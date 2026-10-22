-- V148 · four sacramental rows advance on every update, and old print version is rejected. ROLLBACK.
BEGIN;
DO $qa$
DECLARE
  v_actor uuid;v_parish uuid;v_type text;v_table text;v_rec uuid;
  v_original timestamptz;v_first timestamptz;v_second timestamptz;v_third timestamptz;
  v_book text:='QA148';v_folio text:='8';v_number text:='48';v_event uuid;
  v_metadata jsonb;v_denied int:=0;v_accepted int:=0;v_markers int:=0;
BEGIN
  SELECT auth_user_id,parish_id INTO STRICT v_actor,v_parish
  FROM public.user_profiles WHERE role='parish' AND is_active LIMIT 1;
  FOREACH v_type IN ARRAY ARRAY['bautismo','confirmacion','matrimonio','exequias'] LOOP
    IF v_type='bautismo' THEN
      v_table:='baptisms';
      INSERT INTO public.baptisms(parish_id,status,nombres,apellidos,celebration_date,book_number,folio,number,raw_data)
      VALUES(v_parish,'seated','QA-V148','PRUEBA',DATE '2021-01-01',v_book,v_folio,v_number,'{"qaOnly":true}'::jsonb)
      RETURNING id,updated_at INTO v_rec,v_original;
    ELSIF v_type='confirmacion' THEN
      v_table:='confirmations';
      INSERT INTO public.confirmations(parish_id,status,nombres,apellidos,celebration_date,book_number,folio,number,raw_data)
      VALUES(v_parish,'seated','QA-V148','PRUEBA',DATE '2021-01-01',v_book,v_folio,v_number,'{"qaOnly":true}'::jsonb)
      RETURNING id,updated_at INTO v_rec,v_original;
    ELSIF v_type='matrimonio' THEN
      v_table:='marriages';
      INSERT INTO public.marriages(parish_id,status,celebration_date,book_number,folio,number,raw_data)
      VALUES(v_parish,'seated',DATE '2021-01-01',v_book,v_folio,v_number,'{"qaOnly":true}'::jsonb)
      RETURNING id,updated_at INTO v_rec,v_original;
    ELSE
      v_table:='funerals';
      INSERT INTO public.funerals(parish_id,status,nombres,apellidos,fecha_nacimiento,fecha_defuncion,fecha_exequias,book_number,folio,number,raw_data)
      VALUES(v_parish,'seated','QA-V148','PRUEBA',DATE '1940-01-01',DATE '2020-01-01',DATE '2020-01-02',
       v_book,v_folio,v_number,'{"qaOnly":true}'::jsonb)
      RETURNING id,updated_at INTO v_rec,v_original;
    END IF;

    EXECUTE format('UPDATE public.%I SET observations=$1 WHERE id=$2 RETURNING updated_at',v_table)
      INTO v_first USING 'QA-V148-PRIMER-CAMBIO',v_rec;
    EXECUTE format('UPDATE public.%I SET observations=$1 WHERE id=$2 RETURNING updated_at',v_table)
      INTO v_second USING 'QA-V148-SEGUNDO-CAMBIO',v_rec;
    IF v_original IS NULL OR v_first IS NULL OR v_second IS NULL
      OR NOT (v_original<v_first AND v_first<v_second) THEN
      RAISE EXCEPTION 'V148-FAIL: % did not advance monotonically: % | % | %',v_type,v_original,v_first,v_second;
    END IF;
    -- A manual attempt to force a stale/older updated_at must be overridden.
    EXECUTE format('UPDATE public.%I SET observations=$1,updated_at=$2 WHERE id=$3 RETURNING updated_at',v_table)
      INTO v_third USING 'QA-V148-FORCED-OLD-DATE','2000-01-01'::timestamptz,v_rec;
    IF v_third IS NULL OR v_third<=v_second THEN
      RAISE EXCEPTION 'V148-FAIL: % accepted an externally forced stale updated_at',v_type;
    END IF;
    v_markers:=v_markers+1;
    v_metadata:=jsonb_build_object(
      'expected_coordinates',jsonb_build_object('book',v_book,'folio',v_folio,'number',v_number),
      'expected_record_updated_at',v_original::text,'document_sha256',repeat('a',64));
    PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    BEGIN
      PERFORM public.register_registry_print(v_parish,v_type,v_rec,'partida',ARRAY[]::text[],'[]'::jsonb,v_metadata);
      RAISE EXCEPTION 'V148-FAIL: % accepted old updated_at even though record changed twice',v_type;
    EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1;
    END;
    SELECT public.register_registry_print(v_parish,v_type,v_rec,'partida',
      ARRAY[]::text[],'[]'::jsonb,
      jsonb_set(v_metadata,'{expected_record_updated_at}',to_jsonb(v_third::text)))
      INTO v_event;
    IF v_event IS NULL THEN RAISE EXCEPTION 'V148-FAIL: expected valid current version for %',v_type; END IF;
    EXECUTE 'RESET ROLE';
    v_accepted:=v_accepted+1;
  END LOOP;
  IF v_denied<>4 OR v_accepted<>4 OR v_markers<>4 THEN
    RAISE EXCEPTION 'V148 incomplete: % denied % accepted % markers',v_denied,v_accepted,v_markers;
  END IF;
END $qa$;
ROLLBACK;