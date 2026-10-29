BEGIN;
-- V280B: listas comprobadas para las pantallas de Cancillería y Parroquia.
CREATE FUNCTION public.get_parish_decree_books_v280(p_decree_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a uuid:=auth.uid();p uuid;decree public.decretos%rowtype; books jsonb;
BEGIN
 SELECT up.parish_id INTO p FROM public.user_profiles up
 JOIN public.parishes pa ON pa.id=up.parish_id AND pa.diocese_id=up.diocese_id
 WHERE up.auth_user_id=a AND up.role='parish' AND up.is_active
 AND upper(coalesce(up.status,''))='ACTIVE' AND pa.is_operational;
 IF p IS NULL THEN RAISE EXCEPTION 'V280: acceso de parroquia requerido' USING ERRCODE='42501'; END IF;
 SELECT * INTO decree FROM public.decretos
 WHERE id=p_decree_id AND parish_id=p AND status='active'
 AND payload->>'recordOrigin'='chancery_pending_seat_v280'
 AND replacement_record_id IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'V280: decreto no disponible para asiento'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',m.id,'bookCode',m.book_code,'version',m.version,
  'nextFolio',m.first_folio+m.active_count/m.partidas_per_folio,
  'nextNumber',CASE WHEN m.restart_partida_each_folio
    AND m.active_count>=m.partidas_per_folio
    THEN 1+m.active_count%m.partidas_per_folio
    ELSE m.first_partida+m.active_count END,
  'partidasPorFolio',m.partidas_per_folio,
  'restartEachFolio',m.restart_partida_each_folio,
  'activeCount',m.active_count
 ) ORDER BY m.created_at DESC), '[]'::jsonb) INTO books
 FROM sacramentum_ledger.book_memories m
 WHERE m.parish_id=p AND m.sacrament=decree.sacrament_type
 AND m.book_type='suplementario' AND m.legacy_reconciled
 AND m.closed_at IS NULL AND m.retired_at IS NULL;
 RETURN jsonb_build_object('decreeId',p_decree_id,'parishId',p,
    'sacrament',decree.sacrament_type,'books',books);
END $fn$;
REVOKE ALL ON FUNCTION public.get_parish_decree_books_v280(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_parish_decree_books_v280(uuid) TO authenticated;

CREATE FUNCTION public.get_chancery_decree_issue_context_v280(p_parish_id uuid,p_sacrament text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a uuid:=auth.uid();di uuid;pending_table text;registry_table text;
 pending_rows jsonb;original_rows jsonb; concepts jsonb;v_q text;
BEGIN
 SELECT up.diocese_id INTO di FROM public.user_profiles up
 WHERE up.auth_user_id=a AND up.role='chancery' AND up.is_active
 AND upper(coalesce(up.status,''))='ACTIVE';
 IF di IS NULL OR NOT EXISTS(SELECT 1 FROM public.parishes p
   WHERE p.id=p_parish_id AND p.diocese_id=di AND p.is_operational)
 OR p_sacrament NOT IN('bautismo','confirmacion','matrimonio','exequias') THEN
  RAISE EXCEPTION 'V280: jurisdicción de Cancillería inválida' USING ERRCODE='42501'; END IF;
 pending_table:=CASE p_sacrament WHEN 'bautismo' THEN 'pending_baptisms'
  WHEN 'confirmacion' THEN 'pending_confirmations'
  WHEN 'matrimonio' THEN 'pending_marriages' ELSE 'pending_funerals' END;
 registry_table:=CASE p_sacrament WHEN 'bautismo' THEN 'baptisms'
  WHEN 'confirmacion' THEN 'confirmations'
  WHEN 'matrimonio' THEN 'marriages' ELSE 'funerals' END;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'codigo',c.codigo,'concepto',c.concepto,'type',c.tipo,
    'seinscribe',c.seinscribe,'enLibro',c.enlibro)
    ORDER BY c.codigo), '[]'::jsonb) INTO concepts
 FROM public.conceptos_anulacion c
 JOIN sacramentum_ledger.supplementary_concept_approvals_v272 ap
  ON ap.concept_id=c.id AND ap.diocese_id=di AND ap.approved_by IS NOT NULL
 WHERE c.diocese_id=di AND c.is_active AND c.enlibro=2 AND c.seinscribe
 AND lower(coalesce(c.sacrament_type,'')) IN('general',p_sacrament)
 AND lower(coalesce(c.tipo,'')) IN
  ('porcorreccion','correccion','porreposicion','reposicion')
 AND ap.policy_snapshot=jsonb_build_object(
   'codigo',c.codigo,'concepto',c.concepto,'tipo',c.tipo,
   'sacrament_type',c.sacrament_type,'enlibro',c.enlibro,
   'seinscribe',c.seinscribe,'gennota',c.gennota,'gendocum',c.gendocum,
   'expide',c.expide,'source_kind',c.source_kind,
   'source_reference',c.source_reference,'is_active',c.is_active);
 v_q:=format($query$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',x.id,'createdAt',x.created_at,
    'name',coalesce(nullif(btrim(concat_ws(' ',x.raw_data->>'nombres',
      x.raw_data->>'apellidos')),''),nullif(x.raw_data->>'novioNombres',''),
      nullif(x.raw_data->>'nombres',''),'Pendiente documental'),
    'celebrationDate',coalesce(to_jsonb(x)->>'celebration_date',
      to_jsonb(x)->>'fecha_exequias',x.raw_data->>'fechaSacramento',
      x.raw_data->>'fechaMatrimonio'),
    'registrationNumber',coalesce(x.raw_data->>'numeroRegistro',
      x.raw_data->>'numero_registro',to_jsonb(x)->>'numero_registro')
  ) ORDER BY x.created_at DESC),'[]'::jsonb)
  FROM public.%I x WHERE x.parish_id=$1
  AND x.status='pending' AND coalesce(x.reportado,false)=false
  AND EXISTS(SELECT 1 FROM public.pending_creation_requests r
    WHERE r.parish_id=$1 AND (
     (r.sacrament_type='bautismo' AND r.response->>'baptism_pending_id'=x.id::text)
     OR (r.sacrament_type='bautismo' AND r.response->>'confirmation_pending_id'=x.id::text)
     OR (r.sacrament_type=$2 AND r.response->>'pending_id'=x.id::text)))
  AND NOT EXISTS(SELECT 1 FROM sacramentum_ledger.celebration_attestations_v263 a
    WHERE a.pending_id=x.id)
  AND NOT EXISTS(SELECT 1 FROM public.decretos d WHERE d.parish_id=$1
    AND d.payload->>'pendingId'=x.id::text)
 $query$,pending_table);
 EXECUTE v_q INTO pending_rows USING p_parish_id,p_sacrament;
 v_q:=format($query$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'name',coalesce(nullif(btrim(concat_ws(' ',
      to_jsonb(r)->>'nombres',to_jsonb(r)->>'apellidos')),''),
       nullif(to_jsonb(r)->'raw_data'->>'novioNombres',''),'Partida'),
    'book',r.book_number,'folio',r.folio,'number',r.number,
    'status',r.status) ORDER BY r.created_at DESC), '[]'::jsonb)
  FROM public.%I r WHERE r.parish_id=$1
  AND lower(coalesce(r.status,'seated')) NOT IN
    ('anulada','annulled','cancelled','reversed','deleted')
 $query$,registry_table);
 EXECUTE v_q INTO original_rows USING p_parish_id;
 RETURN jsonb_build_object('parishId',p_parish_id,'sacrament',p_sacrament,
    'pending',pending_rows,'originals',original_rows,'concepts',concepts);
END $fn$;
REVOKE ALL ON FUNCTION public.get_chancery_decree_issue_context_v280(uuid,text)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_chancery_decree_issue_context_v280(uuid,text)
 TO authenticated;
COMMIT;
