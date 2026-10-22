-- V143 · Cotejo de libro/folio/número y versión antes de certificar impresión: cuatro sacramentos, ROLLBACK.
BEGIN;
DO $qa$
DECLARE
 v_actor uuid; v_parish uuid; v_type text; v_table text; v_rec uuid;
 v_expected_folio text; v_expected_number text;
 v_updated timestamptz; v_meta jsonb; v_id uuid;
 v_denied integer:=0; v_passed integer:=0; v_legacy integer:=0;
 v_receipt public.registry_print_events%rowtype;
BEGIN
 SELECT auth_user_id,parish_id INTO STRICT v_actor,v_parish
 FROM public.user_profiles WHERE role='parish' and is_active LIMIT 1;
 FOREACH v_type IN ARRAY ARRAY['bautismo','confirmacion','matrimonio','exequias'] LOOP
  CASE v_type
   WHEN 'bautismo' THEN
     v_table:='baptisms'; v_expected_folio:='443';v_expected_number:='531';
     INSERT INTO public.baptisms(parish_id,status,celebration_date,nombres,apellidos,book_number,folio,number,raw_data)
     VALUES(v_parish,'seated',DATE '2022-01-01','PRUEBA','V143','QA143','443','531','{"qaOnly":true}'::jsonb) RETURNING id INTO v_rec;
   WHEN 'confirmacion' THEN
     v_table:='confirmations';v_expected_folio:='444';v_expected_number:='532';
     INSERT INTO public.confirmations(parish_id,status,celebration_date,nombres,apellidos,book_number,folio,number,raw_data)
     VALUES(v_parish,'seated',DATE '2022-01-01','PRUEBA','V143','QA143','444','532','{"qaOnly":true}'::jsonb) RETURNING id INTO v_rec;
   WHEN 'matrimonio' THEN
     v_table:='marriages';v_expected_folio:='445';v_expected_number:='533';
     INSERT INTO public.marriages(parish_id,status,celebration_date,book_number,folio,number,raw_data)
     VALUES(v_parish,'seated',DATE '2022-01-01','QA143','445','533','{"qaOnly":true}'::jsonb) RETURNING id INTO v_rec;
   ELSE
     v_table:='funerals';v_expected_folio:='446';v_expected_number:='534';
     INSERT INTO public.funerals(parish_id,status,nombres,apellidos,fecha_nacimiento,fecha_defuncion,fecha_exequias,book_number,folio,number,raw_data)
     VALUES(v_parish,'seated','PRUEBA','V143',DATE '1942-01-01',DATE '2021-01-01',DATE '2021-01-02','QA143','446','534','{"qaOnly":true}'::jsonb) RETURNING id INTO v_rec;
  END CASE;

  EXECUTE format('SELECT updated_at FROM public.%I WHERE id=$1',v_table) INTO v_updated USING v_rec;
  v_meta:=jsonb_build_object(
    'expected_coordinates',jsonb_build_object('book','QA143','folio',v_expected_folio,'number',v_expected_number),
    'expected_record_updated_at',v_updated::text,
    'document_sha256',repeat('a',64)
  );

  PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  -- Accept precisely matching fields and record version.
  SELECT public.register_registry_print(v_parish,v_type,v_rec,'partida','{}'::text[],'[]'::jsonb,v_meta) INTO v_id;
  SELECT * INTO STRICT v_receipt FROM public.registry_print_events WHERE id=v_id;
  IF v_receipt.metadata->>'folio' IS DISTINCT FROM v_expected_folio
     OR v_receipt.metadata->>'record_status' IS DISTINCT FROM 'seated'
     OR v_receipt.metadata->>'document_sha256' IS DISTINCT FROM repeat('a',64)
     OR v_receipt.metadata->>'coordinates_checked' IS DISTINCT FROM 'true'
     OR v_receipt.metadata->>'record_version_checked' IS DISTINCT FROM 'true'
     OR v_receipt.metadata->>'document_sha256_provenance' IS DISTINCT FROM 'client_digest_not_server_certification'
  THEN RAISE EXCEPTION 'V143-FAIL: recibo no corroboró versión/coordenadas para %',v_type; END IF;
  v_passed:=v_passed+1;

  -- Book discrepancy.
  BEGIN
   PERFORM public.register_registry_print(v_parish,v_type,v_rec,'partida','{}'::text[],'[]'::jsonb,
     jsonb_set(v_meta,'{expected_coordinates,book}','"LIBRO_FALSO"'::jsonb));
   RAISE EXCEPTION 'V143-FAIL: libro incorrecto autorizado %',v_type;
  EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1; END;

  -- Folio discrepancy.
  BEGIN
   PERFORM public.register_registry_print(v_parish,v_type,v_rec,'partida','{}'::text[],'[]'::jsonb,
     jsonb_set(v_meta,'{expected_coordinates,folio}','"FOLIO_FALSO"'::jsonb));
   RAISE EXCEPTION 'V143-FAIL: folio incorrecto autorizado %',v_type;
  EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1; END;

  -- Number discrepancy.
  BEGIN
   PERFORM public.register_registry_print(v_parish,v_type,v_rec,'partida','{}'::text[],'[]'::jsonb,
     jsonb_set(v_meta,'{expected_coordinates,number}','"NUMERO_FALSO"'::jsonb));
   RAISE EXCEPTION 'V143-FAIL: número incorrecto autorizado %',v_type;
  EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1; END;

  -- Browser must not fake 64-character digest.
  BEGIN
   PERFORM public.register_registry_print(v_parish,v_type,v_rec,'partida','{}'::text[],'[]'::jsonb,
     jsonb_set(v_meta,'{document_sha256}','"weak-hash"'::jsonb));
   RAISE EXCEPTION 'V143-FAIL: huella malformada autorizada %',v_type;
  EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1; END;

  -- Stale version sent by a browser that loaded the record one day earlier.
  -- Same-transaction update triggers may normalize updated_at to transaction start,
  -- so simulate a genuinely older browser timestamp instead of a fake DB change.
  BEGIN
   PERFORM public.register_registry_print(v_parish,v_type,v_rec,'partida','{}'::text[],'[]'::jsonb,
     jsonb_set(v_meta,'{expected_record_updated_at}',to_jsonb((v_updated-interval '1 day')::text)));
   RAISE EXCEPTION 'V143-FAIL: versión anterior autorizada %',v_type;
  EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1; END;

  -- Missing coordinates must not be accepted if an incomplete object is sent.
  BEGIN
   PERFORM public.register_registry_print(v_parish,v_type,v_rec,'partida','{}'::text[],'[]'::jsonb,
     jsonb_set(v_meta,'{expected_coordinates}', '{"book":"QA143"}'::jsonb));
   RAISE EXCEPTION 'V143-FAIL: coordenadas incompletas autorizadas %',v_type;
  EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1; END;

  -- Legacy clients without new fields continue to work, explicitly unchecked.
  SELECT public.register_registry_print(v_parish,v_type,v_rec,'partida','{}'::text[],'[]'::jsonb,'{}'::jsonb) INTO v_id;
  SELECT * INTO STRICT v_receipt FROM public.registry_print_events WHERE id=v_id;
  IF v_receipt.metadata->>'coordinates_checked' IS DISTINCT FROM 'false'
     OR v_receipt.metadata->>'record_version_checked' IS DISTINCT FROM 'false'
  THEN RAISE EXCEPTION 'V143-FAIL: ruta antigua no fue marcada como no cotejada %',v_type; END IF;
  v_legacy:=v_legacy+1;
  EXECUTE 'RESET ROLE';
 END LOOP;
 IF v_passed<>4 OR v_denied<>24 OR v_legacy<>4 THEN
  RAISE EXCEPTION 'V143 matrix mismatch: passed % denied % legacy %',v_passed,v_denied,v_legacy;
 END IF;
END $qa$;
ROLLBACK;