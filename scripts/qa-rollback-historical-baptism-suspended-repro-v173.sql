-- V173 PREPATCH: demonstrate that suspended parish status is accepted by historical digitization.
-- Fictional actor and baptism; no COMMIT and no persistent data.
BEGIN;
DO $setup$
DECLARE v_user uuid:=gen_random_uuid();v_parish uuid;v_diocese uuid;
BEGIN
 SELECT p.id,p.diocese_id INTO STRICT v_parish,v_diocese
 FROM public.parishes p JOIN public.parish_parameters pp ON pp.parish_id=p.id
 WHERE p.diocese_id IS NOT NULL ORDER BY p.id LIMIT 1;
 INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at)
 VALUES(v_user,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'qa-v173-'||v_user::text||'@example.invalid',now(),now());
 IF EXISTS (SELECT 1 FROM public.user_profiles WHERE auth_user_id=v_user) THEN
  UPDATE public.user_profiles SET role='parish',parish_id=v_parish,diocese_id=v_diocese,
  is_active=true,status='SUSPENDED' WHERE auth_user_id=v_user;
 ELSE
  INSERT INTO public.user_profiles(auth_user_id,role,parish_id,diocese_id,is_active,status)
  VALUES(v_user,'parish',v_parish,v_diocese,true,'SUSPENDED');
 END IF;
 PERFORM set_config('qa173.actor',v_user::text,true);
 PERFORM set_config('qa173.parish',v_parish::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $prepatch$
DECLARE v_user uuid:=current_setting('qa173.actor')::uuid;
 v_parish uuid:=current_setting('qa173.parish')::uuid;
 v_record uuid; v_document jsonb;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',v_user::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_user,'role','authenticated')::text,true);
 v_document:=jsonb_build_object('Libro','QA-V173-'||left(v_user::text,8),'folio','98765','numero','1',
 'nombres','PERSONA FICTICIA','apellidos','PRUEBA V173','fechaSacramento','2020-01-01',
 'fechaNacimiento','2019-12-01');
 SELECT record_id INTO v_record FROM public.register_historical_baptism(v_parish,v_document);
 IF v_record IS NULL THEN RAISE EXCEPTION 'V173 prepatch did not produce a baptism';END IF;
 PERFORM set_config('qa173.baptism',v_record::text,true);
 RAISE NOTICE 'V173_PREPATCH_CONFIRMED suspended parish accepted by historical baptism RPC';
END $prepatch$;
RESET ROLE;
DO $verify$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.baptisms WHERE id=current_setting('qa173.baptism')::uuid)
 THEN RAISE EXCEPTION 'V173 reproduction created no fictional baptism'; END IF;
END $verify$;
ROLLBACK;
