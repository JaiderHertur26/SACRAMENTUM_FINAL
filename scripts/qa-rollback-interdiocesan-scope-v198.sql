-- V198. Simulate two dioceses without permanent users, records or backend changes.
-- Every fake diocese, parish, boleta and temporary reassignment is rolled back.
BEGIN;
SET LOCAL statement_timeout='45000ms';
DO $setup$
DECLARE
 real_diocese uuid; real_parish uuid; fake_diocese uuid:=gen_random_uuid();fake_parish uuid:=gen_random_uuid();
 roles jsonb:='{}'::jsonb; p record; role_count integer;
BEGIN
 SELECT id INTO STRICT real_diocese FROM public.dioceses LIMIT 1;
 SELECT id INTO STRICT real_parish FROM public.parishes WHERE diocese_id=real_diocese
 AND is_operational IS TRUE LIMIT 1;
 FOR p IN SELECT id,auth_user_id,role FROM public.user_profiles
 WHERE role IN('admin_general','diocese','chancery','parish') AND is_active IS TRUE AND upper(status)='ACTIVE'
 LOOP
  roles:=roles||jsonb_build_object(p.role,jsonb_build_object('uid',p.auth_user_id,'profile',p.id));
 END LOOP;
 SELECT count(*) INTO role_count FROM jsonb_each(roles);
 IF role_count<>4 THEN RAISE EXCEPTION 'V198 four active institutional actors required';END IF;
 INSERT INTO public.dioceses(id,name,city,type)
 VALUES(fake_diocese,'DIOCESIS FICTICIA QA V198','CIUDAD QA','diocese');
 INSERT INTO public.parishes(id,name,diocese_id,city,is_operational)
 VALUES(fake_parish,'PARROQUIA FICTICIA QA V198',fake_diocese,'CIUDAD QA',false);
 INSERT INTO public.pending_baptisms(id,parish_id,status,reportado,raw_data)
 VALUES(gen_random_uuid(),fake_parish,'pending',false,'{"qa":"V198","nombres":"FICTICIO","apellidos":"NO PERSISTIR"}'::jsonb);
 INSERT INTO public.pending_confirmations(id,parish_id,status,reportado,raw_data)
 VALUES(gen_random_uuid(),fake_parish,'pending',false,'{"qa":"V198","nombres":"FICTICIA","apellidos":"NO PERSISTIR"}'::jsonb);
 PERFORM set_config('qa198.real_diocese',real_diocese::text,true);
 PERFORM set_config('qa198.fake_diocese',fake_diocese::text,true);
 PERFORM set_config('qa198.real_parish',real_parish::text,true);
 PERFORM set_config('qa198.fake_parish',fake_parish::text,true);
 PERFORM set_config('qa198.roles',roles::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $scope$
DECLARE r text; map jsonb:=current_setting('qa198.roles')::jsonb;
 actor text;
 fake_diocese uuid:=current_setting('qa198.fake_diocese')::uuid;
 real_diocese uuid:=current_setting('qa198.real_diocese')::uuid;
 fake_parish uuid:=current_setting('qa198.fake_parish')::uuid;
 real_parish uuid:=current_setting('qa198.real_parish')::uuid;
 can_fake boolean;can_real boolean;
 extra integer; own integer;total integer;
 checks integer:=0;
BEGIN
 FOR r,actor IN SELECT key,value->>'uid' FROM jsonb_each(map)
 LOOP
  PERFORM set_config('request.jwt.claim.sub',actor,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  can_fake:=public.can_access_parish(fake_parish);
  can_real:=public.can_access_parish(real_parish);
  IF can_fake IS DISTINCT FROM (r='admin_general') OR can_real IS DISTINCT FROM true
  THEN RAISE EXCEPTION 'V198 mistaken parish access % old % fake %',r,can_real,can_fake;END IF;
  SELECT count(*) INTO extra FROM public.dioceses WHERE id=fake_diocese;
  SELECT count(*) INTO own FROM public.dioceses WHERE id=real_diocese;
  IF extra<>(CASE WHEN r='admin_general' THEN 1 ELSE 0 END) OR own<>1
  THEN RAISE EXCEPTION 'V198 wrong diocese SELECT %',r;END IF;
  SELECT count(*) INTO extra FROM public.parishes WHERE id=fake_parish;
  IF extra<>(CASE WHEN r='admin_general' THEN 1 ELSE 0 END)
  THEN RAISE EXCEPTION 'V198 wrong parish SELECT %',r;END IF;
  SELECT count(*) INTO extra FROM public.pending_baptisms WHERE parish_id=fake_parish;
  IF extra<>(CASE WHEN r='admin_general' THEN 1 ELSE 0 END)
  THEN RAISE EXCEPTION 'V198 wrong foreign pending baptism %',r;END IF;
  SELECT count(*) INTO extra FROM public.pending_confirmations WHERE parish_id=fake_parish;
  IF extra<>(CASE WHEN r='admin_general' THEN 1 ELSE 0 END)
  THEN RAISE EXCEPTION 'V198 wrong foreign confirmation %',r;END IF;
  checks:=checks+5;
 END LOOP;
 IF checks<>20 THEN RAISE EXCEPTION 'V198 incomplete original-scope matrix';END IF;
 PERFORM set_config('qa198.origin_checks',checks::text,true);
END $scope$;
RESET ROLE;
UPDATE public.user_profiles
 SET diocese_id=current_setting('qa198.fake_diocese')::uuid
 WHERE id=((current_setting('qa198.roles')::jsonb)->'diocese'->>'profile')::uuid;
SET LOCAL ROLE authenticated;
DO $moved$
DECLARE map jsonb:=current_setting('qa198.roles')::jsonb;
 fake_diocese uuid:=current_setting('qa198.fake_diocese')::uuid;
 real_diocese uuid:=current_setting('qa198.real_diocese')::uuid;
 fake_parish uuid:=current_setting('qa198.fake_parish')::uuid;
 real_parish uuid:=current_setting('qa198.real_parish')::uuid;
 n integer; checks integer:=0; actor text;
BEGIN
 actor:=map->'diocese'->>'uid';
 PERFORM set_config('request.jwt.claim.sub',actor,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 IF public.current_app_diocese_id() IS DISTINCT FROM fake_diocese OR
 public.can_access_parish(fake_parish) IS DISTINCT FROM true OR
 public.can_access_parish(real_parish) IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'V198 scope did not change to temporary diocese';END IF;
 SELECT count(*) INTO n FROM public.dioceses WHERE id=fake_diocese;
 IF n<>1 THEN RAISE EXCEPTION 'V198 fake diocese missing for its actor';END IF;
 checks:=checks+1;
 SELECT count(*) INTO n FROM public.dioceses WHERE id=real_diocese;
 IF n<>0 THEN RAISE EXCEPTION 'V198 real diocese leaked to fake actor';END IF;
 checks:=checks+1;
 SELECT count(*) INTO n FROM public.parishes WHERE id=real_parish;
 IF n<>0 THEN RAISE EXCEPTION 'V198 real parish leaked to fake actor';END IF;
 checks:=checks+1;
 SELECT count(*) INTO n FROM public.parishes WHERE id=fake_parish;
 IF n<>1 THEN RAISE EXCEPTION 'V198 fake parish hidden from matching diocese';END IF;
 checks:=checks+1;
 SELECT count(*) INTO n FROM public.pending_baptisms WHERE parish_id=fake_parish;
 IF n<>1 THEN RAISE EXCEPTION 'V198 fake baptism hidden from matching diocese';END IF;
 checks:=checks+1;
 SELECT count(*) INTO n FROM public.pending_confirmations WHERE parish_id=fake_parish;
 IF n<>1 THEN RAISE EXCEPTION 'V198 fake confirmation hidden from matching diocese';END IF;
 checks:=checks+1;
 PERFORM set_config('qa198.moved_checks',checks::text,true);
END $moved$;
RESET ROLE;
SELECT jsonb_build_object('original_context_checks',current_setting('qa198.origin_checks')::integer,
 'other_diocese_context_checks',current_setting('qa198.moved_checks')::integer,
 'temporary_dioceses',1,'temporary_parishes',1,'temporary_boletas',2,
 'real_profiles_changed_permanently',0,'rollback',true) AS report;
ROLLBACK;