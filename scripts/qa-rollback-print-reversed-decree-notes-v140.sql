-- V140 · A reversed decree cannot revalidate its prior operative note; reversal note remains mandatory and printable.
BEGIN;
DO $qa$
DECLARE
 v_actor uuid;v_chancery uuid;v_parish uuid;v_diocese uuid;v_baptism uuid;v_decree uuid;
 v_previous uuid;v_reversal uuid;v_print uuid;v_denied int:=0;v_approved int:=0;
 v_reverse_json jsonb;v_prior_json jsonb;v_row public.registry_print_events%rowtype;
BEGIN
 SELECT auth_user_id,parish_id,diocese_id INTO STRICT v_actor,v_parish,v_diocese
 FROM public.user_profiles WHERE role='parish' AND is_active LIMIT 1;
 SELECT auth_user_id INTO STRICT v_chancery FROM public.user_profiles
 WHERE role='chancery' AND is_active AND diocese_id=v_diocese LIMIT 1;
 INSERT INTO public.baptisms(parish_id,status,book_number,folio,number,celebration_date,nombres,apellidos,raw_data)
 VALUES(v_parish,'seated','QA140R','950','950',DATE '2021-01-01','REVERSIÓN','FICTICIA','{"qaOnly":true}'::jsonb)
 RETURNING id INTO v_baptism;
 INSERT INTO public.decretos(parish_id,diocese_id,tipo,decree_number,decree_date,sacrament_type,status,original_record_id,issued_by,payload)
 VALUES(v_parish,v_diocese,'correccion','QA-V140-REVERSED-'||left(gen_random_uuid()::text,8),CURRENT_DATE,
  'bautismo','reversed',v_baptism,v_chancery,'{"qaOnly":true}'::jsonb)
 RETURNING id INTO v_decree;
 INSERT INTO public.marginal_notes(parish_id,sacrament_type,sacrament_id,decree_id,note_type,content,status,print_policy)
 VALUES(v_parish,'bautismo',v_baptism,v_decree,'correccion_original','DECRETO YA SIN EFECTOS: ANTIGUA NOTA', 'active','optional')
 RETURNING id INTO v_previous;
 INSERT INTO public.marginal_notes(parish_id,sacrament_type,sacrament_id,decree_id,note_type,content,status,print_policy)
 VALUES(v_parish,'bautismo',v_baptism,v_decree,'reversion_correccion_original','REVERSIÓN DOCUMENTAL DEBE PERMANECER EN IMPRESIÓN', 'active','required')
 RETURNING id INTO v_reversal;

 v_reverse_json:=jsonb_build_object('id',v_reversal::text,'content','REVERSIÓN DOCUMENTAL DEBE PERMANECER EN IMPRESIÓN','policy','required');
 v_prior_json:=jsonb_build_object('id',v_previous::text,'content','DECRETO YA SIN EFECTOS: ANTIGUA NOTA','policy','optional');
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 BEGIN
  PERFORM public.register_registry_print(v_parish,'bautismo',v_baptism,'partida',ARRAY[v_previous::text,v_reversal::text],
   jsonb_build_array(v_reverse_json,v_prior_json));
  RAISE EXCEPTION 'V140-FAIL: old reversed decree note passed as valid';
 EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1;
 END;
 BEGIN
  PERFORM public.register_registry_print(v_parish,'bautismo',v_baptism,'partida',ARRAY[]::text[],'[]'::jsonb);
  RAISE EXCEPTION 'V140-FAIL: mandatory reversal note omitted';
 EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1;
 END;
 SELECT public.register_registry_print(v_parish,'bautismo',v_baptism,'partida',
 ARRAY[v_reversal::text],jsonb_build_array(v_reverse_json)) INTO v_print;
 SELECT * INTO STRICT v_row FROM public.registry_print_events WHERE id=v_print;
 IF jsonb_array_length(v_row.included_notes)<>1 OR
    v_row.included_notes->0->>'id'<>v_reversal::text OR
    v_row.included_notes->0->>'provenance'<>'persisted_verified' THEN
  RAISE EXCEPTION 'V140-FAIL reversal note not faithfully logged';
 END IF;
 v_approved:=v_approved+1;
 EXECUTE 'RESET ROLE';
 IF v_denied<>2 OR v_approved<>1 THEN RAISE EXCEPTION 'V140 decree matrix failed'; END IF;
END $qa$;
ROLLBACK;