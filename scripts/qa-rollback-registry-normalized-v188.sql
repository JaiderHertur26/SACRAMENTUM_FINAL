-- SACRAMENTUM V188: rechazo de duplicado semántico con espacios/mayúsculas.
-- Datos inventados dentro de BEGIN/ROLLBACK, cero cambios permanentes.
BEGIN;
DO $qa$
DECLARE
  parish uuid; tab text; guard text;
  book text:='QA188-'||substr(gen_random_uuid()::text,1,12);
  denied integer:=0; tested integer:=0; actual text; rows_count integer;
  fixture jsonb:='{"qaOnly":true,"historicalEntryMode":"narrative","literalTranscription":"Prueba ficticia sin asiento persistente"}'::jsonb;
  sql_insert text;
BEGIN
 SELECT id INTO STRICT parish FROM public.parishes ORDER BY id LIMIT 1;
 FOREACH tab IN ARRAY ARRAY['baptisms','confirmations','marriages','funerals'] LOOP
  guard:=CASE tab WHEN 'baptisms' THEN 'uq_baptisms_registry_normalized_v188'
    WHEN 'confirmations' THEN 'uq_confirmations_registry_normalized_v188'
    WHEN 'marriages' THEN 'uq_marriages_registry_normalized_v188'
    ELSE 'uq_funerals_registry_normalized_v188' END;
  IF tab='funerals' THEN
    sql_insert:=format('INSERT INTO public.%I(parish_id,book_number,folio,number,fecha_defuncion,fecha_exequias,raw_data) VALUES ($1,$2,$3,$4,''2026-01-01'',''2026-01-02'',$5)',tab);
  ELSIF tab='marriages' THEN
    sql_insert:=format('INSERT INTO public.%I(parish_id,book_number,folio,number,celebration_date,raw_data) VALUES ($1,$2,$3,$4,''2026-01-02'',$5)',tab);
  ELSE
    sql_insert:=format('INSERT INTO public.%I(parish_id,book_number,folio,number,nombres,apellidos,celebration_date,raw_data) VALUES ($1,$2,$3,$4,''FICTICIO'',''QA-V188'',''2026-01-02'',$5)',tab);
  END IF;
  EXECUTE sql_insert USING parish,book,'17','33',fixture;
  BEGIN
    EXECUTE sql_insert USING parish,'  '||lower(book)||'  ',' 17 ',' 33 ',fixture;
    RAISE EXCEPTION 'V188 semantically duplicate registry accepted by %',tab;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS actual=CONSTRAINT_NAME;
    IF actual<>guard THEN RAISE EXCEPTION 'V188 wrong protection % expected %',actual,guard;END IF;
    denied:=denied+1;
  END;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE parish_id=$1 AND lower(btrim(book_number))=lower($2)',tab)
    INTO rows_count USING parish,book;
  IF rows_count<>1 THEN RAISE EXCEPTION 'V188 inconsistent count on %',tab;END IF;
  tested:=tested+1;
 END LOOP;
 IF tested<>4 OR denied<>4 THEN RAISE EXCEPTION 'V188 incomplete validation';END IF;
 PERFORM set_config('qa188.report',jsonb_build_object('tables',tested,'normalized_duplicates_denied',denied,'rollback',true)::text,true);
END $qa$;
SELECT current_setting('qa188.report')::jsonb AS qa_report;
ROLLBACK;