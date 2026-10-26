-- V214: reproduce false unique linkage from missing identity. Synthetic, rollback.
BEGIN;
SET LOCAL statement_timeout='45000ms';
SELECT set_config('qa214.actor',(
 SELECT u.auth_user_id::text FROM public.user_profiles u JOIN public.parishes p ON p.diocese_id=u.diocese_id
 WHERE u.role='diocese' AND u.is_active IS TRUE AND upper(u.status)='ACTIVE'
 GROUP BY u.auth_user_id,u.diocese_id HAVING count(DISTINCT p.id)>=2 LIMIT 1),true);
SELECT set_config('qa214.diocese',(SELECT u.diocese_id::text FROM public.user_profiles u
 WHERE u.auth_user_id::text=current_setting('qa214.actor') AND u.role='diocese' LIMIT 1),true);
SELECT set_config('qa214.parish',(SELECT id::text FROM public.parishes
 WHERE diocese_id::text=current_setting('qa214.diocese') ORDER BY id LIMIT 1),true);
DO $seed$
DECLARE v_par uuid:=current_setting('qa214.parish')::uuid; scope text:='QA214 NODATE-'||gen_random_uuid()::text;
BEGIN
 PERFORM set_config('qa214.scope',scope,true);
 INSERT INTO public.baptisms(parish_id,nombres,apellidos,status,book_number,folio,number,celebration_date,raw_data)
 VALUES(v_par,scope,'TEST','seated','9215','0001','0001','2026-10-01','{"qa":"V214"}'::jsonb);
 INSERT INTO public.confirmations(parish_id,nombres,apellidos,status,book_number,folio,number,celebration_date,raw_data)
 VALUES(v_par,scope,'TEST','seated','9215','0001','0001','2026-10-01','{"qa":"V214"}'::jsonb);
END $seed$;
SET LOCAL ROLE authenticated;
DO $verify$
DECLARE v_p text;v_batch uuid;v_target text;v_result jsonb;v_links int:=0;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',current_setting('qa214.actor'),true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa214.actor'),'role','authenticated')::text,true);
 FOREACH v_p IN ARRAY ARRAY['INSBAUTI','INSCONFI'] LOOP
  v_target:=CASE WHEN v_p='INSBAUTI' THEN 'pending_baptism' ELSE 'pending_confirmation' END;
  v_batch:=public.create_legacy_import_batch('QA214-identity.json',v_p,repeat('a',64),'synthetic',current_setting('qa214.parish')::uuid,current_setting('qa214.diocese')::uuid,'{}'::jsonb);
  PERFORM public.stage_legacy_import_rows(v_batch,jsonb_build_array(jsonb_build_object(
   'row_number',1,'source_key','QA214-IDENTITY-'||gen_random_uuid(),'target_entity',v_target,
   'original_data','{}'::jsonb,'normalized_data',jsonb_build_object('names',current_setting('qa214.scope'),'last_names','TEST','reported',true),
   'status','valid')));
  v_result:=public.materialize_pending_legacy_sacramental_records(v_batch,20);
  SELECT count(*) INTO v_links FROM public.legacy_import_rows WHERE batch_id=v_batch AND status='imported' AND target_id IS NOT NULL;
  IF (v_result->>'reconciled')::int<>0 OR (v_result->>'reviewed')::int<>1 OR v_links<>0 OR
   NOT EXISTS(SELECT 1 FROM public.legacy_import_rows WHERE batch_id=v_batch AND status='review' AND 'REPORTED_IDENTITY_INSUFFICIENT'=ANY(issue_codes)) THEN
   RAISE EXCEPTION 'V214 insufficient identity not sent to review %: %',v_p,v_result;
  END IF;
 END LOOP;
 PERFORM set_config('qa214.repro','{"insufficient_identity_sent_to_review":2,"incorrect_links":0,"rolled_back":true}'::text,true);
END $verify$;
SELECT current_setting('qa214.repro')::jsonb AS result;
ROLLBACK;
