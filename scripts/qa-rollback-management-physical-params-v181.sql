-- V181 real PostgreSQL QA: 4 correct actor flows, 28 explicit denied operations.
-- Two fictitious users plus one profileless user; all modifications rolled back.
BEGIN;
DO $fixture$
DECLARE p uuid; di uuid; manager uuid:=gen_random_uuid(); worker uuid:=gen_random_uuid(); ghost uuid:=gen_random_uuid(); target uuid;
BEGIN
 SELECT id,diocese_id INTO STRICT p,di FROM public.parishes WHERE diocese_id IS NOT NULL ORDER BY id LIMIT 1;
 INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at) VALUES
 (manager,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa-v181-manager-'||manager||'@example.invalid',now(),now()),
 (worker,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa-v181-parish-'||worker||'@example.invalid',now(),now()),
 (ghost,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa-v181-profileless-'||ghost||'@example.invalid',now(),now());
 DELETE FROM public.user_profiles WHERE auth_user_id=ghost;
 IF EXISTS(SELECT 1 FROM public.user_profiles WHERE auth_user_id=ghost) THEN RAISE EXCEPTION 'V181 profileless fixture wrong';END IF;
 INSERT INTO public.user_profiles(auth_user_id,role,diocese_id,status,is_active)
 VALUES(manager,'diocese',di,'ACTIVE',true);
 INSERT INTO public.user_profiles(auth_user_id,role,diocese_id,parish_id,status,is_active)
 VALUES(worker,'parish',di,p,'ACTIVE',true) RETURNING id INTO target;
 PERFORM set_config('qa181.manager',manager::text,true);
 PERFORM set_config('qa181.worker',worker::text,true);
 PERFORM set_config('qa181.ghost',ghost::text,true);
 PERFORM set_config('qa181.target',target::text,true);
 PERFORM set_config('qa181.parish',p::text,true);
END $fixture$;
DO $proof$
DECLARE manager uuid:=current_setting('qa181.manager')::uuid;
 worker uuid:=current_setting('qa181.worker')::uuid;
 ghost uuid:=current_setting('qa181.ghost')::uuid;
 target uuid:=current_setting('qa181.target')::uuid;
 parish uuid:=current_setting('qa181.parish')::uuid;
 actor uuid; mode text; err text; expected text;
 t record; positives int:=0; denials int:=0; denied boolean;
BEGIN
 -- Valid manager MUST still be able to change a synthetic target.
 EXECUTE 'SET LOCAL ROLE authenticated';
 PERFORM set_config('request.jwt.claim.sub',manager::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',manager,'role','authenticated')::text,true);
 PERFORM public.set_managed_user_active(target,false);
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=target AND is_active=false)
 THEN RAISE EXCEPTION 'V181 legitimate diocesan access management failed';END IF;
 positives:=positives+1;
 PERFORM public.update_managed_user_profile(target,'QA-V181-AUTHORIZED',parish,NULL::uuid);
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=target AND username='QA-V181-AUTHORIZED')
 THEN RAISE EXCEPTION 'V181 legitimate profile reassignment failed';END IF;
 positives:=positives+1;
 EXECUTE 'RESET ROLE';
 UPDATE public.user_profiles SET is_active=true,status='ACTIVE' WHERE id=target;
 -- Valid parish actor must pass authorization (expected mismatched book to stop mutation).
 EXECUTE 'SET LOCAL ROLE authenticated';
 PERFORM set_config('request.jwt.claim.sub',worker::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',worker,'role','authenticated')::text,true);
 FOR t IN SELECT * FROM (VALUES
 ('baptism','SELECT public.save_baptism_parameters($1,$2::jsonb,999999,NULL,NULL)'),
 ('confirmation','SELECT public.save_confirmation_parameters($1,$2::jsonb,999999,NULL,NULL)')
 ) cases(kind,call)
 LOOP
  err:=NULL; BEGIN
   EXECUTE t.call USING parish,'{}'::jsonb;
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
  END;
  IF err NOT LIKE 'El Libro cambió%' THEN RAISE EXCEPTION 'V181 legitimate % auth did not reach version validation: %',t.kind,err;END IF;
  positives:=positives+1;
 END LOOP;
 EXECUTE 'RESET ROLE';
 -- 6 malformed manager profiles + one profileless session × 2 write RPCs = 14 denials.
 FOREACH mode IN ARRAY ARRAY['SUSPENDED','NULL_STATUS','NULL_ACTIVE','DISABLED','PENDING','WRONG_ROLE','PROFILELESS']
 LOOP
  IF mode='PROFILELESS' THEN actor:=ghost;
  ELSE
   actor:=manager;
   UPDATE public.user_profiles SET
    role=CASE WHEN mode='WRONG_ROLE' THEN 'parish' ELSE 'diocese' END,
    status=CASE WHEN mode='NULL_STATUS' THEN NULL WHEN mode='SUSPENDED' THEN 'SUSPENDED' WHEN mode='PENDING' THEN 'PENDING' ELSE 'ACTIVE' END,
    is_active=CASE WHEN mode='NULL_ACTIVE' THEN NULL WHEN mode='DISABLED' THEN false ELSE true END
   WHERE auth_user_id=manager;
  END IF;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  FOR t IN SELECT * FROM (VALUES
   ('active','SELECT public.set_managed_user_active($1,false)','No autorizado para administrar accesos'),
   ('profile','SELECT public.update_managed_user_profile($1,''QA-V181-FORBIDDEN'',$2,NULL::uuid)','No autorizado para administrar perfiles institucionales')
  ) cases(kind,call,expected)
  LOOP
   err:=NULL;
   BEGIN EXECUTE t.call USING target,parish;
   EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
   END;
   IF err IS DISTINCT FROM t.expected THEN RAISE EXCEPTION 'V181 manager mode % RPC % incorrect failure: %',mode,t.kind,err;END IF;
   denials:=denials+1;
  END LOOP;
  EXECUTE 'RESET ROLE';
 END LOOP;
 -- 7 malformed parish profiles × 2 book updates = 14 denials.
 FOREACH mode IN ARRAY ARRAY['SUSPENDED','NULL_STATUS','NULL_ACTIVE','DISABLED','PENDING','BLANK_STATUS','WRONG_ROLE']
 LOOP
  UPDATE public.user_profiles SET
   role=CASE WHEN mode='WRONG_ROLE' THEN 'diocese' ELSE 'parish' END,
   status=CASE WHEN mode='NULL_STATUS' THEN NULL WHEN mode='SUSPENDED' THEN 'SUSPENDED'
      WHEN mode='PENDING' THEN 'PENDING' WHEN mode='BLANK_STATUS' THEN '' ELSE 'ACTIVE' END,
   is_active=CASE WHEN mode='NULL_ACTIVE' THEN NULL WHEN mode='DISABLED' THEN false ELSE true END
  WHERE auth_user_id=worker;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub',worker::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',worker,'role','authenticated')::text,true);
  FOR t IN SELECT * FROM (VALUES
   ('baptism','SELECT public.save_baptism_parameters($1,$2::jsonb,999999,NULL,NULL)',
     'Sólo la parroquia propietaria puede modificar sus parámetros de Bautismo'),
   ('confirmation','SELECT public.save_confirmation_parameters($1,$2::jsonb,999999,NULL,NULL)',
     'Sólo la parroquia propietaria puede modificar sus parámetros de Confirmación')
  ) cases(kind,call,expected)
  LOOP
   err:=NULL;
   BEGIN EXECUTE t.call USING parish,'{}'::jsonb;
   EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
   END;
   IF err IS DISTINCT FROM t.expected THEN RAISE EXCEPTION 'V181 parish mode % RPC % error %',mode,t.kind,err; END IF;
   denials:=denials+1;
  END LOOP;
  EXECUTE 'RESET ROLE';
 END LOOP;
 IF positives<>4 OR denials<>28 THEN RAISE EXCEPTION 'V181 wrong matrix % permitted and % forbidden',positives,denials;END IF;
 -- Ensure denied attempts did not override valid target operations.
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=target AND username='QA-V181-AUTHORIZED' AND is_active=true)
 THEN RAISE EXCEPTION 'V181 forbidden call altered fictitious authorized target';END IF;
 PERFORM set_config('qa181.result',jsonb_build_object('positive',positives,'denied',denials)::text,true);
END $proof$;
SELECT current_setting('qa181.result')::jsonb AS qa_aggregate_only;
ROLLBACK;