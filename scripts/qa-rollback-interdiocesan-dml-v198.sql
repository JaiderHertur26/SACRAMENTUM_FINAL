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
 INSERT INTO public.pending_baptisms(id,parish_id,status,reportado,raw_data)
 VALUES(gen_random_uuid(),real_parish,'pending',false,'{"qa":"V198","nombres":"ORIGEN","apellidos":"QA V198"}'::jsonb);
 INSERT INTO public.pending_confirmations(id,parish_id,status,reportado,raw_data)
 VALUES(gen_random_uuid(),real_parish,'pending',false,'{"qa":"V198","nombres":"ORIGEN","apellidos":"QA V198"}'::jsonb);
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
SET LOCAL ROLE authenticated;
DO $dml$
DECLARE
 ctx text;actor text;roles jsonb:=current_setting('qa198.roles')::jsonb;
 real_parish uuid:=current_setting('qa198.real_parish')::uuid;
 fake_parish uuid:=current_setting('qa198.fake_parish')::uuid;
 real_diocese uuid:=current_setting('qa198.real_diocese')::uuid;
 direct_ok integer:=0;blocked integer:=0;affected integer;message text;table_name text;
BEGIN
 -- The fake diocese administrator may edit its own fictitious parish, not another one.
 actor:=roles->'diocese'->>'uid';
 PERFORM set_config('request.jwt.claim.sub',actor,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 UPDATE public.parishes SET name=name WHERE id=fake_parish;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'V198 fictitious diocese cannot update its parish';END IF;
 direct_ok:=direct_ok+1;
 UPDATE public.parishes SET name=name WHERE id=real_parish;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'V198 foreign parish edited by other diocese';END IF;
 blocked:=blocked+1;
 DELETE FROM public.parishes WHERE id=real_parish;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'V198 foreign parish deleted by other diocese';END IF;
 blocked:=blocked+1;
 BEGIN
  UPDATE public.parishes SET diocese_id=real_diocese WHERE id=fake_parish;
  RAISE EXCEPTION 'V198 WITH CHECK allowed transferring fictitious parish into foreign diocese';
 EXCEPTION WHEN insufficient_privilege THEN blocked:=blocked+1;
 END;
 BEGIN
  INSERT INTO public.parishes(id,name,diocese_id,is_operational)
  VALUES(gen_random_uuid(),'V198 UNAUTHORIZED PARISH',current_setting('qa198.fake_diocese')::uuid,false);
  RAISE EXCEPTION 'V198 diocese direct parish insert allowed';
 EXCEPTION WHEN insufficient_privilege THEN blocked:=blocked+1;
 END;
 -- Even diocesan managers cannot directly bypass the parish-owner boleta DML policies.
 FOREACH table_name IN ARRAY ARRAY['pending_baptisms','pending_confirmations']
 LOOP
  EXECUTE format('UPDATE public.%I SET status=status WHERE parish_id=$1 AND raw_data->>''qa''=''V198''',table_name) USING fake_parish;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>0 THEN RAISE EXCEPTION 'V198 diocesan manager edited boleta %',table_name;END IF;
  blocked:=blocked+1;
  EXECUTE format('DELETE FROM public.%I WHERE parish_id=$1 AND raw_data->>''qa''=''V198''',table_name) USING fake_parish;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>0 THEN RAISE EXCEPTION 'V198 diocesan manager deleted boleta %',table_name;END IF;
  blocked:=blocked+1;
  BEGIN
   EXECUTE format('INSERT INTO public.%I(id,parish_id,status,reportado,raw_data) VALUES(gen_random_uuid(),$1,''pending'',false,''{"qa":"V198"}''::jsonb)',table_name) USING fake_parish;
   RAISE EXCEPTION 'V198 diocesan actor inserted boleta %',table_name;
  EXCEPTION WHEN insufficient_privilege THEN blocked:=blocked+1;
  END;
 END LOOP;
 -- Original parish identity may not reassign its boletas into the fictitious diocese.
 actor:=roles->'parish'->>'uid';
 PERFORM set_config('request.jwt.claim.sub',actor,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 FOREACH table_name IN ARRAY ARRAY['pending_baptisms','pending_confirmations']
 LOOP
  BEGIN
   EXECUTE format('UPDATE public.%I SET parish_id=$1 WHERE parish_id=$2 AND raw_data->>''qa''=''V198''',table_name) USING fake_parish,real_parish;
   RAISE EXCEPTION 'V198 parish identity could move boleta % into foreign diocese',table_name;
  EXCEPTION WHEN insufficient_privilege THEN blocked:=blocked+1;
  END;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE parish_id=$1 AND raw_data->>''qa''=''V198''',table_name) INTO affected USING real_parish;
  IF affected<>1 THEN RAISE EXCEPTION 'V198 original boleta ownership modified for %',table_name;END IF;
  direct_ok:=direct_ok+1;
 END LOOP;
 IF direct_ok<>3 OR blocked<>12 THEN
  RAISE EXCEPTION 'V198 incomplete DML matrix authorized=% blocked=%',direct_ok,blocked;
 END IF;
 PERFORM set_config('qa198.dml',jsonb_build_object('authorized',direct_ok,'blocked',blocked,'rollback',true)::text,true);
END $dml$;
RESET ROLE;
SELECT jsonb_build_object('original_context_checks',current_setting('qa198.origin_checks')::integer,
 'other_diocese_context_checks',current_setting('qa198.moved_checks')::integer,
 'temporary_dioceses',1,'temporary_parishes',1,'temporary_boletas',4,'authorized_dml_checks',(current_setting('qa198.dml')::jsonb->>'authorized')::integer,'denied_dml_checks',(current_setting('qa198.dml')::jsonb->>'blocked')::integer,
 'real_profiles_changed_permanently',0,'rollback',true) AS report;
ROLLBACK;
