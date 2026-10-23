-- V179 prepatch, fake suspended Chancellor, no records written. All in ROLLBACK.
BEGIN;
DO $fixture$
DECLARE a uuid:=gen_random_uuid(); p uuid; dio uuid;
BEGIN
 SELECT id,diocese_id INTO STRICT p,dio FROM public.parishes WHERE diocese_id IS NOT NULL ORDER BY id LIMIT 1;
 INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at)
 VALUES(a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa-v179-'||a||'@example.invalid',now(),now());
 INSERT INTO public.user_profiles(auth_user_id,role,parish_id,diocese_id,chancery_id,status,is_active)
 VALUES(a,'chancery',NULL,dio,NULL,'SUSPENDED',true);
 PERFORM set_config('qa179.actor',a::text,true);
 PERFORM set_config('qa179.parish',p::text,true);
END $fixture$;
SET LOCAL ROLE authenticated;
DO $check$
DECLARE a uuid:=current_setting('qa179.actor')::uuid;p uuid:=current_setting('qa179.parish')::uuid;
 t record;received text;n int:=0;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 IF public.current_app_role() IS NOT NULL THEN RAISE EXCEPTION 'V179 V176 identity guard failure'; END IF;
 FOR t IN SELECT * FROM (VALUES
 ('marriage_correction','SELECT * FROM public.apply_marriage_correction($1,NULL::date,NULL::text,$3::jsonb,NULL::text)','Partida original de Matrimonio no encontrada'),
 ('funeral_correction','SELECT * FROM public.apply_funeral_correction($1,NULL::date,NULL::text,$3::jsonb,NULL::text)','Partida original de Exequias no encontrada'),
 ('marriage_reposition','SELECT * FROM public.create_marriage_reposition_by_decree($2,NULL::date,NULL::text,$3::jsonb,$3::jsonb,NULL::text)','Fecha y fundamento del decreto son obligatorios'),
 ('funeral_reposition','SELECT * FROM public.create_funeral_reposition_by_decree($2,NULL::date,NULL::text,$3::jsonb,$3::jsonb,NULL::text)','Fecha y fundamento del decreto son obligatorios'),
 ('marriage_nullity','SELECT * FROM public.apply_marriage_nullity($1,NULL::text,NULL::date,NULL::text,$3::jsonb,NULL::uuid[])','Número y fecha de sentencia/decreto son obligatorios')
 ) t(kind,sql_call,business_expected)
 LOOP
  BEGIN
   EXECUTE t.sql_call USING gen_random_uuid(),p,'{}'::jsonb;
   RAISE EXCEPTION 'V179 % returned without rejection',t.kind;
  EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS received=MESSAGE_TEXT;
   IF received IS DISTINCT FROM t.business_expected THEN
    RAISE EXCEPTION 'V179 unexpected % error: %, expected %',t.kind,received,t.business_expected;
   END IF;
   n:=n+1;
  END;
 END LOOP;
 IF n<>5 THEN RAISE EXCEPTION 'V179 expected five weak auth, got %',n;END IF;
 RAISE NOTICE 'V179_SUSPENDED_CHANCELLOR_PASSED_FIVE_AUTH_GATES';
END $check$;
ROLLBACK;