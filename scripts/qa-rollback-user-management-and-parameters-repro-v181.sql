-- V181 PREPATCH: suspended diocesan manager mutates a fictional parish user's access;
-- suspended parish reaches physical Baptism/Confirmation parameter validation.
-- Entire reproduction is inside ROLLBACK and touches NO real record permanently.
BEGIN;
DO $setup$
DECLARE p uuid;dio uuid; manager uuid:=gen_random_uuid();worker uuid:=gen_random_uuid(); target_id uuid;
BEGIN
 SELECT id,diocese_id INTO STRICT p,dio FROM public.parishes WHERE diocese_id IS NOT NULL ORDER BY id LIMIT 1;
 INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at)
 VALUES(manager,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa-v181-manager-'||manager||'@example.invalid',now(),now()),
 (worker,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa-v181-parish-'||worker||'@example.invalid',now(),now());
 INSERT INTO public.user_profiles(auth_user_id,role,diocese_id,status,is_active)
 VALUES(manager,'diocese',dio,'SUSPENDED',true);
 INSERT INTO public.user_profiles(auth_user_id,role,parish_id,diocese_id,status,is_active)
 VALUES(worker,'parish',p,dio,'ACTIVE',true)
 RETURNING id INTO target_id;
 PERFORM set_config('qa181.manager',manager::text,true);
 PERFORM set_config('qa181.worker',worker::text,true);
 PERFORM set_config('qa181.target',target_id::text,true);
 PERFORM set_config('qa181.parish',p::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $manager$
DECLARE actor uuid:=current_setting('qa181.manager')::uuid;
 target uuid:=current_setting('qa181.target')::uuid;
 result record;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 IF public.current_app_role() IS NOT NULL THEN RAISE EXCEPTION 'V181 central V176 status guard failed';END IF;
 SELECT id,is_active,status INTO result FROM public.set_managed_user_active(target,false);
 IF result.id IS DISTINCT FROM target OR result.is_active IS DISTINCT FROM false THEN
  RAISE EXCEPTION 'V181 suspended manager could not reproduce deactivation'; END IF;
 RAISE NOTICE 'V181_PREPATCH_SUSPENDED_DIOCESE_DISABLED_FAKE_PARISH_USER';
END $manager$;
RESET ROLE;
UPDATE public.user_profiles SET status='SUSPENDED',is_active=true
WHERE auth_user_id=current_setting('qa181.worker')::uuid;
SET LOCAL ROLE authenticated;
DO $parish$
DECLARE actor uuid:=current_setting('qa181.worker')::uuid;
 p uuid:=current_setting('qa181.parish')::uuid;
 msg text;confirmed integer:=0;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 IF public.current_app_role() IS NOT NULL THEN RAISE EXCEPTION 'V181 suspended parish centrally allowed';END IF;
 BEGIN
  PERFORM public.save_baptism_parameters(p,'{}'::jsonb,999999,NULL,NULL);
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT;
  IF msg NOT LIKE 'El Libro cambió%' THEN RAISE EXCEPTION 'V181 Baptism unexpected: %',msg;END IF;
  confirmed:=confirmed+1;
 END;
 BEGIN
  PERFORM public.save_confirmation_parameters(p,'{}'::jsonb,999999,NULL,NULL);
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT;
  IF msg NOT LIKE 'El Libro cambió%' THEN RAISE EXCEPTION 'V181 Confirmation unexpected: %',msg;END IF;
  confirmed:=confirmed+1;
 END;
 IF confirmed<>2 THEN RAISE EXCEPTION 'V181 only % parameter bypasses',confirmed; END IF;
 RAISE NOTICE 'V181_PREPATCH_TWO_SUSPENDED_PARISH_PARAMETER_GUARDS_BYPASSED';
END $parish$;
ROLLBACK;