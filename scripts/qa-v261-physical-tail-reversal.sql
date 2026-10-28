-- V261: ONLY fictitious PostgreSQL 16 fixture. No public API, no Supabase DDL.
-- Physical reversal includes the four registry tables and pending status in the
-- SAME SQL transaction as the V253 immutable ledger reversal event.
CREATE FUNCTION sacramentum_ledger.qa_reverse_physical_tail_v261(
 p_book_id uuid,p_expected_version bigint,p_operation_id uuid,p_seat_ids jsonb,
 p_actor uuid,p_reason text,p_authorization text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 m sacramentum_ledger.book_memories%rowtype;
 seat sacramentum_ledger.active_seats%rowtype;
 v_table text;
 v_count integer;
 v_result jsonb;
 v_id text;
BEGIN
 IF p_actor IS NULL OR nullif(btrim(p_reason),'') IS NULL
    OR nullif(btrim(p_authorization),'') IS NULL THEN
   RAISE EXCEPTION 'V261: reversión física sin actor, autorización o motivo';
 END IF;
 SELECT * INTO m FROM sacramentum_ledger.book_memories
 WHERE id=p_book_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'V261: libro no encontrado'; END IF;
 v_table:=CASE m.sacrament WHEN 'bautismo' THEN 'baptisms'
  WHEN 'confirmacion' THEN 'confirmations'
  WHEN 'matrimonio' THEN 'marriages'
  WHEN 'exequias' THEN 'funerals' END;
 IF v_table IS NULL OR p_seat_ids IS NULL OR jsonb_typeof(p_seat_ids)<>'array'
   OR jsonb_array_length(p_seat_ids) NOT BETWEEN 1 AND 500 THEN
   RAISE EXCEPTION 'V261: selección de reversión inválida';
 END IF;
 -- A repeated reversal does NOT silently return success after removing records.
 -- V253 handles exact idempotence of its private immutable journal; this physical
 -- fixture intentionally makes replay a no-op failure rather than hiding state.
 FOR v_id IN SELECT jsonb_array_elements_text(p_seat_ids) LOOP
   SELECT * INTO seat FROM sacramentum_ledger.active_seats
     WHERE id=v_id::uuid AND book_id=p_book_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'V261: asiento inexistente o ya revertido'; END IF;
   EXECUTE format('SELECT count(*) FROM public.%I r WHERE r.id=$1
      AND r.parish_id=$2 AND r.book_number=$3
      AND r.folio=$4 AND r.number=$5 AND r.book_type=$6',v_table)
     INTO v_count USING seat.sacramental_record_id,m.parish_id,m.book_code,
       lpad(seat.folio::text,4,'0'),lpad(seat.partida::text,4,'0'),m.book_type;
   IF v_count<>1 THEN
     RAISE EXCEPTION 'V261: registro físico no coincide con libro y folio';
   END IF;
   IF NOT EXISTS (SELECT 1 FROM sacramentum_ledger.qa_pending_v259 p
       WHERE p.id=seat.pending_id AND p.parish_id=m.parish_id
         AND p.sacrament=m.sacrament AND p.status='seated') THEN
     RAISE EXCEPTION 'V261: boleta no coincide con partida activa';
   END IF;
 END LOOP;
 v_result:=sacramentum_ledger.qa_reverse_tail_v253(p_book_id,p_expected_version,
   p_operation_id,p_seat_ids,p_actor,p_reason,p_authorization);
 FOR v_id IN SELECT jsonb_array_elements_text(p_seat_ids) LOOP
   -- Seat references disappear after kernel reversal; the permanent journal
   -- still records the coordinates. Delete by UUID from source pending lookup.
   -- Source pending id and record UUID were captured before deletion by
   -- immutable and uniquely linked pending->record fixture fields.
   EXECUTE format('DELETE FROM public.%I WHERE id IN (
        SELECT p.record_id FROM sacramentum_ledger.qa_pending_v259 p
         WHERE p.parish_id=$1 AND p.sacrament=$2 AND p.status=''seated''
         AND EXISTS (
           SELECT 1 FROM sacramentum_ledger.seat_events e
           WHERE e.event_type=''tail_reverse''
             AND e.seat_id=$3 AND e.source_pending_id=p.id
             AND e.book_id=$4
         )
       )',v_table)
     USING m.parish_id,m.sacrament,v_id::uuid,p_book_id;
   GET DIAGNOSTICS v_count=ROW_COUNT;
   IF v_count<>1 THEN RAISE EXCEPTION 'V261: no se eliminó exactamente una partida'; END IF;
   UPDATE sacramentum_ledger.qa_pending_v259 p SET status='pending'
    WHERE p.parish_id=m.parish_id AND p.sacrament=m.sacrament AND p.status='seated'
      AND EXISTS (SELECT 1 FROM sacramentum_ledger.seat_events e
        WHERE e.event_type='tail_reverse' AND e.seat_id=v_id::uuid
        AND e.source_pending_id=p.id AND e.book_id=p_book_id);
   GET DIAGNOSTICS v_count=ROW_COUNT;
   IF v_count<>1 THEN RAISE EXCEPTION 'V261: no se recuperó exactamente una boleta'; END IF;
 END LOOP;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION sacramentum_ledger.qa_reverse_physical_tail_v261(
 uuid,bigint,uuid,jsonb,uuid,text,text) FROM PUBLIC;
