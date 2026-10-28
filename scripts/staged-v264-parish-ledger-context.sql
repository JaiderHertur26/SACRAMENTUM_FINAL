-- V264 STAGED: read-only parish ledger context, for FOUR client screens.
-- Depends on V252 book_memories and V263 private attestation table.
-- Not deployed until coordinated migration. Only authenticated can inspect
-- their OWN parish; the four seat RPCs still require separate cutover grants.
CREATE FUNCTION public.get_parish_ledger_seat_context_v264(
 p_parish_id uuid,p_sacrament text,p_pending_ids jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_user uuid:=auth.uid();
 v_books jsonb:='[]'::jsonb;
 v_evidence jsonb:='[]'::jsonb;
 v_book record;
 v_key text;
 v_pending uuid;
 v_table text;
 v_state jsonb;
 v_a record;
BEGIN
 IF v_user IS NULL OR p_parish_id IS NULL OR p_sacrament NOT IN
 ('bautismo','confirmacion','matrimonio','exequias') THEN
   RAISE EXCEPTION 'V264: sesión, parroquia o sacramento inválido';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.user_profiles up
   JOIN public.parishes p ON p.id=up.parish_id AND p.diocese_id=up.diocese_id
   WHERE up.auth_user_id=v_user AND up.parish_id=p_parish_id
     AND lower(up.role)='parish' AND up.is_active IS TRUE
     AND upper(coalesce(up.status,''))='ACTIVE'
 ) THEN
   RAISE EXCEPTION 'V264: consulta no autorizada para esta parroquia';
 END IF;
 IF p_pending_ids IS NULL OR jsonb_typeof(p_pending_ids)<>'array'
    OR jsonb_array_length(p_pending_ids)>500 THEN
   RAISE EXCEPTION 'V264: selección inválida';
 END IF;
 v_table:=CASE p_sacrament WHEN 'bautismo' THEN 'pending_baptisms'
  WHEN 'confirmacion' THEN 'pending_confirmations'
  WHEN 'matrimonio' THEN 'pending_marriages'
  WHEN 'exequias' THEN 'pending_funerals' END;
 FOR v_book IN
   SELECT b.id,b.book_code,b.book_type,b.version,b.first_folio,
     b.first_partida,b.active_count,b.partidas_per_folio,
     b.restart_partida_each_folio
   FROM sacramentum_ledger.book_memories b
   WHERE b.parish_id=p_parish_id AND b.sacrament=p_sacrament
     AND b.legacy_reconciled=true AND b.retired_at IS NULL
   ORDER BY b.book_type,b.book_code
 LOOP
   v_books:=v_books||jsonb_build_array(jsonb_build_object(
     'id',v_book.id,'code',v_book.book_code,
     'type',v_book.book_type,'version',v_book.version,
     'nextFolio',v_book.first_folio+
       v_book.active_count/v_book.partidas_per_folio,
     'nextNumber',CASE WHEN v_book.restart_partida_each_folio
       AND v_book.active_count>=v_book.partidas_per_folio
        THEN 1+v_book.active_count%v_book.partidas_per_folio
       ELSE v_book.first_partida+v_book.active_count END,
     'restartNumberPerFolio',v_book.restart_partida_each_folio
   ));
 END LOOP;
 FOR v_key IN SELECT jsonb_array_elements_text(p_pending_ids) LOOP
   IF v_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   THEN RAISE EXCEPTION 'V264: UUID de boleta inválida'; END IF;
   v_pending:=v_key::uuid;
   EXECUTE format('SELECT to_jsonb(p) FROM public.%I p
     WHERE p.id=$1 AND p.parish_id=$2',v_table)
      INTO v_state USING v_pending,p_parish_id;
   SELECT a.origin,a.evidence_ref,a.verified_at,a.decree_effect
      INTO v_a FROM sacramentum_ledger.celebration_attestations_v263 a
      WHERE a.pending_id=v_pending AND a.parish_id=p_parish_id
        AND a.sacrament=p_sacrament;
   v_evidence:=v_evidence||jsonb_build_array(jsonb_build_object(
     'id',v_pending,
     'pending',v_state IS NOT NULL
       AND lower(coalesce(v_state->>'status',''))='pending'
       AND NOT coalesce((v_state->>'reportado')::boolean,false),
     'verified',v_a.verified_at IS NOT NULL
       AND v_a.verified_at<=clock_timestamp()
       AND nullif(btrim(coalesce(v_a.evidence_ref,'')),'') IS NOT NULL
       AND v_a.origin IN ('new_sacrament','new_decree_supplement'),
     'origin',v_a.origin,
     'bookType',CASE WHEN v_a.origin='new_decree_supplement'
       THEN 'suplementario' WHEN v_a.origin='new_sacrament'
       THEN 'ordinario' ELSE NULL END,
     'evidenceRef',v_a.evidence_ref
   ));
 END LOOP;
 RETURN jsonb_build_object('parishId',p_parish_id,'sacrament',p_sacrament,
   'books',v_books,'boletas',v_evidence,'ready',jsonb_array_length(v_books)>0);
END $fn$;
REVOKE ALL ON FUNCTION public.get_parish_ledger_seat_context_v264(uuid,text,jsonb)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_parish_ledger_seat_context_v264(uuid,text,jsonb)
 TO authenticated;
