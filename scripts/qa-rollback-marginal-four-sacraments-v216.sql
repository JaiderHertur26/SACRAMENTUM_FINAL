-- V216 four-sacrament, cross-parish and idempotency integration test. Always ROLLBACK.
BEGIN;
SET LOCAL statement_timeout='45000ms';
SELECT set_config('qa216.actor',(SELECT u.auth_user_id::text FROM public.user_profiles u JOIN public.parishes p ON p.diocese_id=u.diocese_id WHERE u.role='diocese' AND u.is_active AND upper(u.status)='ACTIVE' AND u.auth_user_id IS NOT NULL AND (SELECT count(*) FROM public.parishes z WHERE z.diocese_id=u.diocese_id AND z.is_operational)>=2 ORDER BY u.auth_user_id LIMIT 1),true);
SELECT set_config('qa216.diocese',(SELECT diocese_id::text FROM public.user_profiles WHERE auth_user_id::text=current_setting('qa216.actor') AND role='diocese' LIMIT 1),true);
SELECT set_config('qa216.pa',(SELECT id::text FROM public.parishes WHERE diocese_id::text=current_setting('qa216.diocese') AND is_operational ORDER BY id LIMIT 1),true);
SELECT set_config('qa216.pb',(SELECT id::text FROM public.parishes WHERE diocese_id::text=current_setting('qa216.diocese') AND is_operational AND id::text<>current_setting('qa216.pa') ORDER BY id LIMIT 1),true);
SELECT set_config('qa216.scope',gen_random_uuid()::text,true);
DO $seed$
DECLARE pa uuid:=current_setting('qa216.pa')::uuid;pb uuid:=current_setting('qa216.pb')::uuid;s text:=current_setting('qa216.scope');
BEGIN
 IF pa IS NULL OR pb IS NULL OR pa=pb THEN RAISE EXCEPTION 'V216 requires two authorized fictional scopes';END IF;
 IF EXISTS(SELECT 1 FROM public.baptisms WHERE parish_id IN (pa,pb) AND book_number='9216' AND folio='1' AND number='1')
 OR EXISTS(SELECT 1 FROM public.confirmations WHERE parish_id IN (pa,pb) AND book_number='9216' AND folio='1' AND number='1')
 OR EXISTS(SELECT 1 FROM public.marriages WHERE parish_id IN (pa,pb) AND book_number='9216' AND folio='1' AND number='1')
 OR EXISTS(SELECT 1 FROM public.funerals WHERE parish_id IN (pa,pb) AND book_number='9216' AND folio='1' AND number='1') THEN
  RAISE EXCEPTION 'QA fixture reference 9216/1/1 already exists. No data changed.';
 END IF;
 INSERT INTO public.baptisms(parish_id,nombres,apellidos,celebration_date,status,book_number,folio,number,raw_data)
 VALUES(pa,'QA216 BA A '||s,'FICTICIO','2026-10-01','seated','9216','1','1',jsonb_build_object('qa','V216')),
       (pb,'QA216 BA B '||s,'FICTICIO','2026-10-01','seated','9216','1','1',jsonb_build_object('qa','V216'));
 INSERT INTO public.confirmations(parish_id,nombres,apellidos,celebration_date,status,book_number,folio,number,raw_data)
 VALUES(pa,'QA216 CO A '||s,'FICTICIO','2026-10-01','seated','9216','1','1',jsonb_build_object('qa','V216')),
       (pb,'QA216 CO B '||s,'FICTICIO','2026-10-01','seated','9216','1','1',jsonb_build_object('qa','V216'));
 INSERT INTO public.marriages(parish_id,celebration_date,status,book_number,folio,number,raw_data)
 VALUES(pa,'2026-10-01','seated','9216','1','1',jsonb_build_object('qa','V216')),
       (pb,'2026-10-01','seated','9216','1','1',jsonb_build_object('qa','V216'));
 INSERT INTO public.funerals(parish_id,nombres,apellidos,fecha_defuncion,status,book_number,folio,number,raw_data)
 VALUES(pa,'QA216 EX A '||s,'FICTICIO','2026-10-01','seated','9216','1','1',jsonb_build_object('qa','V216')),
       (pb,'QA216 EX B '||s,'FICTICIO','2026-10-01','seated','9216','1','1',jsonb_build_object('qa','V216'));
END $seed$;
SET LOCAL ROLE authenticated;
DO $run$
DECLARE actor text:=current_setting('qa216.actor');pa uuid:=current_setting('qa216.pa')::uuid;pb uuid:=current_setting('qa216.pb')::uuid;diocese uuid:=current_setting('qa216.diocese')::uuid;
 profile text;sacrament text;ba uuid;bb uuid;bc uuid;scope_key text;
 n_a uuid;n_b uuid;n_c uuid;v_status text;v_linked_batch uuid;v_target uuid;imp int;fail int;remain int;
 count_passed int:=0;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',actor,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 FOREACH profile IN ARRAY ARRAY['NTBAU002','NTCON001','NTMAT002','NTDEF001'] LOOP
  sacrament:=CASE profile WHEN 'NTBAU002' THEN 'bautismo' WHEN 'NTCON001' THEN 'confirmacion'
   WHEN 'NTMAT002' THEN 'matrimonio' ELSE 'exequias' END;
  scope_key:='QA216-FOUR-'||current_setting('qa216.scope')||'-'||profile;
  ba:=public.create_legacy_import_batch('QA216-four.json',profile,repeat('a',64),'QA216',pa,diocese,'{}'::jsonb);
  bb:=public.create_legacy_import_batch('QA216-four.json',profile,repeat('a',64),'QA216',pb,diocese,'{}'::jsonb);
  PERFORM public.stage_legacy_import_rows(ba,jsonb_build_array(jsonb_build_object('row_number',1,'source_key',scope_key,'target_entity','marginal_note','original_data',jsonb_build_object('qa','V216'),'normalized_data',jsonb_build_object('sacrament_type',sacrament,'book_number','9216','folio','1','number','1','content','QA216 ficticia en parroquia A '||profile),'status','valid')));
  PERFORM public.stage_legacy_import_rows(bb,jsonb_build_array(jsonb_build_object('row_number',1,'source_key',scope_key,'target_entity','marginal_note','original_data',jsonb_build_object('qa','V216'),'normalized_data',jsonb_build_object('sacrament_type',sacrament,'book_number','9216','folio','1','number','1','content','QA216 ficticia en parroquia B '||profile),'status','valid')));
  SELECT imported,failed,remaining INTO imp,fail,remain FROM public.apply_legacy_marginal_note_batch(ba,10);
  IF imp<>1 OR fail<>0 THEN RAISE EXCEPTION 'V216 % could not create owned note % %',profile,imp,fail;END IF;
  SELECT target_id INTO n_a FROM public.legacy_import_rows WHERE batch_id=ba;
  IF NOT EXISTS (SELECT 1 FROM public.marginal_notes WHERE id=n_a AND parish_id=pa AND sacrament_type=sacrament) THEN
   RAISE EXCEPTION 'V216 % note has wrong owner or sacrament',profile;
  END IF;
  SELECT imported,failed,remaining INTO imp,fail,remain FROM public.apply_legacy_marginal_note_batch(bb,10);
  SELECT status,target_id INTO v_status,n_b FROM public.legacy_import_rows WHERE batch_id=bb;
  IF imp<>0 OR fail<>1 OR v_status<>'error' OR n_b IS NOT NULL THEN
   RAISE EXCEPTION 'V216 % foreign-parish note was not rejected',profile;
  END IF;
  SELECT batch_id INTO v_linked_batch FROM public.legacy_record_links
    WHERE source_key=scope_key AND profile_key=profile;
  IF v_linked_batch IS DISTINCT FROM ba THEN RAISE EXCEPTION 'V216 % source overwritten',profile;END IF;
  bc:=public.create_legacy_import_batch('QA216-replay.json',profile,repeat('a',64),'QA216',pa,diocese,'{}'::jsonb);
  PERFORM public.stage_legacy_import_rows(bc,jsonb_build_array(jsonb_build_object('row_number',1,'source_key',scope_key,'target_entity','marginal_note','original_data',jsonb_build_object('qa','V216'),'normalized_data',jsonb_build_object('sacrament_type',sacrament,'book_number','9216','folio','1','number','1','content','QA216 ficticia en parroquia A '||profile),'status','valid')));
  SELECT imported,failed,remaining INTO imp,fail,remain FROM public.apply_legacy_marginal_note_batch(bc,10);
  SELECT status,target_id INTO v_status,n_c FROM public.legacy_import_rows WHERE batch_id=bc;
  IF imp<>0 OR fail<>0 OR v_status<>'duplicate' OR n_c IS DISTINCT FROM n_a THEN
   RAISE EXCEPTION 'V216 % replay was not idempotent',profile;
  END IF;
  count_passed:=count_passed+1;
 END LOOP;
 PERFORM set_config('qa216.result',jsonb_build_object('sacraments_passed',count_passed,'owned_notes_created',4,'foreign_source_rejected',4,'same_parish_replays_idempotent',4,'rollback',true)::text,true);
END $run$;
SELECT current_setting('qa216.result')::jsonb AS result;
ROLLBACK;
