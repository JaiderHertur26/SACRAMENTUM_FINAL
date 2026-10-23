-- V177 integration: 4 legitimate creates + 24 explicit denials, no persistent data.
BEGIN;
DO $setup$
DECLARE actor uuid:=gen_random_uuid();p uuid;di uuid;foreign_d uuid:=gen_random_uuid();
BEGIN
 SELECT id,diocese_id INTO STRICT p,di FROM public.parishes WHERE diocese_id IS NOT NULL ORDER BY id LIMIT 1;
 INSERT INTO public.dioceses(id,name) VALUES(foreign_d,'QA V177 FOREIGN '||left(foreign_d::text,8));
 INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at)
 VALUES(actor,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'qa-v177-'||actor||'@example.invalid',now(),now());
 INSERT INTO public.user_profiles(auth_user_id,role,parish_id,diocese_id,is_active,status)
 VALUES(actor,'parish',p,di,true,'ACTIVE');
 PERFORM set_config('qa177.actor',actor::text,true);
 PERFORM set_config('qa177.parish',p::text,true);
 PERFORM set_config('qa177.home',di::text,true);
 PERFORM set_config('qa177.foreign',foreign_d::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $legitimate$
DECLARE actor uuid:=current_setting('qa177.actor')::uuid;p uuid:=current_setting('qa177.parish')::uuid;
 spec record;created uuid;n int:=0;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 FOR spec IN SELECT * FROM (VALUES
  ('baptism','SELECT pending_id FROM public.create_pending_baptism($1,$2::jsonb)',
    '{"qa_v177":"yes","nombres":"QA V177","apellidos":"BAUTISMO","fechaSacramento":"2026-10-23"}'::jsonb),
  ('confirmation','SELECT pending_id FROM public.create_pending_confirmation($1,$2::jsonb)',
    '{"qa_v177":"yes","nombres":"QA V177","apellidos":"CONFIRMACION","fechaSacramento":"2026-10-23"}'::jsonb),
  ('marriage','SELECT pending_id FROM public.create_pending_marriage($1,$2::jsonb)',
    '{"qa_v177":"yes","novioNombres":"QA V177","novioApellidos":"PRUEBA","noviaNombres":"QA V177","noviaApellidos":"PRUEBA","fechaSacramento":"2026-10-23"}'::jsonb),
  ('funeral','SELECT pending_id FROM public.create_pending_funeral($1,$2::jsonb)',
    '{"qa_v177":"yes","nombres":"QA V177","apellidos":"EXEQUIAS","fecha_defuncion":"2026-10-22","fecha_exequias":"2026-10-23"}'::jsonb)
 ) cases(kind,sql_call,payload)
 LOOP
  EXECUTE spec.sql_call INTO created USING p,spec.payload;
  IF created IS NULL THEN RAISE EXCEPTION 'V177 legitimate % returned no id',spec.kind; END IF;
  n:=n+1;
 END LOOP;
 IF n<>4 THEN RAISE EXCEPTION 'V177 four positive cases incomplete: %',n;END IF;
END $legitimate$;
RESET ROLE;
DO $bad$
DECLARE actor uuid:=current_setting('qa177.actor')::uuid;
 p uuid:=current_setting('qa177.parish')::uuid;
 variant text;spec record;err text;denied boolean;count_denied int:=0;
BEGIN
 FOREACH variant IN ARRAY ARRAY['SUSPENDED','NULL_STATUS','NULL_ACTIVE','DISABLED','FOREIGN_DIOCESE','DIOCESE_ROLE']
 LOOP
  UPDATE public.user_profiles SET
   role=CASE WHEN variant='DIOCESE_ROLE' THEN 'diocese' ELSE 'parish' END,
   status=CASE WHEN variant='NULL_STATUS' THEN NULL WHEN variant='SUSPENDED' THEN 'SUSPENDED' ELSE 'ACTIVE' END,
   is_active=CASE WHEN variant='NULL_ACTIVE' THEN NULL WHEN variant='DISABLED' THEN false ELSE true END,
   diocese_id=CASE WHEN variant='FOREIGN_DIOCESE' THEN current_setting('qa177.foreign')::uuid ELSE current_setting('qa177.home')::uuid END
   WHERE auth_user_id=actor;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  FOR spec IN SELECT * FROM (VALUES
   ('baptism','SELECT pending_id FROM public.create_pending_baptism($1,$2::jsonb)',
    '{"qa_v177":"yes","nombres":"QA V177","apellidos":"BAUTISMO","fechaSacramento":"2026-10-23"}'::jsonb,
    'Sólo la parroquia propietaria puede crear borradores de Bautismo'),
   ('confirmation','SELECT pending_id FROM public.create_pending_confirmation($1,$2::jsonb)',
    '{"qa_v177":"yes","nombres":"QA V177","apellidos":"CONFIRMACION","fechaSacramento":"2026-10-23"}'::jsonb,
    'Sólo la parroquia propietaria puede crear borradores de Confirmación'),
   ('marriage','SELECT pending_id FROM public.create_pending_marriage($1,$2::jsonb)',
    '{"qa_v177":"yes","novioNombres":"QA V177","novioApellidos":"PRUEBA","noviaNombres":"QA V177","noviaApellidos":"PRUEBA","fechaSacramento":"2026-10-23"}'::jsonb,
    'Sólo la parroquia propietaria puede crear expedientes matrimoniales'),
   ('funeral','SELECT pending_id FROM public.create_pending_funeral($1,$2::jsonb)',
    '{"qa_v177":"yes","nombres":"QA V177","apellidos":"EXEQUIAS","fecha_defuncion":"2026-10-22","fecha_exequias":"2026-10-23"}'::jsonb,
    'Sólo la parroquia propietaria puede crear borradores de Exequias')
  ) cases(kind,sql_call,payload,expected)
  LOOP
   denied:=false;
   BEGIN
    EXECUTE spec.sql_call USING p,spec.payload;
   EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
    IF err IS DISTINCT FROM spec.expected THEN RAISE EXCEPTION 'V177 % % unexpected error: %',variant,spec.kind,err; END IF;
    denied:=true;
   END;
   IF NOT denied THEN RAISE EXCEPTION 'V177 % wrongly authorized pending %',variant,spec.kind;END IF;
   count_denied:=count_denied+1;
  END LOOP;
  EXECUTE 'RESET ROLE';
 END LOOP;
 IF count_denied<>24 THEN RAISE EXCEPTION 'V177 expected 24 explicit denials; got %',count_denied;END IF;
END $bad$;
DO $verify$
DECLARE counts integer[];
BEGIN
 SELECT ARRAY[
  (SELECT count(*) FROM public.pending_baptisms WHERE raw_data->>'qa_v177'='yes'),
  (SELECT count(*) FROM public.pending_confirmations WHERE raw_data->>'qa_v177'='yes'),
  (SELECT count(*) FROM public.pending_marriages WHERE raw_data->>'qa_v177'='yes'),
  (SELECT count(*) FROM public.pending_funerals WHERE raw_data->>'qa_v177'='yes')
 ] INTO counts;
 IF counts IS DISTINCT FROM ARRAY[1,1,1,1] THEN
  RAISE EXCEPTION 'V177 unexpected pending mutations after 24 denials: %',counts;
 END IF;
END $verify$;
ROLLBACK;
