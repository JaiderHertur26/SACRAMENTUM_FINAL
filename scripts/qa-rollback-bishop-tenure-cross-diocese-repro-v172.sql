-- V172 PREPATCH · Cross-diocese bishop-tenure access defect, wholly fictional and reversible.
BEGIN;
DO $setup$
DECLARE a uuid:=gen_random_uuid(); u uuid:=gen_random_uuid();
 parish_b uuid; tenure_b uuid:=gen_random_uuid();
BEGIN
 SELECT id INTO STRICT parish_b FROM public.parishes WHERE diocese_id IS NOT NULL LIMIT 1;
 INSERT INTO public.dioceses(id,name) VALUES(a,'QA V172 DIOCESE A '||left(a::text,8));
 INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at)
 VALUES(u,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'qa-v172-'||u::text||'@example.invalid',now(),now());
 INSERT INTO public.user_profiles(auth_user_id,role,diocese_id,status,is_active)
 VALUES(u,'diocese',a,'ACTIVE',true);
 INSERT INTO public.bishop_tenures(id,parish_id,bishop_name,start_date)
 VALUES(tenure_b,parish_b,'QA V172 FICTITIOUS BISHOP',current_date);
 PERFORM set_config('qa172.actor_a',u::text,true);
 PERFORM set_config('qa172.foreign_tenure_b',tenure_b::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $violation$
DECLARE u uuid:=current_setting('qa172.actor_a')::uuid;
 foreign_tenure uuid:=current_setting('qa172.foreign_tenure_b')::uuid;
 seen_count integer;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 SELECT count(*) INTO seen_count FROM public.bishop_tenures WHERE id=foreign_tenure;
 IF seen_count<>1 THEN RAISE EXCEPTION 'V172 prepatch foreign row was not visible, count %',seen_count; END IF;
 DELETE FROM public.bishop_tenures WHERE id=foreign_tenure;
 IF NOT FOUND THEN RAISE EXCEPTION 'V172 prepatch foreign delete not authorized'; END IF;
END $violation$;
RESET ROLE;
DO $verify$
BEGIN
 IF EXISTS(SELECT 1 FROM public.bishop_tenures WHERE id=current_setting('qa172.foreign_tenure_b')::uuid)
 THEN RAISE EXCEPTION 'V172 foreign tenure was not deleted in vulnerable baseline'; END IF;
END $verify$;
ROLLBACK;
