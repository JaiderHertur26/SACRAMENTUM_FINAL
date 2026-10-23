-- V168 · Single-transaction end-to-end QA of TWO independent later marginal notes.
-- Fixture is exclusively fictitious. No data is committed.
BEGIN;
DO $fixture$
DECLARE d uuid;c uuid;a uuid;p uuid;decree uuid;part uuid;note1 uuid;note2 uuid;case1 uuid;case2 uuid;
BEGIN
 SELECT diocese_id,auth_user_id INTO STRICT d,c FROM public.user_profiles
 WHERE role='chancery' AND is_active LIMIT 1;
 SELECT auth_user_id INTO STRICT a FROM public.user_profiles
 WHERE role='diocese' AND is_active AND diocese_id=d LIMIT 1;
 SELECT id INTO STRICT p FROM public.parishes WHERE diocese_id=d AND is_operational LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',c::text,true);
 SELECT decree_id,marriage_id INTO STRICT decree,part FROM
 public.create_marriage_reposition_by_decree(p,current_date,
 'Reposición de prueba con dos notas manuales independientes',
 jsonb_build_object('novioNombres','QA','novioApellidos','V168',
   'noviaNombres','QA','noviaApellidos','V168','fechaMatrimonio','2020-01-01'),
 jsonb_build_object('type','archivo','reference','QA-V168-MULTINOTA',
   'issuer','QA','description','Ficción exclusivamente transaccional'),
 'QA-V168-'||left(gen_random_uuid()::text,8));
 SELECT public.create_manual_marginal_note(p,'matrimonio',part,
 'QA V168 PRIMERA NOTA MANUAL INDEPENDIENTE DEL ACTA') INTO note1;
 SELECT public.create_manual_marginal_note(p,'matrimonio',part,
 'QA V168 SEGUNDA NOTA MANUAL INDEPENDIENTE DEL ACTA') INTO note2;
 SELECT public.request_later_note_reconciliation_v156(decree,note1,
 'Se solicita conciliación de nota primera por la documentación original ficticia.',
 'ARCHIVO MULTINOTA V168 UNO') INTO case1;
 SELECT public.request_later_note_reconciliation_v156(decree,note2,
 'Se solicita conciliación de nota segunda por la documentación original ficticia.',
 'ARCHIVO MULTINOTA V168 DOS') INTO case2;
 PERFORM set_config('qa168.actor_chancery',c::text,true);
 PERFORM set_config('qa168.actor_diocese',a::text,true);
 PERFORM set_config('qa168.decree',decree::text,true);
 PERFORM set_config('qa168.part',part::text,true);
 PERFORM set_config('qa168.note1',note1::text,true);
 PERFORM set_config('qa168.note2',note2::text,true);
 PERFORM set_config('qa168.case1',case1::text,true);
 PERFORM set_config('qa168.case2',case2::text,true);
END $fixture$;
SET LOCAL ROLE authenticated;
DO $checks$
DECLARE c uuid:=current_setting('qa168.actor_chancery')::uuid;
 a uuid:=current_setting('qa168.actor_diocese')::uuid;
 decree uuid:=current_setting('qa168.decree')::uuid;
 part uuid:=current_setting('qa168.part')::uuid;
 n1 uuid:=current_setting('qa168.note1')::uuid;
 n2 uuid:=current_setting('qa168.note2')::uuid;
 k1 uuid:=current_setting('qa168.case1')::uuid;
 k2 uuid:=current_setting('qa168.case2')::uuid;
 out jsonb;
 denied integer:=0;
 count_actual integer;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',c::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
 BEGIN
  PERFORM public.execute_later_note_reconciliation_batch_v168(ARRAY[k1,k2]);
  RAISE EXCEPTION 'V168 unapproved cases executed';
 EXCEPTION WHEN insufficient_privilege THEN denied:=denied+1;END;
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 PERFORM public.approve_later_note_reconciliation_v156(k1,
  'AUTORIZACIÓN INSTITUCIONAL V168 UNO',
  'Se autoriza la primera conciliación ficticia con independencia institucional.');
 PERFORM public.approve_later_note_reconciliation_v156(k2,
  'AUTORIZACIÓN INSTITUCIONAL V168 DOS',
  'Se autoriza la segunda conciliación ficticia con independencia institucional.');
 BEGIN
  PERFORM public.execute_later_note_reconciliation_batch_v168(ARRAY[k1,k2]);
  RAISE EXCEPTION 'V168 diocese executed chancery operation';
 EXCEPTION WHEN insufficient_privilege THEN denied:=denied+1;END;
 PERFORM set_config('request.jwt.claim.sub',c::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
 BEGIN
  PERFORM public.execute_later_note_reconciliation_v156(k1);
  RAISE EXCEPTION 'V168 legacy single case bypassed active second note';
 EXCEPTION WHEN check_violation THEN denied:=denied+1;END;
 BEGIN
  PERFORM public.execute_later_note_reconciliation_batch_v168(ARRAY[k1]);
  RAISE EXCEPTION 'V168 single case accepted';
 EXCEPTION WHEN invalid_parameter_value THEN denied:=denied+1;END;
 BEGIN
  PERFORM public.execute_later_note_reconciliation_batch_v168(ARRAY[k1,k1]);
  RAISE EXCEPTION 'V168 duplicate case accepted';
 EXCEPTION WHEN invalid_parameter_value THEN denied:=denied+1;END;
 BEGIN
  PERFORM public.execute_later_note_reconciliation_batch_v168(ARRAY[k1,k2,gen_random_uuid()]);
  RAISE EXCEPTION 'V168 unknown case accepted';
 EXCEPTION WHEN insufficient_privilege THEN denied:=denied+1;END;
 SELECT public.execute_later_note_reconciliation_batch_v168(ARRAY[k1,k2]) INTO out;
 IF out->>'status' IS DISTINCT FROM 'executed'
   OR (out->>'case_count')::integer IS DISTINCT FROM 2
   OR out->>'decree_status' IS DISTINCT FROM 'reversed'
 THEN RAISE EXCEPTION 'V168 result status/count invalid';END IF;
 IF (SELECT status FROM public.decretos WHERE id=decree)<>'reversed'
  OR (SELECT status FROM public.marginal_notes WHERE id=n1)<>'reversed'
  OR (SELECT status FROM public.marginal_notes WHERE id=n2)<>'reversed'
  OR (SELECT status FROM public.later_note_reconciliations_v156 WHERE id=k1)<>'executed'
  OR (SELECT status FROM public.later_note_reconciliations_v156 WHERE id=k2)<>'executed'
  OR (SELECT status FROM public.marriages WHERE id=part)<>'reversed'
 THEN RAISE EXCEPTION 'V168 atomic state consistency failed';END IF;
 SELECT count(*) INTO count_actual FROM public.registry_audit_log
 WHERE entity_type='marginal_note_reconciliation' AND entity_id IN(k1,k2);
 IF count_actual<>6 THEN RAISE EXCEPTION 'V168 expected 6 request/approval/execution audits, got %',count_actual;END IF;
 SELECT count(*) INTO count_actual FROM public.official_notifications
 WHERE decree_id=decree AND category='decree_reconciliation'
 AND payload->>'batch_v168'='true';
 IF count_actual<>1 THEN RAISE EXCEPTION 'V168 expected one consolidated notification, got %',count_actual;END IF;
 BEGIN
  PERFORM public.execute_later_note_reconciliation_batch_v168(ARRAY[k1,k2]);
  RAISE EXCEPTION 'V168 duplicate batch succeeded';
 EXCEPTION WHEN insufficient_privilege THEN denied:=denied+1;END;
 IF denied<>7 THEN RAISE EXCEPTION 'V168 expected 7 denials, got %',denied;END IF;
END $checks$;
RESET ROLE;
ROLLBACK;