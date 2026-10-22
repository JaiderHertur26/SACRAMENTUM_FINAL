-- V133 · Prueba de recepción falsa de comunicación parroquial desde Diócesis.
BEGIN;
DO $qa$
DECLARE v_diocese uuid;v_parish uuid;v_actor uuid;v_notice uuid;v_status text;
BEGIN
 SELECT up.auth_user_id,up.diocese_id INTO STRICT v_actor,v_diocese FROM public.user_profiles up WHERE up.role='diocese' AND up.is_active LIMIT 1;
 SELECT id INTO STRICT v_parish FROM public.parishes WHERE diocese_id=v_diocese ORDER BY id LIMIT 1;
 INSERT INTO public.official_notifications (diocese_id,receiver_parish_id,category,subject,message,status,payload)
 VALUES(v_diocese,v_parish,'decree','QA-V133-RECEPCION-NO-REAL','Mensaje ficticio para medir límites de recepción','pending','{"qaOnly":true}'::jsonb) RETURNING id INTO v_notice;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 PERFORM public.mark_official_notification_read(v_notice);
 EXECUTE 'RESET ROLE';
 SELECT status INTO STRICT v_status FROM public.official_notifications WHERE id=v_notice;
 IF v_status='read' THEN RAISE EXCEPTION 'V133-CONFIRMED: Diócesis marcó como leída comunicación no recibida por Parroquia'; END IF;
END $qa$;
ROLLBACK;