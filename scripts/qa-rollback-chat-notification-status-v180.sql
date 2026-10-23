-- V180 Chat + matrimonial notification + document template: 10 authorized and 60 blocked tests.
-- All identities and chat defaults created are fictional and transactionally rolled back.
BEGIN;
DO $fixture$
DECLARE actor uuid:=gen_random_uuid(); p uuid; di uuid;
BEGIN
 SELECT id,diocese_id INTO STRICT p,di FROM public.parishes WHERE diocese_id IS NOT NULL ORDER BY id LIMIT 1;
 INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at)
 VALUES(actor,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'qa-v180-'||actor||'@example.invalid',now(),now());
 INSERT INTO public.user_profiles(auth_user_id,role,diocese_id,parish_id,status,is_active)
 VALUES(actor,'parish',di,p,'ACTIVE',true);
 PERFORM set_config('qa180.actor',actor::text,true);
END $fixture$;
DO $test$
DECLARE a uuid:=current_setting('qa180.actor')::uuid;
 scenario text; item record; expected text; got text; denied boolean;
 arr jsonb; active int:=0; blocked int:=0; dir_positive int:=0;
BEGIN
 FOREACH scenario IN ARRAY ARRAY[
   'ACTIVE','NULL_STATUS','NULL_ACTIVE','SUSPENDED','DISABLED','PENDING','BLANK_STATUS'
 ] LOOP
  UPDATE public.user_profiles SET
   status=CASE scenario
    WHEN 'NULL_STATUS' THEN NULL
    WHEN 'SUSPENDED' THEN 'SUSPENDED'
    WHEN 'PENDING' THEN 'PENDING'
    WHEN 'BLANK_STATUS' THEN ''
    ELSE 'ACTIVE' END,
   is_active=CASE scenario
    WHEN 'NULL_ACTIVE' THEN NULL
    WHEN 'DISABLED' THEN FALSE
    ELSE TRUE END
  WHERE auth_user_id=a;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub',a::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  IF scenario<>'ACTIVE' AND public.current_app_role() IS NOT NULL
  THEN RAISE EXCEPTION 'V180 central institutional role was not denied for %',scenario;END IF;
  -- Chat setup is deliberately before chat directory and rooms: prove a real membership
  -- cannot be read when the same user subsequently loses institutional active status.
  FOR item IN SELECT * FROM (VALUES
   ('chat_setup',
    'SELECT public.ensure_diocesan_chat_defaults()',
    'SUCCESS','Perfil institucional no autorizado para Chat Diocesano'),
   ('chat_directory','SELECT public.list_chat_directory()','JSON_ARRAY','EMPTY_ARRAY'),
   ('chat_rooms','SELECT public.list_my_chat_rooms()','JSON_ARRAY','EMPTY_ARRAY'),
   ('archive','SELECT public.archive_matrimonial_notification_recipient(gen_random_uuid())',
    'Aviso matrimonial no encontrado','Cuenta parroquial no autorizada'),
   ('cancel','SELECT public.cancel_matrimonial_notification(gen_random_uuid())',
    'La notificación no pertenece a esta parroquia','Cuenta parroquial no autorizada'),
   ('mark_notification','SELECT public.mark_sacramental_notification_read(gen_random_uuid())',
    'Notificación sacramental no encontrada','Cuenta parroquial activa requerida'),
   ('mark_receipt','SELECT public.mark_sacramental_receipt_read(gen_random_uuid())',
    'Acuse sacramental no encontrado','Cuenta parroquial activa requerida'),
   ('process_physical','SELECT public.process_manual_matrimonial_notification_physical(gen_random_uuid())',
    'Notificación sacramental no encontrada','Cuenta parroquial activa requerida'),
   ('document','SELECT public.issue_document_from_template(gen_random_uuid())',
    'Plantilla no disponible para este ámbito','Perfil activo no disponible'),
   ('matrimonial_issue',
    'SELECT * FROM public.issue_matrimonial_notification(gen_random_uuid(),NULL::uuid,NULL::uuid,NULL::jsonb,NULL::date,NULL::text,NULL::text,NULL::text,NULL::uuid,NULL::uuid,NULL::text,NULL::text,NULL::text,NULL::text,NULL::text,NULL::jsonb)',
    'La fecha de matrimonio es obligatoria','Sólo una cuenta parroquial activa puede emitir notificaciones matrimoniales')
  ) cases(kind,call,allowed_response,denied_response)
  LOOP
   expected:=CASE WHEN scenario='ACTIVE' THEN item.allowed_response ELSE item.denied_response END;
   IF expected IN ('JSON_ARRAY','EMPTY_ARRAY') THEN
    EXECUTE item.call INTO arr;
    IF jsonb_typeof(arr)<>'array' THEN RAISE EXCEPTION 'V180 % % not an array',scenario,item.kind;END IF;
    IF expected='EMPTY_ARRAY' AND jsonb_array_length(arr)<>0
    THEN RAISE EXCEPTION 'V180 % could read % elements of %',scenario,jsonb_array_length(arr),item.kind;END IF;
    IF scenario='ACTIVE' AND item.kind='chat_directory' THEN
     dir_positive:=jsonb_array_length(arr);
     IF dir_positive<1 THEN RAISE EXCEPTION 'V180 active parish cannot read its authorized chat directory';END IF;
    END IF;
   ELSE
    denied:=false;got:='';
    BEGIN
     EXECUTE item.call;
     got:='SUCCESS';
    EXCEPTION WHEN OTHERS THEN
     denied:=true;
     GET STACKED DIAGNOSTICS got=MESSAGE_TEXT;
    END;
    IF got IS DISTINCT FROM expected THEN
     RAISE EXCEPTION 'V180 scenario % kind % returned %, expected %',scenario,item.kind,got,expected;
    END IF;
   END IF;
   IF scenario='ACTIVE' THEN active:=active+1; ELSE blocked:=blocked+1;END IF;
  END LOOP;
  EXECUTE 'RESET ROLE';
 END LOOP;
 IF active<>10 OR blocked<>60 THEN
  RAISE EXCEPTION 'V180 unexpected matrix % legitimate / % denied',active,blocked;
 END IF;
 PERFORM set_config('qa180.result',jsonb_build_object(
  'allowed',active,'blocked',blocked,'authorizedChatDirectorySize',dir_positive)::text,true);
END $test$;
SELECT current_setting('qa180.result')::jsonb AS only_aggregate_counts;
ROLLBACK;