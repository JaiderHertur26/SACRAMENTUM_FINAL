-- V187: colisiones de libro/folio/numero en los cuatro sacramentos.
-- Sólo filas ficticias, transacción con ROLLBACK; nada queda asentado.
BEGIN;
DO $qa$
DECLARE
  v_parish uuid;
  v_table text;
  v_index text;
  v_book text := 'QA187-'||substr(gen_random_uuid()::text,1,12);
  v_denied integer := 0;
  v_count integer := 0;
  v_actual text;
  v_rows integer;
BEGIN
  SELECT id INTO STRICT v_parish FROM public.parishes ORDER BY id LIMIT 1;
  FOREACH v_table IN ARRAY ARRAY['baptisms','confirmations','marriages','funerals'] LOOP
    v_index := CASE v_table
      WHEN 'baptisms' THEN 'uq_baptisms_registry_number'
      WHEN 'confirmations' THEN 'uq_confirmations_registry_number'
      WHEN 'marriages' THEN 'uq_marriages_parish_booktype_location'
      ELSE 'uq_funerals_location_by_book_type'
    END;
    IF v_table='funerals' THEN
      EXECUTE format('INSERT INTO public.%I (parish_id,book_number,folio,number,nombres,apellidos,fecha_defuncion,fecha_exequias,raw_data) VALUES ($1,$2,''17'',''33'',''NOMBRE FICTICIO'',''QA-V187'',''2026-01-01'',''2026-01-02'',$3)',v_table)
      USING v_parish,v_book,'{"qaOnly":true,"historicalEntryMode":"narrative","literalTranscription":"Ensayo sin asiento persistente"}'::jsonb;
    ELSIF v_table='marriages' THEN
      EXECUTE format('INSERT INTO public.%I (parish_id,book_number,folio,number,celebration_date,raw_data) VALUES ($1,$2,''17'',''33'',''2026-01-02'',$3)',v_table)
      USING v_parish,v_book,'{"qaOnly":true,"historicalEntryMode":"narrative","literalTranscription":"Ensayo sin asiento persistente"}'::jsonb;
    ELSE
      EXECUTE format('INSERT INTO public.%I (parish_id,book_number,folio,number,nombres,apellidos,celebration_date,raw_data) VALUES ($1,$2,''17'',''33'',''NOMBRE FICTICIO'',''QA-V187'',''2026-01-02'',$3)',v_table)
      USING v_parish,v_book,'{"qaOnly":true,"historicalEntryMode":"narrative","literalTranscription":"Ensayo sin asiento persistente"}'::jsonb;
    END IF;
    BEGIN
      IF v_table='funerals' THEN
        EXECUTE format('INSERT INTO public.%I (parish_id,book_number,folio,number,nombres,apellidos,fecha_defuncion,fecha_exequias,raw_data) VALUES ($1,$2,''17'',''33'',''NOMBRE FICTICIO'',''QA-V187'',''2026-01-01'',''2026-01-02'',$3)',v_table)
        USING v_parish,v_book,'{"qaOnly":true,"historicalEntryMode":"narrative","literalTranscription":"Ensayo sin asiento persistente"}'::jsonb;
      ELSIF v_table='marriages' THEN
        EXECUTE format('INSERT INTO public.%I (parish_id,book_number,folio,number,celebration_date,raw_data) VALUES ($1,$2,''17'',''33'',''2026-01-02'',$3)',v_table)
        USING v_parish,v_book,'{"qaOnly":true,"historicalEntryMode":"narrative","literalTranscription":"Ensayo sin asiento persistente"}'::jsonb;
      ELSE
        EXECUTE format('INSERT INTO public.%I (parish_id,book_number,folio,number,nombres,apellidos,celebration_date,raw_data) VALUES ($1,$2,''17'',''33'',''NOMBRE FICTICIO'',''QA-V187'',''2026-01-02'',$3)',v_table)
        USING v_parish,v_book,'{"qaOnly":true,"historicalEntryMode":"narrative","literalTranscription":"Ensayo sin asiento persistente"}'::jsonb;
      END IF;
      RAISE EXCEPTION 'V187 DUPLICATE ALLOWED for %',v_table;
    EXCEPTION WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_actual = CONSTRAINT_NAME;
      IF v_actual<>v_index AND v_actual<>(CASE v_table
        WHEN 'baptisms' THEN 'uq_baptisms_registry_normalized_v188'
        WHEN 'confirmations' THEN 'uq_confirmations_registry_normalized_v188'
        WHEN 'marriages' THEN 'uq_marriages_registry_normalized_v188'
        ELSE 'uq_funerals_registry_normalized_v188' END) THEN
        RAISE EXCEPTION 'V187 wrong uniqueness guard % on % (expected %)',v_actual,v_table,v_index;
      END IF;
      v_denied:=v_denied+1;
    END;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE parish_id=$1 AND book_number=$2 AND folio=''17'' AND number=''33''',v_table)
      INTO v_rows USING v_parish,v_book;
    IF v_rows<>1 THEN RAISE EXCEPTION 'V187 unexpected fixture rows in %: %',v_table,v_rows;END IF;
    v_count:=v_count+1;
  END LOOP;
  IF v_count<>4 OR v_denied<>4 THEN
    RAISE EXCEPTION 'V187 incomplete QA % tables, % denied',v_count,v_denied;
  END IF;
  PERFORM set_config('qa187.results',jsonb_build_object('sacraments',v_count,'duplicate_denials',v_denied,'one_original_each',true)::text,true);
END $qa$;
SELECT current_setting('qa187.results')::jsonb AS qa_results;
ROLLBACK;