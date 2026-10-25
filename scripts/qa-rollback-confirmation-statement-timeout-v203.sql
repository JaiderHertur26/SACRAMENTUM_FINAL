-- V203 real statement_timeout after successful confirmation RPC, all writes transient.
-- Control path: increase SET LOCAL statement_timeout to 6000ms; timeout path uses 900ms.
-- pg_sleep(2) must be reached AFTER checking official partida and pending boleta.
BEGIN;
SET LOCAL statement_timeout='900ms';
DO $setup$
DECLARE p uuid;actor uuid;pid uuid;
BEGIN
 SELECT up.parish_id,up.auth_user_id INTO STRICT p,actor
 FROM public.user_profiles up JOIN public.parishes par ON par.id=up.parish_id AND par.diocese_id=up.diocese_id
 WHERE up.role='parish' AND up.is_active IS TRUE AND upper(up.status)='ACTIVE' LIMIT 1;
 IF EXISTS(SELECT 1 FROM public.confirmations WHERE parish_id=p AND book_number='9885')
 THEN RAISE EXCEPTION 'QA203 reserved book already used';END IF;
 UPDATE public.parish_parameters SET confirmaciones_params=confirmaciones_params||
 '{"ordinarioLibro":9885,"ordinarioFolio":1,"ordinarioNumero":1,"ordinarioPartidas":2,"ordinarioBlocked":false}'::jsonb
 WHERE parish_id=p;
 IF NOT FOUND THEN RAISE EXCEPTION 'QA203 missing parish parameters';END IF;
 INSERT INTO public.pending_confirmations(parish_id,status,reportado,raw_data)
 VALUES(p,'pending',false,'{"nombres":"V203","apellidos":"FICTICIO","fechaSacramento":"2026-10-20","qa_v203":"timeout-confirmation"}'::jsonb)
 RETURNING id INTO pid;
 PERFORM set_config('qa203.actor',actor::text,true);
 PERFORM set_config('qa203.parish',p::text,true);
 PERFORM set_config('qa203.pending',pid::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $seat_then_timeout$
DECLARE p uuid:=current_setting('qa203.parish')::uuid;pid uuid:=current_setting('qa203.pending')::uuid;
 outcome record;ct integer;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',current_setting('qa203.actor'),true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa203.actor'),'role','authenticated')::text,true);
 SELECT * INTO STRICT outcome FROM public.seat_confirmation_records(
  p,jsonb_build_array(jsonb_build_object('pending_id',pid)),9885,1,1);
 IF outcome.seated_count<>1 OR outcome.next_book<>9885 OR outcome.next_number<>2
 THEN RAISE EXCEPTION 'QA203 official seat failed before timeout';END IF;
 SELECT count(*) INTO ct FROM public.confirmations
 WHERE parish_id=p AND book_number='9885' AND status='seated';
 IF ct<>1 THEN RAISE EXCEPTION 'QA203 official partida missing before timeout';END IF;
 SELECT count(*) INTO ct FROM public.pending_confirmations WHERE id=pid AND status='seated' AND reportado IS TRUE;
 IF ct<>1 THEN RAISE EXCEPTION 'QA203 boleta not sealed before timeout';END IF;
 PERFORM pg_sleep(2);
END $seat_then_timeout$;
RESET ROLE;
DO $audit_only_on_control_run$
DECLARE p uuid:=current_setting('qa203.parish')::uuid;ct integer;
BEGIN
 SELECT count(*) INTO ct FROM public.registry_audit_log
 WHERE parish_id=p AND entity_type='confirmation' AND action='seat'
 AND created_at>=transaction_timestamp();
 IF ct<>1 THEN RAISE EXCEPTION 'QA203 expected exactly one audit entry in control run, got %',ct;END IF;
END $audit_only_on_control_run$;
SELECT 'confirmation' AS sacrament, 'SEAT_AND_CONTROL_SLEEP_COMPLETED' AS outcome;
ROLLBACK;