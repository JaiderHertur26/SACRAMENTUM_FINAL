-- V253: QA-ONLY TRANSACTION KERNEL. DO NOT apply to live Supabase.
-- The payload uses fixture UUIDs; these functions DO NOT create sacramental records.
-- They are SECURITY INVOKER and remain inside a schema denied to authenticated.
CREATE TABLE sacramentum_ledger.seat_operations (
 operation_id uuid PRIMARY KEY,
 book_id uuid NOT NULL REFERENCES sacramentum_ledger.book_memories(id) ON DELETE RESTRICT,
 fingerprint text NOT NULL CHECK (length(fingerprint)=32),
 action text NOT NULL CHECK (action IN ('append','reverse')),
 response jsonb NOT NULL,
 actor_auth_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE sacramentum_ledger.seat_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sacramentum_ledger.seat_operations FROM PUBLIC;

CREATE TABLE sacramentum_ledger.seat_dependencies (
 seat_id uuid NOT NULL REFERENCES sacramentum_ledger.active_seats(id) ON DELETE RESTRICT,
 dependency_type text NOT NULL,
 dependency_reference uuid NOT NULL,
 PRIMARY KEY (seat_id,dependency_type,dependency_reference)
);
ALTER TABLE sacramentum_ledger.seat_dependencies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sacramentum_ledger.seat_dependencies FROM PUBLIC;

CREATE FUNCTION sacramentum_ledger.qa_append_batch_v253(
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

CREATE FUNCTION sacramentum_ledger.qa_reverse_tail_v253(
 p_book_id uuid,p_expected_version bigint,p_operation_id uuid,
 p_seat_ids jsonb,p_actor uuid,p_reason text,p_authorization text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 m sacramentum_ledger.book_memories%rowtype;
 prior sacramentum_ledger.seat_operations%rowtype;
 seat sacramentum_ledger.active_seats%rowtype;
 fingerprint text; n integer; i integer:=0; result jsonb:='[]'::jsonb; response jsonb;
BEGIN
 IF p_book_id IS NULL OR p_operation_id IS NULL OR p_actor IS NULL
  OR nullif(btrim(p_reason),'') IS NULL OR nullif(btrim(p_authorization),'') IS NULL THEN
   RAISE EXCEPTION 'Reversión sin autoridad, actor o motivo';
 END IF;
 IF p_seat_ids IS NULL OR jsonb_typeof(p_seat_ids)<>'array'
   OR jsonb_array_length(p_seat_ids) NOT BETWEEN 1 AND 500 THEN
   RAISE EXCEPTION 'Se requieren asientos concretos para revertir';
 END IF;
 SELECT * INTO m FROM sacramentum_ledger.book_memories WHERE id=p_book_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Libro inexistente'; END IF;
 fingerprint:=md5(jsonb_build_object('book',p_book_id,'version',p_expected_version,
  'seats',p_seat_ids,'actor',p_actor,'reason',p_reason,'authority',p_authorization)::text);
 SELECT * INTO prior FROM sacramentum_ledger.seat_operations WHERE operation_id=p_operation_id FOR UPDATE;
 IF FOUND THEN
  IF prior.book_id<>p_book_id OR prior.fingerprint<>fingerprint OR prior.action<>'reverse' THEN
   RAISE EXCEPTION 'Idempotencia: identificador ya utilizado para otra reversión';
  END IF;
  RETURN prior.response;
 END IF;
 IF m.retired_at IS NOT NULL OR m.legacy_reconciled IS DISTINCT FROM TRUE
  OR m.version IS DISTINCT FROM p_expected_version THEN
  RAISE EXCEPTION 'Libro no conciliado, retirado o consecutivo cambiado';
 END IF;
 n:=jsonb_array_length(p_seat_ids);
 IF n>m.active_count THEN RAISE EXCEPTION 'No hay suficientes partidas activas'; END IF;
 IF (SELECT count(distinct value) FROM jsonb_array_elements_text(p_seat_ids))<>n THEN
  RAISE EXCEPTION 'Partida repetida en reversión';
 END IF;
 -- The client never controls dependencies: fetch them from the private table.
 FOR seat IN SELECT a.* FROM sacramentum_ledger.active_seats a
  JOIN jsonb_array_elements_text(p_seat_ids) ids ON a.id=ids.value::uuid
  WHERE a.book_id=p_book_id ORDER BY a.ordinal DESC
 LOOP
  IF seat.ordinal<>m.active_count-1-i THEN
   RAISE EXCEPTION 'Reversión prohibida: partida intermedia';
  END IF;
  IF EXISTS (SELECT 1 FROM sacramentum_ledger.seat_dependencies d WHERE d.seat_id=seat.id) THEN
   RAISE EXCEPTION 'La partida tiene documentos o actuaciones dependientes';
  END IF;
  i:=i+1;
 END LOOP;
 IF i<>n THEN RAISE EXCEPTION 'Uno o más asientos no pertenecen a este libro'; END IF;
 i:=0;
 FOR seat IN SELECT a.* FROM sacramentum_ledger.active_seats a
  JOIN jsonb_array_elements_text(p_seat_ids) ids ON a.id=ids.value::uuid
  WHERE a.book_id=p_book_id ORDER BY a.ordinal DESC
 LOOP
  INSERT INTO sacramentum_ledger.seat_events(book_id,event_type,seat_id,source_pending_id,
    before_count,after_count,coordinates,actor_auth_id,reason,authorization_reference)
  VALUES(p_book_id,'tail_reverse',seat.id,seat.pending_id,m.active_count-i,m.active_count-i-1,
   jsonb_build_object('book',m.book_code,'folio',lpad(seat.folio::text,4,'0'),
    'number',lpad(seat.partida::text,4,'0')),p_actor,p_reason,p_authorization);
  DELETE FROM sacramentum_ledger.active_seats WHERE id=seat.id;
  result:=result||jsonb_build_array(seat.id::text);
  i:=i+1;
 END LOOP;
 UPDATE sacramentum_ledger.book_memories SET active_count=m.active_count-i,version=m.version+1,
  updated_at=clock_timestamp() WHERE id=p_book_id;
 response:=jsonb_build_object('operation_id',p_operation_id,'reverted',result,
  'new_version',m.version+1,'after_count',m.active_count-i);
 INSERT INTO sacramentum_ledger.seat_operations(operation_id,book_id,fingerprint,action,response,actor_auth_id)
 VALUES(p_operation_id,p_book_id,fingerprint,'reverse',response,p_actor);
 RETURN response;
END $$;
REVOKE ALL ON FUNCTION sacramentum_ledger.qa_append_batch_v253(uuid,bigint,uuid,integer,integer,jsonb,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION sacramentum_ledger.qa_reverse_tail_v253(uuid,bigint,uuid,jsonb,uuid,text,text) FROM PUBLIC;
