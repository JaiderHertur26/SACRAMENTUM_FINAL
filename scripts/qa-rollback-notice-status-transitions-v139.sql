-- V139 · Matriz de transiciones de comunicaciones oficiales parroquiales, todo ROLLBACK.
BEGIN;
DO $qa$
DECLARE v_actor uuid;v_parish uuid;v_diocese uuid;v_role_actor uuid;
 v_pending uuid;v_read uuid;v_processed uuid;v_cancelled uuid;v_archived uuid;
 v_status text;v_read_at timestamptz;v_processed_at timestamptz;v_denied int:=0;v_positive int:=0;
BEGIN
 SELECT auth_user_id,parish_id,diocese_id INTO STRICT v_actor,v_parish,v_diocese
 FROM public.user_profiles WHERE role='parish' AND is_active LIMIT 1;
 SELECT auth_user_id INTO STRICT v_role_actor FROM public.user_profiles
 WHERE role='diocese' AND diocese_id=v_diocese AND is_active LIMIT 1;
 INSERT INTO public.official_notifications(diocese_id,receiver_parish_id,category,subject,message,status,payload)
 VALUES(v_diocese,v_parish,'decree','QA-V139-PENDING','Mensaje ficticio pendiente','pending','{"qaOnly":true}'::jsonb)
 RETURNING id INTO v_pending;
 INSERT INTO public.official_notifications(diocese_id,receiver_parish_id,category,subject,message,status,read_at,payload)
 VALUES(v_diocese,v_parish,'decree','QA-V139-READ','Mensaje ficticio leído','read',now()-interval '5 hours','{"qaOnly":true}'::jsonb)
 RETURNING id INTO v_read;
 INSERT INTO public.official_notifications(diocese_id,receiver_parish_id,category,subject,message,status,read_at,processed_at,payload)
 VALUES(v_diocese,v_parish,'decree','QA-V139-PROCESSED','Mensaje ficticio procesado','processed',now()-interval '5 hours',now()-interval '4 hours','{"qaOnly":true}'::jsonb)
 RETURNING id INTO v_processed;
 INSERT INTO public.official_notifications(diocese_id,receiver_parish_id,category,subject,message,status,payload)
 VALUES(v_diocese,v_parish,'decree','QA-V139-CANCELLED','Mensaje ficticio cancelado','cancelled','{"qaOnly":true}'::jsonb)
 RETURNING id INTO v_cancelled;
 INSERT INTO public.official_notifications(diocese_id,receiver_parish_id,category,subject,message,status,read_at,processed_at,payload)
 VALUES(v_diocese,v_parish,'decree','QA-V139-ARCHIVED','Mensaje ficticio archivado','archived',now()-interval '5 hours',now()-interval '1 hour','{"qaOnly":true}'::jsonb)
 RETURNING id INTO v_archived;

 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 BEGIN
   PERFORM public.archive_official_notification(v_pending);
   RAISE EXCEPTION 'V139-FAIL: archivo sin lectura previa permitido';
 EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1; END;
 SELECT status,read_at INTO STRICT v_status,v_read_at FROM public.official_notifications WHERE id=v_pending;
 IF v_status<>'pending' OR v_read_at IS NOT NULL THEN RAISE EXCEPTION 'V139-FAIL: alteró pending'; END IF;
 PERFORM public.mark_official_notification_read(v_pending);
 SELECT status,read_at INTO STRICT v_status,v_read_at FROM public.official_notifications WHERE id=v_pending;
 IF v_status<>'read' OR v_read_at IS NULL THEN RAISE EXCEPTION 'V139-FAIL: no se registró lectura real'; END IF;
 v_positive:=v_positive+1;
 PERFORM public.archive_official_notification(v_pending);
 SELECT status INTO STRICT v_status FROM public.official_notifications WHERE id=v_pending;
 IF v_status<>'archived' THEN RAISE EXCEPTION 'V139-FAIL: archivo legítimo no funciona'; END IF;
 v_positive:=v_positive+1;

 PERFORM public.mark_official_notification_read(v_read);
 SELECT status INTO STRICT v_status FROM public.official_notifications WHERE id=v_read;
 IF v_status<>'read' THEN RAISE EXCEPTION 'V139-FAIL: repetición read'; END IF;
 PERFORM public.archive_official_notification(v_read);
 SELECT status,read_at INTO STRICT v_status,v_read_at FROM public.official_notifications WHERE id=v_read;
 IF v_status<>'archived' OR v_read_at IS NULL THEN RAISE EXCEPTION 'V139-FAIL: archive read'; END IF;
 v_positive:=v_positive+1;

 PERFORM public.mark_official_notification_read(v_processed);
 SELECT status,processed_at INTO STRICT v_status,v_processed_at FROM public.official_notifications WHERE id=v_processed;
 IF v_status<>'processed' OR v_processed_at IS NULL THEN RAISE EXCEPTION 'V139-FAIL: processed retrocedió'; END IF;
 v_positive:=v_positive+1;
 PERFORM public.archive_official_notification(v_processed);
 SELECT status,processed_at INTO STRICT v_status,v_processed_at FROM public.official_notifications WHERE id=v_processed;
 IF v_status<>'archived' OR v_processed_at IS NULL THEN RAISE EXCEPTION 'V139-FAIL: archivo processed'; END IF;
 v_positive:=v_positive+1;

 PERFORM public.mark_official_notification_read(v_cancelled);
 SELECT status,read_at INTO STRICT v_status,v_read_at FROM public.official_notifications WHERE id=v_cancelled;
 IF v_status<>'cancelled' OR v_read_at IS NOT NULL THEN RAISE EXCEPTION 'V139-FAIL: marca cancelled como leída'; END IF;
 v_positive:=v_positive+1;
 BEGIN
  PERFORM public.archive_official_notification(v_cancelled);
  RAISE EXCEPTION 'V139-FAIL: pudo archivar cancelled';
 EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1; END;
 SELECT status,read_at INTO STRICT v_status,v_read_at FROM public.official_notifications WHERE id=v_cancelled;
 IF v_status<>'cancelled' OR v_read_at IS NOT NULL THEN RAISE EXCEPTION 'V139-FAIL: modificado cancelled'; END IF;

 PERFORM public.mark_official_notification_read(v_archived);
 SELECT status INTO STRICT v_status FROM public.official_notifications WHERE id=v_archived;
 IF v_status<>'archived' THEN RAISE EXCEPTION 'V139-FAIL: lectura reabrió archived'; END IF;
 v_positive:=v_positive+1;
 BEGIN
  PERFORM public.archive_official_notification(v_archived);
  RAISE EXCEPTION 'V139-FAIL: volvió a archivar archived';
 EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1; END;
 EXECUTE 'RESET ROLE';

 PERFORM set_config('request.jwt.claim.sub',v_role_actor::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 BEGIN
   PERFORM public.archive_official_notification(v_read);
   RAISE EXCEPTION 'V139-FAIL: rol diócesis archivó acuse parroquial';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM LIKE 'V139-FAIL%' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%Sólo la parroquia destinataria%' THEN RAISE; END IF;
   v_denied:=v_denied+1;
 END;
 EXECUTE 'RESET ROLE';

 IF v_positive<>7 OR v_denied<>4 THEN
   RAISE EXCEPTION 'V139 matriz incompleta positivos %, denegados %',v_positive,v_denied;
 END IF;
END $qa$;
ROLLBACK;