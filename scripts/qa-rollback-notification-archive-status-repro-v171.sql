-- SACRAMENTUM V171 · REPRODUCCIÓN PREPARCHE (INTENCIONAL): una cuenta STATUS SUSPENDED con is_active=true no debe archivar.
-- Esta reproducción se ejecuta únicamente bajo BEGIN/ROLLBACK. No hay COMMIT.
BEGIN;
DO $setup$
DECLARE v_actor uuid:=gen_random_uuid();v_parish uuid;v_diocese uuid;v_notice uuid:=gen_random_uuid();v_recipient uuid:=gen_random_uuid();
BEGIN
 SELECT p.id,p.diocese_id INTO STRICT v_parish,v_diocese FROM public.parishes p
 WHERE p.diocese_id IS NOT NULL ORDER BY p.id LIMIT 1;
 INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at)
 VALUES (v_actor,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
  'qa-v171-'||v_actor::text||'@example.invalid',now(),now());
 IF EXISTS(SELECT 1 FROM public.user_profiles WHERE auth_user_id=v_actor)
 THEN
  UPDATE public.user_profiles SET role='parish',parish_id=v_parish,diocese_id=v_diocese,
    status='SUSPENDED',is_active=true WHERE auth_user_id=v_actor;
 ELSE
  INSERT INTO public.user_profiles(auth_user_id,role,parish_id,diocese_id,status,is_active)
  VALUES(v_actor,'parish',v_parish,v_diocese,'SUSPENDED',true);
 END IF;
 INSERT INTO public.matrimonial_notifications
 (id,sender_parish_id,diocese_id,consecutive,document_number,person_name,status)
 VALUES(v_notice,v_parish,v_diocese,
 -(1000000000+floor(random()*100000000)::bigint),
 'QA-V171-'||left(v_notice::text,8),'QA V171 PERSONA FICTICIA','sent');
 INSERT INTO public.matrimonial_notification_recipients
 (id,notification_id,receiver_parish_id,status)
 VALUES(v_recipient,v_notice,v_parish,'pending');
 PERFORM set_config('qa171.actor',v_actor::text,true);
 PERFORM set_config('qa171.recipient',v_recipient::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $repro$
DECLARE v_actor uuid:=current_setting('qa171.actor')::uuid;
 v_recipient uuid:=current_setting('qa171.recipient')::uuid;
 v_result boolean;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
 SELECT public.archive_matrimonial_notification_recipient(v_recipient) INTO v_result;
 IF v_result IS DISTINCT FROM true THEN RAISE EXCEPTION 'Reproduction did not return true'; END IF;
 RAISE NOTICE 'V171_PREPATCH_CONFIRMED: suspended institutional profile improperly archived fictional notice';
END $repro$;
RESET ROLE;
DO $verify$
BEGIN
 IF (SELECT status FROM public.matrimonial_notification_recipients
  WHERE id=current_setting('qa171.recipient')::uuid) IS DISTINCT FROM 'cancelled'
 THEN RAISE EXCEPTION 'Expected prepatch status cancelled'; END IF;
END $verify$;
ROLLBACK;
