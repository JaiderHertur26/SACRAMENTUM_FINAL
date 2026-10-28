BEGIN;
-- SACRAMENTUM V267 · STAGED FIRST-BOOK OPENING FROM A CLEAN OFFICIAL REGISTRY.
-- This is not an instruction to erase test data. No historical book is imported.
-- Its first real Book / Folio / Partida are typed by the parish from the actual
-- new sacramental record; server proves the scope is empty.
CREATE FUNCTION public.open_first_official_book_v267(
 p_parish_id uuid,p_sacrament text,p_pending_id uuid,
 p_book_code text,p_first_folio integer,p_first_partida integer,
 p_partidas_per_folio integer,p_restart_number_each_folio boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_actor uuid:=auth.uid();
 v_pending_table text;
 v_actual_table text;
 v_pending jsonb;
 v_attestation sacramentum_ledger.celebration_attestations_v263%rowtype;
 v_existing sacramentum_ledger.book_memories%rowtype;
 v_book_id uuid;
 v_rows bigint;
 v_code text;
BEGIN
 IF v_actor IS NULL OR p_parish_id IS NULL OR p_pending_id IS NULL
  OR p_sacrament NOT IN('bautismo','confirmacion','matrimonio','exequias')
  OR p_book_code IS NULL OR p_book_code !~ '^[A-Za-z0-9]{1,32}$'
  OR p_first_folio IS NULL OR p_first_folio<1
  OR p_first_partida IS NULL OR p_first_partida<1
  OR p_partidas_per_folio IS NULL OR p_partidas_per_folio NOT BETWEEN 1 AND 200
  OR p_restart_number_each_folio IS NULL
 THEN RAISE EXCEPTION 'V267: Libro, Folio, Número y capacidad iniciales obligatorios'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles up
    JOIN public.parishes p ON p.id=up.parish_id AND p.diocese_id=up.diocese_id
    WHERE up.auth_user_id=v_actor AND up.parish_id=p_parish_id
      AND lower(up.role)='parish' AND up.is_active=true
      AND upper(coalesce(up.status,''))='ACTIVE') THEN
   RAISE EXCEPTION 'V267: solo parroquia propietaria activa' USING ERRCODE='42501';
 END IF;
 v_pending_table:=CASE p_sacrament
  WHEN 'bautismo' THEN 'pending_baptisms'
  WHEN 'confirmacion' THEN 'pending_confirmations'
  WHEN 'matrimonio' THEN 'pending_marriages'
  WHEN 'exequias' THEN 'pending_funerals' END;
 v_actual_table:=CASE p_sacrament
  WHEN 'bautismo' THEN 'baptisms'
  WHEN 'confirmacion' THEN 'confirmations'
  WHEN 'matrimonio' THEN 'marriages'
  WHEN 'exequias' THEN 'funerals' END;
 -- Serialize book opening with the same parish/sacrament lock used for
 -- configuration and prevent concurrent two-user initial book creation.
 PERFORM pg_advisory_xact_lock(hashtextextended(
   p_parish_id::text||':'||p_sacrament||':ordinario:initial',267));
 EXECUTE format('SELECT to_jsonb(p) FROM public.%I p
    WHERE p.id=$1 AND p.parish_id=$2 FOR UPDATE',v_pending_table)
   INTO v_pending USING p_pending_id,p_parish_id;
 IF v_pending IS NULL OR lower(coalesce(v_pending->>'status',''))<>'pending'
  OR coalesce((v_pending->>'reportado')::boolean,false) THEN
   RAISE EXCEPTION 'V267: se necesita una nueva boleta oficial pendiente';
 END IF;
 SELECT * INTO v_attestation
  FROM sacramentum_ledger.celebration_attestations_v263
  WHERE pending_id=p_pending_id FOR UPDATE;
 IF NOT FOUND OR v_attestation.parish_id<>p_parish_id
  OR v_attestation.sacrament<>p_sacrament OR v_attestation.origin<>'new_sacrament'
  OR v_attestation.verified_at>clock_timestamp() OR v_attestation.verified_by IS NULL
  THEN RAISE EXCEPTION 'V267: falta constancia oficial nueva y comprobada'; END IF;
 v_code:=CASE WHEN p_book_code~'^[0-9]+$'
   THEN coalesce(nullif(ltrim(p_book_code,'0'),''),'0')
   ELSE upper(p_book_code) END;
 SELECT * INTO v_existing FROM sacramentum_ledger.book_memories m
 WHERE m.parish_id=p_parish_id AND m.sacrament=p_sacrament
  AND m.book_type='ordinario' AND m.canonical_code=v_code
  AND m.retired_at IS NULL FOR UPDATE;
 IF FOUND THEN
  IF v_existing.book_code<>p_book_code OR v_existing.first_folio<>p_first_folio
    OR v_existing.first_partida<>p_first_partida
    OR v_existing.partidas_per_folio<>p_partidas_per_folio
    OR v_existing.restart_partida_each_folio IS DISTINCT FROM p_restart_number_each_folio
    OR v_existing.active_count<>0 OR NOT v_existing.legacy_reconciled THEN
    RAISE EXCEPTION 'V267: libro previamente abierto con configuración diferente o ya utilizado';
  END IF;
  RETURN jsonb_build_object('bookId',v_existing.id,'bookCode',v_existing.book_code,
    'nextFolio',v_existing.first_folio,'nextNumber',v_existing.first_partida,
    'existing',true);
 END IF;
 -- This newly chosen book code must not appear in any physical row.
 -- The uniqueness index V260 protects the physical slot after opening.
 EXECUTE format('SELECT count(*) FROM public.%I
   WHERE parish_id=$1 AND (CASE WHEN book_number~''^[0-9]+$''
     THEN coalesce(nullif(ltrim(book_number,''0''),''''),''0'') ELSE upper(book_number) END)=$2',
   v_actual_table) INTO v_rows USING p_parish_id,v_code;
 IF v_rows<>0 THEN
  RAISE EXCEPTION 'V267: libro con posiciones físicas existentes; no es una apertura desde cero';
 END IF;
 IF EXISTS(SELECT 1 FROM sacramentum_ledger.book_memories m
    WHERE m.parish_id=p_parish_id AND m.sacrament=p_sacrament
     AND m.book_type='ordinario') THEN
  RAISE EXCEPTION 'V267: ya existe un libro sin usar para este sacramento';
 END IF;
 INSERT INTO sacramentum_ledger.book_memories(
  parish_id,sacrament,book_type,book_code,first_folio,first_partida,
  partidas_per_folio,restart_partida_each_folio,legacy_reconciled
 ) VALUES(p_parish_id,p_sacrament,'ordinario',p_book_code,p_first_folio,
   p_first_partida,p_partidas_per_folio,p_restart_number_each_folio,true)
 RETURNING id INTO v_book_id;
 -- Initial opening is administrative, no sacramental record is seated yet.
 INSERT INTO public.registry_audit_log(
  actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
 ) VALUES(v_actor,p_parish_id,
  (SELECT diocese_id FROM public.parishes WHERE id=p_parish_id),
  'official_book',v_book_id,'first_official_book_opened',
  jsonb_build_object('sacrament',p_sacrament,'book_code',p_book_code,
   'first_folio',p_first_folio,'first_number',p_first_partida,
   'capacity',p_partidas_per_folio,'restart_each_folio',p_restart_number_each_folio),
  jsonb_build_object('pending_id',p_pending_id,
   'attestation_reference',v_attestation.evidence_ref,
   'origin','empty_registry_manual_opening_V267'));
 RETURN jsonb_build_object('bookId',v_book_id,'bookCode',p_book_code,
  'nextFolio',p_first_folio,'nextNumber',p_first_partida,'existing',false);
END $fn$;
REVOKE ALL ON FUNCTION public.open_first_official_book_v267(
 uuid,text,uuid,text,integer,integer,integer,boolean) FROM PUBLIC,anon,authenticated;
-- Grant only during the final coordinated cutover, not independently.
COMMIT;
