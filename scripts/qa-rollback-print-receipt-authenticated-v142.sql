-- V142 · Same authenticated parish user reads back canonical print receipt for four sacraments. ROLLBACK.
BEGIN;
DO $qa$
DECLARE v_actor uuid;v_parish uuid;v_type text;v_record uuid;v_note uuid;v_print uuid;
v_denied int:=0;v_accepted int:=0;v_row public.registry_print_events%rowtype;
BEGIN
 SELECT auth_user_id,parish_id INTO STRICT v_actor,v_parish
 FROM public.user_profiles WHERE role='parish' AND is_active LIMIT 1;
 FOREACH v_type IN ARRAY ARRAY['bautismo','confirmacion','matrimonio','exequias'] LOOP
  IF v_type='bautismo' THEN
    INSERT INTO public.baptisms(parish_id,status,celebration_date,nombres,apellidos,book_number,folio,number,raw_data)
    VALUES(v_parish,'seated',DATE '2021-01-01','PRUEBA','V141','QA141','990','990','{"qaOnly":true}'::jsonb)
    RETURNING id INTO v_record;
  ELSIF v_type='confirmacion' THEN
    INSERT INTO public.confirmations(parish_id,status,celebration_date,nombres,apellidos,book_number,folio,number,raw_data)
    VALUES(v_parish,'seated',DATE '2021-01-01','PRUEBA','V141','QA141','991','991','{"qaOnly":true}'::jsonb)
    RETURNING id INTO v_record;
  ELSIF v_type='matrimonio' THEN
    INSERT INTO public.marriages(parish_id,status,celebration_date,book_number,folio,number,raw_data)
    VALUES(v_parish,'seated',DATE '2021-01-01','QA141','992','992',
      '{"qaOnly":true,"novioNombres":"FICTICIO","noviaNombres":"FICTICIA"}'::jsonb)
    RETURNING id INTO v_record;
  ELSE
    INSERT INTO public.funerals(parish_id,status,nombres,apellidos,fecha_nacimiento,fecha_defuncion,fecha_exequias,book_number,folio,number,raw_data)
    VALUES(v_parish,'seated','PERSONA','QA',DATE '1940-01-01',DATE '2020-01-01',DATE '2020-01-02','QA141','993','993','{"qaOnly":true}'::jsonb)
    RETURNING id INTO v_record;
  END IF;
  INSERT INTO public.marginal_notes(parish_id,sacrament_type,sacrament_id,note_type,content,status,print_policy,print_default)
  VALUES(v_parish,v_type,v_record,'qa_required','NOTA OBLIGATORIA FICTICIA V141 '||v_type,'active','required',true)
  RETURNING id INTO v_note;
  PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.register_registry_print(v_parish,v_type,v_record,'partida',ARRAY[]::text[],'[]'::jsonb);
    RAISE EXCEPTION 'V141-FAIL: impresión de % sin nota obligatoria aceptada',v_type;
  EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1; END;
  SELECT public.register_registry_print(v_parish,v_type,v_record,'partida',ARRAY[v_note::text],
    jsonb_build_array(jsonb_build_object('id',v_note::text,'policy','required','content',
    'NOTA OBLIGATORIA FICTICIA V141 '||v_type))) INTO v_print;
  -- El mismo actor institucional que solicitó imprimir debe poder leer la constancia:
  -- V142 no permitirá pasar al navegador si la autorización RLS lo impide.
  SELECT * INTO STRICT v_row FROM public.registry_print_events
  WHERE id=v_print AND parish_id=v_parish AND sacrament_id=v_record;
  IF v_row.requested_by IS DISTINCT FROM v_actor
     OR v_row.metadata->>'record_status' IS DISTINCT FROM 'seated'
     OR v_row.document_kind IS DISTINCT FROM 'partida'
     OR v_row.metadata->>'note_provenance_validation'
       IS DISTINCT FROM 'server_persisted_with_explicit_legacy_exception'
  THEN RAISE EXCEPTION 'V142-FAIL: constancia del mismo usuario carece de datos verificables'; END IF;
  EXECUTE 'RESET ROLE';
  IF v_row.sacrament_type<>v_type OR jsonb_array_length(v_row.included_notes)<>1
      OR v_row.included_notes->0->>'id'<>v_note::text
      OR v_row.included_notes->0->>'provenance'<>'persisted_verified' THEN
   RAISE EXCEPTION 'V141-FAIL: impresión de % con nota obligatoria no auditada',v_type;
  END IF;
  v_accepted:=v_accepted+1;
 END LOOP;
 IF v_denied<>4 OR v_accepted<>4 THEN
  RAISE EXCEPTION 'V141 multi-sacrament test incomplete denials % accepted %',v_denied,v_accepted;
 END IF;
END $qa$;
ROLLBACK;
