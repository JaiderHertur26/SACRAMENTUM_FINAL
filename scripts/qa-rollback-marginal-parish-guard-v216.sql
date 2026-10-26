-- V216 protected cross-parish audit. Every fixture is fictitious, transaction rolled back.
BEGIN;
SET LOCAL statement_timeout='45000ms';
SELECT set_config('qa216.actor',(SELECT u.auth_user_id::text FROM public.user_profiles u JOIN public.parishes p ON p.diocese_id=u.diocese_id WHERE u.role='diocese' AND u.is_active AND upper(u.status)='ACTIVE' AND u.auth_user_id IS NOT NULL AND (SELECT count(*) FROM public.parishes z WHERE z.diocese_id=u.diocese_id AND z.is_operational)>=2 ORDER BY u.auth_user_id LIMIT 1),true);
SELECT set_config('qa216.diocese',(SELECT diocese_id::text FROM public.user_profiles WHERE auth_user_id::text=current_setting('qa216.actor') AND role='diocese' LIMIT 1),true);
SELECT set_config('qa216.pa',(SELECT id::text FROM public.parishes WHERE diocese_id::text=current_setting('qa216.diocese') AND is_operational ORDER BY id LIMIT 1),true);
SELECT set_config('qa216.pb',(SELECT id::text FROM public.parishes WHERE diocese_id::text=current_setting('qa216.diocese') AND is_operational AND id::text<>current_setting('qa216.pa') ORDER BY id LIMIT 1),true);
SELECT set_config('qa216.scope',gen_random_uuid()::text,true);
INSERT INTO public.baptisms(parish_id,nombres,apellidos,celebration_date,status,book_number,folio,number,raw_data)
VALUES
(current_setting('qa216.pa')::uuid,'QA216 A '||current_setting('qa216.scope'),'FICTICIO','2026-10-01','seated','9216','1','1',jsonb_build_object('qa','V216')),
(current_setting('qa216.pb')::uuid,'QA216 B '||current_setting('qa216.scope'),'FICTICIO','2026-10-01','seated','9216','1','1',jsonb_build_object('qa','V216'));
SET LOCAL ROLE authenticated;
DO $run$
DECLARE actor text:=current_setting('qa216.actor');pa uuid:=current_setting('qa216.pa')::uuid;pb uuid:=current_setting('qa216.pb')::uuid;diocese uuid:=current_setting('qa216.diocese')::uuid;
 ba uuid;bb uuid;bc uuid;src text:='QA216-LINK-'||current_setting('qa216.scope');imp int;fail int;remain int; t_a uuid;t_b uuid;n_a uuid;n_b uuid;n_c uuid;v_status text;v_linked_batch uuid;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',actor,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 ba:=public.create_legacy_import_batch('QA216-notes.json','NTBAU002',repeat('a',64),'QA216',pa,diocese,'{}'::jsonb);
 bb:=public.create_legacy_import_batch('QA216-notes.json','NTBAU002',repeat('a',64),'QA216',pb,diocese,'{}'::jsonb);
 PERFORM public.stage_legacy_import_rows(ba,jsonb_build_array(jsonb_build_object('row_number',1,'source_key',src,'target_entity','marginal_note','original_data',jsonb_build_object('qa','V216'),'normalized_data',jsonb_build_object('sacrament_type','bautismo','book_number','9216','folio','1','number','1','content','NOTA SINTÉTICA PARROQUIA A'),'status','valid')));
 PERFORM public.stage_legacy_import_rows(bb,jsonb_build_array(jsonb_build_object('row_number',1,'source_key',src,'target_entity','marginal_note','original_data',jsonb_build_object('qa','V216'),'normalized_data',jsonb_build_object('sacrament_type','bautismo','book_number','9216','folio','1','number','1','content','NOTA SINTÉTICA PARROQUIA B'),'status','valid')));
 SELECT imported,failed,remaining INTO imp,fail,remain FROM public.apply_legacy_marginal_note_batch(ba,10);
 IF imp<>1 OR fail<>0 THEN RAISE EXCEPTION 'V216 unable to create first note % %',imp,fail; END IF;
 SELECT imported,failed,remaining INTO imp,fail,remain FROM public.apply_legacy_marginal_note_batch(bb,10);
 SELECT target_id INTO n_a FROM public.legacy_import_rows WHERE batch_id=ba;
 SELECT target_id INTO n_b FROM public.legacy_import_rows WHERE batch_id=bb;
 SELECT sacrament_id INTO t_a FROM public.marginal_notes WHERE id=n_a;
 SELECT sacrament_id INTO t_b FROM public.marginal_notes WHERE id=n_b;
 SELECT status INTO v_status FROM public.legacy_import_rows WHERE batch_id=bb;
 IF imp<>0 OR fail<>1 OR v_status<>'error' OR n_b IS NOT NULL THEN
  RAISE EXCEPTION 'V216 cross-parish note was not blocked % % % %',imp,fail,v_status,n_b;
 END IF;
 SELECT batch_id INTO v_linked_batch FROM public.legacy_record_links
 WHERE source_key=src AND profile_key='NTBAU002';
 IF v_linked_batch IS DISTINCT FROM ba THEN
  RAISE EXCEPTION 'V216 original note source ownership was overwritten';
 END IF;
 bc:=public.create_legacy_import_batch('QA216-notes-replay.json','NTBAU002',repeat('a',64),'QA216',pa,diocese,'{}'::jsonb);
 PERFORM public.stage_legacy_import_rows(bc,jsonb_build_array(jsonb_build_object(
   'row_number',1,'source_key',src,'target_entity','marginal_note',
   'original_data',jsonb_build_object('qa','V216'),
   'normalized_data',jsonb_build_object('sacrament_type','bautismo','book_number','9216',
     'folio','1','number','1','content','NOTA SINTÉTICA PARROQUIA A'),
   'status','valid')));
 SELECT imported,failed,remaining INTO imp,fail,remain FROM public.apply_legacy_marginal_note_batch(bc,10);
 SELECT target_id INTO n_c FROM public.legacy_import_rows WHERE batch_id=bc;
 SELECT status INTO v_status FROM public.legacy_import_rows WHERE batch_id=bc;
 IF imp<>0 OR fail<>0 OR v_status<>'duplicate' OR n_c IS DISTINCT FROM n_a THEN
   RAISE EXCEPTION 'V216 same-parish idempotency broken % % %',imp,fail,v_status;
 END IF;
 PERFORM set_config('qa216.result',jsonb_build_object(
    'foreign_parish_note_denied',true,'original_provenance_preserved',true,
    'own_parish_duplicate_idempotent',true,'rollback',true)::text,true);
END $run$;
SELECT current_setting('qa216.result')::jsonb AS result;
ROLLBACK;
