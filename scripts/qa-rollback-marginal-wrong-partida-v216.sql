-- V216 verifies note source key cannot be reassigned to another partida in the SAME parish.
BEGIN;
SET LOCAL statement_timeout='45000ms';
SELECT set_config('qa216.actor',(SELECT u.auth_user_id::text FROM public.user_profiles u JOIN public.parishes p ON p.diocese_id=u.diocese_id WHERE u.role='diocese' AND u.is_active AND upper(u.status)='ACTIVE' AND u.auth_user_id IS NOT NULL ORDER BY u.auth_user_id LIMIT 1),true);
SELECT set_config('qa216.diocese',(SELECT diocese_id::text FROM public.user_profiles WHERE auth_user_id::text=current_setting('qa216.actor') AND role='diocese' LIMIT 1),true);
SELECT set_config('qa216.pa',(SELECT id::text FROM public.parishes WHERE diocese_id::text=current_setting('qa216.diocese') AND is_operational ORDER BY id LIMIT 1),true);
SELECT set_config('qa216.scope',gen_random_uuid()::text,true);
DO $seed$
DECLARE pa uuid:=current_setting('qa216.pa')::uuid;s text:=current_setting('qa216.scope');
BEGIN
 IF EXISTS (SELECT 1 FROM public.baptisms WHERE parish_id=pa AND book_number='9216' AND folio='2' AND number IN ('1','2')) THEN
   RAISE EXCEPTION 'V216 QA reference already present; abort safely';
 END IF;
 INSERT INTO public.baptisms(parish_id,nombres,apellidos,celebration_date,status,book_number,folio,number,raw_data)
 VALUES(pa,'QA216 Original '||s,'FICTICIO','2026-10-01','seated','9216','2','1',jsonb_build_object('qa','V216')),
       (pa,'QA216 Another '||s,'FICTICIO','2026-10-01','seated','9216','2','2',jsonb_build_object('qa','V216'));
END $seed$;
SET LOCAL ROLE authenticated;
DO $qa$
DECLARE pa uuid:=current_setting('qa216.pa')::uuid;diocese uuid:=current_setting('qa216.diocese')::uuid;
 a uuid;b uuid;origin uuid;referent uuid;previous_note uuid;profile text:='NTBAU002';
 key text:='QA216-SAME-PARISH-'||current_setting('qa216.scope');
 imp int;v_failed int;v_remaining int;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',current_setting('qa216.actor'),true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa216.actor'),'role','authenticated')::text,true);
 a:=public.create_legacy_import_batch('QA216-same-parish.json',profile,repeat('a',64),'QA216',pa,diocese,'{}');
 b:=public.create_legacy_import_batch('QA216-same-parish-other-partida.json',profile,repeat('a',64),'QA216',pa,diocese,'{}');
 PERFORM public.stage_legacy_import_rows(a,jsonb_build_array(jsonb_build_object('row_number',1,'source_key',key,'target_entity','marginal_note','original_data','{}'::jsonb,'normalized_data',jsonb_build_object('sacrament_type','bautismo','book_number','9216','folio','2','number','1','content','QA216 nota inicial'),'status','valid')));
 PERFORM public.stage_legacy_import_rows(b,jsonb_build_array(jsonb_build_object('row_number',1,'source_key',key,'target_entity','marginal_note','original_data','{}'::jsonb,'normalized_data',jsonb_build_object('sacrament_type','bautismo','book_number','9216','folio','2','number','2','content','QA216 nota para otro folio'),'status','valid')));
 SELECT imported,failed,remaining INTO imp,v_failed,v_remaining FROM public.apply_legacy_marginal_note_batch(a,10);
 IF imp<>1 OR v_failed<>0 THEN RAISE EXCEPTION 'V216 original note not created'; END IF;
 SELECT target_id INTO previous_note FROM public.legacy_import_rows WHERE batch_id=a;
 SELECT imported,failed,remaining INTO imp,v_failed,v_remaining FROM public.apply_legacy_marginal_note_batch(b,10);
 IF imp<>0 OR v_failed<>1 OR EXISTS(
  SELECT 1 FROM public.legacy_import_rows WHERE batch_id=b AND (status<>'error' OR target_id IS NOT NULL)
 ) OR NOT EXISTS(
  SELECT 1 FROM public.legacy_record_links WHERE source_key=key AND batch_id=a AND target_id=previous_note
 ) OR (SELECT count(*) FROM public.marginal_notes WHERE parish_id=pa AND source_type='legacy_import' AND legacy_source->>'source_key'=key)<>1 THEN
  RAISE EXCEPTION 'V216 wrong same-parish partida was not blocked (% imported, % failed)',imp,v_failed;
 END IF;
 PERFORM set_config('qa216.result',jsonb_build_object('wrong_partida_rejected',true,'original_note_preserved',true,'wrong_note_created',false,'rollback',true)::text,true);
END $qa$;
SELECT current_setting('qa216.result')::jsonb AS result;
ROLLBACK;
