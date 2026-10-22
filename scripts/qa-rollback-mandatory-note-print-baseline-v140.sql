-- V140 · Hallazgo: registro de impresión omite nota obligatoria sin validación servidor.
BEGIN;
DO $qa$
DECLARE v_actor uuid;v_parish uuid;v_baptism uuid;v_note uuid;v_print uuid;v_count int;
BEGIN
 SELECT auth_user_id,parish_id INTO STRICT v_actor,v_parish
 FROM public.user_profiles WHERE role='parish' AND is_active LIMIT 1;
 INSERT INTO public.baptisms(parish_id,status,book_number,folio,number,celebration_date,nombres,apellidos,raw_data)
 VALUES(v_parish,'seated','QA140','940','940',DATE '2021-01-01','PRUEBA','V140','{"qaOnly":true}'::jsonb) RETURNING id INTO v_baptism;
 INSERT INTO public.marginal_notes(parish_id,sacrament_type,sacrament_id,note_type,content,status,print_policy,print_default)
 VALUES(v_parish,'bautismo',v_baptism,'qa-mandatory','QA V140 NOTA MARGINAL OBLIGATORIA', 'active','required',true)
 RETURNING id INTO v_note;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 SELECT public.register_registry_print(v_parish,'bautismo',v_baptism,'partida',ARRAY[]::text[],'[]'::jsonb,'{"qaOnly":true}'::jsonb)
 INTO v_print;
 EXECUTE 'RESET ROLE';
 SELECT count(*) INTO v_count FROM public.registry_print_events WHERE id=v_print
 AND NOT included_notes @> jsonb_build_array(jsonb_build_object('id',v_note::text));
 IF v_count=1 THEN RAISE EXCEPTION 'V140-CONFIRMED: print log accepted without mandatory marginal note'; END IF;
END $qa$;
ROLLBACK;