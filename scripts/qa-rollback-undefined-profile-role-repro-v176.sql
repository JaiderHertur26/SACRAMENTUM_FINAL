-- V176 PREPATCH: ambiguous profiles must not retain institutional authority.
BEGIN;
DO $setup$
DECLARE actor uuid:=gen_random_uuid(); p uuid; di uuid;
BEGIN
 SELECT id,diocese_id INTO STRICT p,di FROM public.parishes WHERE diocese_id IS NOT NULL ORDER BY id LIMIT 1;
 INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at)
 VALUES(actor,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa-v176-'||actor||'@example.invalid',now(),now());
 INSERT INTO public.user_profiles(auth_user_id,role,parish_id,diocese_id,status,is_active)
 VALUES(actor,'parish',p,di,'SUSPENDED',true);
 PERFORM set_config('qa176.actor',actor::text,true);
 PERFORM set_config('qa176.diocese',di::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $pre$
DECLARE actor uuid:=current_setting('qa176.actor')::uuid;
 di uuid:=current_setting('qa176.diocese')::uuid;
 BEGIN
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 IF public.current_effective_diocese_id() IS DISTINCT FROM di
 THEN RAISE EXCEPTION 'V176 baseline was already hardened; no vulnerability reproduced';END IF;
 RAISE NOTICE 'V176_PREPATCH_SUSPENDED_EFFECTIVE_DIOCESE_CONFIRMED';
END $pre$;
RESET ROLE;
UPDATE public.user_profiles SET status=NULL,is_active=true WHERE auth_user_id=current_setting('qa176.actor')::uuid;
SET LOCAL ROLE authenticated;
DO $nullstatus$
DECLARE actor uuid:=current_setting('qa176.actor')::uuid;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 IF public.current_app_role() IS DISTINCT FROM 'parish'
 THEN RAISE EXCEPTION 'V176 null-status baseline already fail-closed';END IF;
 RAISE NOTICE 'V176_PREPATCH_NULL_STATUS_GRANTED_ROLE_CONFIRMED';
END $nullstatus$;
ROLLBACK;
