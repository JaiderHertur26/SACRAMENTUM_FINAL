-- V176: real auth role with fictional account, reversible identity tests.
BEGIN;
DO $fixture$
DECLARE actor uuid:=gen_random_uuid(); pid uuid; di uuid; profile uuid;
BEGIN
 SELECT id,diocese_id INTO STRICT pid,di FROM public.parishes WHERE diocese_id IS NOT NULL ORDER BY id LIMIT 1;
 INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at)
 VALUES(actor,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa-v176-'||actor||'@example.invalid',now(),now());
 INSERT INTO public.user_profiles(auth_user_id,role,diocese_id,parish_id,status,is_active)
 VALUES(actor,'parish',di,pid,'ACTIVE',true) RETURNING id INTO profile;
 PERFORM set_config('qa176.actor',actor::text,true);
 PERFORM set_config('qa176.diocese',di::text,true);
 PERFORM set_config('qa176.parish',pid::text,true);
 PERFORM set_config('qa176.profile',profile::text,true);
END $fixture$;
SET LOCAL ROLE authenticated;
DO $positive$
DECLARE actor uuid:=current_setting('qa176.actor')::uuid;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 IF public.current_app_role() IS DISTINCT FROM 'parish'
 OR public.current_app_parish_id() IS DISTINCT FROM current_setting('qa176.parish')::uuid
 OR public.current_app_diocese_id() IS DISTINCT FROM current_setting('qa176.diocese')::uuid
 OR public.current_effective_diocese_id() IS DISTINCT FROM current_setting('qa176.diocese')::uuid
 OR public.current_chat_profile_id() IS DISTINCT FROM current_setting('qa176.profile')::uuid
 THEN RAISE EXCEPTION 'V176 legitimate active parish lost authorized scope';END IF;
END $positive$;
RESET ROLE;
DO $denials$
DECLARE actor uuid:=current_setting('qa176.actor')::uuid; mode text;
BEGIN
 FOREACH mode IN ARRAY ARRAY['SUSPENDED','NULL_STATUS','NULL_ACTIVE','DISABLED']
 LOOP
  UPDATE public.user_profiles
   SET status=CASE WHEN mode='NULL_STATUS' THEN NULL ELSE 'ACTIVE' END,
       is_active=CASE WHEN mode='NULL_ACTIVE' THEN NULL WHEN mode='DISABLED' THEN false ELSE true END
  WHERE auth_user_id=actor;
  IF mode='SUSPENDED' THEN UPDATE public.user_profiles SET status='SUSPENDED' WHERE auth_user_id=actor;END IF;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  IF public.current_app_role() IS NOT NULL
   OR public.current_app_parish_id() IS NOT NULL
   OR public.current_app_diocese_id() IS NOT NULL
   OR public.current_app_chancery_id() IS NOT NULL
   OR public.current_effective_diocese_id() IS NOT NULL
   OR public.current_chat_profile_id() IS NOT NULL
  THEN RAISE EXCEPTION 'V176 forbidden institutional scope for %',mode;END IF;
  EXECUTE 'RESET ROLE';
 END LOOP;
END $denials$;
ROLLBACK;
