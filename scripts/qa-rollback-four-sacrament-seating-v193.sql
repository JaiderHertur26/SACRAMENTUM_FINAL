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
 current_setting('qa193.audit_count')::integer AS min_seat_audit_entries;
ROLLBACK;
