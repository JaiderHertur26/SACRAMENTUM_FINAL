-- V177 prepatch independent four-sacrament suspended-account authorization repro.
-- All generated users and pending records are fictional, all rolled back.
BEGIN;
DO $setup$
DECLARE a uuid:=gen_random_uuid();p uuid;di uuid;
BEGIN
 SELECT id,diocese_id INTO STRICT p,di FROM public.parishes WHERE diocese_id IS NOT NULL ORDER BY id LIMIT 1;
 INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at)
 VALUES(a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa-v177-'||a||'@example.invalid',now(),now());
 INSERT INTO public.user_profiles(auth_user_id,role,parish_id,diocese_id,is_active,status)
 VALUES(a,'parish',p,di,true,'SUSPENDED');
 PERFORM set_config('qa177.actor',a::text,true);
 PERFORM set_config('qa177.parish',p::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $check$
DECLARE a uuid:=current_setting('qa177.actor')::uuid;p uuid:=current_setting('qa177.parish')::uuid;
 r uuid;total integer:=0;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 IF public.current_app_role() IS NOT NULL THEN RAISE EXCEPTION 'V177 baseline central role not denied';END IF;
 BEGIN
  SELECT pending_id INTO STRICT r FROM public.create_pending_baptism(p,'{"nombres":"QA V177","apellidos":"BAUTISMO","fechaSacramento":"2026-10-23"}'::jsonb);
  total:=total+1;
 EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'V177 baptism baseline rejected: %',SQLERRM;END;
 BEGIN
  SELECT pending_id INTO STRICT r FROM public.create_pending_confirmation(p,'{"nombres":"QA V177","apellidos":"CONFIRMACION","fechaSacramento":"2026-10-23"}'::jsonb);
  total:=total+1;
 EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'V177 confirmation baseline rejected: %',SQLERRM;END;
 BEGIN
  SELECT pending_id INTO STRICT r FROM public.create_pending_marriage(p,'{"novioNombres":"QA V177","novioApellidos":"PRUEBA","noviaNombres":"QA V177","noviaApellidos":"PRUEBA","fechaSacramento":"2026-10-23"}'::jsonb);
  total:=total+1;
 EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'V177 marriage baseline rejected: %',SQLERRM;END;
 BEGIN
  SELECT pending_id INTO STRICT r FROM public.create_pending_funeral(p,'{"nombres":"QA V177","apellidos":"EXEQUIAS","fecha_defuncion":"2026-10-22","fecha_exequias":"2026-10-23"}'::jsonb);
  total:=total+1;
 EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'V177 funeral baseline rejected: %',SQLERRM;END;
 IF total<>4 THEN RAISE EXCEPTION 'V177 expected four erroneous permissions, got %',total;END IF;
 RAISE NOTICE 'V177_PREPATCH_ALL_FOUR_SUSPENDED_PENDING_CREATIONS_CONFIRMED';
END $check$;
ROLLBACK;
