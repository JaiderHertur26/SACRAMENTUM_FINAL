-- V172 · Integration QA: two synthetic institutional actors on opposite sides of a jurisdiction boundary.
-- Caller wraps this script's BEGIN/ROLLBACK around the V172 migration for pre-commit verification.
BEGIN;
DO $setup$
DECLARE a uuid:=gen_random_uuid();u_d uuid:=gen_random_uuid();u_p uuid:=gen_random_uuid();
 u_admin uuid:=gen_random_uuid();p uuid;d_p uuid;t uuid:=gen_random_uuid();
BEGIN
 SELECT id,diocese_id INTO STRICT p,d_p FROM public.parishes WHERE diocese_id IS NOT NULL ORDER BY id LIMIT 1;
 INSERT INTO public.dioceses(id,name) VALUES(a,'QA V172 FOREIGN DIOCESE '||left(a::text,8));
 INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at)
 SELECT u,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
  'qa-v172-'||u::text||'@example.invalid',now(),now()
 FROM (VALUES(u_d),(u_p),(u_admin)) uu(u);
 INSERT INTO public.user_profiles(auth_user_id,role,diocese_id,parish_id,status,is_active)
 VALUES(u_d,'diocese',a,NULL,'ACTIVE',true),
       (u_p,'parish',d_p,p,'ACTIVE',true),
       (u_admin,'admin_general',NULL,NULL,'ACTIVE',true);
 INSERT INTO public.bishop_tenures(id,parish_id,bishop_name,start_date)
 VALUES(t,p,'QA V172 REVERSIBLE TENURE',current_date);
 PERFORM set_config('qa172.foreign',u_d::text,true);
 PERFORM set_config('qa172.parish',u_p::text,true);
 PERFORM set_config('qa172.admin',u_admin::text,true);
 PERFORM set_config('qa172.tenure',t::text,true);
 PERFORM set_config('qa172.owner_parish',p::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $foreign$
DECLARE a uuid:=current_setting('qa172.foreign')::uuid;t uuid:=current_setting('qa172.tenure')::uuid;
 n integer; denied boolean:=false;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 SELECT count(*) INTO n FROM public.bishop_tenures WHERE id=t;
 IF n<>0 THEN RAISE EXCEPTION 'V172 foreign diocese could READ tenure';END IF;
 UPDATE public.bishop_tenures SET notes='ILLEGAL V172 WRITE' WHERE id=t;
 IF FOUND THEN RAISE EXCEPTION 'V172 foreign diocese could UPDATE tenure';END IF;
 DELETE FROM public.bishop_tenures WHERE id=t;
 IF FOUND THEN RAISE EXCEPTION 'V172 foreign diocese could DELETE tenure';END IF;
 BEGIN
  INSERT INTO public.bishop_tenures(parish_id,bishop_name,start_date,end_date)
  VALUES(current_setting('qa172.owner_parish')::uuid,'V172 FOREIGN INSERT ATTEMPT',DATE '1800-01-01',DATE '1800-01-02');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'V172 foreign diocese could INSERT tenure';END IF;
END $foreign$;
DO $own$
DECLARE a uuid:=current_setting('qa172.parish')::uuid;t uuid:=current_setting('qa172.tenure')::uuid;
 extra uuid:=gen_random_uuid();n integer;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 SELECT count(*) INTO n FROM public.bishop_tenures WHERE id=t;
 IF n<>1 THEN RAISE EXCEPTION 'V172 owning parish could not READ tenure';END IF;
 UPDATE public.bishop_tenures SET notes='QA V172 OWN UPDATE' WHERE id=t;
 IF NOT FOUND THEN RAISE EXCEPTION 'V172 owning parish could not UPDATE';END IF;
 INSERT INTO public.bishop_tenures(id,parish_id,bishop_name,start_date,end_date)
 VALUES(extra,current_setting('qa172.owner_parish')::uuid,'QA V172 OWN INSERT',DATE '1800-01-01',DATE '1800-01-02');
 DELETE FROM public.bishop_tenures WHERE id=extra;
 IF NOT FOUND THEN RAISE EXCEPTION 'V172 owning parish could not DELETE own inserted tenure';END IF;
END $own$;
DO $admin$
DECLARE a uuid:=current_setting('qa172.admin')::uuid;t uuid:=current_setting('qa172.tenure')::uuid;n integer;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 SELECT count(*) INTO n FROM public.bishop_tenures WHERE id=t;
 IF n<>1 THEN RAISE EXCEPTION 'V172 general admin lost global visibility';END IF;
END $admin$;
RESET ROLE;
UPDATE public.user_profiles SET status='SUSPENDED' WHERE auth_user_id=current_setting('qa172.parish')::uuid;
SET LOCAL ROLE authenticated;
DO $suspended$
DECLARE a uuid:=current_setting('qa172.parish')::uuid;t uuid:=current_setting('qa172.tenure')::uuid;n integer;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 SELECT count(*) INTO n FROM public.bishop_tenures WHERE id=t;
 IF n<>0 THEN RAISE EXCEPTION 'V172 suspended parish could READ tenure';END IF;
END $suspended$;
RESET ROLE;
DO $verify$
BEGIN
 IF (SELECT notes FROM public.bishop_tenures WHERE id=current_setting('qa172.tenure')::uuid)
    IS DISTINCT FROM 'QA V172 OWN UPDATE' THEN
    RAISE EXCEPTION 'V172 foreign access corrupted owner data';
 END IF;
END $verify$;
ROLLBACK;
