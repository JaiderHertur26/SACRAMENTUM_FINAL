-- V201: Two-record seat RPC atomicity with an invalid second record, followed by safe retry.
-- Executes against real production SQL functions, but all figures and changes are fictitious.
-- The only persistent effect of this script is NONE: outer transaction always ROLLBACK.
BEGIN;
SET LOCAL statement_timeout='45000ms';
DO $setup$
DECLARE actor uuid;parish uuid;
BEGIN
 SELECT up.auth_user_id,up.parish_id INTO STRICT actor,parish FROM public.user_profiles up
 JOIN public.parishes p ON p.id=up.parish_id AND p.diocese_id=up.diocese_id
 WHERE up.role='parish' AND up.is_active IS TRUE AND upper(up.status)='ACTIVE' LIMIT 1;
 IF EXISTS (SELECT 1 FROM public.baptisms WHERE parish_id=parish AND book_number='9881')
 OR EXISTS (SELECT 1 FROM public.confirmations WHERE parish_id=parish AND book_number='9881')
 THEN RAISE EXCEPTION 'V201 test book 9881 in use';END IF;
 UPDATE public.parish_parameters SET
 bautizos_params=bautizos_params||'{"ordinarioLibro":9881,"ordinarioFolio":1,"ordinarioNumero":1,"ordinarioPartidas":2,"ordinarioBlocked":false}'::jsonb,
 confirmaciones_params=confirmaciones_params||'{"ordinarioLibro":9881,"ordinarioFolio":1,"ordinarioNumero":1,"ordinarioPartidas":2,"ordinarioBlocked":false}'::jsonb
 WHERE parish_id=parish;
 IF NOT FOUND THEN RAISE EXCEPTION 'V201 parameters absent';END IF;
 PERFORM set_config('qa201.actor',actor::text,true);
 PERFORM set_config('qa201.parish',parish::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $exercise$
DECLARE
 p uuid:=current_setting('qa201.parish')::uuid;actor uuid:=current_setting('qa201.actor')::uuid;
 k text; pending_table text; official_table text;create_rpc text;seat_rpc text;
 first_id uuid;second_id uuid;res record;why text;
 before_b jsonb; after_b jsonb; n integer;
 blocked integer:=0; recovered integer:=0; valid_pending integer:=0; audit_count integer;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 FOR k,pending_table,official_table,create_rpc,seat_rpc IN
 SELECT * FROM (VALUES
 ('bautismo','pending_baptisms','baptisms','create_pending_baptism','seat_baptism_records'),
 ('confirmacion','pending_confirmations','confirmations','create_pending_confirmation','seat_confirmation_records')
 ) e(k,pending_table,official_table,create_rpc,seat_rpc)
 LOOP
  EXECUTE format('SELECT pending_id FROM public.%I($1,$2)',create_rpc)
   INTO STRICT first_id USING p,jsonb_build_object('nombres','V201','apellidos','PRIMERO FICTICIO','fechaSacramento','2026-10-20','qa_v201','first');
  EXECUTE format('SELECT pending_id FROM public.%I($1,$2)',create_rpc)
   INTO STRICT second_id USING p,jsonb_build_object('nombres','V201','apellidos','SEGUNDO FICTICIO','fechaSacramento','2035-11-01','qa_v201','second');
  SELECT CASE WHEN k='bautismo' THEN bautizos_params ELSE confirmaciones_params END
   INTO before_b FROM public.parish_parameters WHERE parish_id=p;
  BEGIN
   EXECUTE format('SELECT * FROM public.%I($1,$2,$3,$4,$5)',seat_rpc)
    INTO STRICT res USING p,jsonb_build_array(jsonb_build_object('pending_id',first_id),jsonb_build_object('pending_id',second_id)),9881,1,1;
   RAISE EXCEPTION 'V201_ERROR_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS why=MESSAGE_TEXT;
   IF why='V201_ERROR_NOT_RAISED' OR
    (position('antes de' in lower(why))=0 AND position('posterior' in lower(why))=0)
   THEN RAISE EXCEPTION 'V201 unexpected batch failure %: %',k,why;END IF;
   blocked:=blocked+1;
  END;
  SELECT CASE WHEN k='bautismo' THEN bautizos_params ELSE confirmaciones_params END
   INTO after_b FROM public.parish_parameters WHERE parish_id=p;
  IF (before_b->>'ordinarioLibro',before_b->>'ordinarioFolio',before_b->>'ordinarioNumero')
   IS DISTINCT FROM (after_b->>'ordinarioLibro',after_b->>'ordinarioFolio',after_b->>'ordinarioNumero')
  THEN RAISE EXCEPTION 'V201 numbers advanced after failed batch %',k;END IF;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE parish_id=$1 AND book_number=''9881''',official_table) INTO n USING p;
  IF n<>0 THEN RAISE EXCEPTION 'V201 phantom official record after error %',k;END IF;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE id=ANY($1) AND status=''pending'' AND reportado IS FALSE',pending_table)
   INTO n USING ARRAY[first_id,second_id];
  IF n<>2 THEN RAISE EXCEPTION 'V201 lost pending records after batch rollback %: %',k,n;END IF;
  valid_pending:=valid_pending+n;
  EXECUTE format('UPDATE public.%I SET raw_data=raw_data||''{"fechaSacramento":"2026-10-20"}''::jsonb WHERE id=$1',pending_table) USING second_id;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'V201 failed correction of fictitious pending %',k;END IF;
  EXECUTE format('SELECT * FROM public.%I($1,$2,$3,$4,$5)',seat_rpc)
    INTO STRICT res USING p,jsonb_build_array(jsonb_build_object('pending_id',first_id),jsonb_build_object('pending_id',second_id)),9881,1,1;
  IF res.seated_count<>2 OR res.next_book<>9881 OR res.next_number<>3 OR res.next_folio<>2
  THEN RAISE EXCEPTION 'V201 legal retry wrong coordinates %: count %,book %,number %,folio %',
   k,res.seated_count,res.next_book,res.next_number,res.next_folio;END IF;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE parish_id=$1 AND book_number=''9881'' AND status=''seated''',official_table) INTO n USING p;
  IF n<>2 THEN RAISE EXCEPTION 'V201 expected 2 official rows after retry %',k;END IF;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE id=ANY($1) AND status=''seated'' AND reportado IS TRUE',pending_table) INTO n USING ARRAY[first_id,second_id];
  IF n<>2 THEN RAISE EXCEPTION 'V201 pending rows not sealed after retry %',k;END IF;
  recovered:=recovered+1;
 END LOOP;
 IF blocked<>2 OR recovered<>2 OR valid_pending<>4 THEN RAISE EXCEPTION 'V201 incomplete validation matrix';END IF;
 PERFORM set_config('qa201.outcome',jsonb_build_object(
 'two_record_batches_rolled_back_on_second_invalid',blocked,
 'pending_rows_preserved_after_partial_failure',valid_pending,
 'successful_retries_with_two_partidas_each',recovered,
 'phantom_audit_events_after_failure',0,
 'monotonic_numbering_after_retry',true,
 'rollback',true)::text,true);
END $exercise$;
RESET ROLE;
DO $audit_verify$
DECLARE p uuid:=current_setting('qa201.parish')::uuid;kind text;n integer;verified integer:=0;
BEGIN
 FOR kind IN SELECT unnest(ARRAY['baptism','confirmation'])
 LOOP
  SELECT count(*) INTO n FROM public.registry_audit_log
  WHERE parish_id=p AND action='seat'
   AND entity_type=kind AND created_at>=transaction_timestamp();
  IF n<>2 THEN RAISE EXCEPTION 'V201 audit mismatch for %, expected exactly 2, got %',kind,n;END IF;
  verified:=verified+n;
 END LOOP;
 PERFORM set_config('qa201.audit_verified',verified::text,true);
END $audit_verify$;
SELECT current_setting('qa201.outcome')::jsonb AS result,
 current_setting('qa201.audit_verified')::integer AS exact_legal_audit_records;
ROLLBACK;