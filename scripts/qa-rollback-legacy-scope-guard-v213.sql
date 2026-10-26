-- V213: verify protected legacy key under one cross-parish and one same-parish attempt. Never commit.
BEGIN;
SET LOCAL statement_timeout='45000ms';
SELECT set_config('qa213.actor',(SELECT u.auth_user_id::text FROM public.user_profiles u JOIN public.parishes p ON p.diocese_id=u.diocese_id WHERE u.role='diocese' AND u.is_active IS TRUE AND upper(u.status)='ACTIVE' AND u.auth_user_id IS NOT NULL AND (SELECT count(*) FROM public.parishes z WHERE z.diocese_id=u.diocese_id AND z.is_operational)>=2 ORDER BY u.auth_user_id LIMIT 1),true);
SELECT set_config('qa213.diocese',(SELECT diocese_id::text FROM public.user_profiles WHERE auth_user_id::text=current_setting('qa213.actor') AND role='diocese' LIMIT 1),true);
SELECT set_config('qa213.pa',(SELECT id::text FROM public.parishes WHERE diocese_id::text=current_setting('qa213.diocese') AND is_operational ORDER BY id LIMIT 1),true);
SELECT set_config('qa213.pb',(SELECT id::text FROM public.parishes WHERE diocese_id::text=current_setting('qa213.diocese') AND is_operational AND id::text<>current_setting('qa213.pa') ORDER BY id LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $qa$
DECLARE actor text:=current_setting('qa213.actor');v_diocese uuid:=current_setting('qa213.diocese')::uuid;
pa uuid;pb uuid;ba uuid;bb uuid;source text:='QA213-REPRO-'||gen_random_uuid()::text;
res_a jsonb;res_b jsonb;res_c jsonb;target_a uuid;target_b uuid; target_c uuid; actual_a uuid;actual_b uuid;bc uuid;denial text;
BEGIN
 pa:=current_setting('qa213.pa')::uuid;
 pb:=current_setting('qa213.pb')::uuid;
 IF pa IS NULL OR pb IS NULL THEN RAISE EXCEPTION 'V213 requires 2 separate fictional test scopes'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 ba:=public.create_legacy_import_batch('QA213-repro.json','INSBAUTI',repeat('a',64),'QA213',pa,v_diocese,'{}');
 bb:=public.create_legacy_import_batch('QA213-repro.json','INSBAUTI',repeat('a',64),'QA213',pb,v_diocese,'{}');
 PERFORM public.stage_legacy_import_rows(ba,jsonb_build_array(jsonb_build_object('row_number',1,'source_key',source,'target_entity','pending_baptism','original_data','{}','normalized_data',jsonb_build_object('reported',false,'names','QA213','last_names','SYNTHETIC'), 'status','valid')));
 PERFORM public.stage_legacy_import_rows(bb,jsonb_build_array(jsonb_build_object('row_number',1,'source_key',source,'target_entity','pending_baptism','original_data','{}','normalized_data',jsonb_build_object('reported',false,'names','QA213','last_names','SYNTHETIC'), 'status','valid')));
 res_a:=public.materialize_pending_legacy_sacramental_records(ba,10);
 BEGIN
  res_b:=public.materialize_pending_legacy_sacramental_records(bb,10);
  RAISE EXCEPTION 'V213_UNSAFE foreign source silently accepted';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS denial=MESSAGE_TEXT;
  IF denial LIKE 'V213_UNSAFE%' THEN RAISE; END IF;
  IF denial NOT LIKE 'Clave histórica vinculada a otra parroquia%' THEN
    RAISE EXCEPTION 'V213 unexpected denial: %',denial;
  END IF;
 END;
 bc:=public.create_legacy_import_batch('QA213-replay.json','INSBAUTI',repeat('a',64),'QA213',pa,v_diocese,'{}');
 PERFORM public.stage_legacy_import_rows(bc,jsonb_build_array(jsonb_build_object(
  'row_number',1,'source_key',source,'target_entity','pending_baptism',
  'original_data','{}','normalized_data',jsonb_build_object('reported',false,'names','QA213','last_names','SYNTHETIC'),'status','valid')));
 res_c:=public.materialize_pending_legacy_sacramental_records(bc,10);
 SELECT target_id INTO target_c FROM public.legacy_import_rows WHERE batch_id=bc;
 SELECT target_id INTO target_a FROM public.legacy_import_rows WHERE batch_id=ba;
 SELECT target_id INTO target_b FROM public.legacy_import_rows WHERE batch_id=bb;
 SELECT parish_id INTO actual_a FROM public.pending_baptisms WHERE id=target_a;
 SELECT parish_id INTO actual_b FROM public.pending_baptisms WHERE id=target_b;
 IF target_b IS NOT NULL OR target_c IS DISTINCT FROM target_a
    OR (res_c->>'imported')::int<>0
    OR NOT EXISTS(SELECT 1 FROM public.legacy_import_rows WHERE batch_id=bb AND status='valid')
    OR actual_a IS DISTINCT FROM pa THEN
  RAISE EXCEPTION 'V213 protected key regression';
 END IF;
 PERFORM set_config('qa213.collision',jsonb_build_object(
  'foreign_attempt_denied',true,'source_link_unchanged',true,
  'same_parish_duplicate_reused',true,'rollback',true)::text,true);
END $qa$;
SELECT current_setting('qa213.collision')::jsonb AS result;
ROLLBACK;
