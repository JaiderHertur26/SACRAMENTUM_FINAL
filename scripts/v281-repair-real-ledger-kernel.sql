BEGIN;
-- V281 production repair: exact tested V253 append engine, moved into
-- a private, non-exposed, SECURITY INVOKER function without client EXECUTE.
-- The previously installed V263 real-seat called a missing QA function.
CREATE FUNCTION sacramentum_ledger.append_verified_batch_v281(
 p_book_id uuid,p_expected_version bigint,p_operation_id uuid,
 p_expected_folio integer,p_expected_partida integer,
 p_items jsonb,p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 m sacramentum_ledger.book_memories%rowtype;
 existing sacramentum_ledger.seat_operations%rowtype;
 val jsonb;
 f integer; n integer; cnt integer; idx integer:=0;
 seen text[]:=ARRAY[]::text[];
 reg text; num bigint; date_text text; calendar_date date;
 seat_uuid uuid; pending_uuid uuid; record_uuid uuid;
 result jsonb:='[]'::jsonb; response jsonb; fingerprint text;
BEGIN
 IF p_book_id IS NULL OR p_actor IS NULL OR p_operation_id IS NULL THEN
   RAISE EXCEPTION 'Identificadores obligatorios ausentes';
 END IF;
 IF p_items IS NULL OR jsonb_typeof(p_items)<>'array'
   OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 500 THEN
   RAISE EXCEPTION 'El lote debe contener entre 1 y 500 boletas';
 END IF;
 IF p_expected_version IS NULL OR p_expected_version<0
  OR p_expected_folio IS NULL OR p_expected_partida IS NULL THEN
   RAISE EXCEPTION 'Precondición de secuencia incompleta';
 END IF;

 SELECT * INTO m FROM sacramentum_ledger.book_memories
  WHERE id=p_book_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Libro inexistente'; END IF;
 fingerprint:=md5(jsonb_build_object('book',p_book_id,'version',p_expected_version,
  'folio',p_expected_folio,'partida',p_expected_partida,'items',p_items,'actor',p_actor)::text);
 SELECT * INTO existing FROM sacramentum_ledger.seat_operations
 WHERE operation_id=p_operation_id FOR UPDATE;
 IF FOUND THEN
  IF existing.fingerprint<>fingerprint OR existing.book_id<>p_book_id OR existing.action<>'append' THEN
    RAISE EXCEPTION 'Idempotencia: el identificador ya se usó para otra operación';
  END IF;
  RETURN existing.response;
 END IF;
 IF m.retired_at IS NOT NULL OR m.closed_at IS NOT NULL
    OR m.legacy_reconciled IS DISTINCT FROM TRUE THEN
  RAISE EXCEPTION 'Libro no conciliado o retirado: no se permite asentar';
 END IF;
 IF m.version<>p_expected_version THEN
  RAISE EXCEPTION 'Consecutivo modificado por otra sesión: versión esperada %, actual %',
   p_expected_version,m.version;
 END IF;
 IF (m.first_folio::bigint+m.active_count::bigint/m.partidas_per_folio::bigint)<>p_expected_folio
  OR (CASE WHEN m.restart_partida_each_folio AND m.active_count>=m.partidas_per_folio
      THEN 1+m.active_count%m.partidas_per_folio
      ELSE m.first_partida+m.active_count END)<>p_expected_partida THEN
  RAISE EXCEPTION 'Libro %, folio o partida inicial no coincide con la memoria',m.book_code;
 END IF;
 IF m.first_partida::bigint+m.active_count::bigint+jsonb_array_length(p_items)>2147483647 OR
    m.first_folio::bigint+(m.active_count::bigint+jsonb_array_length(p_items))/m.partidas_per_folio::bigint>2147483647 THEN
   RAISE EXCEPTION 'El libro supera su límite';
 END IF;
 -- Validate entire request before inserting anything; rows are sorted server-side.
 FOR val IN SELECT value FROM jsonb_array_elements(p_items) LOOP
   IF jsonb_typeof(val)<>'object'
    OR coalesce(val->>'flow','') NOT IN ('new_sacrament','new_decree_supplement')
    OR coalesce(val->>'verified','')<>'true'
    OR coalesce(val->>'recordOrigin','') ~* 'historic|legacy'
    OR nullif(btrim(coalesce(val->>'book_number',val->>'Libro',val->>'libro','')),'') IS NOT NULL
    OR nullif(btrim(coalesce(val->>'folio',val->>'page_number','')),'') IS NOT NULL
    OR nullif(btrim(coalesce(val->>'number',val->>'numero','')),'') IS NOT NULL
    OR (val->>'flow'='new_decree_supplement' AND (
       coalesce(val->>'decree_effect','')<>'create_supplementary_record'
       OR coalesce(val->>'decree_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
    OR coalesce(val->>'registration_number','') !~ '^[0-9]+$' OR
    length(val->>'registration_number')>30 OR
    coalesce(val->>'celebration_date','') !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'Boleta sin comprobación, fecha o número de registro válido';
   END IF;
   reg:=ltrim(val->>'registration_number','0');
   reg:=coalesce(nullif(reg,''),'0');
   IF reg=ANY(seen) THEN RAISE EXCEPTION 'Número de registro repetido dentro del lote'; END IF;
   seen:=array_append(seen,reg);
   BEGIN
    pending_uuid:=(val->>'pending_id')::uuid;
    record_uuid:=(val->>'record_id')::uuid;
    calendar_date:=(val->>'celebration_date')::date;
   EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Identificación o fecha de celebración inválida'; END;
   IF pending_uuid IS NULL OR record_uuid IS NULL
      OR to_char(calendar_date,'YYYY-MM-DD')<>val->>'celebration_date'
      OR calendar_date>current_date THEN RAISE EXCEPTION 'Celebración no comprobada o futura'; END IF;
 END LOOP;

 FOR val IN
  SELECT value FROM jsonb_array_elements(p_items) ORDER BY
   (value->>'celebration_date')::date,
   (value->>'registration_number')::numeric,
   (value->>'pending_id')::text
 LOOP
  cnt:=m.active_count+idx;
  f:=m.first_folio+cnt/m.partidas_per_folio;
  n:=CASE WHEN m.restart_partida_each_folio AND cnt>=m.partidas_per_folio
     THEN 1+cnt%m.partidas_per_folio ELSE m.first_partida+cnt END;
  INSERT INTO sacramentum_ledger.active_seats(
   book_id,ordinal,pending_id,sacramental_record_id,folio,partida,created_by_auth)
  VALUES(p_book_id,cnt,(val->>'pending_id')::uuid,(val->>'record_id')::uuid,f,n,p_actor)
  RETURNING id INTO seat_uuid;
  INSERT INTO sacramentum_ledger.seat_events(book_id,event_type,seat_id,source_pending_id,
   before_count,after_count,coordinates,actor_auth_id)
  VALUES (p_book_id,'seat',seat_uuid,(val->>'pending_id')::uuid,cnt,cnt+1,
   jsonb_build_object('book',m.book_code,'folio',lpad(f::text,4,'0'),
    'number',lpad(n::text,4,'0')),p_actor);
  result:=result||jsonb_build_array(jsonb_build_object('seat_id',seat_uuid,'pending_id',
   val->>'pending_id','folio',lpad(f::text,4,'0'),'number',lpad(n::text,4,'0'),'book',m.book_code));
  idx:=idx+1;
 END LOOP;
 UPDATE sacramentum_ledger.book_memories SET
  active_count=m.active_count+idx,version=m.version+1,
  first_seated_at=coalesce(first_seated_at,clock_timestamp()),updated_at=clock_timestamp()
 WHERE id=p_book_id;
 response:=jsonb_build_object('operation_id',p_operation_id,'seats',result,
  'new_version',m.version+1,'after_count',m.active_count+idx);
 INSERT INTO sacramentum_ledger.seat_operations(operation_id,book_id,fingerprint,action,response,actor_auth_id)
 VALUES(p_operation_id,p_book_id,fingerprint,'append',response,p_actor);
 RETURN response;
END $$;
REVOKE ALL ON FUNCTION sacramentum_ledger.append_verified_batch_v281(
 uuid,bigint,uuid,integer,integer,jsonb,uuid) FROM PUBLIC,anon,authenticated;
DO $rewrite$
DECLARE original text; modified text;
BEGIN
 SELECT pg_get_functiondef('sacramentum_ledger.real_seat_v263(
 uuid,text,uuid,bigint,integer,integer,uuid,jsonb)'::regprocedure) INTO original;
 IF original IS NULL OR
  (length(original)-length(replace(original,
    'sacramentum_ledger.qa_append_batch_v253(',
    '')))/length('sacramentum_ledger.qa_append_batch_v253(')<>1 THEN
  RAISE EXCEPTION 'V281: origen V263 incompatible con reparación verificable';
 END IF;
 modified:=replace(original,'sacramentum_ledger.qa_append_batch_v253(',
  'sacramentum_ledger.append_verified_batch_v281(');
 EXECUTE modified;
END $rewrite$;
DO $verify$
BEGIN
 IF to_regprocedure('sacramentum_ledger.append_verified_batch_v281(
 uuid,bigint,uuid,integer,integer,jsonb,uuid)') IS NULL OR
  position('append_verified_batch_v281(' IN pg_get_functiondef(
   'sacramentum_ledger.real_seat_v263(
 uuid,text,uuid,bigint,integer,integer,uuid,jsonb)'::regprocedure))=0 OR
  has_function_privilege('authenticated',
   'sacramentum_ledger.append_verified_batch_v281(uuid,bigint,uuid,integer,integer,jsonb,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'V281: motor privado no verificado'; END IF;
END $verify$;
COMMIT;
