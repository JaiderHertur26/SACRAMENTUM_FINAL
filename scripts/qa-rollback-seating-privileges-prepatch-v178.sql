-- V178 prepatch probes: suspended actor must not reach business validation.
BEGIN;
DO $setup$
DECLARE a uuid:=gen_random_uuid();p uuid;di uuid;
BEGIN
 SELECT id,diocese_id INTO STRICT p,di FROM public.parishes WHERE diocese_id IS NOT NULL ORDER BY id LIMIT 1;
 INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at)
 VALUES(a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'qa-v178-'||a||'@example.invalid',now(),now());
 INSERT INTO public.user_profiles(auth_user_id,role,parish_id,diocese_id,status,is_active)
 VALUES(a,'parish',p,di,'SUSPENDED',true);
 PERFORM set_config('qa178.actor',a::text,true);PERFORM set_config('qa178.parish',p::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $probes$
DECLARE a uuid:=current_setting('qa178.actor')::uuid;p uuid:=current_setting('qa178.parish')::uuid;
 sp record;err text;n int:=0;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 IF public.current_app_role() IS NOT NULL THEN RAISE EXCEPTION 'V178 central status guard failed';END IF;
 FOR sp IN SELECT * FROM (VALUES
 ('combined','SELECT * FROM public.create_pending_baptism_with_confirmation_flow($1,$2::jsonb,$3::jsonb)',
   'Fecha de nacimiento y fecha de Bautismo son obligatorias'),
 ('baptism_seat','SELECT * FROM public.seat_baptism_records($1,$2::jsonb,0,0,0)',
   'No hay registros para asentar'),
 ('confirmation_seat','SELECT * FROM public.seat_confirmation_records($1,$2::jsonb,0,0,0)',
   'No hay registros para asentar'),
 ('marriage_seat','SELECT * FROM public.seat_pending_marriage($1)',
   'Expediente matrimonial pendiente no encontrado'),
 ('funeral_seat','SELECT * FROM public.seat_funeral_record($2::jsonb,NULL::uuid)',
   'Datos de Exequias inválidos'),
 ('notification_apply','SELECT * FROM public.process_matrimonial_notification_recipient($1)',
   'Notificación sacramental no encontrada')
 ) cases(kind,call,expected)
 LOOP
  BEGIN
   IF sp.kind='combined' THEN EXECUTE sp.call USING p,'{}'::jsonb,'{}'::jsonb;
   ELSIF sp.kind IN ('baptism_seat','confirmation_seat') THEN EXECUTE sp.call USING p,'[]'::jsonb;
   ELSIF sp.kind='marriage_seat' OR sp.kind='notification_apply' THEN EXECUTE sp.call USING gen_random_uuid();
   ELSIF sp.kind='funeral_seat' THEN EXECUTE sp.call USING p,NULL::jsonb;
   END IF;
   RAISE EXCEPTION 'V178 % unexpectedly succeeded',sp.kind;
  EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
   IF err=sp.expected THEN n:=n+1;
   ELSE RAISE EXCEPTION 'V178 % unexpected business response: % (expected %)',sp.kind,err,sp.expected; END IF;
  END;
 END LOOP;
 IF n<>6 THEN RAISE EXCEPTION 'V178 prepatch checked %, wanted 6',n; END IF;
 RAISE NOTICE 'V178_SUSPENDED_PASSED_AUTH_IN_SIX_PRIVILEGED_CALLS';
END $probes$;
ROLLBACK;