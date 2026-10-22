-- V139 · Lectura tardía de aviso ya procesado puede degradar estado. ROLLBACK.
BEGIN;
DO $qa$
DECLARE v_actor uuid;v_parish uuid;v_diocese uuid;v_id uuid;v_after text;
BEGIN
 SELECT auth_user_id,parish_id,diocese_id INTO STRICT v_actor,v_parish,v_diocese
 FROM public.user_profiles WHERE role='parish' AND is_active LIMIT 1;
 INSERT INTO public.official_notifications(diocese_id,receiver_parish_id,category,subject,message,status,read_at,processed_at,payload)
 VALUES(v_diocese,v_parish,'decree','QA-V139-PROCESADA','Aviso ficticio procesado','processed',now()-interval '2 days',now()-interval '1 day','{"qaOnly":true}'::jsonb)
 RETURNING id INTO v_id;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 PERFORM public.mark_official_notification_read(v_id);
 EXECUTE 'RESET ROLE';
 SELECT status INTO STRICT v_after FROM public.official_notifications WHERE id=v_id;
 IF v_after='read' THEN RAISE EXCEPTION 'V139-CONFIRMED: marcar lectura degradó processed a read'; END IF;
END $qa$;
ROLLBACK;