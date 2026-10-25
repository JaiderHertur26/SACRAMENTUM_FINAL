-- V201: two stale UI snapshots; the second submission must be rejected until refreshed.
-- This deliberately does NOT claim simultaneously overlapping physical PostgreSQL connections.
-- Entire synthetic scenario is transactionally rolled back.
BEGIN;
SET LOCAL statement_timeout='45000ms';
DO $init$
DECLARE parish uuid;actor uuid;
BEGIN
 SELECT up.parish_id,up.auth_user_id INTO STRICT parish,actor
 FROM public.user_profiles up JOIN public.parishes p
 ON up.parish_id=p.id AND up.diocese_id=p.diocese_id
 WHERE up.role='parish' AND up.is_active IS TRUE AND upper(up.status)='ACTIVE' LIMIT 1;
 IF EXISTS(SELECT 1 FROM public.baptisms WHERE parish_id=parish AND book_number='9882')
 OR EXISTS(SELECT 1 FROM public.confirmations WHERE parish_id=parish AND book_number='9882')
 THEN RAISE EXCEPTION 'V201 simulated stale client book already occupied';END IF;
 UPDATE public.parish_parameters SET
 bautizos_params=bautizos_params||'{"ordinarioLibro":9882,"ordinarioFolio":1,"ordinarioNumero":1,"ordinarioPartidas":2,"ordinarioBlocked":false}'::jsonb,
 confirmaciones_params=confirmaciones_params||'{"ordinarioLibro":9882,"ordinarioFolio":1,"ordinarioNumero":1,"ordinarioPartidas":2,"ordinarioBlocked":false}'::jsonb
 WHERE parish_id=parish;
 IF NOT FOUND THEN RAISE EXCEPTION 'V201 missing parameters';END IF;
 PERFORM set_config('qa201.actor',actor::text,true);
 PERFORM set_config('qa201.parish',parish::text,true);
END $init$;
SET LOCAL ROLE authenticated;
DO $qa$
DECLARE parish uuid:=current_setting('qa201.parish')::uuid;actor uuid:=current_setting('qa201.actor')::uuid;
 kind text;create_rpc text;seat_rpc text;pending_table text;official_table text;
 first_id uuid; second_id uuid;result record;error_message text;
 first_res integer:=0;stale_denied integer:=0;safe_second integer:=0;
 n integer;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 FOR kind,create_rpc,seat_rpc,pending_table,official_table IN SELECT * FROM (VALUES
 ('baptism','create_pending_baptism','seat_baptism_records','pending_baptisms','baptisms'),
 ('confirmation','create_pending_confirmation','seat_confirmation_records','pending_confirmations','confirmations')) x(kind,create_rpc,seat_rpc,pending_table,official_table)
 LOOP
  EXECUTE format('SELECT pending_id FROM public.%I($1,$2)',create_rpc)
  INTO STRICT first_id USING parish,jsonb_build_object('nombres','QA201','apellidos','CLIENTE UNO','fechaSacramento','2026-10-20','qa_v201','stale');
  EXECUTE format('SELECT pending_id FROM public.%I($1,$2)',create_rpc)
  INTO STRICT second_id USING parish,jsonb_build_object('nombres','QA201','apellidos','CLIENTE DOS','fechaSacramento','2026-10-20','qa_v201','stale');
  -- Both virtual clients initially saw Libro 9882 / Folio 1 / Número 1.
  EXECUTE format('SELECT * FROM public.%I($1,$2,$3,$4,$5)',seat_rpc)
   INTO STRICT result USING parish,jsonb_build_array(jsonb_build_object('pending_id',first_id)),9882,1,1;
  IF result.seated_count<>1 OR result.next_number<>2 OR result.next_folio<>1 THEN
   RAISE EXCEPTION 'V201 unexpected first snapshot seating %',kind;END IF;
  first_res:=first_res+1;
  BEGIN
   EXECUTE format('SELECT * FROM public.%I($1,$2,$3,$4,$5)',seat_rpc)
    INTO STRICT result USING parish,jsonb_build_array(jsonb_build_object('pending_id',second_id)),9882,1,1;
   RAISE EXCEPTION 'V201_STALE_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS error_message=MESSAGE_TEXT;
   IF position('consecutivo' IN lower(error_message))=0 OR error_message='V201_STALE_ACCEPTED'
   THEN RAISE EXCEPTION 'V201 stale rejection invalid for %: %',kind,error_message;END IF;
   stale_denied:=stale_denied+1;
  END;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE id=$1 AND status=''pending'' AND reportado IS FALSE',pending_table)
   INTO n USING second_id;
  IF n<>1 THEN RAISE EXCEPTION 'V201 second pending not preserved after stale rejection %',kind;END IF;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE parish_id=$1 AND book_number=''9882''',official_table)
   INTO n USING parish;
  IF n<>1 THEN RAISE EXCEPTION 'V201 phantom duplicate after stale rejection %',kind;END IF;
  EXECUTE format('SELECT * FROM public.%I($1,$2,$3,$4,$5)',seat_rpc)
   INTO STRICT result USING parish,jsonb_build_array(jsonb_build_object('pending_id',second_id)),9882,1,2;
  IF result.seated_count<>1 OR result.next_book<>9882 OR result.next_number<>3 OR result.next_folio<>2
  THEN RAISE EXCEPTION 'V201 refreshed second snapshot failed %',kind;END IF;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE parish_id=$1 AND book_number=''9882''',official_table)
   INTO n USING parish;
  IF n<>2 THEN RAISE EXCEPTION 'V201 expected two distinct records after refresh %',kind;END IF;
  safe_second:=safe_second+1;
 END LOOP;
 IF first_res<>2 OR stale_denied<>2 OR safe_second<>2 THEN RAISE EXCEPTION 'V201 incomplete stale clients';END IF;
 PERFORM set_config('qa201.result',jsonb_build_object('first_client_seated',first_res,
 'stale_second_client_denied_without_side_effect',stale_denied,
 'second_client_accepted_after_refresh',safe_second,'rollback',true)::text,true);
END $qa$;
RESET ROLE;
DO $audit$
DECLARE parish uuid:=current_setting('qa201.parish')::uuid;entity text;n integer;
BEGIN
 FOR entity IN SELECT unnest(ARRAY['baptism','confirmation']) LOOP
  SELECT count(*) INTO n FROM public.registry_audit_log WHERE parish_id=parish
   AND action='seat' AND entity_type=entity AND created_at>=transaction_timestamp();
  IF n<>2 THEN RAISE EXCEPTION 'V201 expected exact audit rows, % got %',entity,n;END IF;
 END LOOP;
END $audit$;
SELECT current_setting('qa201.result')::jsonb AS result;
ROLLBACK;