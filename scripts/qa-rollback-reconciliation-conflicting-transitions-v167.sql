-- V167 · Sequential conflicting transitions (not two physical connections): four sacrament replacements.
-- Temporary QA fixtures; all rows including params CONCEPTS and audits ROLLBACK.
BEGIN;
DO $setup$
DECLARE v_dio uuid;v_actor uuid;v_parish uuid;v_chancery uuid;v_dio_actor uuid;
 v_s text;v_repo uuid;v_decree uuid;v_rec uuid;v_ref text;v_para jsonb;
 v_book integer;v_folio integer;v_number integer;v_fields jsonb;v_meta jsonb;
 v_note uuid;v_case uuid;v_cases jsonb:='[]'::jsonb;
BEGIN
 SELECT diocese_id,auth_user_id INTO STRICT v_dio,v_chancery FROM public.user_profiles
 WHERE role='chancery' AND is_active LIMIT 1;
 SELECT auth_user_id INTO STRICT v_dio_actor FROM public.user_profiles
 WHERE role='diocese' AND is_active AND diocese_id=v_dio LIMIT 1;
 SELECT id INTO STRICT v_parish FROM public.parishes
 WHERE diocese_id=v_dio AND is_operational ORDER BY id LIMIT 1;
 PERFORM set_config('qa159.diocese',v_dio::text,true);
 PERFORM set_config('qa159.chancery',v_chancery::text,true);
 PERFORM set_config('qa159.diocese_actor',v_dio_actor::text,true);
 PERFORM set_config('request.jwt.claim.sub',v_chancery::text,true);
 FOREACH v_s IN ARRAY ARRAY['bautismo','confirmacion','matrimonio','exequias'] LOOP
  v_ref:='QA-V167-'||v_s||'-'||left(gen_random_uuid()::text,8);
  v_meta:=jsonb_build_object('type','archivo','reference','QA-159-ARCHIVO',
    'issuer','Archivo ficticio','description','Evidencia ficticia, solamente QA');
  IF v_s IN ('bautismo','confirmacion') THEN
   INSERT INTO public.conceptos_anulacion(diocese_id,tipo,concepto,codigo,sacrament_type,
    seinscribe,gennota,gendocum,source_kind)
   VALUES(v_dio,'porReposicion','REPOSICION FICTICIA DE V159',v_ref,v_s,true,true,true,'manual')
   RETURNING id INTO v_repo;
   IF v_s='bautismo' THEN
    UPDATE public.parish_parameters SET bautizos_params=
      jsonb_set(jsonb_set(jsonb_set(bautizos_params,'{suplementarioLibro}','9959'::jsonb,true),
        '{suplementarioFolio}','1'::jsonb,true),'{suplementarioNumero}','1'::jsonb,true)
    WHERE parish_id=v_parish;
    SELECT bautizos_params INTO STRICT v_para FROM public.parish_parameters WHERE parish_id=v_parish;
   ELSE
    UPDATE public.parish_parameters SET confirmaciones_params=
      jsonb_set(jsonb_set(jsonb_set(confirmaciones_params,'{suplementarioLibro}','9959'::jsonb,true),
        '{suplementarioFolio}','1'::jsonb,true),'{suplementarioNumero}','1'::jsonb,true)
    WHERE parish_id=v_parish;
    SELECT confirmaciones_params INTO STRICT v_para FROM public.parish_parameters WHERE parish_id=v_parish;
   END IF;
   v_book:=(v_para->>'suplementarioLibro')::integer;
   v_folio:=(v_para->>'suplementarioFolio')::integer;
   v_number:=(v_para->>'suplementarioNumero')::integer;
   v_fields:=CASE WHEN v_s='bautismo' THEN
     jsonb_build_object('firstName','QA','lastName','V159','sacramentDate','2020-01-01',
      'reason','Reposición QA','decreeEvidence',v_meta)
     ELSE jsonb_build_object('nombres','QA','apellidos','V159','fechaSacramento','2020-01-01',
      'reason','Reposición QA','decreeEvidence',v_meta) END;
   IF v_s='bautismo' THEN
    SELECT decree_id,replacement_baptism_id INTO STRICT v_decree,v_rec FROM public.apply_baptism_replacement(
      v_parish,v_ref,current_date,v_repo,v_fields,
      jsonb_build_object('reason','Prueba institucional v159','decreeType','reposicion','sacramentType',v_s),
      'PARTIDA SUPLETORIA QA',v_book,v_folio,v_number);
   ELSE
    SELECT decree_id,replacement_confirmation_id INTO STRICT v_decree,v_rec FROM public.apply_confirmation_replacement(
      v_parish,v_ref,current_date,v_repo,v_fields,
      jsonb_build_object('reason','Prueba institucional v159','decreeType','reposicion','sacramentType',v_s),
      'PARTIDA SUPLETORIA QA',v_book,v_folio,v_number);
   END IF;
  ELSIF v_s='matrimonio' THEN
   SELECT decree_id,marriage_id INTO STRICT v_decree,v_rec FROM public.create_marriage_reposition_by_decree(
    v_parish,current_date,'Reposición ficticia QA para reconciliación institucional',
    jsonb_build_object('novioNombres','QA','novioApellidos','V159','noviaNombres','QA',
      'noviaApellidos','V159','fechaMatrimonio','2020-02-02'),v_meta,v_ref);
  ELSE
   SELECT decree_id,funeral_id INTO STRICT v_decree,v_rec FROM public.create_funeral_reposition_by_decree(
    v_parish,current_date,'Reposición ficticia QA para reconciliación institucional',
    jsonb_build_object('nombres','QA','apellidos','V159','fecha_nacimiento','1940-01-01',
      'fecha_defuncion','2020-01-01','fecha_exequias','2020-01-02'),v_meta,v_ref);
  END IF;
  SELECT public.create_manual_marginal_note(v_parish,v_s,v_rec,
   'NOTA MANUAL INDEPENDIENTE FICTICIA V159 PARA VERIFICAR CONCILIACIÓN') INTO v_note;
  v_cases:=v_cases||jsonb_build_array(jsonb_build_object(
   'sacrament',v_s,'decree',v_decree,'part',v_rec,'note',v_note));
 END LOOP;
 PERFORM set_config('qa159.cases',v_cases::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $qa$
DECLARE v_c uuid:=current_setting('qa159.chancery')::uuid;
 v_d uuid:=current_setting('qa159.diocese_actor')::uuid;
 v_cases jsonb:=current_setting('qa159.cases')::jsonb;
 v_item jsonb;v_s text;v_decree uuid;v_record uuid;v_note uuid;v_case uuid;
 v_output jsonb;v_no text;v_seen integer:=0;
BEGIN
 FOR v_item IN SELECT value FROM jsonb_array_elements(v_cases) LOOP
  v_s:=v_item->>'sacrament';v_decree:=(v_item->>'decree')::uuid;
  v_record:=(v_item->>'part')::uuid;v_note:=(v_item->>'note')::uuid;
  PERFORM set_config('request.jwt.claim.sub',v_c::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_c,'role','authenticated')::text,true);
  SELECT public.request_later_note_reconciliation_v156(v_decree,v_note,
   'Nota posterior de laboratorio con fundamento documental para conciliar en prueba reversible.',
   'QA V167 CONSTANCIA ARCHIVO') INTO v_case;
  -- The partial UNIQUE index must reject two open cases for the same decree+note,
  -- regardless of a second user requesting it later or an API retry.
  BEGIN
   PERFORM public.request_later_note_reconciliation_v156(v_decree,v_note,
    'Solicitud duplicada ficticia: no debe aparecer otro expediente abierto para el mismo decreto y nota.',
    'QA-V167-DUPLICATE-CASE');
   RAISE EXCEPTION 'V167 duplicate OPEN reconciliation accepted for %',v_s;
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
   PERFORM public.execute_later_note_reconciliation_v156(v_case);
   RAISE EXCEPTION 'V167 execution WITHOUT independent authorization on %',v_s;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub',v_d::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_d,'role','authenticated')::text,true);
  SELECT public.approve_later_note_reconciliation_v156(v_case,
   'APROBACIÓN FICTICIA QA V167',
   'Cuenta de Diócesis independiente autoriza este caso reversible de laboratorio') INTO v_output;
  IF v_output->>'status' IS DISTINCT FROM 'authorized' THEN
    RAISE EXCEPTION 'V159 approval failed %',v_s;
  END IF;
  PERFORM set_config('request.jwt.claim.sub',v_c::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_c,'role','authenticated')::text,true);
  SELECT public.execute_later_note_reconciliation_v156(v_case) INTO v_output;
  IF v_output->>'status' IS DISTINCT FROM 'executed'
     OR v_output->>'decree_id' IS DISTINCT FROM v_decree::text
     OR v_output->>'note_id' IS DISTINCT FROM v_note::text
  THEN RAISE EXCEPTION 'V159 execution incomplete for %',v_s;END IF;
  -- Retry a success with the same credential; must not write a second notification.
  BEGIN
   PERFORM public.execute_later_note_reconciliation_v156(v_case);
   RAISE EXCEPTION 'V167 double execution accepted %',v_s;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- The decree is reversed: no new workflow may be opened for a closed original.
  BEGIN
   PERFORM public.request_later_note_reconciliation_v156(v_decree,v_note,
    'Reapertura ficticia prohibida de una conciliación ya ejecutada anteriormente.',
    'QA-V167-REOPEN-AFTER-EXECUTED');
   RAISE EXCEPTION 'V167 reopened executed decree %',v_s;
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub',v_d::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_d,'role','authenticated')::text,true);
  BEGIN
   PERFORM public.approve_later_note_reconciliation_v156(v_case,
    'SEGUNDA AUTORIZACIÓN QA-V167',
    'Una conciliación ejecutada no se puede autorizar nuevamente por la diócesis.');
   RAISE EXCEPTION 'V167 reauthorized executed case %',v_s;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
   PERFORM public.reject_later_note_reconciliation_v157(v_case,
    'RECHAZO TARDÍO QA V167',
    'Diócesis no puede rechazar cuando ya terminó la reversión formal.');
   RAISE EXCEPTION 'V167 rejected executed case %',v_s;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  v_seen:=v_seen+1;
  PERFORM set_config('qa159.case.'||v_s,v_case::text,true);
 END LOOP;
 IF v_seen<>4 THEN RAISE EXCEPTION 'V159 expected four cases got %',v_seen;END IF;
END $qa$;
RESET ROLE;
DO $verify$
DECLARE v_cases jsonb:=current_setting('qa159.cases')::jsonb;
 v_item jsonb;v_s text;v_decree uuid;v_record uuid;v_note uuid;v_case uuid;
 v_new text;v_audits integer;v_notices integer;v_checked integer:=0;
BEGIN
 FOR v_item IN SELECT value FROM jsonb_array_elements(v_cases) LOOP
  v_s:=v_item->>'sacrament';v_decree:=(v_item->>'decree')::uuid;
  v_record:=(v_item->>'part')::uuid;v_note:=(v_item->>'note')::uuid;
  v_case:=current_setting('qa159.case.'||v_s)::uuid;
  IF v_s='bautismo' THEN
    SELECT status INTO STRICT v_new FROM public.baptisms WHERE id=v_record;
  ELSIF v_s='confirmacion' THEN
    SELECT status INTO STRICT v_new FROM public.confirmations WHERE id=v_record;
  ELSIF v_s='matrimonio' THEN
    SELECT status INTO STRICT v_new FROM public.marriages WHERE id=v_record;
  ELSE
    SELECT status INTO STRICT v_new FROM public.funerals WHERE id=v_record;
  END IF;
  IF v_new IS DISTINCT FROM 'reversed'
   OR (SELECT status FROM public.decretos WHERE id=v_decree) IS DISTINCT FROM 'reversed'
   OR (SELECT status FROM public.marginal_notes WHERE id=v_note) IS DISTINCT FROM 'reversed'
   OR (SELECT status FROM public.later_note_reconciliations_v156 WHERE id=v_case) IS DISTINCT FROM 'executed'
  THEN RAISE EXCEPTION 'V159 incomplete atomic effects for %',v_s;END IF;
  SELECT count(*) INTO v_audits FROM public.registry_audit_log WHERE entity_type='marginal_note_reconciliation' AND entity_id=v_case;
  IF v_audits<>3 THEN RAISE EXCEPTION 'V159 missing case audit on %: %',v_s,v_audits;END IF;
  SELECT count(*) INTO v_notices FROM public.official_notifications WHERE decree_id=v_decree
   AND category='decree_reconciliation' AND payload->>'reconciliation_case_id'=v_case::text;
  IF v_notices<>1 THEN RAISE EXCEPTION 'V159 missing notice on %: %',v_s,v_notices;END IF;
  v_checked:=v_checked+1;
 END LOOP;
 IF v_checked<>4 THEN RAISE EXCEPTION 'V159 expected 4 complete, got %',v_checked;END IF;
END $verify$;
ROLLBACK;
