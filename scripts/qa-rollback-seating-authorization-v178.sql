-- SACRAMENTUM V178: permitted branch of 6 RPCs + 36 fail-closed denials;
-- all profile/diocese/user changes fictional and ROLLBACK.
BEGIN;
DO $setup$
DECLARE a uuid:=gen_random_uuid();p uuid;di uuid;foreign_di uuid:=gen_random_uuid();
BEGIN
 SELECT id,diocese_id INTO STRICT p,di FROM public.parishes WHERE diocese_id IS NOT NULL ORDER BY id LIMIT 1;
 INSERT INTO public.dioceses(id,name) VALUES(foreign_di,'QA V178 OTHER DIOCESE '||left(foreign_di::text,8));
 INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at)
 VALUES(a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa-v178-'||a||'@example.invalid',now(),now());
 INSERT INTO public.user_profiles(auth_user_id,role,parish_id,diocese_id,status,is_active)
 VALUES(a,'parish',p,di,'ACTIVE',true);
 PERFORM set_config('qa178.actor',a::text,true);PERFORM set_config('qa178.parish',p::text,true);
 PERFORM set_config('qa178.diocese',di::text,true);PERFORM set_config('qa178.foreign',foreign_di::text,true);
END $setup$;
DO $scenarios$
DECLARE a uuid:=current_setting('qa178.actor')::uuid;
 p uuid:=current_setting('qa178.parish')::uuid;
 scenario text;spec record;msg text;num_good int:=0;num_denied int:=0;expected text;
BEGIN
 FOREACH scenario IN ARRAY ARRAY['ACTIVE','SUSPENDED','NULL_STATUS','NULL_ACTIVE','DISABLED','FOREIGN_DIOCESE','WRONG_ROLE']
 LOOP
  UPDATE public.user_profiles
  SET role=CASE WHEN scenario='WRONG_ROLE' THEN 'diocese' ELSE 'parish' END,
  status=CASE WHEN scenario='NULL_STATUS' THEN NULL WHEN scenario='SUSPENDED' THEN 'SUSPENDED' ELSE 'ACTIVE' END,
  is_active=CASE WHEN scenario='NULL_ACTIVE' THEN NULL WHEN scenario='DISABLED' THEN false ELSE true END,
  diocese_id=CASE WHEN scenario='FOREIGN_DIOCESE' THEN current_setting('qa178.foreign')::uuid ELSE current_setting('qa178.diocese')::uuid END
  WHERE auth_user_id=a;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub',a::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  FOR spec IN SELECT * FROM (VALUES
   ('combined','SELECT * FROM public.create_pending_baptism_with_confirmation_flow($1,$2::jsonb,$3::jsonb)',
    'Fecha de nacimiento y fecha de Bautismo son obligatorias',
    'Sólo la parroquia propietaria puede crear este registro conjunto'),
   ('baptism_seat','SELECT * FROM public.seat_baptism_records($1,$2::jsonb,0,0,0)',
    'No hay registros para asentar',
    'Sólo la parroquia propietaria puede asentar estos Bautismos'),
   ('confirmation_seat','SELECT * FROM public.seat_confirmation_records($1,$2::jsonb,0,0,0)',
    'No hay registros para asentar',
    'Sólo la parroquia propietaria puede asentar estas Confirmaciones'),
   ('marriage_seat','SELECT * FROM public.seat_pending_marriage($1)',
    'Expediente matrimonial pendiente no encontrado',
    'Sólo una parroquia activa puede asentar matrimonios'),
   ('funeral_seat','SELECT * FROM public.seat_funeral_record($2::jsonb,NULL::uuid)',
    'Datos de Exequias inválidos',
    'Sólo una cuenta parroquial activa puede asentar Exequias'),
   ('notification_apply','SELECT * FROM public.process_matrimonial_notification_recipient($1)',
    'Notificación sacramental no encontrada',
    'Sólo la parroquia destinataria puede procesar la notificación sacramental')
  ) t(kind,call,allowed_error,denied_error)
  LOOP
   expected:=CASE WHEN scenario='ACTIVE' THEN spec.allowed_error ELSE spec.denied_error END;
   BEGIN
    IF spec.kind='combined' THEN EXECUTE spec.call USING p,'{}'::jsonb,'{}'::jsonb;
    ELSIF spec.kind IN ('baptism_seat','confirmation_seat') THEN EXECUTE spec.call USING p,'[]'::jsonb;
    ELSIF spec.kind IN ('marriage_seat','notification_apply') THEN EXECUTE spec.call USING gen_random_uuid();
    ELSE EXECUTE spec.call USING p,NULL::jsonb;END IF;
    RAISE EXCEPTION 'V178 failure: % % completed unexpectedly',scenario,spec.kind;
   EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT;
    IF msg IS DISTINCT FROM expected THEN
      RAISE EXCEPTION 'V178 scenario % function % got % expected %',scenario,spec.kind,msg,expected;
    END IF;
    IF scenario='ACTIVE' THEN num_good:=num_good+1; ELSE num_denied:=num_denied+1;END IF;
   END;
  END LOOP;
  EXECUTE 'RESET ROLE';
 END LOOP;
 IF num_good<>6 OR num_denied<>36
 THEN RAISE EXCEPTION 'V178 expected 6 positive permission reaches and 36 denials, got % and %',num_good,num_denied; END IF;
 RAISE NOTICE 'V178_POSITIVE_GATES_6_NEGATIVE_GATES_36';
END $scenarios$;
ROLLBACK;