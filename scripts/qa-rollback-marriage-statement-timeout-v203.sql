-- V203 real PostgreSQL statement_timeout during a fully seated marriage transaction.
-- Expected outcome: SQLSTATE 57014 cancellation; no COMMIT possible; server must roll back.
-- To run the control, replace '900ms' with '6000ms' (pg_sleep(2) completes).
-- Before timeout, assert that official seat, pending closure, number and audit all exist.
BEGIN;
SET LOCAL statement_timeout='900ms';
DO $setup$
DECLARE actor uuid;p uuid;pid uuid;
BEGIN
 SELECT up.auth_user_id,up.parish_id INTO STRICT actor,p FROM public.user_profiles up
 JOIN public.parishes par ON par.id=up.parish_id AND par.diocese_id=up.diocese_id
 WHERE up.role='parish' AND up.is_active IS TRUE AND upper(up.status)='ACTIVE' LIMIT 1;
 IF EXISTS(SELECT 1 FROM public.marriages WHERE parish_id=p AND book_number='9885')
 THEN RAISE EXCEPTION 'QA V203 reserved book in use';END IF;
 UPDATE public.parish_parameters
 SET matrimonios_params=matrimonios_params||'{"ordinarioLibro":9885,"ordinarioFolio":1,"ordinarioNumero":1,"ordinarioPartidas":2,"ordinarioBlocked":false}'::jsonb
 WHERE parish_id=p;
 IF NOT FOUND THEN RAISE EXCEPTION 'QA V203 missing parameters';END IF;
 INSERT INTO public.pending_marriages(parish_id,status,reportado,raw_data)
 VALUES(p,'pending',false,'{"fechaSacramento":"2026-10-20","novioNombres":"V203","novioApellidos":"FICTICIO","noviaNombres":"V203","noviaApellidos":"FICTICIA","qa_v203":"timeout-marriage"}'::jsonb) RETURNING id INTO pid;
 PERFORM set_config('qa203.actor',actor::text,true);
 PERFORM set_config('qa203.parish',p::text,true);
 PERFORM set_config('qa203.pending',pid::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $seat_then_timeout$
DECLARE p uuid:=current_setting('qa203.parish')::uuid;
 id_pending uuid:=current_setting('qa203.pending')::uuid;
 seated record;ct integer;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',current_setting('qa203.actor'),true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa203.actor'),'role','authenticated')::text,true);
 SELECT * INTO STRICT seated FROM public.seat_pending_marriage(id_pending);
 IF seated.marriage_id IS NULL OR seated.book_number<>'9885' OR seated.number<>'0001' OR seated.next_number<>2
 THEN RAISE EXCEPTION 'QA V203 the official seat was NOT successful before sleep';END IF;
 SELECT count(*) INTO ct FROM public.marriages
 WHERE id=seated.marriage_id AND parish_id=p AND status='seated';
 IF ct<>1 THEN RAISE EXCEPTION 'QA V203 official partida absent before timeout';END IF;
 SELECT count(*) INTO ct FROM public.pending_marriages
 WHERE id=id_pending AND status='seated' AND reportado IS TRUE;
 IF ct<>1 THEN RAISE EXCEPTION 'QA V203 pending boleta not closed before timeout';END IF;
 -- The successful seat and boleta have been verified; now force the server cancellation.
 PERFORM pg_sleep(2);
END $seat_then_timeout$;
RESET ROLE;
DO $audit_only_on_control_run$
DECLARE p uuid:=current_setting('qa203.parish')::uuid;ct integer;
BEGIN
 SELECT count(*) INTO ct FROM public.registry_audit_log WHERE parish_id=p
 AND action='seat' AND entity_type='matrimonio' AND created_at>=transaction_timestamp();
 IF ct<>1 THEN RAISE EXCEPTION 'QA V203 normal control should have exactly one seat audit';END IF;
END $audit_only_on_control_run$;
SELECT 'marriage' AS sacrament, 'SEAT_AND_CONTROL_SLEEP_COMPLETED' AS outcome;
ROLLBACK;
