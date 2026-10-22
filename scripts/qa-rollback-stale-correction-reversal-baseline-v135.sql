-- V135 · Reproducción de reversión que reabre original aunque su supletoria ya fue afectada después. ROLLBACK.
BEGIN;
DO $qa$
DECLARE v_dio uuid;v_actor uuid;v_parish uuid;v_s text;v_original uuid;v_new uuid;v_decree uuid;v_st text;v_new_st text;v_ref text;
BEGIN
 SELECT diocese_id,auth_user_id INTO STRICT v_dio,v_actor FROM public.user_profiles WHERE role='chancery' AND is_active LIMIT 1;
 SELECT id INTO STRICT v_parish FROM public.parishes WHERE diocese_id=v_dio AND is_operational ORDER BY id LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 FOREACH v_s IN ARRAY ARRAY['matrimonio','exequias'] LOOP
   v_ref:='QA-V135-STALE-'||v_s||'-'||left(gen_random_uuid()::text,8);
   IF v_s='matrimonio' THEN
     INSERT INTO public.marriages(parish_id,celebration_date,status,raw_data,book_type)
       VALUES(v_parish,DATE '2019-01-01','seated','{"qaOnly":true,"novioNombres":"PRUEBA","noviaNombres":"FICTICIA"}'::jsonb,'ordinario')
       RETURNING id INTO v_original;
     SELECT decree_id,replacement_marriage_id INTO STRICT v_decree,v_new
     FROM public.apply_marriage_correction(v_original,CURRENT_DATE,'Corrección de partida estrictamente ficticia en QA.',
       '{"novioApellidos":"CORREGIDO-QA"}'::jsonb,v_ref);
     -- Simulación reversible de una resolución posterior que ya afecta a la supletoria.
     UPDATE public.marriages SET status='nullified' WHERE id=v_new;
     PERFORM public.reverse_marriage_decree(v_decree,'Reversión tardía ficticia que no debería rehabilitar original');
     SELECT status INTO STRICT v_st FROM public.marriages WHERE id=v_original;
     SELECT status INTO STRICT v_new_st FROM public.marriages WHERE id=v_new;
   ELSE
     INSERT INTO public.funerals(parish_id,status,nombres,apellidos,fecha_nacimiento,fecha_defuncion,fecha_exequias,raw_data,book_type)
       VALUES(v_parish,'seated','PERSONA','QA',DATE '1945-01-01',DATE '2021-01-01',DATE '2021-01-02',
         '{"qaOnly":true}'::jsonb,'ordinario') RETURNING id INTO v_original;
     SELECT decree_id,replacement_funeral_id INTO STRICT v_decree,v_new
     FROM public.apply_funeral_correction(v_original,CURRENT_DATE,'Corrección de exequias ficticia de laboratorio.',
       '{"apellidos":"CORREGIDO-QA"}'::jsonb,v_ref);
     UPDATE public.funerals SET status='reversed' WHERE id=v_new;
     PERFORM public.reverse_funeral_decree(v_decree,'Reversión tardía ficticia que no debe rehabilitar original');
     SELECT status INTO STRICT v_st FROM public.funerals WHERE id=v_original;
     SELECT status INTO STRICT v_new_st FROM public.funerals WHERE id=v_new;
   END IF;
   IF v_st='seated' AND v_new_st='reversed' THEN
     RAISE EXCEPTION 'V135-CONFIRMED: reversión tardía % rehabilitó original y sobrescribió estado posterior de supletoria',v_s;
   END IF;
 END LOOP;
END $qa$;
ROLLBACK;