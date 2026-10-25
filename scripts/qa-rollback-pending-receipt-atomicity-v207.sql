-- V207: receipt insertion failure must roll back the original creation, counters and audits.
BEGIN;
SET LOCAL statement_timeout='45000ms';
CREATE TEMP TABLE qa207_scope AS
 SELECT up.auth_user_id AS actor,up.parish_id AS parish FROM public.user_profiles up
 JOIN public.parishes p ON p.id=up.parish_id AND p.diocese_id=up.diocese_id
 WHERE up.role='parish' AND up.is_active IS TRUE AND upper(up.status)='ACTIVE' LIMIT 1;
DO $init$ BEGIN
 IF (SELECT count(*) FROM qa207_scope)<>1 THEN RAISE EXCEPTION 'Missing QA parish'; END IF;
 PERFORM set_config('qa207.actor',(SELECT actor::text FROM qa207_scope),true);
 PERFORM set_config('qa207.parish',(SELECT parish::text FROM qa207_scope),true);
END $init$;
CREATE FUNCTION pg_temp.qa207_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN RAISE EXCEPTION 'QA207_RECEIPT_FAIL'; END $f$;
CREATE TRIGGER qa207_receipt_failure BEFORE INSERT ON public.pending_creation_requests
 FOR EACH ROW EXECUTE FUNCTION pg_temp.qa207_receipt_failure();
SET LOCAL ROLE authenticated;
DO $fail$
DECLARE a uuid:=current_setting('qa207.actor')::uuid;p uuid:=current_setting('qa207.parish')::uuid;k text;req uuid;payload jsonb;
 before_params jsonb;after_params jsonb;before_n bigint;after_n bigint;blocked int:=0;reason text;requests jsonb:='{}';
BEGIN
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 FOREACH k IN ARRAY ARRAY['bautismo','confirmacion','matrimonio','exequias'] LOOP
  req:=gen_random_uuid();requests:=requests||jsonb_build_object(k,req);
  payload:='{"nombres":"QA207_ATOMIC","apellidos":"FICTICIO","fechaNacimiento":"2020-01-01","fechaSacramento":"2026-10-20","novioNombres":"QA207","novioApellidos":"FICTICIO","noviaNombres":"QA207","noviaApellidos":"FICTICIA","fecha_defuncion":"2026-10-18","fecha_exequias":"2026-10-20","qa_v207":true}';
  SELECT to_jsonb(pp) INTO before_params FROM public.parish_parameters pp WHERE parish_id=p;
  SELECT (SELECT count(*) FROM public.pending_baptisms WHERE parish_id=p)+(SELECT count(*) FROM public.pending_confirmations WHERE parish_id=p)+(SELECT count(*) FROM public.pending_marriages WHERE parish_id=p)+(SELECT count(*) FROM public.pending_funerals WHERE parish_id=p) INTO before_n;
  BEGIN
   PERFORM public.create_pending_registration_v207(k,req,p,payload,null);
   RAISE EXCEPTION 'V207 injected failure did not fire';
  EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS reason=MESSAGE_TEXT;
   IF reason<>'QA207_RECEIPT_FAIL' THEN RAISE EXCEPTION 'V207 wrong failure %',reason; END IF;
   blocked:=blocked+1;
  END;
  SELECT to_jsonb(pp) INTO after_params FROM public.parish_parameters pp WHERE parish_id=p;
  SELECT (SELECT count(*) FROM public.pending_baptisms WHERE parish_id=p)+(SELECT count(*) FROM public.pending_confirmations WHERE parish_id=p)+(SELECT count(*) FROM public.pending_marriages WHERE parish_id=p)+(SELECT count(*) FROM public.pending_funerals WHERE parish_id=p) INTO after_n;
  IF before_params IS DISTINCT FROM after_params OR before_n<>after_n THEN RAISE EXCEPTION 'V207 partial creation after receipt failure %',k; END IF;
 END LOOP;
 PERFORM set_config('qa207.requests',requests::text,true);
 PERFORM set_config('qa207.atomic_failures',blocked::text,true);
END $fail$;
RESET ROLE;
DO $check$ BEGIN
 IF EXISTS(SELECT 1 FROM public.registry_audit_log WHERE after_data->>'qa_v207'='true' AND created_at>=transaction_timestamp()) THEN RAISE EXCEPTION 'V207 orphan audit after receipt failure'; END IF;
 IF EXISTS(SELECT 1 FROM public.pending_creation_requests WHERE parish_id=current_setting('qa207.parish')::uuid AND created_at>=transaction_timestamp()) THEN RAISE EXCEPTION 'V207 ghost receipt after failure'; END IF;
END $check$;
DROP TRIGGER qa207_receipt_failure ON public.pending_creation_requests;
SET LOCAL ROLE authenticated;
DO $retry$
DECLARE p uuid:=current_setting('qa207.parish')::uuid;k text;req uuid;payload jsonb;answer jsonb;retried int:=0;
BEGIN
 FOREACH k IN ARRAY ARRAY['bautismo','confirmacion','matrimonio','exequias'] LOOP
  req:=(current_setting('qa207.requests')::jsonb->>k)::uuid;
  payload:='{"nombres":"QA207_ATOMIC","apellidos":"FICTICIO","fechaNacimiento":"2020-01-01","fechaSacramento":"2026-10-20","novioNombres":"QA207","novioApellidos":"FICTICIO","noviaNombres":"QA207","noviaApellidos":"FICTICIA","fecha_defuncion":"2026-10-18","fecha_exequias":"2026-10-20","qa_v207":true}';
  answer:=public.create_pending_registration_v207(k,req,p,payload,null);
  IF answer IS NULL THEN RAISE EXCEPTION 'V207 missing retry receipt %',k; END IF;
  retried:=retried+1;
 END LOOP;
 PERFORM set_config('qa207.atomic_retries',retried::text,true);
END $retry$;
RESET ROLE;
SELECT current_setting('qa207.atomic_failures')::int AS forced_receipt_failures,
 current_setting('qa207.atomic_retries')::int AS recovered_with_same_request_ids,
 (SELECT count(*) FROM public.pending_creation_requests WHERE parish_id=current_setting('qa207.parish')::uuid AND created_at>=transaction_timestamp()) AS receipts_after_recovery;
ROLLBACK;
