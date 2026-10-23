-- V177 PREPATCH · suspended parish creates a fictitious pending Baptism through SECURITY DEFINER.
-- This test MUST run only before the fix; it is archived after confirmation. All writes rolled back.
BEGIN;
DO $fixture$
DECLARE actor uuid:=gen_random_uuid();p uuid;di uuid;
BEGIN
 SELECT id,diocese_id INTO STRICT p,di FROM public.parishes WHERE diocese_id IS NOT NULL ORDER BY id LIMIT 1;
 INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at)
 VALUES(actor,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'qa-v177-'||actor||'@example.invalid',now(),now());
 INSERT INTO public.user_profiles(auth_user_id,role,parish_id,diocese_id,status,is_active)
 VALUES(actor,'parish',p,di,'SUSPENDED',true);
 PERFORM set_config('qa177.actor',actor::text,true);
 PERFORM set_config('qa177.parish',p::text,true);
END $fixture$;
SET LOCAL ROLE authenticated;
DO $exploit$
DECLARE actor uuid:=current_setting('qa177.actor')::uuid;p uuid:=current_setting('qa177.parish')::uuid;
 r uuid;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 IF public.current_app_role() IS NOT NULL THEN RAISE EXCEPTION 'V177 central V176 role must deny SUSPENDED';END IF;
 SELECT pending_id INTO r FROM public.create_pending_baptism(p,jsonb_build_object(
   'nombres','QA V177 FICTICIA','apellidos','PRUEBA SUSPENDIDO','fechaSacramento','2026-10-23'));
 IF r IS NULL THEN RAISE EXCEPTION 'V177 prepatch failed to produce a pending Baptism';END IF;
 PERFORM set_config('qa177.pending',r::text,true);
 RAISE NOTICE 'V177_PREPATCH_SUSPENDED_RPC_CREATED_PENDING_BAPTISM';
END $exploit$;
RESET ROLE;
DO $verify$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.pending_baptisms WHERE id=current_setting('qa177.pending')::uuid)
 THEN RAISE EXCEPTION 'V177 reproduction did not create pending row';END IF;
END $verify$;
ROLLBACK;
