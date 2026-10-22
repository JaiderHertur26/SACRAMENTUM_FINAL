-- V128 · Caso completo, cuatro roles, autorización previa y efectos ficticios reversibles.
BEGIN;
DO $qa$
DECLARE
 v_diocese uuid; v_parish uuid; v_actor_chancery uuid; v_actor_diocese uuid;v_actor_parish uuid;v_actor_admin uuid;
 v_marr uuid; v_other_marr uuid; v_req uuid; v_decree uuid; v_result jsonb;
 v_ref text := 'QA-V128-SENT-'||substr(gen_random_uuid()::text,1,8);
 v_decree_no text:='QA-V128-D-'||substr(gen_random_uuid()::text,1,8);
 v_role text; v_actor uuid; v_denied int:=0;v_status text;v_decree_count int;v_note_count int;v_audit_count int;
BEGIN
 SELECT up.diocese_id,up.auth_user_id INTO STRICT v_diocese,v_actor_chancery FROM public.user_profiles up
  WHERE up.role='chancery' AND up.is_active LIMIT 1;
 SELECT auth_user_id INTO STRICT v_actor_diocese FROM public.user_profiles
  WHERE role='diocese' AND diocese_id=v_diocese AND is_active LIMIT 1;
 SELECT auth_user_id INTO STRICT v_actor_parish FROM public.user_profiles
  WHERE role='parish' AND diocese_id=v_diocese AND is_active LIMIT 1;
 SELECT auth_user_id INTO STRICT v_actor_admin FROM public.user_profiles
  WHERE role='admin_general' AND is_active LIMIT 1;
 SELECT id INTO STRICT v_parish FROM public.parishes WHERE diocese_id=v_diocese AND is_operational ORDER BY id LIMIT 1;

 INSERT INTO public.marriages(parish_id,status,celebration_date,book_number,folio,number,raw_data)
 VALUES(v_parish,'seated',DATE '2018-05-05','QA-V128','995','995','{"qaOnly":true}'::jsonb)
 RETURNING id INTO v_marr;
 INSERT INTO public.marriages(parish_id,status,celebration_date,book_number,folio,number,raw_data)
 VALUES(v_parish,'seated',DATE '2017-05-05','QA-V128','994','994','{"qaOnly":true}'::jsonb)
 RETURNING id INTO v_other_marr;

 FOREACH v_role IN ARRAY ARRAY['admin_general','diocese','parish'] LOOP
  v_actor:=CASE v_role WHEN 'admin_general' THEN v_actor_admin
    WHEN 'diocese' THEN v_actor_diocese ELSE v_actor_parish END;
  PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
   PERFORM public.request_marriage_nullity_execution_v128(v_marr,v_decree_no,DATE '2025-05-05',
    'Tribunal Eclesiastico Ficticio',v_ref,DATE '2025-05-05',repeat('a',64),
    'Documento de laboratorio con referencia ficticia y solicitud sin efectos reales.');
   RAISE EXCEPTION 'V128-FAIL: role % could request nullity',v_role;
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=v_denied+1;
  END;
  EXECUTE 'RESET ROLE';
 END LOOP;
 IF v_denied<>3 THEN RAISE EXCEPTION 'V128 missing request role denials'; END IF;

 -- Cancillería no puede ejecutar sin autorización.
 PERFORM set_config('request.jwt.claim.sub',v_actor_chancery::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 BEGIN
  PERFORM public.apply_marriage_nullity(v_marr,v_decree_no,DATE '2025-05-05',
   'Prueba sin validacion institucional','{}'::jsonb,NULL::uuid[]);
  RAISE EXCEPTION 'V128-FAIL: missing preflight accepted';
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=v_denied+1; END;

 SELECT public.request_marriage_nullity_execution_v128(v_marr,v_decree_no,DATE '2025-05-05',
  'Tribunal Eclesiastico Ficticio',v_ref,DATE '2025-05-05',repeat('a',64),
  'Documento de laboratorio con referencia ficticia, revisiones separadas y sin efectos fuera de la transaccion.')
 INTO v_req;

 BEGIN
  PERFORM public.apply_marriage_nullity(v_marr,v_decree_no,DATE '2025-05-05',
   'Prueba sin doble revision',jsonb_build_object('preExecutionAuthorizationId',v_req),NULL::uuid[]);
  RAISE EXCEPTION 'V128-FAIL: pending preflight accepted';
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=v_denied+1; END;

 BEGIN
  PERFORM public.review_marriage_nullity_execution_v128(v_req,'authorize',
    'No corresponde a Cancillería autorizar su propia solicitud.',
    'QA-V128-EXT-001',repeat('a',64));
  RAISE EXCEPTION 'V128-FAIL: chancery reviews its own preflight';
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=v_denied+1; END;
 EXECUTE 'RESET ROLE';

 PERFORM set_config('request.jwt.claim.sub',v_actor_diocese::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 -- La RPC antigua de 4 parámetros debe estar inhabilitada, incluso para Diócesis.
 BEGIN
  PERFORM public.review_marriage_nullity_execution_v128(v_req,'authorize',
   'Solicitud QA por la ruta obsoleta sin cotejo digital.',
   'QA-V128-EXT-001');
  RAISE EXCEPTION 'V132-FAIL: revisión legacy con cuatro parámetros aceptada';
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=v_denied+1; END;
 -- Una huella distinta no permite autorizar aunque el revisor tenga rol de Diócesis.
 BEGIN
  PERFORM public.review_marriage_nullity_execution_v128(v_req,'authorize',
   'Se revisó el documento ficticio sin una copia idéntica.',
   'QA-V128-EXT-001',repeat('0',64));
  RAISE EXCEPTION 'V132-FAIL: huella SHA-256 incorrecta aceptada';
 EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1; END;
 SELECT public.review_marriage_nullity_execution_v128(v_req,'authorize',
 'Se revisó la referencia externa de la documentación aportada. Expediente ficticio de validación técnica reversible.',
 'QA-V128-EXT-001',repeat('a',64)) INTO v_result;
 IF v_result->>'status'<>'authorized' OR v_result->>'court_authenticity_certified'<>'false' THEN
  RAISE EXCEPTION 'V128 unexpected review output';
 END IF;
 BEGIN
  PERFORM public.review_marriage_nullity_execution_v128(v_req,'authorize',
   'Una segunda revisión sobre el mismo documento no se permite.', 'QA-V128-EXT-002',repeat('a',64));
  RAISE EXCEPTION 'V128-FAIL: duplicate review accepted';
 EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1; END;
 BEGIN
  PERFORM public.apply_marriage_nullity(v_marr,v_decree_no,DATE '2025-05-05',
   'Diocese must not issue decrees',jsonb_build_object('preExecutionAuthorizationId',v_req),NULL::uuid[]);
  RAISE EXCEPTION 'V128-FAIL: diocesan nullity issuance accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'V128-FAIL:%' THEN RAISE; END IF;
  v_denied:=v_denied+1;
 END;
 EXECUTE 'RESET ROLE';

 PERFORM set_config('request.jwt.claim.sub',v_actor_chancery::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 BEGIN
  PERFORM public.apply_marriage_nullity(v_other_marr,v_decree_no,DATE '2025-05-05',
    'Wrong marriage',jsonb_build_object('preExecutionAuthorizationId',v_req),NULL::uuid[]);
  RAISE EXCEPTION 'V128-FAIL: wrong marriage accepted';
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=v_denied+1; END;
 BEGIN
  PERFORM public.apply_marriage_nullity(v_marr,v_decree_no||'X',DATE '2025-05-05',
    'Wrong decree number',jsonb_build_object('preExecutionAuthorizationId',v_req),NULL::uuid[]);
  RAISE EXCEPTION 'V128-FAIL: wrong decree number accepted';
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=v_denied+1; END;

 SELECT decree_id INTO STRICT v_decree FROM public.apply_marriage_nullity(
 v_marr,v_decree_no,DATE '2025-05-05','Sentencia en laboratorio, autoridad institucional cotejada',
 jsonb_build_object('preExecutionAuthorizationId',v_req,'qaOnly',true),NULL::uuid[]);
 EXECUTE 'RESET ROLE';

 SELECT status INTO v_status FROM public.marriages WHERE id=v_marr;
 SELECT count(*) INTO v_decree_count FROM public.decretos WHERE id=v_decree
 AND tipo='nulidad_matrimonial' AND original_record_id=v_marr;
 SELECT count(*) INTO v_note_count FROM public.marginal_notes WHERE decree_id=v_decree AND sacrament_id=v_marr;
 SELECT count(*) INTO v_audit_count FROM public.registry_audit_log WHERE entity_id=v_decree AND action='issue';
 IF v_status<>'nullified' OR v_decree_count<>1 OR v_note_count<>1 OR v_audit_count<>1
 OR NOT EXISTS(SELECT 1 FROM public.nullity_execution_authorizations_v128
   WHERE id=v_req AND status='executed' AND decree_id=v_decree)
 THEN
  RAISE EXCEPTION 'V128-FINAL mismatch: status %, decrees %, notes %, audit %',
   v_status,v_decree_count,v_note_count,v_audit_count;
 END IF;

 PERFORM set_config('request.jwt.claim.sub',v_actor_chancery::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 BEGIN
  PERFORM public.apply_marriage_nullity(v_marr,v_decree_no,DATE '2025-05-05',
  'Re-ejecucion',jsonb_build_object('preExecutionAuthorizationId',v_req),NULL::uuid[]);
  RAISE EXCEPTION 'V128-FAIL: token reused';
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=v_denied+1; END;
 EXECUTE 'RESET ROLE';
 IF v_denied<>13 THEN RAISE EXCEPTION 'V132 expected 13 denials, got %',v_denied; END IF;
END $qa$;
ROLLBACK;