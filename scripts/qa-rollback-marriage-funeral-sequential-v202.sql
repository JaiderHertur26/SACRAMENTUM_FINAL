-- V202: two distinct pending records in each single-record seat RPC, no duplicate numbering,
-- no accidental double seat, exact juridical audit, all rolled back.
BEGIN;
SET LOCAL statement_timeout='45000ms';
DO $init$
DECLARE p uuid;actor uuid;
BEGIN
 SELECT up.parish_id,up.auth_user_id INTO STRICT p,actor
 FROM public.user_profiles up JOIN public.parishes par ON par.id=up.parish_id AND par.diocese_id=up.diocese_id
 WHERE up.role='parish' AND up.is_active IS TRUE AND upper(up.status)='ACTIVE' LIMIT 1;
 IF EXISTS(SELECT 1 FROM public.marriages WHERE parish_id=p AND book_number='9884')
 OR EXISTS(SELECT 1 FROM public.funerals WHERE parish_id=p AND book_number='9884')
 THEN RAISE EXCEPTION 'QA202 second reserved book in use';END IF;
 UPDATE public.parish_parameters SET
 matrimonios_params=matrimonios_params||'{"ordinarioLibro":9884,"ordinarioFolio":1,"ordinarioNumero":1,"ordinarioPartidas":2,"registroInscripcionEn":"ordinario","ordinarioBlocked":false}'::jsonb,
 exequias_params=exequias_params||'{"ordinarioLibro":9884,"ordinarioFolio":1,"ordinarioNumero":1,"ordinarioPartidas":2,"registroInscripcionEn":"ordinario","ordinarioBlocked":false}'::jsonb
 WHERE parish_id=p;
 IF NOT FOUND THEN RAISE EXCEPTION 'QA202 parish parameters missing';END IF;
 PERFORM set_config('qa202.parish',p::text,true);
 PERFORM set_config('qa202.actor',actor::text,true);
END $init$;
SET LOCAL ROLE authenticated;
DO $exercise$
DECLARE p uuid:=current_setting('qa202.parish')::uuid;actor uuid:=current_setting('qa202.actor')::uuid;
 k text;tbl text;official_table text;id_one uuid;id_two uuid;
 outcome record; i integer;number_list text[];found_n integer;duplicates integer:=0;seated integer:=0;
 reason text;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 FOR k,tbl,official_table IN SELECT * FROM (VALUES
 ('marriage','pending_marriages','marriages'),
 ('funeral','pending_funerals','funerals')) x(k,tbl,official_table)
 LOOP
  IF k='marriage' THEN
   SELECT pending_id INTO STRICT id_one FROM public.create_pending_marriage(p,
     '{"novioNombres":"QA202","novioApellidos":"CLIENTE A","noviaNombres":"QA202","noviaApellidos":"FICTICIA","fechaSacramento":"2026-10-20","qa_v202":"clients"}'::jsonb);
   SELECT pending_id INTO STRICT id_two FROM public.create_pending_marriage(p,
     '{"novioNombres":"QA202","novioApellidos":"CLIENTE B","noviaNombres":"QA202","noviaApellidos":"FICTICIA","fechaSacramento":"2026-10-20","qa_v202":"clients"}'::jsonb);
  ELSE
   SELECT pending_id INTO STRICT id_one FROM public.create_pending_funeral(p,
     '{"nombres":"QA202","apellidos":"CLIENTE A","fecha_defuncion":"2026-10-18","fecha_exequias":"2026-10-20","qa_v202":"clients"}'::jsonb);
   SELECT pending_id INTO STRICT id_two FROM public.create_pending_funeral(p,
     '{"nombres":"QA202","apellidos":"CLIENTE B","fecha_defuncion":"2026-10-18","fecha_exequias":"2026-10-20","qa_v202":"clients"}'::jsonb);
  END IF;
  FOR i IN 1..2 LOOP
   IF k='marriage' THEN SELECT * INTO STRICT outcome FROM public.seat_pending_marriage(CASE WHEN i=1 THEN id_one ELSE id_two END);
   ELSE SELECT * INTO STRICT outcome FROM public.seat_funeral_record('{}'::jsonb,CASE WHEN i=1 THEN id_one ELSE id_two END);END IF;
   IF outcome.book_number<>'9884' OR outcome.number<>lpad(i::text,4,'0')
   THEN RAISE EXCEPTION 'QA202 wrong position for % sequential %',k,i;END IF;
   IF i=2 AND (outcome.next_number<>3 OR outcome.next_folio<>2)
   THEN RAISE EXCEPTION 'QA202 second seat must advance to next folio %',k;END IF;
   seated:=seated+1;
  END LOOP;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE parish_id=$1 AND book_number=''9884'' AND folio=''0001'' AND number IN(''0001'',''0002'') AND status=''seated''',official_table)
    INTO found_n USING p;
  IF found_n<>2 THEN RAISE EXCEPTION 'QA202 expected two unique juridical records %',k;END IF;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE id=ANY($1) AND status=''seated'' AND reportado IS TRUE',tbl)
    INTO found_n USING ARRAY[id_one,id_two];
  IF found_n<>2 THEN RAISE EXCEPTION 'QA202 expected both boletas sealed %',k;END IF;
  FOR i IN 1..2 LOOP
   BEGIN
    IF k='marriage' THEN PERFORM public.seat_pending_marriage(CASE WHEN i=1 THEN id_one ELSE id_two END);
    ELSE PERFORM public.seat_funeral_record('{}'::jsonb,CASE WHEN i=1 THEN id_one ELSE id_two END);END IF;
    RAISE EXCEPTION 'QA202_DUPLICATE_ACCEPTED';
   EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS reason=MESSAGE_TEXT;
    IF reason='QA202_DUPLICATE_ACCEPTED' OR (
      k='marriage' AND position('ya fue procesado' IN reason)=0) OR (
      k='funeral' AND position('ya no está disponible' IN reason)=0)
    THEN RAISE EXCEPTION 'QA202 invalid double-seat protection %: %',k,reason;END IF;
    duplicates:=duplicates+1;
   END;
  END LOOP;
 END LOOP;
 IF seated<>4 OR duplicates<>4 THEN RAISE EXCEPTION 'QA202 incomplete double-client matrix';END IF;
 PERFORM set_config('qa202.results',jsonb_build_object('unique_sequential_seatings',seated,
 'duplicate_retries_denied',duplicates,'correct_next_folio',true,'rollback',true)::text,true);
END $exercise$;
RESET ROLE;
DO $audit$
DECLARE p uuid:=current_setting('qa202.parish')::uuid;typ text;ct integer;
BEGIN
 FOR typ IN SELECT unnest(ARRAY['matrimonio','exequias']) LOOP
  SELECT count(*) INTO ct FROM public.registry_audit_log WHERE parish_id=p AND action='seat'
   AND entity_type=typ AND created_at>=transaction_timestamp();
  IF ct<>2 THEN RAISE EXCEPTION 'QA202 expected two audit rows for %, found %',typ,ct;END IF;
 END LOOP;
END $audit$;
SELECT current_setting('qa202.results')::jsonb AS results;
ROLLBACK;