-- V199 execute real seating of all four sacraments and reject deletion of sealed or reported records.
-- SACRAMENTUM V193 · Circuito boleta -> asiento -> cierre -> retry por 4 sacramentos.
-- QA E2E de PostgreSQL (sin navegador) usando rol authenticated con usuario parroquial.
-- Todas las inserciones, números, asientos y parámetros son ficticios y se revierten.
BEGIN;
SET LOCAL statement_timeout='45000ms';
DO $init$
DECLARE actor uuid;par uuid;
BEGIN
 SELECT up.auth_user_id,up.parish_id INTO STRICT actor,par
 FROM public.user_profiles up JOIN public.parishes p ON p.id=up.parish_id AND p.diocese_id=up.diocese_id
 WHERE up.role='parish' AND up.is_active IS TRUE AND upper(up.status)='ACTIVE' LIMIT 1;
 PERFORM set_config('qa193.actor',actor::text,true);
 PERFORM set_config('qa193.parish',par::text,true);
 IF EXISTS (SELECT 1 FROM public.baptisms WHERE parish_id=par AND book_number='9876')
    OR EXISTS (SELECT 1 FROM public.confirmations WHERE parish_id=par AND book_number='9876')
    OR EXISTS (SELECT 1 FROM public.marriages WHERE parish_id=par AND book_number='9876')
    OR EXISTS (SELECT 1 FROM public.funerals WHERE parish_id=par AND book_number='9876') THEN
   RAISE EXCEPTION 'V193 reserved QA book 9876 already used';
 END IF;
 UPDATE public.parish_parameters SET
  bautizos_params=bautizos_params||'{"ordinarioLibro":9876,"ordinarioFolio":1,"ordinarioNumero":1,"ordinarioPartidas":2,"ordinarioBlocked":false}'::jsonb,
  confirmaciones_params=confirmaciones_params||'{"ordinarioLibro":9876,"ordinarioFolio":1,"ordinarioNumero":1,"ordinarioPartidas":2,"ordinarioBlocked":false}'::jsonb,
  matrimonios_params=matrimonios_params||'{"ordinarioLibro":9876,"ordinarioFolio":1,"ordinarioNumero":1,"ordinarioPartidas":2,"registroInscripcionEn":"ordinario","ordinarioBlocked":false}'::jsonb,
  exequias_params=exequias_params||'{"ordinarioLibro":9876,"ordinarioFolio":1,"ordinarioNumero":1,"ordinarioPartidas":2,"registroInscripcionEn":"ordinario","ordinarioBlocked":false}'::jsonb
 WHERE parish_id=par;
 IF NOT FOUND THEN RAISE EXCEPTION 'V193 missing parish parameters';END IF;
END $init$;
DO $historical$
DECLARE par uuid:=current_setting('qa193.parish')::uuid;bid uuid;cid uuid;
BEGIN
 INSERT INTO public.pending_baptisms(parish_id,status,reportado,raw_data)
 VALUES(par,'legacy_reported_unmatched',true,'{"qa_v199":"yes","nombres":"QA HISTORICO FICTICIO"}'::jsonb)
 RETURNING id INTO bid;
 INSERT INTO public.pending_confirmations(parish_id,status,reportado,raw_data)
 VALUES(par,'legacy_reported_unmatched',true,'{"qa_v199":"yes","nombres":"QA HISTORICO FICTICIO"}'::jsonb)
 RETURNING id INTO cid;
 PERFORM set_config('qa199.baptism_legacy',bid::text,true);
 PERFORM set_config('qa199.confirmation_legacy',cid::text,true);
END $historical$;
SET LOCAL ROLE authenticated;
DO $qa$
DECLARE parish uuid:=current_setting('qa193.parish')::uuid;actor uuid:=current_setting('qa193.actor')::uuid;
 bp uuid;cp uuid;mp uuid;fp uuid; reg text;result record; created_id uuid;
 n integer:=0;denied integer:=0;reason text;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);

 SELECT pending_id,numero_registro INTO STRICT bp,reg FROM public.create_pending_baptism(parish,
 '{"nombres":"QA193","apellidos":"BAUTISMO","fechaSacramento":"2026-10-20","qa_v193":"yes"}'::jsonb);
 SELECT * INTO STRICT result FROM public.seat_baptism_records(parish,jsonb_build_array(jsonb_build_object('pending_id',bp)),9876,1,1);
 IF result.seated_count<>1 OR NOT EXISTS(SELECT 1 FROM public.baptisms WHERE parish_id=parish AND book_number='9876' AND status='seated')
 OR NOT EXISTS(SELECT 1 FROM public.pending_baptisms WHERE id=bp AND status='seated' AND reportado IS TRUE) THEN
 RAISE EXCEPTION 'V193 baptism lifecycle incomplete';END IF;
 n:=n+1;
 BEGIN
  PERFORM public.seat_baptism_records(parish,jsonb_build_array(jsonb_build_object('pending_id',bp)),result.next_book,result.next_folio,result.next_number);
  RAISE EXCEPTION 'V193 baptism duplicate accepted';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS reason=MESSAGE_TEXT;
  IF reason NOT LIKE '%ya fue asentado%' THEN RAISE EXCEPTION 'V193 baptism retry wrong failure: %',reason;END IF;
  denied:=denied+1;
 END;

 SELECT pending_id,numero_registro INTO STRICT cp,reg FROM public.create_pending_confirmation(parish,
 '{"nombres":"QA193","apellidos":"CONFIRMACION","fechaSacramento":"2026-10-20","qa_v193":"yes"}'::jsonb);
 SELECT * INTO STRICT result FROM public.seat_confirmation_records(parish,jsonb_build_array(jsonb_build_object('pending_id',cp)),9876,1,1);
 IF result.seated_count<>1 OR NOT EXISTS(SELECT 1 FROM public.confirmations WHERE parish_id=parish AND book_number='9876' AND status='seated')
 OR NOT EXISTS(SELECT 1 FROM public.pending_confirmations WHERE id=cp AND status='seated' AND reportado IS TRUE) THEN
 RAISE EXCEPTION 'V193 confirmation lifecycle incomplete';END IF;
 n:=n+1;
 BEGIN
  PERFORM public.seat_confirmation_records(parish,jsonb_build_array(jsonb_build_object('pending_id',cp)),result.next_book,result.next_folio,result.next_number);
  RAISE EXCEPTION 'V193 confirmation duplicate accepted';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS reason=MESSAGE_TEXT;
  IF reason NOT LIKE '%ya fue asentada%' THEN RAISE EXCEPTION 'V193 confirmation retry wrong failure: %',reason;END IF;
  denied:=denied+1;
 END;

 SELECT pending_id,numero_registro INTO STRICT mp,reg FROM public.create_pending_marriage(parish,
 '{"novioNombres":"QA193","novioApellidos":"FICTICIO","noviaNombres":"QA193","noviaApellidos":"FICTICIA","fechaSacramento":"2026-10-20","qa_v193":"yes"}'::jsonb);
 SELECT * INTO STRICT result FROM public.seat_pending_marriage(mp);
 IF result.marriage_id IS NULL OR result.book_number<>'9876' OR result.folio<>'0001'
 OR NOT EXISTS(SELECT 1 FROM public.marriages WHERE id=result.marriage_id AND parish_id=parish AND status='seated' AND book_type='ordinario')
 OR NOT EXISTS(SELECT 1 FROM public.pending_marriages WHERE id=mp AND status='seated' AND reportado IS TRUE) THEN
 RAISE EXCEPTION 'V193 marriage lifecycle incomplete';END IF;
 n:=n+1;
 BEGIN
  PERFORM public.seat_pending_marriage(mp);
  RAISE EXCEPTION 'V193 marriage duplicate accepted';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS reason=MESSAGE_TEXT;
  IF reason NOT LIKE '%ya fue procesado%' THEN RAISE EXCEPTION 'V193 marriage retry wrong failure: %',reason;END IF;
  denied:=denied+1;
 END;

 SELECT pending_id,numero_registro INTO STRICT fp,reg FROM public.create_pending_funeral(parish,
 '{"nombres":"QA193","apellidos":"EXEQUIAS","fecha_defuncion":"2026-10-18","fecha_exequias":"2026-10-20","qa_v193":"yes"}'::jsonb);
 SELECT * INTO STRICT result FROM public.seat_funeral_record('{}'::jsonb,fp);
 IF result.funeral_id IS NULL OR result.book_number<>'9876' OR result.folio<>'0001'
 OR NOT EXISTS(SELECT 1 FROM public.funerals WHERE id=result.funeral_id AND parish_id=parish AND status='seated' AND book_type='ordinario')
 OR NOT EXISTS(SELECT 1 FROM public.pending_funerals WHERE id=fp AND status='seated' AND reportado IS TRUE) THEN
 RAISE EXCEPTION 'V193 funeral lifecycle incomplete';END IF;
 n:=n+1;
 BEGIN
  PERFORM public.seat_funeral_record('{}'::jsonb,fp);
  RAISE EXCEPTION 'V193 funeral duplicate accepted';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS reason=MESSAGE_TEXT;
  IF reason NOT LIKE '%ya no está disponible%' THEN RAISE EXCEPTION 'V193 funeral retry wrong failure: %',reason;END IF;
  denied:=denied+1;
 END;
 IF n<>4 OR denied<>4 THEN RAISE EXCEPTION 'V193 coverage incomplete %/%',n,denied;END IF;
 PERFORM set_config('qa193.result',jsonb_build_object('sacramental_lifecycles',n,
 'pendings_closed',n,'duplicate_seating_rejected',denied,'rollback',true)::text,true);
END $qa$;
DO $qa199$
DECLARE p uuid:=current_setting('qa193.parish')::uuid; t text; kind text;
 sealed_id uuid;historic_id uuid;new_pending_uuid uuid;n integer;msg text;
 forbidden integer:=0;allowed integer:=0;verified integer:=0;created integer:=0;
BEGIN
 FOR t,kind IN SELECT * FROM (VALUES ('pending_baptisms','baptism'),('pending_confirmations','confirmation')) a(t,kind)
 LOOP
   EXECUTE format('SELECT id FROM public.%I WHERE parish_id=$1 AND status=''seated'' AND raw_data->>''seated_book''=''9876''',t)
   INTO STRICT sealed_id USING p;
   historic_id:=(current_setting(CASE WHEN kind='baptism' THEN 'qa199.baptism_legacy' ELSE 'qa199.confirmation_legacy' END))::uuid;
   BEGIN
    EXECUTE format('DELETE FROM public.%I WHERE id=$1',t) USING sealed_id;
    RAISE EXCEPTION 'V199 seated boleta was deleted in %',t;
   EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT;
    IF msg NOT LIKE 'Boleta protegida:%' THEN RAISE EXCEPTION 'Unexpected refusal %',msg;END IF;
    forbidden:=forbidden+1;
   END;
   BEGIN
    EXECUTE format('DELETE FROM public.%I WHERE id=$1',t) USING historic_id;
    RAISE EXCEPTION 'V199 legacy reported boleta was deleted in %',t;
   EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT;
    IF msg NOT LIKE 'Boleta protegida:%' THEN RAISE EXCEPTION 'Unexpected legacy refusal %',msg;END IF;
    forbidden:=forbidden+1;
   END;
   IF kind='baptism' THEN
    SELECT pending_id INTO STRICT new_pending_uuid FROM public.create_pending_baptism(p,'{"nombres":"QA199","apellidos":"PENDIENTE BORRABLE","fechaSacramento":"2026-10-24","qa_v199":"yes"}'::jsonb);
   ELSE
    SELECT pending_id INTO STRICT new_pending_uuid FROM public.create_pending_confirmation(p,'{"nombres":"QA199","apellidos":"PENDIENTE BORRABLE","fechaSacramento":"2026-10-24","qa_v199":"yes"}'::jsonb);
   END IF;
   created:=created+1;
   EXECUTE format('DELETE FROM public.%I WHERE id=$1 AND status=''pending'' AND reportado IS NOT TRUE',t) USING new_pending_uuid;
   GET DIAGNOSTICS n=ROW_COUNT;
   IF n<>1 THEN RAISE EXCEPTION 'V199 delete of genuine pending boleta blocked in %',t;END IF;
   allowed:=allowed+1;
   EXECUTE format('SELECT count(*) FROM public.%I WHERE id IN ($1,$2)',t) INTO n USING sealed_id,historic_id;
   IF n<>2 THEN RAISE EXCEPTION 'V199 historical or seated boleta lost in %',t;END IF;
   verified:=verified+1;
 END LOOP;
 IF forbidden<>4 OR allowed<>2 OR verified<>2 OR created<>2 THEN RAISE EXCEPTION 'V199 coverage incomplete';END IF;
 PERFORM set_config('qa199.results',jsonb_build_object(
 'archived_and_legacy_delete_rejected',forbidden,'genuine_pending_delete_allowed',allowed,
 'seated_and_legacy_rows_preserved',verified*2,'rollback',true)::text,true);
END $qa199$;
RESET ROLE;
DO $verify$
DECLARE p uuid:=current_setting('qa193.parish')::uuid;n integer;
BEGIN
 SELECT count(*) INTO n FROM public.registry_audit_log WHERE parish_id=p
 AND action='seat' AND entity_type IN ('baptism','confirmation','matrimonio','exequias')
 AND created_at >= transaction_timestamp();
 IF n<4 THEN RAISE EXCEPTION 'V193 missing juridical audit logs, expected 4 got %',n;END IF;
 PERFORM set_config('qa193.audit_count',n::text,true);
END $verify$;
SELECT current_setting('qa193.result')::jsonb AS results,
 current_setting('qa193.audit_count')::integer AS min_seat_audit_entries,
 current_setting('qa199.results')::jsonb AS protection;
ROLLBACK;
