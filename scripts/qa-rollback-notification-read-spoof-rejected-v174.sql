-- V174: strict negative regression replacing historical V133 vulnerability reproduction.
BEGIN;
DO $qa$
DECLARE v_diocese uuid;v_parish uuid;v_actor uuid;v_notice uuid;
 v_status text;v_error text;v_denied boolean:=false;
BEGIN
 SELECT up.auth_user_id,up.diocese_id INTO STRICT v_actor,v_diocese
 FROM public.user_profiles up WHERE up.role='diocese' AND up.is_active=true
 AND upper(coalesce(up.status,'ACTIVE'))='ACTIVE' LIMIT 1;
 SELECT id INTO STRICT v_parish FROM public.parishes WHERE diocese_id=v_diocese ORDER BY id LIMIT 1;
 INSERT INTO public.official_notifications(diocese_id,receiver_parish_id,category,subject,message,status,payload)
 VALUES(v_diocese,v_parish,'decree','QA-V174-UNAUTHORIZED-READ','Fictitious notification for forbidden receipt test','pending',
 '{"qaOnly":true,"source":"V174"}'::jsonb) RETURNING id INTO v_notice;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 BEGIN
  PERFORM public.mark_official_notification_read(v_notice);
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_error=MESSAGE_TEXT;
  IF v_error='No autorizado para esta notificación' THEN v_denied:=true;
  ELSE RAISE;END IF;
 END;
 EXECUTE 'RESET ROLE';
 IF NOT v_denied THEN RAISE EXCEPTION 'V174 FAIL: diocese actor forged parish receipt';END IF;
 SELECT status INTO STRICT v_status FROM public.official_notifications WHERE id=v_notice;
 IF v_status IS DISTINCT FROM 'pending' THEN
  RAISE EXCEPTION 'V174 FAIL: denied reception mutated notification status: %',v_status;
 END IF;
END $qa$;
ROLLBACK;
