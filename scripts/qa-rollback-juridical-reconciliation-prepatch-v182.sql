-- V182 prepatch · NULL status diocese actor reaches sensitive juridical functions.
-- Only fictional identities, all transactions rolled back. No court text output.
BEGIN;
DO $setup$
DECLARE a uuid:=gen_random_uuid();dio uuid;
BEGIN
 SELECT id INTO STRICT dio FROM public.dioceses ORDER BY id LIMIT 1;
 INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at)
 VALUES(a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa-v182-'||a||'@example.invalid',now(),now());
 INSERT INTO public.user_profiles(auth_user_id,role,diocese_id,status,is_active)
 VALUES(a,'diocese',dio,NULL,true);
 PERFORM set_config('qa182.actor',a::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $repro$
DECLARE a uuid:=current_setting('qa182.actor')::uuid; r record; msg text;n int:=0;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 IF public.current_app_role() IS NOT NULL THEN RAISE EXCEPTION 'V182 central role must deny NULL status';END IF;
 FOR r IN SELECT * FROM (VALUES
 ('approve','SELECT public.approve_later_note_reconciliation_v156(gen_random_uuid(),NULL::text,NULL::text)',
  'Referencia de autorización y motivación episcopal obligatorias'),
 ('clarifications','SELECT public.get_court_clarifications_v113(gen_random_uuid())',
  'Recepción ajena o inexistente'),
 ('dual_control','SELECT public.get_court_receipt_dual_control_summary_v111(gen_random_uuid())',
  'Recepción no localizada en la jurisdicción')
 ) e(kind,cmd,expected)
 LOOP
  msg:=NULL;BEGIN EXECUTE r.cmd;EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT;END;
  IF msg IS DISTINCT FROM r.expected THEN RAISE EXCEPTION 'V182 % returned %, expected %',r.kind,msg,r.expected; END IF;
  n:=n+1;
 END LOOP;
 IF n<>3 THEN RAISE EXCEPTION 'V182 expected 3 profile bypasses, got %',n;END IF;
 RAISE NOTICE 'V182_NULL_STATUS_PASSED_3_JURIDICAL_PRIVILEGED_GATES';
END $repro$;
ROLLBACK;