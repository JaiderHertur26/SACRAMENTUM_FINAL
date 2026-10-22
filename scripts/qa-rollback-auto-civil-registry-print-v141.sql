-- V141 · Registro Civil automático: conservar referencia legítima y rechazar texto ajeno, ROLLBACK.
BEGIN;
DO $qa$
DECLARE v_actor uuid;v_parish uuid;v_baptism uuid;v_plain uuid;v_print uuid;v_data public.registry_print_events%rowtype;v_denied int:=0;
BEGIN
 SELECT auth_user_id,parish_id INTO STRICT v_actor,v_parish FROM public.user_profiles WHERE role='parish' AND is_active LIMIT 1;
 INSERT INTO public.baptisms(parish_id,status,book_number,folio,number,celebration_date,nombres,apellidos,nuip,raw_data)
 VALUES(v_parish,'seated','QA141','941','942',DATE '2021-01-01','NUIP','FICTICIO','QA141NUIP0001','{"qaOnly":true,"nuip":"QA141NUIP0001"}'::jsonb)
 RETURNING id INTO v_baptism;
 INSERT INTO public.baptisms(parish_id,status,book_number,folio,number,celebration_date,nombres,apellidos,raw_data)
 VALUES(v_parish,'seated','QA141','942','943',DATE '2021-01-01','SIN NUIP','FICTICIO','{"qaOnly":true}'::jsonb)
 RETURNING id INTO v_plain;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 SELECT public.register_registry_print(v_parish,'bautismo',v_baptism,'partida',
   ARRAY['auto-rc-'||v_baptism::text],
   jsonb_build_array(jsonb_build_object('id','auto-rc-'||v_baptism::text,
   'content','REGISTRO CIVIL: NUIP QA141NUIP0001 - REFERENCIA FICTICIA', 'policy','optional'))
 ) INTO v_print;
 SELECT * INTO STRICT v_data FROM public.registry_print_events WHERE id=v_print;
 IF v_data.metadata->>'contains_unverified_derived_note'<>'true'
  OR v_data.included_notes->0->>'provenance'<>'client_rendered_registry_fields_unverified'
  OR v_data.included_notes->0->>'content' NOT LIKE '%QA141NUIP0001%' THEN
  RAISE EXCEPTION 'V141-FAIL: nota civil no marcada como cliente no certificado';
 END IF;
 BEGIN
  PERFORM public.register_registry_print(v_parish,'bautismo',v_plain,'partida',
    ARRAY['auto-rc-'||v_plain::text],
    jsonb_build_array(jsonb_build_object('id','auto-rc-'||v_plain::text,'content','NUIP INVENTADO','policy','optional')));
  RAISE EXCEPTION 'V141-FAIL: nota civil sin NUIP en partida permitida';
 EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1; END;
 BEGIN
  PERFORM public.register_registry_print(v_parish,'bautismo',v_baptism,'partida',
    ARRAY['auto-rc-'||v_baptism::text],
    jsonb_build_array(jsonb_build_object('id','auto-rc-'||v_baptism::text,'content','IDENTIFICADOR FALSO','policy','optional')));
  RAISE EXCEPTION 'V141-FAIL: nota civil sin NUIP verdadero en contenido permitida';
 EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1; END;
 BEGIN
  PERFORM public.register_registry_print(v_parish,'bautismo',v_baptism,'partida',
    ARRAY['auto-rc-'||v_plain::text],
    jsonb_build_array(jsonb_build_object('id','auto-rc-'||v_plain::text,'content','QA141NUIP0001','policy','optional')));
  RAISE EXCEPTION 'V141-FAIL: vínculo civil ID de otra partida permitido';
 EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1; END;
 EXECUTE 'RESET ROLE';
 IF v_denied<>3 THEN RAISE EXCEPTION 'V141 expected three denials, got %',v_denied; END IF;
END $qa$;
ROLLBACK;