-- SACRAMENTUM V202: marriage and funeral seat transaction-subtransaction rollback after SUCCESSFUL insertion.
-- The forced failure happens after official record, boleta closure and audit are written.
-- No production residue: outer BEGIN / ROLLBACK, only synthetic pending records.
BEGIN;
SET LOCAL statement_timeout='45000ms';
DO $init$
DECLARE p uuid;u uuid;
BEGIN
 SELECT up.parish_id,up.auth_user_id INTO STRICT p,u
 FROM public.user_profiles up JOIN public.parishes par ON par.id=up.parish_id AND par.diocese_id=up.diocese_id
 WHERE up.role='parish' AND up.is_active IS TRUE AND upper(up.status)='ACTIVE' LIMIT 1;
 IF EXISTS(SELECT 1 FROM public.marriages WHERE parish_id=p AND book_number='9883')
 OR EXISTS(SELECT 1 FROM public.funerals WHERE parish_id=p AND book_number='9883')
 THEN RAISE EXCEPTION 'QA202 reserved test book already used'; END IF;
 UPDATE public.parish_parameters SET
 matrimonios_params=matrimonios_params||'{"ordinarioLibro":9883,"ordinarioFolio":1,"ordinarioNumero":1,"ordinarioPartidas":2,"registroInscripcionEn":"ordinario","ordinarioBlocked":false}'::jsonb,
 exequias_params=exequias_params||'{"ordinarioLibro":9883,"ordinarioFolio":1,"ordinarioNumero":1,"ordinarioPartidas":2,"registroInscripcionEn":"ordinario","ordinarioBlocked":false}'::jsonb
 WHERE parish_id=p;
 IF NOT FOUND THEN RAISE EXCEPTION 'QA202 parish parameters missing';END IF;
 PERFORM set_config('qa202.parish',p::text,true);
 PERFORM set_config('qa202.actor',u::text,true);
END $init$;
SET LOCAL ROLE authenticated;
DO $abort_subtransaction$
DECLARE p uuid:=current_setting('qa202.parish')::uuid;actor uuid:=current_setting('qa202.actor')::uuid;
  item text;pending_table text;official_table text;id_pending uuid;
  old_params jsonb;new_params jsonb;generated uuid;generated_number text;
  success_inside integer:=0;rolled_back integer:=0;err text;ct integer;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 FOR item,pending_table,official_table IN
 SELECT * FROM (VALUES
 ('marriage','pending_marriages','marriages'),
 ('funeral','pending_funerals','funerals')) v(item,pending_table,official_table)
 LOOP
  IF item='marriage' THEN
   SELECT pending_id INTO STRICT id_pending FROM public.create_pending_marriage(p,
    '{"novioNombres":"QA202","novioApellidos":"FICTICIO","noviaNombres":"QA202","noviaApellidos":"FICTICIA","fechaSacramento":"2026-10-20","qa_v202":"marriage"}'::jsonb);
   SELECT matrimonios_params INTO STRICT old_params FROM public.parish_parameters WHERE parish_id=p;
   PERFORM set_config('qa202.marriage_id',id_pending::text,true);
  ELSE
   SELECT pending_id INTO STRICT id_pending FROM public.create_pending_funeral(p,
    '{"nombres":"QA202","apellidos":"FICTICIA","fecha_defuncion":"2026-10-18","fecha_exequias":"2026-10-20","qa_v202":"funeral"}'::jsonb);
   SELECT exequias_params INTO STRICT old_params FROM public.parish_parameters WHERE parish_id=p;
   PERFORM set_config('qa202.funeral_id',id_pending::text,true);
  END IF;
  -- PostgreSQL PL/pgSQL EXCEPTION block is an implicit subtransaction.
  BEGIN
   IF item='marriage' THEN
    SELECT marriage_id,number INTO STRICT generated,generated_number FROM public.seat_pending_marriage(id_pending);
   ELSE
    SELECT funeral_id,number INTO STRICT generated,generated_number FROM public.seat_funeral_record('{}'::jsonb,id_pending);
   END IF;
   IF generated IS NULL OR generated_number<>'0001' THEN
    RAISE EXCEPTION 'QA202 seat failed to produce first official position %',item; END IF;
   EXECUTE format('SELECT count(*) FROM public.%I WHERE id=$1 AND parish_id=$2 AND status=''seated''',official_table)
     INTO ct USING generated,p;
   IF ct<>1 THEN RAISE EXCEPTION 'QA202 expected inserted official record before intentional failure %',item;END IF;
   EXECUTE format('SELECT count(*) FROM public.%I WHERE id=$1 AND status=''seated'' AND reportado IS TRUE',pending_table)
     INTO ct USING id_pending;
   IF ct<>1 THEN RAISE EXCEPTION 'QA202 expected sealed pending before intentional failure %',item;END IF;
   RAISE EXCEPTION 'QA202_FORCED_FAILURE_AFTER_SUCCESS';
  EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
   IF err IS DISTINCT FROM 'QA202_FORCED_FAILURE_AFTER_SUCCESS' THEN
    RAISE EXCEPTION 'QA202 real RPC error, not intended fault injection, kind=% reason=%',item,err;
   END IF;
   success_inside:=success_inside+1;
  END;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE parish_id=$1 AND book_number=''9883''',official_table)
    INTO ct USING p;
  IF ct<>0 THEN RAISE EXCEPTION 'QA202 partial official record survived forced rollback %',item;END IF;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE id=$1 AND status=''pending'' AND reportado IS FALSE',pending_table)
    INTO ct USING id_pending;
  IF ct<>1 THEN RAISE EXCEPTION 'QA202 pending record lost after forced rollback %',item;END IF;
  IF item='marriage' THEN SELECT matrimonios_params INTO STRICT new_params FROM public.parish_parameters WHERE parish_id=p;
  ELSE SELECT exequias_params INTO STRICT new_params FROM public.parish_parameters WHERE parish_id=p; END IF;
  IF new_params IS DISTINCT FROM old_params THEN RAISE EXCEPTION 'QA202 counter changed despite forced rollback %',item;END IF;
  rolled_back:=rolled_back+1;
 END LOOP;
 IF success_inside<>2 OR rolled_back<>2 THEN RAISE EXCEPTION 'QA202 incomplete forced failure test';END IF;
 PERFORM set_config('qa202.failed',jsonb_build_object('successful_seatings_then_forced_exception',success_inside,
 'official_record_rollback_pending_and_counter_restored',rolled_back,'fully_reversible',true)::text,true);
END $abort_subtransaction$;
RESET ROLE;
DO $audit_clean$
DECLARE p uuid:=current_setting('qa202.parish')::uuid;ct integer;
BEGIN
 SELECT count(*) INTO ct FROM public.registry_audit_log WHERE parish_id=p AND action='seat'
 AND entity_type IN('matrimonio','exequias') AND created_at>=transaction_timestamp();
 IF ct<>0 THEN RAISE EXCEPTION 'QA202 audit record survived forced rollback: %',ct;END IF;
 PERFORM set_config('qa202.audit_pre',ct::text,true);
END $audit_clean$;
SET LOCAL ROLE authenticated;
DO $retry$
DECLARE p uuid:=current_setting('qa202.parish')::uuid;actor uuid:=current_setting('qa202.actor')::uuid;
 mp uuid:=current_setting('qa202.marriage_id')::uuid;fp uuid:=current_setting('qa202.funeral_id')::uuid;
 result record;generated uuid;ct integer;reason text;completed integer:=0;duplicate_denied integer:=0;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 SELECT * INTO STRICT result FROM public.seat_pending_marriage(mp);
 IF result.marriage_id IS NULL OR result.book_number<>'9883' OR result.folio<>'0001' OR result.number<>'0001' OR result.next_number<>2
 THEN RAISE EXCEPTION 'QA202 legitimate marriage retry failed';END IF;
 completed:=completed+1;
 BEGIN
  PERFORM public.seat_pending_marriage(mp);
  RAISE EXCEPTION 'QA202_UNEXPECTED_DUPLICATE_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS reason=MESSAGE_TEXT;
  IF position('ya fue procesado' IN reason)=0 OR reason='QA202_UNEXPECTED_DUPLICATE_ACCEPTED'
   THEN RAISE EXCEPTION 'QA202 wrong marriage duplicate behavior %',reason; END IF;
  duplicate_denied:=duplicate_denied+1;
 END;
 SELECT * INTO STRICT result FROM public.seat_funeral_record('{}'::jsonb,fp);
 IF result.funeral_id IS NULL OR result.book_number<>'9883' OR result.folio<>'0001' OR result.number<>'0001' OR result.next_number<>2
 THEN RAISE EXCEPTION 'QA202 legitimate funeral retry failed';END IF;
 completed:=completed+1;
 BEGIN
  PERFORM public.seat_funeral_record('{}'::jsonb,fp);
  RAISE EXCEPTION 'QA202_UNEXPECTED_DUPLICATE_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS reason=MESSAGE_TEXT;
  IF position('ya no está disponible' IN reason)=0 OR reason='QA202_UNEXPECTED_DUPLICATE_ACCEPTED'
   THEN RAISE EXCEPTION 'QA202 wrong funeral duplicate behavior %',reason; END IF;
  duplicate_denied:=duplicate_denied+1;
 END;
 IF completed<>2 OR duplicate_denied<>2 THEN RAISE EXCEPTION 'QA202 incomplete retry coverage';END IF;
 PERFORM set_config('qa202.success',jsonb_build_object('legitimate_retry_seatings',completed,
 'duplicate_retries_rejected',duplicate_denied)::text,true);
END $retry$;
RESET ROLE;
DO $audit_final$
DECLARE p uuid:=current_setting('qa202.parish')::uuid;ct integer;
BEGIN
 SELECT count(*) INTO ct FROM public.registry_audit_log WHERE parish_id=p AND action='seat'
 AND entity_type IN('matrimonio','exequias') AND created_at>=transaction_timestamp();
 IF ct<>2 THEN RAISE EXCEPTION 'QA202 exactly two legal audits expected, got %',ct;END IF;
 PERFORM set_config('qa202.audit_final',ct::text,true);
END $audit_final$;
SELECT current_setting('qa202.failed')::jsonb AS failed_seatings_atomic,
 current_setting('qa202.audit_pre')::integer AS phantom_seat_logs,
 current_setting('qa202.success')::jsonb AS official_retry,
 current_setting('qa202.audit_final')::integer AS official_audit_events,
 'ROLLBACK' AS finalization;
ROLLBACK;