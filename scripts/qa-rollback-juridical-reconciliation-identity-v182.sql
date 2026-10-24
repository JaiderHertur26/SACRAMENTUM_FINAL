-- V182: 5 valid juridical auth gates, 24 invalid states/roles explicitly denied.
-- Synthetic actors only. Never output private court records. Entire QA ROLLBACK.
BEGIN;
DO $setup$
DECLARE a uuid:=gen_random_uuid();ghost uuid:=gen_random_uuid();di uuid;
BEGIN
 SELECT id INTO STRICT di FROM public.dioceses ORDER BY id LIMIT 1;
 INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at) VALUES
 (a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa-v182-dio-'||a||'@example.invalid',now(),now()),
 (ghost,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa-v182-guest-'||ghost||'@example.invalid',now(),now());
 INSERT INTO public.user_profiles(auth_user_id,role,diocese_id,status,is_active)
 VALUES(a,'diocese',di,'ACTIVE',true);
 DELETE FROM public.user_profiles WHERE auth_user_id=ghost;
 IF EXISTS(SELECT 1 FROM public.user_profiles WHERE auth_user_id=ghost)
 THEN RAISE EXCEPTION 'V182 guest must have no profile';END IF;
 PERFORM set_config('qa182.actor',a::text,true);
 PERFORM set_config('qa182.ghost',ghost::text,true);
END $setup$;
DO $matrix$
DECLARE a uuid:=current_setting('qa182.actor')::uuid;
 ghost uuid:=current_setting('qa182.ghost')::uuid;
 who uuid;scenario text;fn record;msg text;expected text;
 positive int:=0;negative int:=0;
BEGIN
 FOREACH scenario IN ARRAY ARRAY['ACTIVE','CHANCERY','SUSPENDED','NULL_STATUS','NULL_ACTIVE','DISABLED','PENDING','BLANK_STATUS','WRONG_ROLE','PROFILELESS']
 LOOP
  who:=CASE WHEN scenario='PROFILELESS' THEN ghost ELSE a END;
  IF who=a THEN
   UPDATE public.user_profiles SET
    role=CASE WHEN scenario='CHANCERY' THEN 'chancery' WHEN scenario='WRONG_ROLE' THEN 'parish' ELSE 'diocese' END,
    status=CASE WHEN scenario='NULL_STATUS' THEN NULL WHEN scenario='SUSPENDED' THEN 'SUSPENDED' WHEN scenario='PENDING' THEN 'PENDING' WHEN scenario='BLANK_STATUS' THEN '' ELSE 'ACTIVE' END,
    is_active=CASE WHEN scenario='NULL_ACTIVE' THEN NULL WHEN scenario='DISABLED' THEN false ELSE true END
   WHERE auth_user_id=a;
  END IF;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub',who::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',who,'role','authenticated')::text,true);
  FOR fn IN SELECT * FROM (VALUES
   ('approve','SELECT public.approve_later_note_reconciliation_v156(gen_random_uuid(),NULL::text,NULL::text)',
      'Referencia de autorización y motivación episcopal obligatorias',
      'Sólo Diócesis puede autorizar, desde cuenta distinta de Cancillería'),
   ('clarifications','SELECT public.get_court_clarifications_v113(gen_random_uuid())',
      'Recepción ajena o inexistente',
      'Acceso institucional denegado'),
   ('summary','SELECT public.get_court_receipt_dual_control_summary_v111(gen_random_uuid())',
      'Recepción no localizada en la jurisdicción',
      'Consulta limitada a Cancillería y Diócesis')
  ) t(kind,sql_call,allowed_error,denied_error)
  LOOP
   IF scenario='CHANCERY' AND fn.kind='approve' THEN CONTINUE;END IF;
   expected:=CASE WHEN scenario IN ('ACTIVE','CHANCERY') THEN fn.allowed_error ELSE fn.denied_error END;
   msg:=NULL;
   BEGIN EXECUTE fn.sql_call;
   EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT;
   END;
   IF msg IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'V182 scenario % / %: got %, expected %',scenario,fn.kind,msg,expected;
   END IF;
   IF scenario IN ('ACTIVE','CHANCERY') THEN positive:=positive+1; ELSE negative:=negative+1;END IF;
  END LOOP;
  EXECUTE 'RESET ROLE';
 END LOOP;
 IF positive<>5 OR negative<>24 THEN
  RAISE EXCEPTION 'V182 expected 5 allowed gates and 24 denials, got % %',positive,negative;END IF;
 PERFORM set_config('qa182.result',jsonb_build_object('allowed_gates',positive,'denied',negative)::text,true);
END $matrix$;
SELECT current_setting('qa182.result')::jsonb AS aggregate_counts_only;
ROLLBACK;