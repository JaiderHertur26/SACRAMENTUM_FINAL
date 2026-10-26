-- V215: reproduce legacy global source-key collision safely, never commit.
BEGIN;
SET LOCAL statement_timeout='45000ms';
SELECT set_config('qa215.actor',(SELECT u.auth_user_id::text FROM public.user_profiles u JOIN public.parishes p ON p.diocese_id=u.diocese_id WHERE u.role='diocese' AND u.is_active IS TRUE AND upper(u.status)='ACTIVE' AND u.auth_user_id IS NOT NULL AND (SELECT count(*) FROM public.parishes z WHERE z.diocese_id=u.diocese_id AND z.is_operational)>=2 ORDER BY u.auth_user_id LIMIT 1),true);
SELECT set_config('qa215.diocese',(SELECT diocese_id::text FROM public.user_profiles WHERE auth_user_id::text=current_setting('qa215.actor') AND role='diocese' LIMIT 1),true);
SELECT set_config('qa215.pa',(SELECT id::text FROM public.parishes WHERE diocese_id::text=current_setting('qa215.diocese') AND is_operational ORDER BY id LIMIT 1),true);
SELECT set_config('qa215.pb',(SELECT id::text FROM public.parishes WHERE diocese_id::text=current_setting('qa215.diocese') AND is_operational AND id::text<>current_setting('qa215.pa') ORDER BY id LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $qa$
DECLARE actor text:=current_setting('qa215.actor');v_diocese uuid:=current_setting('qa215.diocese')::uuid;
pa uuid;pb uuid;ba uuid;bb uuid;source text:='QA215-REPRO-'||gen_random_uuid()::text;
res_a jsonb;res_b jsonb;target_a uuid;target_b uuid; actual_a uuid;actual_b uuid;
BEGIN
 pa:=current_setting('qa215.pa')::uuid;
 pb:=current_setting('qa215.pb')::uuid;
 IF pa IS NULL OR pb IS NULL THEN RAISE EXCEPTION 'V215 requires 2 separate fictional test scopes'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 ba:=public.create_legacy_import_batch('QA215-repro.json','INSMATRI',repeat('a',64),'QA215',pa,v_diocese,'{}');
 bb:=public.create_legacy_import_batch('QA215-repro.json','INSMATRI',repeat('a',64),'QA215',pb,v_diocese,'{}');
 PERFORM public.stage_legacy_import_rows(ba,jsonb_build_array(jsonb_build_object('row_number',1,'source_key',source,'target_entity','pending_marriage','original_data','{}','normalized_data',jsonb_build_object('reported',false,'nombres1','QA215','apellidos1','SYNTHETIC','nombres2','QA215','apellidos2','SYNTHETIC'), 'status','valid')));
 PERFORM public.stage_legacy_import_rows(bb,jsonb_build_array(jsonb_build_object('row_number',1,'source_key',source,'target_entity','pending_marriage','original_data','{}','normalized_data',jsonb_build_object('reported',false,'nombres1','QA215','apellidos1','SYNTHETIC','nombres2','QA215','apellidos2','SYNTHETIC'), 'status','valid')));
 res_a:=public.materialize_pending_legacy_marriages(ba,10);
 res_b:=public.materialize_pending_legacy_marriages(bb,10);
 SELECT target_id INTO target_a FROM public.legacy_import_rows WHERE batch_id=ba;
 SELECT target_id INTO target_b FROM public.legacy_import_rows WHERE batch_id=bb;
 SELECT parish_id INTO actual_a FROM public.pending_marriages WHERE id=target_a;
 SELECT parish_id INTO actual_b FROM public.pending_marriages WHERE id=target_b;
 PERFORM set_config('qa215.collision',jsonb_build_object('first_imported',res_a->>'imported','second_imported',res_b->>'imported','cross_parish_target',target_a=target_b AND actual_b<>pb,'rollback',true)::text,true);
END $qa$;
SELECT current_setting('qa215.collision')::jsonb AS result;
ROLLBACK;
