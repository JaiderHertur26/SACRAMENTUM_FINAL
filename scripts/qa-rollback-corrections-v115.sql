-- V115 · Matrimonio y Exequias: corrección / reversión con doble partida
BEGIN;
DO $qa$
DECLARE
 v_dio uuid; v_parish uuid; v_actor uuid; v_parish_actor uuid;
 v_original uuid; v_replacement uuid; v_decree uuid; v_s text;
 v_old text; v_new text; v_notes int; v_notices int; v_number text;
BEGIN
 SELECT diocese_id,auth_user_id INTO STRICT v_dio,v_actor
 FROM public.user_profiles WHERE role='chancery' AND is_active;
 SELECT id INTO STRICT v_parish FROM public.parishes WHERE diocese_id=v_dio
 AND is_operational ORDER BY id LIMIT 1;
 SELECT auth_user_id INTO STRICT v_parish_actor FROM public.user_profiles
 WHERE role='parish' AND diocese_id=v_dio AND is_active;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 FOREACH v_s IN ARRAY ARRAY['matrimonio','exequias'] LOOP
  v_number:='QA-V115-CORR-'||v_s||'-'||substr(gen_random_uuid()::text,1,8);
  IF v_s='matrimonio' THEN
   INSERT INTO public.marriages(parish_id,celebration_date,status,raw_data,book_type)
   VALUES(v_parish,'2019-01-01','seated',
   '{"qaOnly":true,"novioNombres":"PRUEBA","novioApellidos":"ALFA","noviaNombres":"FICTICIA","noviaApellidos":"BETA","fechaMatrimonio":"2019-01-01"}'::jsonb,'ordinario')
   RETURNING id INTO v_original;
   SELECT decree_id,replacement_marriage_id INTO STRICT v_decree,v_replacement
   FROM public.apply_marriage_correction(
     v_original,CURRENT_DATE,
     'Corrección ficticia por error documental demostrado en laboratorio.',
     '{"novioApellidos":"ALFA-CORREGIDO"}'::jsonb,v_number
   );
   SELECT status INTO STRICT v_old FROM public.marriages WHERE id=v_original;
   SELECT status INTO STRICT v_new FROM public.marriages WHERE id=v_replacement;
  ELSE
   INSERT INTO public.funerals(parish_id,status,nombres,apellidos,
     fecha_nacimiento,fecha_defuncion,fecha_exequias,raw_data,book_type)
   VALUES(v_parish,'seated','PERSONA','FICTICIA',
     '1945-01-01','2021-01-01','2021-01-02',
     '{"qaOnly":true}'::jsonb,'ordinario')
   RETURNING id INTO v_original;
   SELECT decree_id,replacement_funeral_id INTO STRICT v_decree,v_replacement
   FROM public.apply_funeral_correction(
     v_original,CURRENT_DATE,
     'Corrección ficticia por error documental demostrado en laboratorio.',
     '{"apellidos":"FICTICIA-CORREGIDO"}'::jsonb,v_number
   );
   SELECT status INTO STRICT v_old FROM public.funerals WHERE id=v_original;
   SELECT status INTO STRICT v_new FROM public.funerals WHERE id=v_replacement;
  END IF;
  IF v_old<>'anulada' OR v_new<>'seated' OR
   (SELECT original_record_id IS DISTINCT FROM v_original FROM public.decretos WHERE id=v_decree) OR
   (SELECT replacement_record_id IS DISTINCT FROM v_replacement FROM public.decretos WHERE id=v_decree)
  THEN RAISE EXCEPTION 'V115: partida corregida sin vínculo adecuado %: % %',v_s,v_old,v_new; END IF;
  SELECT count(*) INTO v_notes FROM public.marginal_notes WHERE decree_id=v_decree;
  SELECT count(*) INTO v_notices FROM public.official_notifications WHERE decree_id=v_decree;
  IF v_notes<2 OR v_notices<1 THEN RAISE EXCEPTION 'V115: faltan notas o avisos de corrección %',v_s; END IF;
  PERFORM set_config('request.jwt.claim.sub',v_parish_actor::text,true);
  BEGIN
    IF v_s='matrimonio' THEN
     PERFORM public.reverse_marriage_decree(v_decree,'Reversión indebida de parroquia');
    ELSE
     PERFORM public.reverse_funeral_decree(v_decree,'Reversión indebida de parroquia');
    END IF;
    RAISE EXCEPTION 'V115: parroquia revirtió corrección';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='V115: parroquia revirtió corrección' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
  IF v_s='matrimonio' THEN
   PERFORM public.reverse_marriage_decree(v_decree,'Reversión ficticia autorizada');
   SELECT status INTO STRICT v_old FROM public.marriages WHERE id=v_original;
   SELECT status INTO STRICT v_new FROM public.marriages WHERE id=v_replacement;
  ELSE
   PERFORM public.reverse_funeral_decree(v_decree,'Reversión ficticia autorizada');
   SELECT status INTO STRICT v_old FROM public.funerals WHERE id=v_original;
   SELECT status INTO STRICT v_new FROM public.funerals WHERE id=v_replacement;
  END IF;
  IF v_old<>'seated' OR v_new<>'reversed' OR
    (SELECT status FROM public.decretos WHERE id=v_decree)<>'reversed'
  THEN RAISE EXCEPTION 'V115: la reversión no restituyó el original % (% / %)',v_s,v_old,v_new; END IF;
  IF (SELECT count(*) FROM public.marginal_notes WHERE decree_id=v_decree)<=v_notes
  THEN RAISE EXCEPTION 'V115: falta anotación de reversión %',v_s; END IF;
 END LOOP;
END
$qa$;
ROLLBACK;