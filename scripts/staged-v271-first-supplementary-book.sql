-- V271 initial supplementary book is opened only after two-role decree approval.
-- It has no overlap with first ordinary book V267 or successor V270.
CREATE FUNCTION public.open_first_supplementary_book_v271(
 p_parish_id uuid,p_sacrament text,p_pending_id uuid,
 p_book_code text,p_first_folio integer,p_first_partida integer,
 p_partidas_per_folio integer,p_restart_number_each_folio boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_actor uuid:=auth.uid();
 v_pending_table text;
 v_real_table text;
 v_pending jsonb;
 v_att sacramentum_ledger.celebration_attestations_v263%rowtype;
 v_decree public.decretos%rowtype;
 v_book uuid;
 v_code text;
 v_count bigint;
 v_existing sacramentum_ledger.book_memories%rowtype;
BEGIN
 IF v_actor IS NULL OR p_parish_id IS NULL OR p_pending_id IS NULL
  OR p_sacrament NOT IN('bautismo','confirmacion','matrimonio','exequias')
  OR coalesce(p_book_code,'') !~ '^[A-Za-z0-9]{1,32}$'
  OR coalesce(p_first_folio,0)<1 OR coalesce(p_first_partida,0)<1
  OR coalesce(p_partidas_per_folio,0) NOT BETWEEN 1 AND 200
  OR p_restart_number_each_folio IS NULL THEN
  RAISE EXCEPTION 'V271: Libro, Folio, Número y capacidad supletoria obligatorios';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles up
  JOIN public.parishes p ON p.id=up.parish_id AND p.diocese_id=up.diocese_id
  WHERE up.auth_user_id=v_actor AND up.parish_id=p_parish_id
   AND lower(up.role)='parish' AND up.is_active IS TRUE
   AND upper(coalesce(up.status,''))='ACTIVE') THEN
  RAISE EXCEPTION 'V271: solo parroquia propietaria activa' USING ERRCODE='42501'; END IF;
 v_pending_table:=CASE p_sacrament WHEN 'bautismo' THEN 'pending_baptisms'
  WHEN 'confirmacion' THEN 'pending_confirmations'
  WHEN 'matrimonio' THEN 'pending_marriages' ELSE 'pending_funerals' END;
 v_real_table:=CASE p_sacrament WHEN 'bautismo' THEN 'baptisms'
  WHEN 'confirmacion' THEN 'confirmations'
  WHEN 'matrimonio' THEN 'marriages' ELSE 'funerals' END;
 PERFORM pg_advisory_xact_lock(hashtextextended(
  p_parish_id::text||':'||p_sacrament||':suplementario:first',271));
 EXECUTE format('SELECT to_jsonb(p) FROM public.%I p WHERE id=$1 AND parish_id=$2 FOR UPDATE',
   v_pending_table) INTO v_pending USING p_pending_id,p_parish_id;
 IF v_pending IS NULL OR lower(coalesce(v_pending->>'status',''))<>'pending'
  OR coalesce((v_pending->>'reportado')::boolean,false) THEN
    RAISE EXCEPTION 'V271: boleta del decreto no disponible';
 END IF;
 SELECT * INTO v_att FROM sacramentum_ledger.celebration_attestations_v263
  WHERE pending_id=p_pending_id FOR UPDATE;
 IF NOT FOUND OR v_att.parish_id<>p_parish_id
  OR v_att.sacrament<>p_sacrament
  OR v_att.origin<>'new_decree_supplement'
  OR v_att.decree_id IS NULL
  OR v_att.decree_effect<>'create_supplementary_record'
  OR v_att.verified_at>clock_timestamp() OR v_att.verified_by IS NULL THEN
  RAISE EXCEPTION 'V271: falta autorización diocesana válida del nuevo decreto'; END IF;
 SELECT * INTO v_decree FROM public.decretos WHERE id=v_att.decree_id;
 IF NOT FOUND OR v_decree.parish_id<>p_parish_id
  OR v_decree.sacrament_type<>p_sacrament
  OR v_decree.status<>'active'
  OR v_decree.payload->>'decreeEffect'<>'create_supplementary_record'
  OR v_decree.payload->>'recordOrigin'<>'new_decree_supplement_v271'
  OR v_decree.payload->>'pendingId'<>p_pending_id::text
  OR nullif(v_decree.payload->>'diocesanApprovedBy','') IS NULL THEN
  RAISE EXCEPTION 'V271: el decreto no está aprobado para este asiento supletorio'; END IF;
 v_code:=CASE WHEN p_book_code~'^[0-9]+$'
  THEN coalesce(nullif(ltrim(p_book_code,'0'),''),'0') ELSE upper(p_book_code) END;
 SELECT * INTO v_existing FROM sacramentum_ledger.book_memories m
 WHERE m.parish_id=p_parish_id AND m.sacrament=p_sacrament
 AND m.canonical_code=v_code AND m.retired_at IS NULL FOR UPDATE;
 IF FOUND THEN
  IF v_existing.book_type<>'suplementario'
    OR v_existing.active_count<>0 OR v_existing.closed_at IS NOT NULL
    OR NOT v_existing.legacy_reconciled
    OR v_existing.book_code<>p_book_code
    OR v_existing.first_folio<>p_first_folio
    OR v_existing.first_partida<>p_first_partida
    OR v_existing.partidas_per_folio<>p_partidas_per_folio
    OR v_existing.restart_partida_each_folio IS DISTINCT FROM p_restart_number_each_folio THEN
   RAISE EXCEPTION 'V271: libro supletorio ya configurado de otro modo'; END IF;
  RETURN jsonb_build_object('bookId',v_existing.id,
    'bookCode',v_existing.book_code,'nextFolio',v_existing.first_folio,
    'nextNumber',v_existing.first_partida,'existing',true);
 END IF;
 IF EXISTS(SELECT 1 FROM sacramentum_ledger.book_memories
   WHERE parish_id=p_parish_id AND sacrament=p_sacrament AND book_type='suplementario')
 THEN RAISE EXCEPTION 'V271: ya existe libro supletorio; no se permite segunda apertura inicial'; END IF;
 EXECUTE format('SELECT count(*) FROM public.%I p WHERE p.parish_id=$1
  AND (CASE WHEN p.book_number~''^[0-9]+$'' THEN
     coalesce(nullif(ltrim(p.book_number,''0''),''''),''0'')
     ELSE upper(p.book_number) END)=$2',v_real_table)
 INTO v_count USING p_parish_id,v_code;
 IF v_count<>0 THEN RAISE EXCEPTION 'V271: el código de libro ya tiene partidas'; END IF;
 INSERT INTO sacramentum_ledger.book_memories(
  parish_id,sacrament,book_type,book_code,first_folio,first_partida,
  partidas_per_folio,restart_partida_each_folio,legacy_reconciled)
 VALUES(p_parish_id,p_sacrament,'suplementario',p_book_code,
  p_first_folio,p_first_partida,p_partidas_per_folio,
  p_restart_number_each_folio,true) RETURNING id INTO v_book;
 INSERT INTO public.registry_audit_log(actor_user_id,parish_id,diocese_id,
  entity_type,entity_id,action,after_data,metadata)
 VALUES(v_actor,p_parish_id,
  (SELECT diocese_id FROM public.parishes WHERE id=p_parish_id),
  'official_book',v_book,'first_supplementary_book_opened_v271',
  jsonb_build_object('book_code',p_book_code,'folio',p_first_folio,
    'number',p_first_partida,'capacity',p_partidas_per_folio),
  jsonb_build_object('decree_id',v_att.decree_id,'pending_id',p_pending_id,
    'diocesan_approver',v_att.verified_by));
 RETURN jsonb_build_object('bookId',v_book,'bookCode',p_book_code,
  'nextFolio',p_first_folio,'nextNumber',p_first_partida,'existing',false);
END $fn$;
REVOKE ALL ON FUNCTION public.open_first_supplementary_book_v271(
 uuid,text,uuid,text,integer,integer,integer,boolean)
 FROM PUBLIC,anon,authenticated;
-- GRANT only at coordinated go-live.
