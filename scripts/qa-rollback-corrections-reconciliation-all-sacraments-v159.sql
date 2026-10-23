-- V159 · Four sacramental CORRECTIONS, institutional reconciliation and original restoration.
-- Every fixture and event is fictional and transaction-scoped. Do not commit.
BEGIN;
DO $fixture$
DECLARE v_dio uuid;v_chancery uuid;v_dio_actor uuid;v_parish uuid;
 v_s text;v_concept uuid;v_orig uuid;v_new uuid;v_decree uuid;v_note uuid;
 v_ref text;v_para jsonb;v_book int;v_folio int;v_num int;
 v_fixtures jsonb:='[]'::jsonb;v_payload jsonb;
BEGIN
 SELECT diocese_id,auth_user_id INTO STRICT v_dio,v_chancery
 FROM public.user_profiles WHERE role='chancery' AND is_active LIMIT 1;
 SELECT auth_user_id INTO STRICT v_dio_actor FROM public.user_profiles
 WHERE role='diocese' AND diocese_id=v_dio AND is_active LIMIT 1;
 SELECT id INTO STRICT v_parish FROM public.parishes
 WHERE diocese_id=v_dio AND is_operational ORDER BY id LIMIT 1;
 PERFORM set_config('qa159corr.diocese',v_dio::text,true);
 PERFORM set_config('qa159corr.chancery',v_chancery::text,true);
 PERFORM set_config('qa159corr.diocese_actor',v_dio_actor::text,true);
 PERFORM set_config('request.jwt.claim.sub',v_chancery::text,true);
 FOREACH v_s IN ARRAY ARRAY['bautismo','confirmacion','matrimonio','exequias'] LOOP
  v_ref:='QA-V159-CORR-'||v_s||'-'||left(gen_random_uuid()::text,8);
  IF v_s IN ('bautismo','confirmacion') THEN
   SELECT id INTO STRICT v_concept FROM public.conceptos_anulacion
   WHERE diocese_id=v_dio AND sacrament_type=v_s
     AND tipo='porCorreccion' AND is_active ORDER BY id LIMIT 1;
   IF v_s='bautismo' THEN
    UPDATE public.parish_parameters SET bautizos_params=
     jsonb_set(jsonb_set(jsonb_set(bautizos_params,'{suplementarioLibro}','9959'::jsonb,true),
      '{suplementarioFolio}','5'::jsonb,true),'{suplementarioNumero}','5'::jsonb,true)
    WHERE parish_id=v_parish;
    SELECT bautizos_params INTO STRICT v_para FROM public.parish_parameters WHERE parish_id=v_parish;
    INSERT INTO public.baptisms(parish_id,celebration_date,book_number,folio,number,nombres,apellidos,status,raw_data)
    VALUES(v_parish,'2010-01-01','9801','0001','0001','QA','CORR V159','seated','{"qaOnly":true}'::jsonb)
    RETURNING id INTO v_orig;
   ELSE
    UPDATE public.parish_parameters SET confirmaciones_params=
     jsonb_set(jsonb_set(jsonb_set(confirmaciones_params,'{suplementarioLibro}','9959'::jsonb,true),
      '{suplementarioFolio}','5'::jsonb,true),'{suplementarioNumero}','5'::jsonb,true)
    WHERE parish_id=v_parish;
    SELECT confirmaciones_params INTO STRICT v_para FROM public.parish_parameters WHERE parish_id=v_parish;
    INSERT INTO public.confirmations(parish_id,celebration_date,book_number,folio,number,nombres,apellidos,status,raw_data)
    VALUES(v_parish,'2010-01-01','9801','0001','0001','QA','CORR V159','seated','{"qaOnly":true}'::jsonb)
    RETURNING id INTO v_orig;
   END IF;
   v_book:=(v_para->>'suplementarioLibro')::integer;
   v_folio:=(v_para->>'suplementarioFolio')::integer;
   v_num:=(v_para->>'suplementarioNumero')::integer;
   v_payload:=jsonb_build_object('reason','Corrección ficticia de laboratorio',
     'sacramentType',v_s,'decreeType','correccion');
   IF v_s='bautismo' THEN
    SELECT decree_id,replacement_baptism_id INTO STRICT v_decree,v_new
    FROM public.apply_baptism_correction(v_parish,v_orig,v_ref,current_date,v_concept,
     '{"nombres":"QA CORREGIDO","apellidos":"CORR V159","fechaSacramento":"2010-01-01"}'::jsonb,
     v_payload,'ORIGINAL ANULADA QA','REPOSICION DE CORRECCION QA',v_book,v_folio,v_num);
   ELSE
    SELECT decree_id,replacement_confirmation_id INTO STRICT v_decree,v_new
    FROM public.apply_confirmation_correction(v_parish,v_orig,v_ref,current_date,v_concept,
     '{"nombres":"QA CORREGIDO","apellidos":"CORR V159","fechaSacramento":"2010-01-01"}'::jsonb,
     v_payload,'ORIGINAL ANULADA QA','REPOSICION DE CORRECCION QA',v_book,v_folio,v_num);
   END IF;
  ELSIF v_s='matrimonio' THEN
   INSERT INTO public.marriages(parish_id,celebration_date,status,raw_data,book_type)
   VALUES(v_parish,'2019-01-01','seated',
     '{"qaOnly":true,"novioNombres":"QA","noviaNombres":"FICTICIA"}'::jsonb,'ordinario')
   RETURNING id INTO v_orig;
   SELECT decree_id,replacement_marriage_id INTO STRICT v_decree,v_new
   FROM public.apply_marriage_correction(v_orig,current_date,
     'Corrección matrimonial ficticia QA V159.',
     '{"novioApellidos":"CORREGIDO V159"}'::jsonb,v_ref);
  ELSE
   INSERT INTO public.funerals(parish_id,status,nombres,apellidos,fecha_nacimiento,
     fecha_defuncion,fecha_exequias,raw_data,book_type)
   VALUES(v_parish,'seated','QA','CORR V159','1940-01-01','2020-01-01',
     '2020-01-02','{"qaOnly":true}'::jsonb,'ordinario') RETURNING id INTO v_orig;
   SELECT decree_id,replacement_funeral_id INTO STRICT v_decree,v_new
   FROM public.apply_funeral_correction(v_orig,current_date,
     'Corrección exequial ficticia QA V159.',
     '{"apellidos":"CORREGIDO V159"}'::jsonb,v_ref);
  END IF;
  SELECT public.create_manual_marginal_note(v_parish,v_s,v_new,
   'NOTA MANUAL INDEPENDIENTE FICTICIA V159 SOBRE CORRECCION') INTO v_note;
  v_fixtures:=v_fixtures||jsonb_build_array(jsonb_build_object(
    'sacrament',v_s,'decree',v_decree,'original',v_orig,'new',v_new,'note',v_note));
 END LOOP;
 PERFORM set_config('qa159corr.fixtures',v_fixtures::text,true);
END $fixture$;
SET LOCAL ROLE authenticated;
DO $qa$
DECLARE v_chancery uuid:=current_setting('qa159corr.chancery')::uuid;
 v_diocese_actor uuid:=current_setting('qa159corr.diocese_actor')::uuid;
 v_fixtures jsonb:=current_setting('qa159corr.fixtures')::jsonb;
 v_f jsonb;v_decree uuid;v_note uuid;v_case uuid;v_result jsonb;
 v_s text;v_done integer:=0;
BEGIN
 FOR v_f IN SELECT value FROM jsonb_array_elements(v_fixtures) LOOP
  v_s:=v_f->>'sacrament';v_decree:=(v_f->>'decree')::uuid;
  v_note:=(v_f->>'note')::uuid;
  PERFORM set_config('request.jwt.claim.sub',v_chancery::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_chancery,'role','authenticated')::text,true);
  SELECT public.request_later_note_reconciliation_v156(v_decree,v_note,
   'La nota posterior ficticia de corrección requiere conciliación institucional y doble autoridad.',
   'QA V159 CORR ARCHIVO DOCUMENTAL') INTO v_case;
  BEGIN
   PERFORM public.execute_later_note_reconciliation_v156(v_case);
   RAISE EXCEPTION 'V159 correction executed without diocesan approval: %',v_s;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub',v_diocese_actor::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_diocese_actor,'role','authenticated')::text,true);
  SELECT public.approve_later_note_reconciliation_v156(v_case,
   'APROBACION DOCUMENTAL FICTICIA V159',
   'Autorización independiente para conciliación y reversión de corrección ficticia.')
   INTO v_result;
  IF v_result->>'status' IS DISTINCT FROM 'authorized' THEN
    RAISE EXCEPTION 'V159 correction approval error: %',v_s;END IF;
  PERFORM set_config('request.jwt.claim.sub',v_chancery::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_chancery,'role','authenticated')::text,true);
  SELECT public.execute_later_note_reconciliation_v156(v_case) INTO v_result;
  IF v_result->>'status' IS DISTINCT FROM 'executed'
    OR v_result->>'decree_id' IS DISTINCT FROM v_decree::text
    OR v_result->>'note_id' IS DISTINCT FROM v_note::text
  THEN RAISE EXCEPTION 'V159 correction execute incomplete: %',v_s;END IF;
  PERFORM set_config('qa159corr.case.'||v_s,v_case::text,true);
  v_done:=v_done+1;
 END LOOP;
 IF v_done<>4 THEN RAISE EXCEPTION 'V159 corrections incomplete %',v_done;END IF;
END $qa$;
RESET ROLE;
DO $verify$
DECLARE v_fixtures jsonb:=current_setting('qa159corr.fixtures')::jsonb;
 v_f jsonb;v_s text;v_orig uuid;v_new uuid;v_dec uuid;v_note uuid;v_case uuid;
 v_old_status text;v_new_status text;v_count integer;v_checked integer:=0;
BEGIN
 FOR v_f IN SELECT value FROM jsonb_array_elements(v_fixtures) LOOP
  v_s:=v_f->>'sacrament';v_orig:=(v_f->>'original')::uuid;
  v_new:=(v_f->>'new')::uuid;v_dec:=(v_f->>'decree')::uuid;
  v_note:=(v_f->>'note')::uuid;v_case:=current_setting('qa159corr.case.'||v_s)::uuid;
  IF v_s='bautismo' THEN
   SELECT status INTO STRICT v_old_status FROM public.baptisms WHERE id=v_orig;
   SELECT status INTO STRICT v_new_status FROM public.baptisms WHERE id=v_new;
  ELSIF v_s='confirmacion' THEN
   SELECT status INTO STRICT v_old_status FROM public.confirmations WHERE id=v_orig;
   SELECT status INTO STRICT v_new_status FROM public.confirmations WHERE id=v_new;
  ELSIF v_s='matrimonio' THEN
   SELECT status INTO STRICT v_old_status FROM public.marriages WHERE id=v_orig;
   SELECT status INTO STRICT v_new_status FROM public.marriages WHERE id=v_new;
  ELSE
   SELECT status INTO STRICT v_old_status FROM public.funerals WHERE id=v_orig;
   SELECT status INTO STRICT v_new_status FROM public.funerals WHERE id=v_new;
  END IF;
  IF v_old_status IS DISTINCT FROM 'seated' OR v_new_status IS DISTINCT FROM 'reversed'
    OR (SELECT status FROM public.decretos WHERE id=v_dec) IS DISTINCT FROM 'reversed'
    OR (SELECT status FROM public.marginal_notes WHERE id=v_note) IS DISTINCT FROM 'reversed'
    OR (SELECT status FROM public.later_note_reconciliations_v156 WHERE id=v_case) IS DISTINCT FROM 'executed'
  THEN RAISE EXCEPTION 'V159 correction failed to restore original % (old %, replacement %)',
      v_s,v_old_status,v_new_status;END IF;
  SELECT count(*) INTO v_count FROM public.registry_audit_log
    WHERE entity_type='marginal_note_reconciliation' AND entity_id=v_case;
  IF v_count<>3 THEN RAISE EXCEPTION 'V159 correction missing institutional audits % %',v_s,v_count;END IF;
  SELECT count(*) INTO v_count FROM public.official_notifications
    WHERE decree_id=v_dec AND category='decree_reconciliation'
      AND payload->>'reconciliation_case_id'=v_case::text;
  IF v_count<>1 THEN RAISE EXCEPTION 'V159 correction missing parish notification %',v_s;END IF;
  v_checked:=v_checked+1;
 END LOOP;
 IF v_checked<>4 THEN RAISE EXCEPTION 'V159 correction verification incomplete';END IF;
END $verify$;
ROLLBACK;
