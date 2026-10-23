-- V171 · Full real-PostgreSQL transaction QA using only fictional actors/notices.
BEGIN;
DO $setup$
DECLARE a uuid:=gen_random_uuid();p uuid;d uuid;n uuid:=gen_random_uuid();r uuid:=gen_random_uuid();
BEGIN
 SELECT id,diocese_id INTO STRICT p,d FROM public.parishes
 WHERE diocese_id IS NOT NULL ORDER BY id LIMIT 1;
 INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at)
 VALUES(a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'qa-v171-'||a::text||'@example.invalid',now(),now());
 IF EXISTS(SELECT 1 FROM public.user_profiles WHERE auth_user_id=a) THEN
  UPDATE public.user_profiles SET role='parish',parish_id=p,diocese_id=d,status='SUSPENDED',is_active=true
   WHERE auth_user_id=a;
 ELSE
  INSERT INTO public.user_profiles(auth_user_id,role,parish_id,diocese_id,status,is_active)
  VALUES(a,'parish',p,d,'SUSPENDED',true);
 END IF;
 INSERT INTO public.matrimonial_notifications
 (id,sender_parish_id,diocese_id,consecutive,document_number,person_name,status)
 VALUES(n,p,d,-(2000000000+floor(random()*100000000)::bigint),
  'QA-V171-'||left(n::text,8),'PERSONA FICTICIA V171','sent');
 INSERT INTO public.matrimonial_notification_recipients
 (id,notification_id,receiver_parish_id,status)
 VALUES(r,n,p,'pending');
 PERFORM set_config('qa171.actor',a::text,true);
 PERFORM set_config('qa171.recipient',r::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $denials$
DECLARE a uuid:=current_setting('qa171.actor')::uuid;
 r uuid:=current_setting('qa171.recipient')::uuid;
 v_message text;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 BEGIN
  PERFORM public.archive_matrimonial_notification_recipient(r);
  RAISE EXCEPTION 'V171 BUG: Suspended profile archived notice';
 EXCEPTION WHEN OTHERS THEN
  -- Accept only the expected institutional denial, never our sentry exception.
  GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
  IF v_message <> 'Cuenta parroquial no autorizada' THEN RAISE; END IF;
 END;
END $denials$;
RESET ROLE;
DO $verify_denial$
DECLARE a uuid:=current_setting('qa171.actor')::uuid;
 r uuid:=current_setting('qa171.recipient')::uuid;
BEGIN
 IF (SELECT status FROM public.matrimonial_notification_recipients WHERE id=r)<>'pending'
 THEN RAISE EXCEPTION 'V171 denied session changed notice'; END IF;
 UPDATE public.user_profiles SET status='ACTIVE' WHERE auth_user_id=a;
END $verify_denial$;
SET LOCAL ROLE authenticated;
DO $positive$
DECLARE a uuid:=current_setting('qa171.actor')::uuid;
 r uuid:=current_setting('qa171.recipient')::uuid;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 IF public.archive_matrimonial_notification_recipient(r) IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'V171 active parish cannot archive own pending notice';END IF;
 IF public.archive_matrimonial_notification_recipient(r) IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'V171 duplicate archival should be idempotent';END IF;
END $positive$;
RESET ROLE;
DO $audit$
DECLARE a uuid:=current_setting('qa171.actor')::uuid;
 r uuid:=current_setting('qa171.recipient')::uuid;
BEGIN
 IF (SELECT status FROM public.matrimonial_notification_recipients WHERE id=r) IS DISTINCT FROM 'cancelled'
 THEN RAISE EXCEPTION 'V171 pending notice not archived';END IF;
 IF (SELECT count(*) FROM public.registry_audit_log WHERE actor_user_id=a AND entity_id=r AND action='archive')<>1
 THEN RAISE EXCEPTION 'V171 expected one archival audit event';END IF;
END $audit$;
ROLLBACK;
