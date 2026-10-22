-- V140 · Mandatory, forged, internal, inactive, foreign note and historical inline print QA. All ROLLBACK.
BEGIN;
DO $qa$
DECLARE
 v_actor uuid;v_parish uuid;v_baptism uuid;v_other_baptism uuid;
 v_required uuid;v_internal uuid;v_inactive uuid;v_optional uuid;v_other uuid;
 v_print uuid;v_row public.registry_print_events%rowtype;v_denied int:=0;v_ok int:=0;
 v_required_note jsonb;v_optional_note jsonb;v_internal_note jsonb;v_inactive_note jsonb;v_other_note jsonb;
BEGIN
 SELECT auth_user_id,parish_id INTO STRICT v_actor,v_parish FROM public.user_profiles WHERE role='parish' AND is_active LIMIT 1;
 INSERT INTO public.baptisms(parish_id,status,book_number,folio,number,celebration_date,nombres,apellidos,raw_data)
 VALUES(v_parish,'seated','QA140','940','940',DATE '2021-01-01','PRUEBA','V140','{"qaOnly":true}'::jsonb)
 RETURNING id INTO v_baptism;
 INSERT INTO public.baptisms(parish_id,status,book_number,folio,number,celebration_date,nombres,apellidos,raw_data)
 VALUES(v_parish,'seated','QA140','941','941',DATE '2021-01-01','SEGUNDA','V140','{"qaOnly":true}'::jsonb)
 RETURNING id INTO v_other_baptism;
 INSERT INTO public.marginal_notes(parish_id,sacrament_type,sacrament_id,note_type,content,status,print_policy,print_default)
 VALUES(v_parish,'bautismo',v_baptism,'qa-required','QA V140 TEXTO OBLIGATORIO', 'active','required',true)
 RETURNING id INTO v_required;
 INSERT INTO public.marginal_notes(parish_id,sacrament_type,sacrament_id,note_type,content,status,print_policy)
 VALUES(v_parish,'bautismo',v_baptism,'qa-internal','QA V140 TEXTO INTERNO','active','internal')
 RETURNING id INTO v_internal;
 INSERT INTO public.marginal_notes(parish_id,sacrament_type,sacrament_id,note_type,content,status,print_policy)
 VALUES(v_parish,'bautismo',v_baptism,'qa-inactive','QA V140 TEXTO INACTIVO','reversed','optional')
 RETURNING id INTO v_inactive;
 INSERT INTO public.marginal_notes(parish_id,sacrament_type,sacrament_id,note_type,content,status,print_policy)
 VALUES(v_parish,'bautismo',v_baptism,'qa-optional','QA V140 TEXTO OPCIONAL','active','optional')
 RETURNING id INTO v_optional;
 INSERT INTO public.marginal_notes(parish_id,sacrament_type,sacrament_id,note_type,content,status,print_policy)
 VALUES(v_parish,'bautismo',v_other_baptism,'qa-other','QA V140 TEXTO PARTIDA AJENA','active','optional')
 RETURNING id INTO v_other;

 v_required_note:=jsonb_build_object('id',v_required::text,'content','QA V140 TEXTO OBLIGATORIO','policy','required','label','ETIQUETA CLIENTE ALTERABLE');
 v_optional_note:=jsonb_build_object('id',v_optional::text,'content','QA V140 TEXTO OPCIONAL','policy','optional');
 v_internal_note:=jsonb_build_object('id',v_internal::text,'content','QA V140 TEXTO INTERNO','policy','internal');
 v_inactive_note:=jsonb_build_object('id',v_inactive::text,'content','QA V140 TEXTO INACTIVO','policy','optional');
 v_other_note:=jsonb_build_object('id',v_other::text,'content','QA V140 TEXTO PARTIDA AJENA','policy','optional');

 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 -- A missing mandatory note must be denied by backend.
 BEGIN
  PERFORM public.register_registry_print(v_parish,'bautismo',v_baptism,'partida',ARRAY[]::text[],'[]'::jsonb);
  RAISE EXCEPTION 'V140-FAIL accepted print without mandatory note';
 EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1;
 END;
 -- Forged content of a real note.
 BEGIN
  PERFORM public.register_registry_print(v_parish,'bautismo',v_baptism,'partida',ARRAY[v_required::text],
   jsonb_build_array(jsonb_set(v_required_note,'{content}','"QA FORGERY"'::jsonb)));
  RAISE EXCEPTION 'V140-FAIL forged printed text accepted';
 EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1; END;
 -- Missing optional is legal but submitting an internal one is not.
 BEGIN
  PERFORM public.register_registry_print(v_parish,'bautismo',v_baptism,'partida',ARRAY[v_required::text,v_internal::text],
   jsonb_build_array(v_required_note,v_internal_note));
  RAISE EXCEPTION 'V140-FAIL internal note printed';
 EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1; END;
 BEGIN
  PERFORM public.register_registry_print(v_parish,'bautismo',v_baptism,'partida',ARRAY[v_required::text,v_inactive::text],
   jsonb_build_array(v_required_note,v_inactive_note));
  RAISE EXCEPTION 'V140-FAIL reversed note printed as active';
 EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1; END;
 BEGIN
  PERFORM public.register_registry_print(v_parish,'bautismo',v_baptism,'partida',ARRAY[v_required::text,v_other::text],
   jsonb_build_array(v_required_note,v_other_note));
  RAISE EXCEPTION 'V140-FAIL note from other sacramental record printed';
 EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1; END;
 BEGIN
  PERFORM public.register_registry_print(v_parish,'bautismo',v_baptism,'partida',ARRAY[v_required::text,gen_random_uuid()::text],
   jsonb_build_array(v_required_note));
  RAISE EXCEPTION 'V140-FAIL phantom selected note accepted';
 EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1; END;
 BEGIN
  PERFORM public.register_registry_print(v_parish,'bautismo',v_baptism,'partida',ARRAY[v_required::text,v_required::text],
   jsonb_build_array(v_required_note,v_required_note));
  RAISE EXCEPTION 'V140-FAIL duplicated included note accepted';
 EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1; END;
 -- Valid mandatory note with canonical server content.
 SELECT public.register_registry_print(v_parish,'bautismo',v_baptism,'partida',ARRAY[v_required::text],
  jsonb_build_array(v_required_note)) INTO v_print;
 SELECT * INTO STRICT v_row FROM public.registry_print_events WHERE id=v_print;
 IF jsonb_array_length(v_row.included_notes)<>1
 OR v_row.included_notes->0->>'id'<>v_required::text
 OR v_row.included_notes->0->>'content'<>'QA V140 TEXTO OBLIGATORIO'
 OR v_row.included_notes->0->>'label'<>'qa-required'
 OR v_row.included_notes->0->>'provenance'<>'persisted_verified'
 OR v_row.metadata->>'record_status'<>'seated' THEN
  RAISE EXCEPTION 'V140-FAIL canonical document note not persisted';
 END IF;
 v_ok:=v_ok+1;
 SELECT public.register_registry_print(v_parish,'bautismo',v_baptism,'partida',ARRAY[v_required::text,v_optional::text],
  jsonb_build_array(v_required_note,v_optional_note)) INTO v_print;
 SELECT * INTO STRICT v_row FROM public.registry_print_events WHERE id=v_print;
 IF jsonb_array_length(v_row.included_notes)<>2 THEN RAISE EXCEPTION 'V140-FAIL optional note lost'; END IF;
 v_ok:=v_ok+1;
 -- Historical inline only survives when it is explicitly marked unverified.
 SELECT public.register_registry_print(v_parish,'bautismo',v_baptism,'partida',ARRAY[v_required::text,'legacy-inline'],
  jsonb_build_array(v_required_note,jsonb_build_object('id','legacy-inline','content','TRANSCRIPCION HISTORICA','policy','optional')))
 INTO v_print;
 SELECT * INTO STRICT v_row FROM public.registry_print_events WHERE id=v_print;
 IF v_row.metadata->>'contains_unverified_legacy_inline'<>'true'
 OR v_row.included_notes->1->>'provenance'<>'client_supplied_unverified_historical' THEN
  RAISE EXCEPTION 'V140-FAIL historical source not labelled';
 END IF;
 v_ok:=v_ok+1;
 EXECUTE 'RESET ROLE';
 IF v_denied<>7 OR v_ok<>3 THEN RAISE EXCEPTION 'V140 outcomes denied %, valid %',v_denied,v_ok; END IF;
END $qa$;
ROLLBACK;