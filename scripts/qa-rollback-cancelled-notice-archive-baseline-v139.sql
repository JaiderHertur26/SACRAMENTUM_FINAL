-- V139: reproducción de acuse archivado sobre notificación previamente cancelada. ROLLBACK.
BEGIN;
DO $qa$
DECLARE v_actor uuid;v_parish uuid;v_diocese uuid;v_notice uuid;v_status text;v_read_at timestamptz;
BEGIN
 SELECT auth_user_id,parish_id,diocese_id INTO STRICT v_actor,v_parish,v_diocese
 FROM public.user_profiles WHERE role='parish' AND is_active LIMIT 1;
 INSERT INTO public.official_notifications(diocese_id,receiver_parish_id,category,subject,message,status,payload)
 VALUES(v_diocese,v_parish,'decree','QA-V139-DECRETO-REVERTIDO','Aviso ficticio de decreto ya revertido','cancelled','{"qaOnly":true}'::jsonb)
 RETURNING id INTO v_notice;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 PERFORM public.archive_official_notification(v_notice);
 EXECUTE 'RESET ROLE';
 SELECT status,read_at INTO STRICT v_status,v_read_at FROM public.official_notifications WHERE id=v_notice;
 IF v_status='archived' AND v_read_at IS NOT NULL THEN
  RAISE EXCEPTION 'V139-CONFIRMED: archivo de aviso cancelado creó lectura ficticia y perdió estado cancelled';
 END IF;
END $qa$;
ROLLBACK;