-- V215 marriage reported without celebration date matches by names alone; all QA is rolled back.
BEGIN;
SET LOCAL statement_timeout='45000ms';
SELECT set_config('qa215.actor',(SELECT u.auth_user_id::text FROM public.user_profiles u JOIN public.parishes p ON p.diocese_id=u.diocese_id WHERE u.role='diocese' AND u.is_active IS TRUE AND upper(u.status)='ACTIVE' AND u.auth_user_id IS NOT NULL ORDER BY u.auth_user_id LIMIT 1),true);
SELECT set_config('qa215.diocese',(SELECT diocese_id::text FROM public.user_profiles WHERE auth_user_id::text=current_setting('qa215.actor') AND role='diocese' LIMIT 1),true);
SELECT set_config('qa215.pa',(SELECT id::text FROM public.parishes WHERE diocese_id::text=current_setting('qa215.diocese') AND is_operational ORDER BY id LIMIT 1),true);
SELECT set_config('qa215.tag',gen_random_uuid()::text,true);
INSERT INTO public.marriages(parish_id,celebration_date,status,raw_data,book_number,folio,number)
VALUES(current_setting('qa215.pa')::uuid,'2026-10-01','seated',jsonb_build_object('novioNombres','QA215G-'||current_setting('qa215.tag'),'novioApellidos','FICTICIO','noviaNombres','QA215B-'||current_setting('qa215.tag'),'noviaApellidos','FICTICIA','qa','V215'),'9215','1','1');
SET LOCAL ROLE authenticated;
DO $qa$
DECLARE batch uuid;v_report jsonb;v_status text;v_link_count int;v_tag text:=current_setting('qa215.tag');
BEGIN
 PERFORM set_config('request.jwt.claim.sub',current_setting('qa215.actor'),true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa215.actor'),'role','authenticated')::text,true);
 batch:=public.create_legacy_import_batch('QA215-marriage-reported.json','INSMATRI',repeat('a',64),'QA215',current_setting('qa215.pa')::uuid,current_setting('qa215.diocese')::uuid,'{}');
 PERFORM public.stage_legacy_import_rows(batch,jsonb_build_array(jsonb_build_object(
  'row_number',1,'source_key','QA215-REPORTED-'||v_tag,'target_entity','pending_marriage',
  'original_data','{}'::jsonb,'normalized_data',jsonb_build_object('reported',true,
    'nombres1','QA215G-'||v_tag,'apellidos1','FICTICIO','nombres2','QA215B-'||v_tag,'apellidos2','FICTICIA'),
  'status','valid')));
 v_report:=public.materialize_pending_legacy_marriages(batch,10);
 SELECT status INTO v_status FROM public.legacy_import_rows WHERE batch_id=batch;
 SELECT count(*) INTO v_link_count FROM public.legacy_record_links WHERE batch_id=batch;
 IF (v_report->>'reconciled')::int<>1 OR v_status<>'imported' OR v_link_count<>1 THEN
  RAISE EXCEPTION 'V215 original missing-date vulnerability was not observed: %',v_report;
 END IF;
 PERFORM set_config('qa215.result',jsonb_build_object('unsafe_reported_link_created',true,'rollback',true)::text,true);
END $qa$;
SELECT current_setting('qa215.result')::jsonb AS result;
ROLLBACK;
