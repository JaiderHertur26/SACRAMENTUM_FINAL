-- V157 · Verified institutional rejection/revocation under authenticated role.
-- Created records are fictional and ALWAYS reverted, including audit entries.
BEGIN;
DO $fixture$
DECLARE
 v_chancery uuid;v_diocese uuid;v_parish_user uuid;v_parish uuid;
 v_decree uuid;v_record uuid;v_note uuid;v_case uuid;
BEGIN
 SELECT diocese_id,auth_user_id INTO STRICT v_diocese,v_chancery
 FROM public.user_profiles WHERE role='chancery' AND is_active LIMIT 1;
 SELECT auth_user_id INTO STRICT v_parish_user
 FROM public.user_profiles WHERE role='parish' AND diocese_id=v_diocese AND is_active LIMIT 1;
 SELECT id INTO STRICT v_parish FROM public.parishes
 WHERE diocese_id=v_diocese AND is_operational ORDER BY id LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',v_chancery::text,true);
 SELECT decree_id,marriage_id INTO STRICT v_decree,v_record
 FROM public.create_marriage_reposition_by_decree(v_parish,current_date,
 'V157 recuperación ficticia del acta matrimonial previa',
 jsonb_build_object('novioNombres','QA','novioApellidos','UNO',
 'noviaNombres','QA','noviaApellidos','DOS','fechaMatrimonio','2020-01-01'),
 jsonb_build_object('type','archivo','reference','QA-V157-ARCHIVO',
 'issuer','QA','description','Ficción transaccional reversible'),
 'QA-V157-'||left(gen_random_uuid()::text,8));
 SELECT public.create_manual_marginal_note(v_parish,'matrimonio',v_record,
 'NOTA MANUAL FICTICIA QA-V157 PARA PROBAR DENEGACIONES') INTO v_note;
 SELECT public.request_later_note_reconciliation_v156(
 v_decree,v_note,
 'Solicito conciliación documental ficticia, sujeta a autorización diocesana independiente.',
 'ARCHIVO INSTITUCIONAL QA V157') INTO v_case;
 PERFORM set_config('qa.v157.case1',v_case::text,true);
 PERFORM set_config('qa.v157.decree',v_decree::text,true);
 PERFORM set_config('qa.v157.note',v_note::text,true);
 PERFORM set_config('qa.v157.chancery',v_chancery::text,true);
 PERFORM set_config('qa.v157.parish',v_parish_user::text,true);
 PERFORM set_config('qa.v157.diocese',v_diocese::text,true);
 PERFORM set_config('qa.v157.diocese_actor',(
 SELECT auth_user_id::text FROM public.user_profiles
 WHERE role='diocese' AND diocese_id=v_diocese AND is_active LIMIT 1),true);
END $fixture$;

SET LOCAL ROLE authenticated;
DO $qa$
DECLARE
 v_first uuid:=current_setting('qa.v157.case1')::uuid;
 v_decree uuid:=current_setting('qa.v157.decree')::uuid;
 v_note uuid:=current_setting('qa.v157.note')::uuid;
 v_chancery uuid:=current_setting('qa.v157.chancery')::uuid;
 v_parish uuid:=current_setting('qa.v157.parish')::uuid;
 v_diocese uuid:=current_setting('qa.v157.diocese')::uuid;
 v_dio_actor uuid:=current_setting('qa.v157.diocese_actor')::uuid;
 v_case2 uuid;v_case3 uuid;v_result jsonb;
 v_denied integer:=0;v_count integer;v_msg text;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',v_chancery::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_chancery,'role','authenticated')::text,true);
 BEGIN
  PERFORM public.reject_later_note_reconciliation_v157(v_first,'REF QA V157',
   'Cancillería no puede rechazar su propia solicitud.');
  RAISE EXCEPTION 'V157-FAIL chancery rejected';
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=v_denied+1;END;
 PERFORM set_config('request.jwt.claim.sub',v_parish::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_parish,'role','authenticated')::text,true);
 BEGIN
  PERFORM public.reject_later_note_reconciliation_v157(v_first,'REF QA V157',
   'Parroquia no tiene facultad de rechazo diocesano.');
  RAISE EXCEPTION 'V157-FAIL parish rejected';
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=v_denied+1;END;
 PERFORM set_config('request.jwt.claim.sub',v_dio_actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_dio_actor,'role','authenticated')::text,true);
 SELECT public.reject_later_note_reconciliation_v157(v_first,'RECHAZO-OBISPO-QA-V157',
  'Diócesis rechaza formalmente esta conciliación ficticia sin alterar partida.')
 INTO v_result;
 IF v_result->>'status' IS DISTINCT FROM 'rejected'
 OR v_result->>'previous_status' IS DISTINCT FROM 'pending'
 THEN RAISE EXCEPTION 'V157-FAIL invalid initial rejection';END IF;
 SELECT count(*) INTO v_count FROM public.list_later_note_reconciliations_v157(v_diocese)
 WHERE id=v_first AND status='rejected'
 AND rejection_reference='RECHAZO-OBISPO-QA-V157'
 AND rejection_reason LIKE 'Diócesis rechaza%'
 AND rejected_by=v_dio_actor;
 IF v_count<>1 THEN RAISE EXCEPTION 'V157-FAIL rejection not in scoped list';END IF;
 PERFORM set_config('request.jwt.claim.sub',v_chancery::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_chancery,'role','authenticated')::text,true);
 SELECT public.request_later_note_reconciliation_v156(
 v_decree,v_note,
 'Nueva solicitud revisada en laboratorio después del rechazo institucional anterior.',
 'ARCHIVO DE SOPORTE QA V157 NUEVO') INTO v_case2;
 PERFORM set_config('qa.v157.case2',v_case2::text,true);
 PERFORM set_config('request.jwt.claim.sub',v_dio_actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_dio_actor,'role','authenticated')::text,true);
 PERFORM public.approve_later_note_reconciliation_v156(v_case2,
  'AUTORIZACION DIÓCESIS QA V157',
  'Verificación independiente de referencia ficticia registrada en expediente.');
 SELECT public.reject_later_note_reconciliation_v157(v_case2,'REVOCACIÓN QA-V157',
  'La autorización previa se revoca expresamente antes de ejecutar la reversión.')
 INTO v_result;
 IF v_result->>'previous_status' IS DISTINCT FROM 'authorized'
 THEN RAISE EXCEPTION 'V157-FAIL authorized-case revocation';END IF;
 PERFORM set_config('request.jwt.claim.sub',v_chancery::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_chancery,'role','authenticated')::text,true);
 BEGIN
  PERFORM public.execute_later_note_reconciliation_v156(v_case2);
  RAISE EXCEPTION 'V157-FAIL executed revoked authorization';
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=v_denied+1; END;
 SELECT public.request_later_note_reconciliation_v156(v_decree,v_note,
 'Tercera solicitud de ensayo al haberse cerrado el expediente anterior de forma formal.',
 'NUEVA FUENTE QA V157 TERCERA') INTO v_case3;
 PERFORM set_config('qa.v157.case3',v_case3::text,true);
 PERFORM set_config('request.jwt.claim.sub',v_dio_actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_dio_actor,'role','authenticated')::text,true);
 BEGIN
  PERFORM public.reject_later_note_reconciliation_v157(v_first,'REPETICIÓN-QA-V157',
    'Rechazo de expediente ya cerrado debe estar expresamente impedido.');
  RAISE EXCEPTION 'V157-FAIL double rejection';
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=v_denied+1;END;
 BEGIN
  PERFORM public.reject_later_note_reconciliation_v157(v_case3,'CORTO','Breve');
  RAISE EXCEPTION 'V157-FAIL short reasons accepted';
 EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1;END;
 IF v_denied<>5 THEN RAISE EXCEPTION 'V157-FAIL denied case count %',v_denied;END IF;
 SELECT count(*) INTO v_count FROM public.list_later_note_reconciliations_v157(v_diocese)
 WHERE id IN (v_first,v_case2,v_case3);
 IF v_count<>3 THEN RAISE EXCEPTION 'V157-FAIL missing reopened cases';END IF;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000157',true);
 PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000157","role":"authenticated"}',true);
 BEGIN
  SELECT count(*) INTO v_count FROM public.list_later_note_reconciliations_v157(v_diocese);
  RAISE EXCEPTION 'V157-FAIL unprofiled actor listed';
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=v_denied+1;END;
 IF v_denied<>6 THEN RAISE EXCEPTION 'V157-FAIL final denial count %',v_denied;END IF;
END $qa$;
RESET ROLE;

DO $verify$
DECLARE v_first uuid:=current_setting('qa.v157.case1')::uuid;
 v_case2 uuid:=current_setting('qa.v157.case2')::uuid;
 v_case3 uuid:=current_setting('qa.v157.case3')::uuid;
 v_decree uuid:=current_setting('qa.v157.decree')::uuid;
 v_note uuid:=current_setting('qa.v157.note')::uuid;
 v_count integer;
BEGIN
 IF (SELECT status FROM public.decretos WHERE id=v_decree) IS DISTINCT FROM 'active'
 OR (SELECT status FROM public.marginal_notes WHERE id=v_note) IS DISTINCT FROM 'active'
 THEN RAISE EXCEPTION 'V157-FAIL reject mutated decree or marginal note';END IF;
 IF (SELECT status FROM public.later_note_reconciliations_v156 WHERE id=v_first) IS DISTINCT FROM 'rejected'
 OR (SELECT status FROM public.later_note_reconciliations_v156 WHERE id=v_case2) IS DISTINCT FROM 'rejected'
 OR (SELECT status FROM public.later_note_reconciliations_v156 WHERE id=v_case3) IS DISTINCT FROM 'pending'
 THEN RAISE EXCEPTION 'V157-FAIL invalid case state';END IF;
 SELECT count(*) INTO v_count FROM public.registry_audit_log
 WHERE entity_type='marginal_note_reconciliation' AND entity_id IN (v_first,v_case2)
 AND action IN ('reconciliation_rejected','reconciliation_authorization_revoked');
 IF v_count<>2 THEN RAISE EXCEPTION 'V157-FAIL rejection audit %',v_count;END IF;
END $verify$;
ROLLBACK;
