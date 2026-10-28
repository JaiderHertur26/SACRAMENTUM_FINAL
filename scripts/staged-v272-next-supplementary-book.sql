-- V272: one atomic transition from a seated, still-open ordinary book to
-- a manually confirmed successor; never guesses the next book code.
-- STAGED ONLY. Requires V252 schema with V272 closure columns, V263 attestations.
CREATE FUNCTION public.open_next_supplementary_book_v272(
 p_parish_id uuid,p_sacrament text,p_previous_book_id uuid,
 p_expected_version bigint,p_pending_id uuid,p_new_book_code text,
 p_first_folio integer,p_first_partida integer,p_partidas_per_folio integer,
 p_restart_number_each_folio boolean,p_close_evidence_ref text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_actor uuid:=auth.uid();
 v_old sacramentum_ledger.book_memories%rowtype;
 v_previous_seat sacramentum_ledger.active_seats%rowtype;
 v_attestation sacramentum_ledger.celebration_attestations_v263%rowtype;
 v_decree public.decretos%rowtype;
 v_pending_table text;
 v_real_table text;
 v_pending jsonb;
 v_next uuid;
 v_existing sacramentum_ledger.book_memories%rowtype;
 v_original_count bigint;
 v_code text;
 v_evidence text:=btrim(coalesce(p_close_evidence_ref,''));
 v_closed timestamptz:=clock_timestamp();
BEGIN
 IF v_actor IS NULL OR p_parish_id IS NULL OR p_previous_book_id IS NULL
   OR p_pending_id IS NULL OR p_expected_version IS NULL
   OR p_sacrament NOT IN ('bautismo','confirmacion','matrimonio','exequias')
   OR coalesce(p_new_book_code,'') !~ '^[A-Za-z0-9]{1,32}$'
   OR coalesce(p_first_folio,0)<1 OR coalesce(p_first_partida,0)<1
   OR coalesce(p_partidas_per_folio,0) NOT BETWEEN 1 AND 200
   OR p_restart_number_each_folio IS NULL
   OR length(v_evidence) NOT BETWEEN 8 AND 120 THEN
   RAISE EXCEPTION 'V272: identidad, Libro, Folio, Número, capacidad y constancia de cierre obligatorios';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles up
   JOIN public.parishes p ON p.id=up.parish_id AND p.diocese_id=up.diocese_id
   WHERE up.auth_user_id=v_actor AND up.parish_id=p_parish_id
     AND lower(up.role)='parish' AND up.is_active IS TRUE
     AND upper(coalesce(up.status,''))='ACTIVE' AND up.diocese_id IS NOT NULL) THEN
   RAISE EXCEPTION 'V272: solo parroquia propietaria activa' USING ERRCODE='42501';
 END IF;
 v_pending_table:=CASE p_sacrament WHEN 'bautismo' THEN 'pending_baptisms'
  WHEN 'confirmacion' THEN 'pending_confirmations'
  WHEN 'matrimonio' THEN 'pending_marriages'
  ELSE 'pending_funerals' END;
 v_real_table:=CASE p_sacrament WHEN 'bautismo' THEN 'baptisms'
  WHEN 'confirmacion' THEN 'confirmations'
  WHEN 'matrimonio' THEN 'marriages' ELSE 'funerals' END;
 -- Serializes with initial-book opening for the same parish/sacrament.
 PERFORM pg_advisory_xact_lock(hashtextextended(
    p_parish_id::text||':'||p_sacrament||':suplementario:first',271));
 SELECT * INTO v_old FROM sacramentum_ledger.book_memories
  WHERE id=p_previous_book_id FOR UPDATE;
 IF NOT FOUND OR v_old.parish_id<>p_parish_id OR v_old.sacrament<>p_sacrament
   OR v_old.book_type<>'suplementario' OR v_old.retired_at IS NOT NULL
   OR NOT v_old.legacy_reconciled THEN
   RAISE EXCEPTION 'V272: libro anterior no habilitado en esta parroquia';
 END IF;
 v_code:=CASE WHEN p_new_book_code~'^[0-9]+$'
    THEN coalesce(nullif(ltrim(p_new_book_code,'0'),''),'0')
    ELSE upper(p_new_book_code) END;
 IF v_code=v_old.canonical_code THEN
   RAISE EXCEPTION 'V272: el nuevo libro debe tener otro código físico'; END IF;
 -- Repeated network request can ONLY return an unchanged, UNSEATED successor.
 IF v_old.closed_at IS NOT NULL THEN
   SELECT * INTO v_existing FROM sacramentum_ledger.book_memories
    WHERE predecessor_book_id=v_old.id FOR UPDATE;
   IF NOT FOUND OR v_existing.active_count<>0
     OR v_existing.closed_at IS NOT NULL OR v_existing.retired_at IS NOT NULL
     OR v_existing.book_code<>p_new_book_code
     OR v_existing.first_folio<>p_first_folio
     OR v_existing.first_partida<>p_first_partida
     OR v_existing.partidas_per_folio<>p_partidas_per_folio
     OR v_existing.restart_partida_each_folio IS DISTINCT FROM p_restart_number_each_folio
     OR v_old.close_evidence_ref<>v_evidence OR v_old.version<>p_expected_version THEN
      RAISE EXCEPTION 'V272: la sucesión ya se registró; vuelva a consultar la memoria';
   END IF;
   RETURN jsonb_build_object('bookId',v_existing.id,'bookCode',v_existing.book_code,
     'previousBookId',v_old.id,'nextFolio',v_existing.first_folio,
     'nextNumber',v_existing.first_partida,'existing',true);
 END IF;
 IF v_old.version<>p_expected_version OR v_old.active_count<1
  OR v_old.first_seated_at IS NULL THEN
   RAISE EXCEPTION 'V272: libro vacío, versión cambiada o sin asiento auténtico';
 END IF;
 IF EXISTS(SELECT 1 FROM sacramentum_ledger.book_memories m
  WHERE m.id<>v_old.id AND m.parish_id=p_parish_id
    AND m.sacrament=p_sacrament AND m.book_type='suplementario'
    AND m.closed_at IS NULL AND m.retired_at IS NULL) THEN
   RAISE EXCEPTION 'V272: ya existe otro libro suplementario abierto';
 END IF;
 IF EXISTS(SELECT 1 FROM sacramentum_ledger.book_memories m
  WHERE m.parish_id=p_parish_id AND m.sacrament=p_sacrament
    AND m.book_type='suplementario' AND m.canonical_code=v_code) THEN
   RAISE EXCEPTION 'V272: código de libro previamente utilizado';
 END IF;
 SELECT count(*) INTO v_original_count FROM sacramentum_ledger.active_seats
  WHERE book_id=v_old.id;
 IF v_original_count<>v_old.active_count THEN
   RAISE EXCEPTION 'V272: memoria y asientos no coinciden'; END IF;
 SELECT * INTO v_previous_seat FROM sacramentum_ledger.active_seats
  WHERE book_id=v_old.id AND ordinal=v_old.active_count-1 FOR UPDATE;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'V272: falta último asiento físico anterior'; END IF;
 EXECUTE format('SELECT count(*) FROM public.%I p
   WHERE p.id=$1 AND p.parish_id=$2 AND p.book_number=$3 AND p.book_type=''suplementario''
     AND p.folio=$4 AND p.number=$5',v_real_table)
 INTO v_original_count USING v_previous_seat.sacramental_record_id,p_parish_id,
   v_old.book_code,lpad(v_previous_seat.folio::text,4,'0'),
   lpad(v_previous_seat.partida::text,4,'0');
 IF v_original_count<>1 THEN
   RAISE EXCEPTION 'V272: la última partida no coincide con el libro físico';
 END IF;
 EXECUTE format('SELECT to_jsonb(p) FROM public.%I p
    WHERE p.id=$1 AND p.parish_id=$2 FOR UPDATE',v_pending_table)
 INTO v_pending USING p_pending_id,p_parish_id;
 IF v_pending IS NULL OR lower(coalesce(v_pending->>'status',''))<>'pending'
   OR coalesce((v_pending->>'reportado')::boolean,false) THEN
   RAISE EXCEPTION 'V272: se requiere nueva boleta pendiente'; END IF;
 SELECT * INTO v_attestation FROM sacramentum_ledger.celebration_attestations_v263
  WHERE pending_id=p_pending_id FOR UPDATE;
 IF NOT FOUND OR v_attestation.parish_id<>p_parish_id
   OR v_attestation.sacrament<>p_sacrament
   OR v_attestation.origin<>'new_decree_supplement'
   OR v_attestation.decree_id IS NULL
   OR v_attestation.decree_effect<>'create_supplementary_record'
   OR v_attestation.verified_at>clock_timestamp()
   OR v_attestation.verified_by IS NULL
   OR nullif(btrim(v_attestation.evidence_ref),'') IS NULL THEN
   RAISE EXCEPTION 'V272: constancia de la siguiente celebración no acreditada';
 END IF;
 -- The next pending record must have its own active independently approved decree.
 SELECT * INTO v_decree FROM public.decretos
 WHERE id=v_attestation.decree_id FOR SHARE;
 IF NOT FOUND OR v_decree.parish_id<>p_parish_id
    OR v_decree.sacrament_type<>p_sacrament
    OR v_decree.status<>'active' OR v_decree.tipo<>'reposicion'
    OR v_decree.payload->>'recordOrigin'<>'new_decree_supplement_v271'
    OR v_decree.payload->>'decreeEffect'<>'create_supplementary_record'
    OR v_decree.payload->>'pendingId'<>p_pending_id::text
    OR nullif(v_decree.payload->>'diocesanApprovedBy','') IS NULL
    OR v_decree.issued_by IS NULL
    OR v_decree.issued_by::text=v_decree.payload->>'diocesanApprovedBy' THEN
    RAISE EXCEPTION 'V272: el nuevo decreto supletorio no está aprobado independientemente';
 END IF;
 -- Reusing a historical Book code is forbidden, even if all its seats are old.
 EXECUTE format('SELECT count(*) FROM public.%I p WHERE p.parish_id=$1
   AND (CASE WHEN p.book_number~''^[0-9]+$'' THEN
    coalesce(nullif(ltrim(p.book_number,''0''),''''),''0'')
    ELSE upper(p.book_number) END)=$2',v_real_table)
 INTO v_original_count USING p_parish_id,v_code;
 IF v_original_count>0 THEN
    RAISE EXCEPTION 'V272: el código nuevo ya contiene partidas físicas'; END IF;
 UPDATE sacramentum_ledger.book_memories SET
   closed_at=v_closed,closed_by_auth=v_actor,close_evidence_ref=v_evidence,
   updated_at=v_closed
 WHERE id=v_old.id;
 INSERT INTO sacramentum_ledger.book_memories(
   parish_id,sacrament,book_type,book_code,first_folio,first_partida,
   partidas_per_folio,restart_partida_each_folio,
   legacy_reconciled,predecessor_book_id
 ) VALUES(p_parish_id,p_sacrament,'suplementario',p_new_book_code,
   p_first_folio,p_first_partida,p_partidas_per_folio,
   p_restart_number_each_folio,true,v_old.id) RETURNING id INTO v_next;
 INSERT INTO public.registry_audit_log(actor_user_id,parish_id,diocese_id,
  entity_type,entity_id,action,after_data,metadata)
 VALUES(v_actor,p_parish_id,
  (SELECT diocese_id FROM public.parishes WHERE id=p_parish_id),
  'official_book',v_old.id,'book_closed_for_succession_v272',
  jsonb_build_object('book_code',v_old.book_code,
    'last_folio',v_previous_seat.folio,'last_partida',v_previous_seat.partida,
    'active_count',v_old.active_count,
    'closure_evidence',v_evidence),
  jsonb_build_object('successor_book_id',v_next,'pending_id',p_pending_id)),
 (v_actor,p_parish_id,
  (SELECT diocese_id FROM public.parishes WHERE id=p_parish_id),
  'official_book',v_next,'successor_book_opened_v272',
  jsonb_build_object('book_code',p_new_book_code,
    'first_folio',p_first_folio,'first_partida',p_first_partida,
    'capacity',p_partidas_per_folio,
    'restart_each_folio',p_restart_number_each_folio),
  jsonb_build_object('previous_book_id',v_old.id,
    'pending_id',p_pending_id,'attestation_ref',v_attestation.evidence_ref));
 RETURN jsonb_build_object('bookId',v_next,'bookCode',p_new_book_code,
   'previousBookId',v_old.id,'nextFolio',p_first_folio,
   'nextNumber',p_first_partida,'existing',false);
END $fn$;
REVOKE ALL ON FUNCTION public.open_next_supplementary_book_v272(
 uuid,text,uuid,bigint,uuid,text,integer,integer,integer,boolean,text)
 FROM PUBLIC,anon,authenticated;
-- GRANT only inside the coordinated V267 permission cutover after zero-reset.
