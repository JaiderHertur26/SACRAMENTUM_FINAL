-- V259: isolated PG16 demonstration of atomic NEW seating across four sacramental
-- registry tables. Not a Supabase migration. Real four RPC bodies remain unchanged.
-- Uses deliberately minimal public tables matching real coordinate types.
CREATE TABLE sacramentum_ledger.qa_pending_v259 (
 id uuid PRIMARY KEY,
 parish_id uuid NOT NULL,
 sacrament text NOT NULL CHECK(sacrament IN('bautismo','confirmacion','matrimonio','exequias')),
 celebration_date date NOT NULL,
 registration_number text NOT NULL,
 flow text NOT NULL CHECK(flow IN('new_sacrament','new_decree_supplement','historical_import')),
 verified boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'pending',
 has_physical_coordinates boolean NOT NULL DEFAULT false,
 decree_id uuid,
 decree_effect text,
 record_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid()
);
CREATE TABLE sacramentum_ledger.qa_seat_calls_v259 (
 operation_id uuid PRIMARY KEY,
 fingerprint text NOT NULL,
 response jsonb NOT NULL,
 actor_auth_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION sacramentum_ledger.qa_atomic_seat_v259(
 p_parish_id uuid,p_sacrament text,p_book_id uuid,
 p_expected_version bigint,p_expected_folio integer,p_expected_partida integer,
 p_operation_id uuid,p_pending_ids jsonb,p_actor uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 m sacramentum_ledger.book_memories%rowtype;
 source sacramentum_ledger.qa_pending_v259%rowtype;
 previous sacramentum_ledger.qa_seat_calls_v259%rowtype;
 v_sql_table text;
 v_items jsonb:='[]'::jsonb;
 v_id_text text;
 v_seen uuid[]:=ARRAY[]::uuid[];
 v_fingerprint text;
 v_result jsonb;
 v_seat jsonb;
 v_next_folio integer;
 v_next_partida integer;
 v_index integer:=0;
 v_exists boolean;
 v_count integer;
BEGIN
 IF p_parish_id IS NULL OR p_sacrament NOT IN('bautismo','confirmacion','matrimonio','exequias')
    OR p_actor IS NULL OR p_operation_id IS NULL THEN
   RAISE EXCEPTION 'V259: alcance o actor inválido';
 END IF;
 IF p_pending_ids IS NULL OR jsonb_typeof(p_pending_ids)<>'array'
   OR jsonb_array_length(p_pending_ids) NOT BETWEEN 1 AND 500 THEN
   RAISE EXCEPTION 'V259: seleccione entre una y quinientas boletas';
 END IF;
 SELECT * INTO m FROM sacramentum_ledger.book_memories WHERE id=p_book_id FOR UPDATE;
 IF NOT FOUND OR m.parish_id<>p_parish_id OR m.sacrament<>p_sacrament
    OR m.legacy_reconciled IS DISTINCT FROM TRUE OR m.retired_at IS NOT NULL THEN
   RAISE EXCEPTION 'V259: memoria no conciliada o fuera de parroquia/sacramento';
 END IF;
 v_fingerprint:=md5(jsonb_build_object('parish',p_parish_id,'sacrament',p_sacrament,
   'book',p_book_id,'version',p_expected_version,'folio',p_expected_folio,
   'partida',p_expected_partida,'ids',p_pending_ids,'actor',p_actor)::text);
 SELECT * INTO previous FROM sacramentum_ledger.qa_seat_calls_v259
  WHERE operation_id=p_operation_id FOR UPDATE;
 IF FOUND THEN
   IF previous.fingerprint<>v_fingerprint OR previous.actor_auth_id<>p_actor THEN
     RAISE EXCEPTION 'V259: operación idempotente reutilizada con contenido distinto';
   END IF;
   -- A previously returned success must not be replayed after a later physical
   -- reversal, even though the immutable seat receipt remains in the journal.
   IF (SELECT count(*) FROM sacramentum_ledger.active_seats a
        JOIN sacramentum_ledger.qa_pending_v259 p ON p.id=a.pending_id
        WHERE a.book_id=p_book_id AND p.status='seated' AND a.id IN (
          SELECT (value->>'seat_id')::uuid
          FROM jsonb_array_elements(previous.response->'seats'))) <>
      jsonb_array_length(previous.response->'seats') THEN
     RAISE EXCEPTION 'V261: asiento ya revertido; recibo original solo documental';
   END IF;
   RETURN previous.response;
 END IF;
 IF m.version IS DISTINCT FROM p_expected_version OR
   m.first_folio+m.active_count/m.partidas_per_folio<>p_expected_folio OR
   (CASE WHEN m.restart_partida_each_folio AND m.active_count>=m.partidas_per_folio
      THEN 1+m.active_count%m.partidas_per_folio
      ELSE m.first_partida+m.active_count END)<>p_expected_partida THEN
   RAISE EXCEPTION 'V259: cambió la memoria o el punto de asiento';
 END IF;
 v_sql_table:= CASE p_sacrament
   WHEN 'bautismo' THEN 'baptisms'
   WHEN 'confirmacion' THEN 'confirmations'
   WHEN 'matrimonio' THEN 'marriages'
   WHEN 'exequias' THEN 'funerals' END;
 -- Lock/verify source pending records; never accept client-provided date,
 -- verification, origin, register numbers, record IDs or book coordinates.
 FOR v_id_text IN SELECT jsonb_array_elements_text(p_pending_ids) LOOP
   IF v_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
     RAISE EXCEPTION 'V259: identificador de boleta inválido';
   END IF;
   IF v_id_text::uuid=ANY(v_seen) THEN
     RAISE EXCEPTION 'V259: boleta duplicada dentro del lote';
   END IF;
   v_seen:=array_append(v_seen,v_id_text::uuid);
   SELECT * INTO source FROM sacramentum_ledger.qa_pending_v259
     WHERE id=v_id_text::uuid FOR UPDATE;
   IF NOT FOUND OR source.parish_id<>p_parish_id OR source.sacrament<>p_sacrament
      OR source.verified IS DISTINCT FROM TRUE OR source.status<>'pending'
      OR source.has_physical_coordinates IS TRUE OR source.celebration_date>current_date
      OR source.registration_number !~ '^[0-9]{1,30}$' THEN
     RAISE EXCEPTION 'V259: la boleta no es nueva, no está comprobada o es ajena';
   END IF;
   IF source.flow='new_decree_supplement' THEN
     IF m.book_type<>'suplementario' OR source.decree_id IS NULL OR
        source.decree_effect<>'create_supplementary_record' THEN
       RAISE EXCEPTION 'V259: decreto sin mandato de asiento supletorio';
     END IF;
   ELSIF source.flow<>'new_sacrament' OR m.book_type<>'ordinario' THEN
     RAISE EXCEPTION 'V259: un histórico o partida supletoria no autorizada no consume memoria';
   END IF;
   v_items:=v_items||jsonb_build_array(jsonb_build_object(
     'pending_id',source.id,'record_id',source.record_id,
     'celebration_date',to_char(source.celebration_date,'YYYY-MM-DD'),
     'registration_number',source.registration_number,
     'flow',source.flow,'verified',true,
     'decree_id',source.decree_id,'decree_effect',source.decree_effect
   ));
 END LOOP;
 -- The kernel sorts by celebration date and registration number. Check every
 -- prospective physical location against existing original record tables.
 FOR v_index IN 0..jsonb_array_length(p_pending_ids)-1 LOOP
   v_next_folio:=m.first_folio+(m.active_count+v_index)/m.partidas_per_folio;
   v_next_partida:=CASE WHEN m.restart_partida_each_folio AND m.active_count+v_index>=m.partidas_per_folio
     THEN 1+(m.active_count+v_index)%m.partidas_per_folio
     ELSE m.first_partida+m.active_count+v_index END;
   EXECUTE format(
      'SELECT EXISTS(SELECT 1 FROM public.%I r WHERE r.parish_id=$1
        AND (CASE WHEN r.book_number ~ ''^[0-9]+$''
           THEN coalesce(nullif(ltrim(r.book_number,''0''),''''),''0'')
           ELSE upper(r.book_number) END)=$2
        AND r.folio ~ ''^[0-9]+$'' AND r.number ~ ''^[0-9]+$''
        AND r.folio::numeric=$3 AND r.number::numeric=$4)',
      v_sql_table)
     INTO v_exists USING p_parish_id,m.canonical_code,v_next_folio,v_next_partida;
   IF v_exists THEN
     RAISE EXCEPTION 'V259: colisión con partida física existente, no consumir memoria';
   END IF;
 END LOOP;
 -- This call, the records, status transitions and call receipt share ONE
 -- Postgres transaction. Any insertion/audit failure rolls back all changes.
 v_result:=sacramentum_ledger.qa_append_batch_v253(
  p_book_id,p_expected_version,p_operation_id,p_expected_folio,
  p_expected_partida,v_items,p_actor);
 FOR v_seat IN SELECT value FROM jsonb_array_elements(v_result->'seats') LOOP
   SELECT * INTO source FROM sacramentum_ledger.qa_pending_v259
     WHERE id=(v_seat->>'pending_id')::uuid FOR UPDATE;
   EXECUTE format(
     'INSERT INTO public.%I(id,parish_id,book_number,folio,number,book_type,pending_id)
      VALUES($1,$2,$3,$4,$5,$6,$7)',v_sql_table)
     USING source.record_id,p_parish_id,v_seat->>'book',v_seat->>'folio',
           v_seat->>'number',m.book_type,source.id;
   UPDATE sacramentum_ledger.qa_pending_v259 SET status='seated'
     WHERE id=source.id AND status='pending';
   IF NOT FOUND THEN RAISE EXCEPTION 'V259: boleta ya fue asentada'; END IF;
 END LOOP;
 INSERT INTO sacramentum_ledger.qa_seat_calls_v259(
  operation_id,fingerprint,response,actor_auth_id)
 VALUES(p_operation_id,v_fingerprint,v_result,p_actor);
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION sacramentum_ledger.qa_atomic_seat_v259(
 uuid,text,uuid,bigint,integer,integer,uuid,jsonb,uuid) FROM PUBLIC;
REVOKE ALL ON sacramentum_ledger.qa_pending_v259,sacramentum_ledger.qa_seat_calls_v259 FROM PUBLIC;
