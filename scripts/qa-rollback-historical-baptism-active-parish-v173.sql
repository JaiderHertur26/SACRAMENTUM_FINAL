-- SACRAMENTUM V173 · Postpatch transactional QA of historical Baptism.
-- Test with only fictional actor and baptism; always ROLLBACK.
BEGIN;
DO $setup$
DECLARE v_actor uuid:=gen_random_uuid();v_parish uuid;v_home uuid;v_other uuid:=gen_random_uuid();
BEGIN
 SELECT p.id,p.diocese_id INTO STRICT v_parish,v_home
 FROM public.parishes p JOIN public.parish_parameters pp ON pp.parish_id=p.id
 WHERE p.diocese_id IS NOT NULL ORDER BY p.id LIMIT 1;
 INSERT INTO public.dioceses(id,name) VALUES(v_other,'QA V173 FOREIGN '||left(v_other::text,8));
 INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at)
 VALUES(v_actor,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'qa-v173-'||v_actor::text||'@example.invalid',now(),now());
 IF EXISTS(SELECT 1 FROM public.user_profiles WHERE auth_user_id=v_actor) THEN
  UPDATE public.user_profiles SET role='parish',parish_id=v_parish,diocese_id=v_home,
   is_active=true,status='SUSPENDED' WHERE auth_user_id=v_actor;
 ELSE
  INSERT INTO public.user_profiles(auth_user_id,role,parish_id,diocese_id,is_active,status)
  VALUES(v_actor,'parish',v_parish,v_home,true,'SUSPENDED');
 END IF;
 PERFORM set_config('qa173.actor',v_actor::text,true);
 PERFORM set_config('qa173.parish',v_parish::text,true);
 PERFORM set_config('qa173.home',v_home::text,true);
 PERFORM set_config('qa173.other',v_other::text,true);
 PERFORM set_config('qa173.book','QA-V173-'||left(v_actor::text,8),true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $suspended$
DECLARE v_actor uuid:=current_setting('qa173.actor')::uuid;
 v_parish uuid:=current_setting('qa173.parish')::uuid;
 v_book text:=current_setting('qa173.book');
 v_doc jsonb;v_err text;v_denied boolean:=false;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
 v_doc:=jsonb_build_object('Libro',v_book,'folio','98765','numero','1','nombres','PERSONA FICTICIA',
 'apellidos','PRUEBA V173','fechaSacramento','2020-01-01','fechaNacimiento','2019-12-01');
 BEGIN
  PERFORM public.register_historical_baptism(v_parish,v_doc);
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_err=MESSAGE_TEXT;
  IF v_err='Sólo la parroquia propietaria puede digitalizar su libro de Bautismos'
  THEN v_denied:=true;ELSE RAISE;END IF;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'V173 FAIL: suspended parish registered historical Baptism';END IF;
END $suspended$;
RESET ROLE;
UPDATE public.user_profiles SET status='ACTIVE',diocese_id=current_setting('qa173.other')::uuid
 WHERE auth_user_id=current_setting('qa173.actor')::uuid;
SET LOCAL ROLE authenticated;
DO $wrongdiocese$
DECLARE v_actor uuid:=current_setting('qa173.actor')::uuid;
 v_parish uuid:=current_setting('qa173.parish')::uuid;
 v_book text:=current_setting('qa173.book');
 v_doc jsonb;v_err text;v_denied boolean:=false;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
 v_doc:=jsonb_build_object('Libro',v_book,'folio','98765','numero','1','nombres','PERSONA FICTICIA',
 'apellidos','PRUEBA V173','fechaSacramento','2020-01-01','fechaNacimiento','2019-12-01');
 BEGIN
  PERFORM public.register_historical_baptism(v_parish,v_doc);
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_err=MESSAGE_TEXT;
  IF v_err='Sólo la parroquia propietaria puede digitalizar su libro de Bautismos'
  THEN v_denied:=true;ELSE RAISE;END IF;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'V173 FAIL: foreign diocese profile registered Baptism';END IF;
END $wrongdiocese$;
RESET ROLE;
UPDATE public.user_profiles SET diocese_id=current_setting('qa173.home')::uuid
 WHERE auth_user_id=current_setting('qa173.actor')::uuid;
SET LOCAL ROLE authenticated;
DO $owner$
DECLARE v_actor uuid:=current_setting('qa173.actor')::uuid;
 v_parish uuid:=current_setting('qa173.parish')::uuid;
 v_book text:=current_setting('qa173.book');
 v_doc jsonb;v_record uuid;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
 v_doc:=jsonb_build_object('Libro',v_book,'folio','98765','numero','1','nombres','PERSONA FICTICIA',
 'apellidos','PRUEBA V173','fechaSacramento','2020-01-01','fechaNacimiento','2019-12-01');
 SELECT record_id INTO v_record FROM public.register_historical_baptism(v_parish,v_doc);
 IF v_record IS NULL THEN RAISE EXCEPTION 'V173 FAIL: active owning parish cannot register Baptism';END IF;
 PERFORM set_config('qa173.baptism',v_record::text,true);
END $owner$;
RESET ROLE;
DO $verify$
DECLARE v_actor uuid:=current_setting('qa173.actor')::uuid;
 v_parish uuid:=current_setting('qa173.parish')::uuid;
 v_record uuid:=current_setting('qa173.baptism')::uuid;
 v_book text:=current_setting('qa173.book');n integer;
BEGIN
 SELECT count(*) INTO n FROM public.baptisms WHERE id=v_record AND parish_id=v_parish AND book_number IS NOT NULL;
 IF n<>1 THEN RAISE EXCEPTION 'V173 expected exactly one legitimate fictional Baptism, got %',n; END IF;
 SELECT count(*) INTO n FROM public.registry_audit_log WHERE actor_user_id=v_actor AND entity_id=v_record
 AND action='historical_digitization';
 IF n<>1 THEN RAISE EXCEPTION 'V173 expected exactly one historical audit event, got %',n; END IF;
END $verify$;
ROLLBACK;
