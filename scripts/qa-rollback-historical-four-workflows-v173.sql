-- V173: four additional historic workflows, authenticated synthetic actor, reversible.
-- Test two forbidden scenarios: suspended user and mismatched institutional diocese.
BEGIN;
DO $setup$
DECLARE v_actor uuid:=gen_random_uuid();p uuid;d uuid;foreign_d uuid:=gen_random_uuid();
BEGIN
 SELECT id,diocese_id INTO STRICT p,d FROM public.parishes WHERE diocese_id IS NOT NULL ORDER BY id LIMIT 1;
 INSERT INTO public.dioceses(id,name) VALUES(foreign_d,'QA V173 FOREIGN SCOPE '||left(foreign_d::text,8));
 INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at)
 VALUES(v_actor,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'qa-v173-'||v_actor::text||'@example.invalid',now(),now());
 IF EXISTS(SELECT 1 FROM public.user_profiles WHERE auth_user_id=v_actor) THEN
  UPDATE public.user_profiles SET role='parish',parish_id=p,diocese_id=d,status='SUSPENDED',is_active=true
  WHERE auth_user_id=v_actor;
 ELSE
  INSERT INTO public.user_profiles(auth_user_id,role,parish_id,diocese_id,status,is_active)
  VALUES(v_actor,'parish',p,d,'SUSPENDED',true);
 END IF;
 PERFORM set_config('qa173.actor',v_actor::text,true);
 PERFORM set_config('qa173.parish',p::text,true);
 PERFORM set_config('qa173.home',d::text,true);
 PERFORM set_config('qa173.foreign',foreign_d::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $suspended$
DECLARE v_actor uuid:=current_setting('qa173.actor')::uuid;
 p uuid:=current_setting('qa173.parish')::uuid;
 scenario record;
 err text;
 blocked integer:=0;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
 FOR scenario IN
 SELECT * FROM (VALUES
  ('confirmacion','SELECT * FROM public.register_historical_confirmation($1,$2::jsonb,NULL::uuid,NULL::text)','Sólo la parroquia propietaria puede digitalizar su libro de Confirmaciones'),
  ('matrimonio','SELECT * FROM public.register_historical_marriage($1,$2::jsonb)','Sólo la parroquia propietaria puede digitalizar su libro de Matrimonios'),
  ('exequias','SELECT * FROM public.register_historical_funeral($1,$2::jsonb)','Sólo la parroquia propietaria puede digitalizar su libro de Exequias'),
  ('narrativo','SELECT * FROM public.register_historical_narrative($1,''bautismo'',$2::jsonb)','Sólo la parroquia propietaria puede digitalizar un asiento narrativo de su libro físico')
 ) tests(kind,command,expected)
 LOOP
  BEGIN
   EXECUTE scenario.command USING p,'{}'::jsonb;
  EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
   IF err=scenario.expected THEN blocked:=blocked+1;
   ELSE RAISE EXCEPTION 'V173 unexpected % response: %',scenario.kind,err; END IF;
  END;
 END LOOP;
 IF blocked<>4 THEN RAISE EXCEPTION 'V173 suspended actor: expected 4 denials, found %',blocked;END IF;
END $suspended$;
RESET ROLE;
UPDATE public.user_profiles SET status='ACTIVE',diocese_id=current_setting('qa173.foreign')::uuid
WHERE auth_user_id=current_setting('qa173.actor')::uuid;
SET LOCAL ROLE authenticated;
DO $wrongdiocese$
DECLARE v_actor uuid:=current_setting('qa173.actor')::uuid;
 p uuid:=current_setting('qa173.parish')::uuid;
 scenario record;err text;blocked integer:=0;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
 FOR scenario IN
 SELECT * FROM (VALUES
  ('confirmacion','SELECT * FROM public.register_historical_confirmation($1,$2::jsonb,NULL::uuid,NULL::text)','Sólo la parroquia propietaria puede digitalizar su libro de Confirmaciones'),
  ('matrimonio','SELECT * FROM public.register_historical_marriage($1,$2::jsonb)','Sólo la parroquia propietaria puede digitalizar su libro de Matrimonios'),
  ('exequias','SELECT * FROM public.register_historical_funeral($1,$2::jsonb)','Sólo la parroquia propietaria puede digitalizar su libro de Exequias'),
  ('narrativo','SELECT * FROM public.register_historical_narrative($1,''bautismo'',$2::jsonb)','Sólo la parroquia propietaria puede digitalizar un asiento narrativo de su libro físico')
 ) tests(kind,command,expected)
 LOOP
  BEGIN
   EXECUTE scenario.command USING p,'{}'::jsonb;
  EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
   IF err=scenario.expected THEN blocked:=blocked+1;
   ELSE RAISE EXCEPTION 'V173 unexpected foreign % response: %',scenario.kind,err; END IF;
  END;
 END LOOP;
 IF blocked<>4 THEN RAISE EXCEPTION 'V173 foreign profile: expected 4 denials, found %',blocked;END IF;
END $wrongdiocese$;
ROLLBACK;
