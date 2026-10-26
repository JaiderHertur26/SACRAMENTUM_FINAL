-- V213: fully reversible QA, never commit.
BEGIN;
SET LOCAL statement_timeout='45000ms';
SELECT set_config('qa213.diocese_actor',(
 SELECT u.auth_user_id::text FROM public.user_profiles u JOIN public.parishes p ON p.diocese_id=u.diocese_id
 WHERE u.role='diocese' AND u.is_active IS TRUE AND upper(u.status)='ACTIVE' AND u.auth_user_id IS NOT NULL
 ORDER BY u.auth_user_id LIMIT 1),true);
SELECT set_config('qa213.parish',(
 SELECT p.id::text FROM public.user_profiles u JOIN public.parishes p ON p.diocese_id=u.diocese_id
 WHERE u.role='diocese' AND u.auth_user_id::text=current_setting('qa213.diocese_actor')
 AND p.is_operational IS TRUE ORDER BY p.id LIMIT 1),true);
SELECT set_config('qa213.diocese',(
 SELECT diocese_id::text FROM public.parishes WHERE id::text=current_setting('qa213.parish')),true);
SET LOCAL ROLE authenticated;
DO $qa$
DECLARE v_profile text;v_type text;v_batch uuid;v_parish uuid:=current_setting('qa213.parish')::uuid;
v_scope text:=gen_random_uuid()::text;v_report jsonb;v_pending integer;v_review integer;v_imported integer;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',current_setting('qa213.diocese_actor'),true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa213.diocese_actor'),'role','authenticated')::text,true);
 FOREACH v_profile IN ARRAY ARRAY['INSBAUTI','INSCONFI'] LOOP
  v_type:=CASE WHEN v_profile='INSBAUTI' THEN 'pending_baptism' ELSE 'pending_confirmation' END;
  v_batch:=public.create_legacy_import_batch('QA213-'||v_profile||'.json',v_profile,repeat('a',64),'V213 synthetic',v_parish,current_setting('qa213.diocese')::uuid,jsonb_build_object('qa_protocol','V213','scope',v_scope));
  PERFORM public.stage_legacy_import_rows(v_batch,jsonb_build_array(
    jsonb_build_object('row_number',1,'source_key','QA213-'||v_scope||'-'||v_profile||'-pending','target_entity',v_type,'original_data',jsonb_build_object('reported',false,'nombres','QA213'), 'normalized_data',jsonb_build_object('reported',false,'names','QA213 PENDIENTE '||v_scope,'last_names','PRUEBA','legacy_entry_number','2131','inscription_date','2026-10-20'), 'status','valid','issue_codes',jsonb_build_array('LEGACY_BOLETA_NOT_SEATED')),
    jsonb_build_object('row_number',2,'source_key','QA213-'||v_scope||'-'||v_profile||'-reported','target_entity',v_type,'original_data',jsonb_build_object('reported',true,'nombres','QA213'), 'normalized_data',jsonb_build_object('reported',true,'names','QA213 REPORTADA '||v_scope,'last_names','PRUEBA','legacy_entry_number','2132','celebration_date','2026-10-20'), 'status','valid','issue_codes',jsonb_build_array('LEGACY_BOLETA_REPORTED'))
  ));
  v_report:=public.materialize_pending_legacy_sacramental_records(v_batch,20);
  IF (v_report->>'imported')::int<>1 OR (v_report->>'reviewed')::int<>1 OR (v_report->>'reconciled')::int<>0 OR (v_report->>'remaining')::int<>0 THEN RAISE EXCEPTION 'V213 unexpected counts % %',v_profile,v_report;END IF;
  SELECT count(*) FILTER (WHERE status='imported'),count(*) FILTER (WHERE status='review') INTO v_imported,v_review FROM public.legacy_import_rows WHERE batch_id=v_batch;
  IF v_imported<>1 OR v_review<>1 THEN RAISE EXCEPTION 'V213 row status mismatch % %',v_imported,v_review;END IF;
  IF v_profile='INSBAUTI' THEN SELECT count(*) INTO v_pending FROM public.pending_baptisms WHERE id IN (SELECT target_id FROM public.legacy_import_rows WHERE batch_id=v_batch AND status='imported');
  ELSE SELECT count(*) INTO v_pending FROM public.pending_confirmations WHERE id IN (SELECT target_id FROM public.legacy_import_rows WHERE batch_id=v_batch AND status='imported');END IF;
  IF v_pending<>1 THEN RAISE EXCEPTION 'V213 absent pending %',v_profile; END IF;
 END LOOP;
 PERFORM set_config('qa213.result',jsonb_build_object('profiles_passed',2,'pending_created',2,'reported_review',2,'reconciled',0,'rolled_back',true)::text,true);
END $qa$;
SELECT current_setting('qa213.result')::jsonb AS result;
ROLLBACK;
