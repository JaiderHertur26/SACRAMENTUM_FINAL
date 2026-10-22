-- V153 · Auditoría de integridad de los 4 circuitos de corrección/reposición
-- Extiende QA V115 para verificar relaciones, coordenadas y trazas, sin persistir datos.
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
  v_new_row jsonb; v_decree_row jsonb; v_next_params jsonb; v_audit_count integer;
  v_bad_notes integer; v_duplicate_numbers integer; v_chancery_id uuid;
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
        RAISE EXCEPTION 'V153: faltan constancias %/%',v_s,v_kind; END IF;
      SELECT to_jsonb(d) INTO STRICT v_decree_row FROM public.decretos d WHERE d.id=v_decree;
      SELECT id INTO STRICT v_chancery_id FROM public.chancelleries
        WHERE diocese_id=v_dio ORDER BY id LIMIT 1;
      IF (v_decree_row->>'parish_id') IS DISTINCT FROM v_parish::text
        OR (v_decree_row->>'diocese_id') IS DISTINCT FROM v_dio::text
        OR (v_decree_row->>'chancery_id') IS DISTINCT FROM v_chancery_id::text
        OR (v_decree_row->>'original_record_id') IS DISTINCT FROM
          (CASE WHEN v_kind='correccion' THEN v_original::text ELSE NULL END)
        OR (v_decree_row->>'replacement_record_id') IS DISTINCT FROM v_new::text
        OR lower(v_decree_row->>'sacrament_type') IS DISTINCT FROM v_s
        OR lower(v_decree_row->>'status') IS DISTINCT FROM 'active'
        OR (v_decree_row->>'decree_number') IS DISTINCT FROM v_ref THEN
        RAISE EXCEPTION 'V153: vinculación Cancillería/Parroquia incorrecta %/%',v_s,v_kind;
      END IF;
      IF v_s='bautismo' THEN
        SELECT to_jsonb(b) INTO STRICT v_new_row FROM public.baptisms b WHERE b.id=v_new;
        SELECT bautizos_params INTO STRICT v_next_params FROM public.parish_parameters
          WHERE parish_id=v_parish;
      ELSE
        SELECT to_jsonb(c) INTO STRICT v_new_row FROM public.confirmations c WHERE c.id=v_new;
        SELECT confirmaciones_params INTO STRICT v_next_params FROM public.parish_parameters
          WHERE parish_id=v_parish;
      END IF;
      IF (v_new_row->>'parish_id') IS DISTINCT FROM v_parish::text
        OR (v_new_row->>'book_number')::integer IS DISTINCT FROM v_book
        OR (v_new_row->>'folio')::integer IS DISTINCT FROM v_folio
        OR (v_new_row->>'number')::integer IS DISTINCT FROM v_number
        OR ((v_next_params->>'suplementarioLibro')::integer=v_book
          AND (v_next_params->>'suplementarioFolio')::integer=v_folio
          AND (v_next_params->>'suplementarioNumero')::integer=v_number) THEN
        RAISE EXCEPTION 'V153: libro/físico/avance supletorio desalineado %/%',v_s,v_kind;
      END IF;
      SELECT count(*) INTO v_bad_notes FROM public.marginal_notes mn
      WHERE mn.decree_id=v_decree AND (
        mn.parish_id IS DISTINCT FROM v_parish
        OR mn.sacrament_type IS DISTINCT FROM v_s
        OR (mn.sacrament_id IS DISTINCT FROM v_new
           AND (v_original IS NULL OR mn.sacrament_id IS DISTINCT FROM v_original))
      );
      IF v_bad_notes>0 THEN
        RAISE EXCEPTION 'V153: nota marginal fuera de partida o parroquia %/% (% notas)',v_s,v_kind,v_bad_notes;
      END IF;
      SELECT count(*) INTO v_audit_count FROM public.registry_audit_log ra
      WHERE ra.entity_type='decree' AND ra.entity_id=v_decree AND ra.parish_id=v_parish;
      IF v_audit_count<1 THEN RAISE EXCEPTION 'V153: decreto sin auditoría institucional %/%',v_s,v_kind;END IF;
      SELECT count(*) INTO v_duplicate_numbers FROM public.decretos d
      WHERE d.diocese_id=v_dio AND lower(trim(d.decree_number))=lower(trim(v_ref));
      IF v_duplicate_numbers<>1 THEN
        RAISE EXCEPTION 'V153: número de decreto duplicado %/%',v_s,v_kind;
      END IF;
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
      IF v_kind='correccion' THEN
        PERFORM public.reverse_correction_decree_with_reason(v_decree,'REVERSIÓN FICTICIA');
      ELSE
        PERFORM public.reverse_replacement_decree_with_reason(v_decree,'REVERSIÓN FICTICIA');
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
      IF (SELECT status FROM public.decretos WHERE id=v_decree)<>'reversed'
        OR v_new_status<>'reversed'
        OR (v_original IS NOT NULL AND v_old_status<>'seated') THEN
        RAISE EXCEPTION 'V115: reversión incompleta %/% (nueva %, original %)',v_s,v_kind,v_new_status,v_old_status;
      END IF;
      IF (SELECT count(*) FROM public.marginal_notes WHERE decree_id=v_decree)<=v_note_count THEN
        RAISE EXCEPTION 'V115: falta nota marginal de reversión %/%',v_s,v_kind;
      END IF;
      v_note_count:=(SELECT count(*) FROM public.marginal_notes WHERE decree_id=v_decree);
      BEGIN
        IF v_kind='correccion' THEN
          PERFORM public.reverse_correction_decree_with_reason(v_decree,'INTENTO DUPLICADO QA');
        ELSE
          PERFORM public.reverse_replacement_decree_with_reason(v_decree,'INTENTO DUPLICADO QA');
        END IF;
        RAISE EXCEPTION 'V115: se admitió reversión duplicada %/%',v_s,v_kind;
      EXCEPTION WHEN OTHERS THEN
        IF position('V115: se admitió reversión duplicada' in SQLERRM)>0 THEN RAISE; END IF;
        IF position('ya fue revertido' in SQLERRM)=0 THEN RAISE; END IF;
      END;
      IF (SELECT count(*) FROM public.marginal_notes WHERE decree_id=v_decree)<>v_note_count THEN
        RAISE EXCEPTION 'V115: doble reversión insertó una nota marginal %/%',v_s,v_kind;
      END IF;
      v_count:=v_count+1;
    END LOOP;
  END LOOP;
  IF v_count<>4 THEN RAISE EXCEPTION 'V115: escenarios incompletos'; END IF;
END $qa$;
ROLLBACK;
