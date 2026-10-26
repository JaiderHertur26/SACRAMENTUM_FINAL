-- PRIVILEGED QA fixture provisioning. Never run in CI.
-- The SELECT result contains newly generated QA credentials: keep it outside git and reports.
-- No messages/emails are sent. Save the result privately and append the project URL/publishable key.
BEGIN;
CREATE TEMP TABLE qa208_export(config jsonb) ON COMMIT DROP;
DO $seed$
DECLARE run_id uuid:=gen_random_uuid();tag text;d1 uuid:=gen_random_uuid();d2 uuid:=gen_random_uuid();
 v1 uuid:=gen_random_uuid();v2 uuid:=gen_random_uuid();n1 uuid:=gen_random_uuid();n2 uuid:=gen_random_uuid();
 pa uuid:=gen_random_uuid();pb uuid:=gen_random_uuid();px uuid:=gen_random_uuid();ch uuid:=gen_random_uuid();
 actor uuid;profile_id uuid;pass text;mail text;role_name text;parish uuid;dio uuid;kind text;users jsonb:='[]';
BEGIN
 tag:='QA208-'||run_id::text;
 INSERT INTO public.dioceses(id,name,type,city) VALUES(d1,tag||' DIOCESIS A','diocese','QA FICTICIA'),(d2,tag||' DIOCESIS B','diocese','QA FICTICIA');
 INSERT INTO public.vicarias(id,name,diocese_id) VALUES(v1,tag||' VICARIA A',d1),(v2,tag||' VICARIA B',d2);
 INSERT INTO public.decanatos(id,name,vicaria_id,diocese_id) VALUES(n1,tag||' DECANATO A',v1,d1),(n2,tag||' DECANATO B',v2,d2);
 INSERT INTO public.parishes(id,name,diocese_id,vicary_id,decanate_id,city)
 VALUES(pa,tag||' PARROQUIA A',d1,v1,n1,'QA FICTICIA'),(pb,tag||' PARROQUIA B',d1,v1,n1,'QA FICTICIA'),(px,tag||' PARROQUIA X',d2,v2,n2,'QA FICTICIA');
 INSERT INTO public.chancelleries(id,name,diocese_id,city) VALUES(ch,tag||' CANCILLERIA',d1,'QA FICTICIA');
 FOREACH kind IN ARRAY ARRAY['parish_a1','parish_a2','parish_b','parish_x','diocese_a','diocese_b','chancery','admin_general'] LOOP
  actor:=gen_random_uuid();profile_id:=gen_random_uuid();pass:=encode(extensions.gen_random_bytes(32),'hex')||'!Qa208';
  mail:='qa208.'||kind||'.'||run_id::text||'@example.invalid';
  role_name:=CASE WHEN kind LIKE 'parish_%' THEN 'parish' WHEN kind LIKE 'diocese_%' THEN 'diocese' ELSE kind END;
  parish:=CASE kind WHEN 'parish_a1' THEN pa WHEN 'parish_a2' THEN pa WHEN 'parish_b' THEN pb WHEN 'parish_x' THEN px ELSE NULL END;
  dio:=CASE WHEN kind IN ('parish_x','diocese_b') THEN d2 WHEN kind='admin_general' THEN NULL ELSE d1 END;
  INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
  VALUES('00000000-0000-0000-0000-000000000000',actor,'authenticated','authenticated',mail,extensions.crypt(pass,extensions.gen_salt('bf',10)),now(),
    jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'qa_run',run_id),jsonb_build_object('full_name',tag||' '||kind),now(),now(),'','','','');
  INSERT INTO auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at)
  VALUES(actor::text,actor,jsonb_build_object('sub',actor::text,'email',mail,'email_verified',true),'email',now(),now());
  INSERT INTO public.user_profiles(id,auth_user_id,email,username,full_name,role,diocese_id,parish_id,chancery_id,is_active,status)
  VALUES(profile_id,actor,mail,'qa208_'||replace(kind,'_','')||'_'||left(run_id::text,8),tag||' '||kind,role_name,dio,parish,CASE WHEN kind='chancery' THEN ch ELSE NULL END,true,'ACTIVE');
  users:=users||jsonb_build_array(jsonb_build_object('kind',kind,'id',actor,'profileId',profile_id,'email',mail,'password',pass,'role',role_name,'parishId',parish,'dioceseId',dio));
 END LOOP;
 INSERT INTO qa208_export VALUES(jsonb_build_object('runId',run_id,'tag',tag,'dioceses',jsonb_build_array(d1,d2),'vicariates',jsonb_build_array(v1,v2),'deaneries',jsonb_build_array(n1,n2),'parishes',jsonb_build_array(pa,pb,px),'chancery',ch,'users',users));
END $seed$;
SELECT config FROM qa208_export;
COMMIT;
