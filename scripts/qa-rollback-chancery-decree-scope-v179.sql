-- SACRAMENTUM V179 · 5 ACTIVE Chancellor authorization gates, 25 forbidden cases.
-- No real decree or sacrament rows, fictitious auth actor; BEGIN/ROLLBACK.
BEGIN;
DO $fixture$
DECLARE a uuid:=gen_random_uuid(); p uuid; di uuid;
BEGIN
 SELECT id,diocese_id INTO STRICT p,di FROM public.parishes WHERE diocese_id IS NOT NULL ORDER BY id LIMIT 1;
 INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at)
 VALUES(a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa-v179-'||a||'@example.invalid',now(),now());
 INSERT INTO public.user_profiles(auth_user_id,role,parish_id,diocese_id,chancery_id,status,is_active)
 VALUES(a,'chancery',NULL,di,NULL,'ACTIVE',true);
 PERFORM set_config('qa179.actor',a::text,true);
 PERFORM set_config('qa179.diocese',di::text,true);
 PERFORM set_config('qa179.parish',p::text,true);
END $fixture$;
DO $check$
DECLARE actor uuid:=current_setting('qa179.actor')::uuid; parish uuid:=current_setting('qa179.parish')::uuid;
 scenario text; f record; expected text; received text;
 allowed int:=0; forbidden int:=0;
BEGIN
 FOREACH scenario IN ARRAY ARRAY['ACTIVE','SUSPENDED','NULL_STATUS','NULL_ACTIVE','DISABLED','WRONG_ROLE']
 LOOP
  UPDATE public.user_profiles SET
    role=CASE WHEN scenario='WRONG_ROLE' THEN 'diocese' ELSE 'chancery' END,
    is_active=CASE WHEN scenario='NULL_ACTIVE' THEN NULL WHEN scenario='DISABLED' THEN false ELSE true END,
    status=CASE WHEN scenario='NULL_STATUS' THEN NULL WHEN scenario='SUSPENDED' THEN 'SUSPENDED' ELSE 'ACTIVE' END
  WHERE auth_user_id=actor;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  FOR f IN SELECT * FROM (VALUES
   ('marriage_correction','SELECT * FROM public.apply_marriage_correction($1,NULL::date,NULL::text,$3::jsonb,NULL::text)',
     'Partida original de Matrimonio no encontrada',
     'Sólo Cancillería puede corregir Matrimonios por decreto'),
   ('funeral_correction','SELECT * FROM public.apply_funeral_correction($1,NULL::date,NULL::text,$3::jsonb,NULL::text)',
     'Partida original de Exequias no encontrada',
     'Sólo Cancillería puede corregir Exequias por decreto'),
   ('marriage_reposition','SELECT * FROM public.create_marriage_reposition_by_decree($2,NULL::date,NULL::text,$3::jsonb,$3::jsonb,NULL::text)',
     'Fecha y fundamento del decreto son obligatorios',
     'Sólo Cancillería puede reponer Matrimonios por decreto'),
   ('funeral_reposition','SELECT * FROM public.create_funeral_reposition_by_decree($2,NULL::date,NULL::text,$3::jsonb,$3::jsonb,NULL::text)',
     'Fecha y fundamento del decreto son obligatorios',
     'Sólo Cancillería puede reponer Exequias por decreto'),
   ('marriage_nullity','SELECT * FROM public.apply_marriage_nullity($1,NULL::text,NULL::date,NULL::text,$3::jsonb,NULL::uuid[])',
     'Número y fecha de sentencia/decreto son obligatorios',
     'Sólo Cancillería puede registrar una nulidad matrimonial')
  ) cases(kind,sql_call,expected_active,expected_denied)
  LOOP
   expected:=CASE WHEN scenario='ACTIVE' THEN f.expected_active ELSE f.expected_denied END;
   BEGIN
    EXECUTE f.sql_call USING gen_random_uuid(),parish,'{}'::jsonb;
    RAISE EXCEPTION 'V179 % % unexpectedly succeeded',scenario,f.kind;
   EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS received=MESSAGE_TEXT;
    IF received IS DISTINCT FROM expected THEN
      RAISE EXCEPTION 'V179 unexpected % % error: %, expected %',scenario,f.kind,received,expected;
    END IF;
    IF scenario='ACTIVE' THEN allowed:=allowed+1;ELSE forbidden:=forbidden+1;END IF;
   END;
  END LOOP;
  EXECUTE 'RESET ROLE';
 END LOOP;
 IF allowed<>5 OR forbidden<>25 THEN
  RAISE EXCEPTION 'V179 expected 5 allowed gates and 25 refusals, found % and %',allowed,forbidden;
 END IF;
 RAISE NOTICE 'V179_FIVE_ACTIVE_CHANCERY_GATES_TWENTYFIVE_DENIALS';
END $check$;
ROLLBACK;