-- V180 prepatch: NULL institutional status can call privileged chat directory.
-- Synthetic auth actor; do not persist or leak returned user details.
BEGIN;
DO $setup$
DECLARE a uuid:=gen_random_uuid();p uuid;di uuid;
BEGIN
 SELECT id,diocese_id INTO STRICT p,di FROM public.parishes WHERE diocese_id IS NOT NULL ORDER BY id LIMIT 1;
 INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at)
 VALUES(a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
        'qa-v180-'||a||'@example.invalid',now(),now());
 INSERT INTO public.user_profiles(auth_user_id,role,parish_id,diocese_id,status,is_active)
 VALUES(a,'parish',p,di,NULL,true);
 PERFORM set_config('qa180.actor',a::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $repro$
DECLARE a uuid:=current_setting('qa180.actor')::uuid;
       directory jsonb; my_rooms jsonb; count_users int;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 IF public.current_app_role() IS NOT NULL THEN RAISE EXCEPTION 'V180 baseline central identity should deny null';END IF;
 SELECT public.list_chat_directory() INTO directory;
 SELECT public.list_my_chat_rooms() INTO my_rooms;
 IF jsonb_typeof(directory)<>'array' OR jsonb_typeof(my_rooms)<>'array'
 THEN RAISE EXCEPTION 'V180 invalid chat outputs'; END IF;
 count_users:=jsonb_array_length(directory);
 IF count_users<1 THEN RAISE EXCEPTION 'V180 baseline did not expose chat directory for null-status actor';END IF;
 RAISE NOTICE 'V180_PREPATCH_NULL_STATUS_CHAT_DIRECTORY_EXPOSED_COUNT_%',count_users;
 PERFORM set_config('qa180.directory_count',count_users::text,true);
END $repro$;
SELECT current_setting('qa180.directory_count')::integer AS exposed_contact_count_only;
ROLLBACK;