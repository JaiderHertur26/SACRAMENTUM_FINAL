-- V136 baseline: reversión tardía de Bautismo y Confirmación; ROLLBACK
-- Exclusivamente QA. El ROLLBACK protege partidas, conceptos y parámetros reales.
BEGIN;
DO $qa$
DECLARE
  v_dio uuid; v_parish uuid; v_chancery uuid; v_parish_actor uuid;
  v_s text; v_kind text; v_original uuid; v_new uuid; v_decree uuid;
  v_concept uuid; v_repo_concept uuid;
  v_para jsonb; v_book integer; v_folio integer; v_number integer;
  v_names jsonb; v_payload jsonb; v_ref text; v_new_status text; v_old_status text;
  v_note_count integer; v_notice_count integer; v_count integer:=0;
BEGIN
  SELECT diocese_id,auth_user_id INTO STRICT v_dio,v_chancery
  FROM public.user_profiles WHERE role='chancery' AND is_active;
  SELECT id INTO STRICT v_parish FROM public.parishes
  WHERE diocese_id=v_dio AND is_operational ORDER BY id LIMIT 1;
  SELECT auth_user_id INTO STRICT v_parish_actor FROM public.user_profiles
  WHERE role='parish' AND is_active AND diocese_id=v_dio;
  PERFORM set_config('request.jwt.claim.sub',v_chancery::text,true);

  FOREACH v_s IN ARRAY ARRAY['bautismo','confirmacion'] LOOP
    INSERT INTO public.conceptos_anulacion(diocese_id,tipo,concepto,codigo,
       sacrament_type,seinscribe,gennota,gendocum,source_kind)
    VALUES(v_dio,'porReposicion','REPOSICION FICTICIA DEL LABORATORIO',
       'QA-V115-'||v_s,v_s,true,true,true,'manual')
    RETURNING id INTO v_repo_concept;
    SELECT id INTO STRICT v_concept
    FROM public.conceptos_anulacion WHERE diocese_id=v_dio
    AND sacrament_type=v_s AND tipo='porCorreccion' AND is_active
    ORDER BY id LIMIT 1;
    -- Reservar coordenadas ficticias no utilizadas, reversibles dentro de la transacción.
    IF v_s='bautismo' THEN
      UPDATE public.parish_parameters SET bautizos_params=
       jsonb_set(jsonb_set(jsonb_set(bautizos_params,
          '{suplementarioLibro}','9900'::jsonb,true),
          '{suplementarioFolio}','1'::jsonb,true),
          '{suplementarioNumero}','1'::jsonb,true)
      WHERE parish_id=v_parish;
    ELSE
      UPDATE public.parish_parameters SET confirmaciones_params=
       jsonb_set(jsonb_set(jsonb_set(confirmaciones_params,
          '{suplementarioLibro}','9900'::jsonb,true),
          '{suplementarioFolio}','1'::jsonb,true),
          '{suplementarioNumero}','1'::jsonb,true)
      WHERE parish_id=v_parish;
    END IF;

    FOREACH v_kind IN ARRAY ARRAY['correccion','reposicion'] LOOP
      IF v_s='bautismo' THEN
        SELECT bautizos_params INTO STRICT v_para FROM public.parish_parameters
         WHERE parish_id=v_parish;
      ELSE
        SELECT confirmaciones_params INTO STRICT v_para FROM public.parish_parameters
         WHERE parish_id=v_parish;
      END IF;
      v_book:=coalesce((v_para->>'suplementarioLibro')::integer,1);
      v_folio:=coalesce((v_para->>'suplementarioFolio')::integer,1);
      v_number:=coalesce((v_para->>'suplementarioNumero')::integer,1);
      v_ref:='QA-V115-'||v_s||'-'||v_kind||'-'||substr(gen_random_uuid()::text,1,8);
      v_original:=NULL;
      v_payload:=jsonb_build_object('reason','Trámite ficticio reproducible, sin efectos persistentes.',
        'sacramentType',v_s,'decreeType',v_kind);
      IF v_kind='correccion' THEN
        IF v_s='bautismo' THEN
          INSERT INTO public.baptisms(parish_id,celebration_date,
           book_number,folio,number,nombres,apellidos,status,raw_data)
          VALUES(v_parish,'2010-01-01','9800','0001','0001','QA','ORIGINAL','seated',
           '{"qaOnly":true}'::jsonb) RETURNING id INTO v_original;
          SELECT decree_id,replacement_baptism_id INTO STRICT v_decree,v_new
          FROM public.apply_baptism_correction(
            v_parish,v_original,v_ref,CURRENT_DATE,v_concept,
            '{"nombres":"QA-CORREGIDO","apellidos":"ORIGINAL","fechaSacramento":"2010-01-01"}'::jsonb,
            v_payload,'PARTIDA ORIGINAL ANULADA QA','PARTIDA NUEVA QA',
            v_book,v_folio,v_number);
        ELSE
          INSERT INTO public.confirmations(parish_id,celebration_date,
           book_number,folio,number,nombres,apellidos,status,raw_data)
          VALUES(v_parish,'2010-01-01','9800','0001','0001','QA','ORIGINAL','seated',
           '{"qaOnly":true}'::jsonb) RETURNING id INTO v_original;
          SELECT decree_id,replacement_confirmation_id INTO STRICT v_decree,v_new
          FROM public.apply_confirmation_correction(
            v_parish,v_original,v_ref,CURRENT_DATE,v_concept,
            '{"nombres":"QA-CORREGIDO","apellidos":"ORIGINAL","fechaSacramento":"2010-01-01"}'::jsonb,
            v_payload,'PARTIDA ORIGINAL ANULADA QA','PARTIDA NUEVA QA',
            v_book,v_folio,v_number);
        END IF;
      ELSE
        v_names:=CASE WHEN v_s='bautismo' THEN
         '{"firstName":"QA","lastName":"SUPLETORIO","sacramentDate":"2010-01-01",
         "reason":"Reponer acta ficticia",
         "decreeEvidence":{"type":"archivo","reference":"QA-REF-V115",
           "issuer":"Custodio de pruebas","description":"Documento ficticio"}}'::jsonb
         ELSE '{"nombres":"QA","apellidos":"SUPLETORIO","fechaSacramento":"2010-01-01",
         "reason":"Reponer acta ficticia",
         "decreeEvidence":{"type":"archivo","reference":"QA-REF-V115",
           "issuer":"Custodio de pruebas","description":"Documento ficticio"}}'::jsonb END;
        IF v_s='bautismo' THEN
          SELECT decree_id,replacement_baptism_id INTO STRICT v_decree,v_new
          FROM public.apply_baptism_replacement(
             v_parish,v_ref,CURRENT_DATE,v_repo_concept,
             v_names,v_payload,'PARTIDA REPUESTA QA',v_book,v_folio,v_number);
        ELSE
          SELECT decree_id,replacement_confirmation_id INTO STRICT v_decree,v_new
          FROM public.apply_confirmation_replacement(
             v_parish,v_ref,CURRENT_DATE,v_repo_concept,
             v_names,v_payload,'PARTIDA REPUESTA QA',v_book,v_folio,v_number);
        END IF;
      END IF;

      IF v_s='bautismo' THEN
        SELECT status INTO STRICT v_new_status FROM public.baptisms WHERE id=v_new;
        IF v_original IS NOT NULL THEN SELECT status INTO STRICT v_old_status
          FROM public.baptisms WHERE id=v_original; END IF;
      ELSE
        SELECT status INTO STRICT v_new_status FROM public.confirmations WHERE id=v_new;
        IF v_original IS NOT NULL THEN SELECT status INTO STRICT v_old_status
          FROM public.confirmations WHERE id=v_original; END IF;
      END IF;
      IF v_new_status<>'seated' OR (v_original IS NOT NULL AND v_old_status<>'anulada')
       OR (SELECT replacement_record_id IS DISTINCT FROM v_new
           FROM public.decretos WHERE id=v_decree)
      THEN RAISE EXCEPTION 'V115: vinculación defectuosa %/%',v_s,v_kind; END IF;
      SELECT count(*) INTO v_note_count FROM public.marginal_notes WHERE decree_id=v_decree;
      SELECT count(*) INTO v_notice_count FROM public.official_notifications WHERE decree_id=v_decree;
      IF v_note_count<1 OR v_notice_count<1 THEN
        RAISE EXCEPTION 'V115: faltan constancias %/%',v_s,v_kind; END IF;
      PERFORM set_config('request.jwt.claim.sub',v_parish_actor::text,true);
      BEGIN
        IF v_kind='correccion' THEN
          PERFORM public.reverse_correction_decree_with_reason(v_decree,'Parroquia QA');
        ELSE
          PERFORM public.reverse_replacement_decree_with_reason(v_decree,'Parroquia QA');
        END IF;
        RAISE EXCEPTION 'V115: Parroquia revirtió decreto';
      EXCEPTION WHEN OTHERS THEN
        IF SQLERRM='V115: Parroquia revirtió decreto' THEN RAISE; END IF;
      END;
      PERFORM set_config('request.jwt.claim.sub',v_chancery::text,true);

      -- Simular una actuación posterior que retiró vigencia a la partida supletoria.
      IF v_s='bautismo' THEN
        UPDATE public.baptisms SET status='reversed' WHERE id=v_new;
      ELSE
        UPDATE public.confirmations SET status='reversed' WHERE id=v_new;
      END IF;
      IF v_kind='correccion' THEN
        PERFORM public.reverse_correction_decree_with_reason(v_decree,'QA V136 REVERSIÓN TARDÍA');
      ELSE
        PERFORM public.reverse_replacement_decree_with_reason(v_decree,'QA V136 REPOSICIÓN TARDÍA');
      END IF;
      IF (SELECT status FROM public.decretos WHERE id=v_decree)='reversed'
      THEN
        RAISE EXCEPTION 'V136-CONFIRMED: reversión antigua %/% alteró decreto pese a supletoria ya revertida',v_s,v_kind;
      END IF;
      v_count:=v_count+1;
    END LOOP;
  END LOOP;
  IF v_count<>4 THEN RAISE EXCEPTION 'V115: escenarios incompletos'; END IF;
END $qa$;
ROLLBACK;
