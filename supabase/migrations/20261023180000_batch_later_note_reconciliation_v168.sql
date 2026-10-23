-- SACRAMENTUM V168 · Conciliar varias notas manuales independientes de un solo decreto.
-- Toda la ejecución comparte la transacción RPC de PostgREST. No altera datos históricos por migración.
CREATE OR REPLACE FUNCTION public.execute_later_note_reconciliation_batch_v168(
  p_case_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $v168$
DECLARE
  v_case public.later_note_reconciliations_v156%ROWTYPE;
  v_decree public.decretos%ROWTYPE;
  v_note public.marginal_notes%ROWTYPE;
  v_case_id uuid;
  v_decree_id uuid;
  v_diocese_id uuid;
  v_parish_id uuid;
  v_note_ids uuid[] := ARRAY[]::uuid[];
  v_refs text[] := ARRAY[]::text[];
  v_case_count integer := 0;
  v_updated integer;
  v_others integer;
  v_reason text;
BEGIN
  IF auth.uid() IS NULL OR public.current_app_role() IS DISTINCT FROM 'chancery'
  THEN
    RAISE EXCEPTION 'Sólo Cancillería puede ejecutar conciliaciones autorizadas'
      USING errcode='42501';
  END IF;
  IF p_case_ids IS NULL OR cardinality(p_case_ids) NOT BETWEEN 2 AND 30
     OR array_position(p_case_ids,NULL) IS NOT NULL
     OR (SELECT count(DISTINCT id) FROM unnest(p_case_ids) AS e(id)) <> cardinality(p_case_ids)
  THEN
    RAISE EXCEPTION 'Lote inválido de conciliaciones: seleccione entre dos y treinta expedientes únicos'
      USING errcode='22023';
  END IF;

  -- Acquire case row locks in a stable order. Existing single-case RPCs use the same
  -- case -> decree -> note lock hierarchy; wait or a PostgreSQL deadlock rollback
  -- cannot leave only a subset of the fictitious/institutional records changed.
  FOR v_case_id IN
    SELECT x.id FROM unnest(p_case_ids) AS x(id) ORDER BY x.id
  LOOP
    SELECT * INTO v_case
    FROM public.later_note_reconciliations_v156
    WHERE id=v_case_id FOR UPDATE;
    IF NOT FOUND OR v_case.status IS DISTINCT FROM 'authorized'
      OR v_case.approved_by IS NULL
      OR v_case.approved_by IS NOT DISTINCT FROM v_case.requested_by
    THEN
      RAISE EXCEPTION 'Un expediente no cuenta con autorización diocesana independiente vigente'
        USING errcode='42501';
    END IF;
    IF v_case_count=0 THEN
      v_decree_id:=v_case.decree_id;
      v_parish_id:=v_case.parish_id;
      v_diocese_id:=v_case.diocese_id;
    ELSE
      IF v_case.decree_id IS DISTINCT FROM v_decree_id
        OR v_case.parish_id IS DISTINCT FROM v_parish_id
        OR v_case.diocese_id IS DISTINCT FROM v_diocese_id
      THEN
        RAISE EXCEPTION 'El lote mezcla decretos o jurisdicciones distintas'
          USING errcode='23514';
      END IF;
    END IF;
    IF v_case.note_id=ANY(v_note_ids) THEN
      RAISE EXCEPTION 'Una nota aparece en varios expedientes del mismo lote'
        USING errcode='23514';
    END IF;
    v_note_ids:=array_append(v_note_ids,v_case.note_id);
    v_refs:=array_append(v_refs,v_case.approval_reference);
    v_case_count:=v_case_count+1;
  END LOOP;

  PERFORM public.sacramentum_assert_chancery_for_parish(v_parish_id);
  IF public.current_app_diocese_id() IS DISTINCT FROM v_diocese_id THEN
    RAISE EXCEPTION 'Conciliaciones fuera de jurisdicción' USING errcode='42501';
  END IF;
  SELECT * INTO v_decree FROM public.decretos WHERE id=v_decree_id FOR UPDATE;
  IF NOT FOUND OR v_decree.status IS DISTINCT FROM 'active'
    OR v_decree.parish_id IS DISTINCT FROM v_parish_id
    OR v_decree.diocese_id IS DISTINCT FROM v_diocese_id
    OR v_decree.tipo NOT IN ('correccion','reposicion')
    OR v_decree.sacrament_type NOT IN ('bautismo','confirmacion','matrimonio','exequias')
    OR v_decree.replacement_record_id IS NULL
  THEN
    RAISE EXCEPTION 'Decreto ajeno, inactivo o incompatible con conciliación por lotes'
      USING errcode='23514';
  END IF;

  SELECT count(*) INTO v_others
  FROM public.later_note_reconciliations_v156 c
  WHERE c.decree_id=v_decree_id AND c.status IN ('pending','authorized')
    AND NOT (c.id=ANY(p_case_ids));
  IF v_others<>0 THEN
    RAISE EXCEPTION 'Existen otras solicitudes abiertas para este decreto que no están autorizadas en el lote'
      USING errcode='23514';
  END IF;

  -- Lock all notes in UUID order and reject stale snapshots before any writes.
  FOR v_note IN
    SELECT n.* FROM public.marginal_notes n
    WHERE n.id=ANY(v_note_ids)
    ORDER BY n.id FOR UPDATE OF n
  LOOP
    SELECT * INTO v_case FROM public.later_note_reconciliations_v156 c
    WHERE c.id=ANY(p_case_ids) AND c.note_id=v_note.id;
    IF NOT FOUND OR to_jsonb(v_note) IS DISTINCT FROM v_case.note_snapshot
      OR v_note.status IS DISTINCT FROM 'active'
      OR v_note.parish_id IS DISTINCT FROM v_parish_id
      OR v_note.sacrament_id IS DISTINCT FROM v_decree.replacement_record_id
      OR lower(v_note.sacrament_type) IS DISTINCT FROM lower(v_decree.sacrament_type)
      OR lower(coalesce(v_note.note_type,''))<>'manual'
      OR lower(coalesce(v_note.source_type,'')) NOT IN ('','manual')
      OR v_note.decree_id IS NOT NULL
      OR v_note.is_locked IS DISTINCT FROM false
      OR v_note.print_policy IS DISTINCT FROM 'optional'
    THEN
      RAISE EXCEPTION 'Nota manual ajena, alterada, obligatoria o incompatible: todo el lote se cancela'
        USING errcode='23514';
    END IF;
  END LOOP;
  SELECT count(*) INTO v_updated FROM public.marginal_notes WHERE id=ANY(v_note_ids);
  IF v_updated<>v_case_count THEN
    RAISE EXCEPTION 'Faltan notas del lote' USING errcode='23514';
  END IF;

  -- A decree may have additional later notes not selected. Never reverse it
  -- while any independent active note would survive this transaction.
  SELECT count(*) INTO v_others FROM public.marginal_notes n
  WHERE n.parish_id=v_parish_id
    AND n.sacrament_id=v_decree.replacement_record_id
    AND lower(n.sacrament_type)=lower(v_decree.sacrament_type)
    AND lower(coalesce(n.status,'active')) IN ('active','vigente')
    AND n.decree_id IS DISTINCT FROM v_decree_id
    AND NOT (n.id=ANY(v_note_ids));
  IF v_others<>0 THEN
    RAISE EXCEPTION 'Hay notas marginales posteriores fuera del lote: reversión detenida'
      USING errcode='23514';
  END IF;

  FOR v_note IN
    SELECT n.* FROM public.marginal_notes n
    WHERE n.id=ANY(v_note_ids) ORDER BY n.id
  LOOP
    SELECT * INTO STRICT v_case FROM public.later_note_reconciliations_v156 c
    WHERE c.id=ANY(p_case_ids) AND c.note_id=v_note.id;
    UPDATE public.marginal_notes SET status='reversed',updated_at=now()
    WHERE id=v_note.id AND status='active';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Una nota cambió durante la conciliación: lote cancelado'
        USING errcode='23514';
    END IF;
    INSERT INTO public.registry_audit_log(
      actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,
      before_data,after_data,metadata
    ) VALUES(
      auth.uid(),v_parish_id,v_diocese_id,'marginal_note',v_note.id,
      'manual_note_reconciled_before_decree_reversal',
      to_jsonb(v_note),
      jsonb_build_object('status','reversed','content',v_note.content,'decree_id',v_decree_id),
      jsonb_build_object('case_id',v_case.id,'authorization_reference',v_case.approval_reference,
        'source_reference',v_case.source_reference,'batch_v168',true)
    );
  END LOOP;

  v_reason:='CONCILIACIÓN CONJUNTA AUTORIZADA '||array_to_string(v_refs,'; ')
    ||'. '||v_case_count::text||' NOTAS POSTERIORES INDEPENDIENTES.';
  IF v_decree.sacrament_type IN ('bautismo','confirmacion') THEN
    IF v_decree.tipo='correccion' THEN
      PERFORM public.reverse_correction_decree_with_reason(v_decree_id,v_reason);
    ELSE
      PERFORM public.reverse_replacement_decree_with_reason(v_decree_id,v_reason);
    END IF;
  ELSIF v_decree.sacrament_type='matrimonio' THEN
    PERFORM 1 FROM public.reverse_marriage_decree(v_decree_id,v_reason);
  ELSE
    PERFORM 1 FROM public.reverse_funeral_decree(v_decree_id,v_reason);
  END IF;
  IF (SELECT status FROM public.decretos WHERE id=v_decree_id)
    IS DISTINCT FROM 'reversed'
  THEN RAISE EXCEPTION 'No se confirmó una reversión íntegra del decreto'
    USING errcode='23514';
  END IF;

  UPDATE public.later_note_reconciliations_v156
  SET status='executed',executed_by=auth.uid(),executed_at=now(),updated_at=now()
  WHERE id=ANY(p_case_ids) AND status='authorized';
  GET DIAGNOSTICS v_updated=ROW_COUNT;
  IF v_updated<>v_case_count THEN
    RAISE EXCEPTION 'No se cerraron todos los expedientes: lote revertido'
      USING errcode='23514';
  END IF;

  FOR v_case_id IN SELECT x.id FROM unnest(p_case_ids) AS x(id) ORDER BY x.id LOOP
    SELECT * INTO STRICT v_case FROM public.later_note_reconciliations_v156
    WHERE id=v_case_id;
    INSERT INTO public.registry_audit_log(
      actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,
      before_data,after_data,metadata
    ) VALUES(
      auth.uid(),v_parish_id,v_diocese_id,'marginal_note_reconciliation',v_case.id,
      'reconciliation_executed',
      jsonb_build_object('status','authorized','note_id',v_case.note_id,'decree_id',v_decree_id),
      jsonb_build_object('status','executed','note_status','reversed','decree_status','reversed'),
      jsonb_build_object('authorization_reference',v_case.approval_reference,
        'source_reference',v_case.source_reference,'batch_v168',true)
    );
  END LOOP;

  INSERT INTO public.official_notifications(
    diocese_id,receiver_parish_id,decree_id,category,subject,message,
    status,payload,created_by
  ) VALUES(
    v_diocese_id,v_parish_id,v_decree_id,'decree_reconciliation',
    'Conciliación conjunta de notas marginales y reversión de decreto',
    'Se ejecutó una conciliación autorizada de '||v_case_count::text
      ||' notas y la reversión del decreto '
      ||coalesce(v_decree.decree_number,'SIN NÚMERO')||'. Consulte el expediente de auditoría.',
    'pending',jsonb_build_object(
      'batch_v168',true,'reconciliation_case_ids',to_jsonb(p_case_ids),
      'note_ids',to_jsonb(v_note_ids),'authorization_references',to_jsonb(v_refs)
    ),auth.uid()
  );
  RETURN jsonb_build_object('decree_id',v_decree_id,'status','executed',
    'case_ids',to_jsonb(p_case_ids),'note_ids',to_jsonb(v_note_ids),
    'case_count',v_case_count,'decree_status','reversed');
END;
$v168$;

REVOKE ALL ON FUNCTION public.execute_later_note_reconciliation_batch_v168(uuid[])
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.execute_later_note_reconciliation_batch_v168(uuid[])
  TO authenticated;
