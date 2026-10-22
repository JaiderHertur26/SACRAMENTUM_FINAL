-- V106 · No aceptar nulidades inexistentes ni archivar notas ya asentadas.
-- Prueba anterior con registros 100% ficticios:
-- procesar aviso de nulidad sin decreto generó nota bautismal;
-- posteriormente archive_matrimonial_notification_recipient lo pasó a
-- cancelled aun con note_applied=true. Todo reversido con ROLLBACK.
--
-- Modifica solamente la validación de dos RPC SECURITY DEFINER existentes,
-- conservando permisos, firma, concesiones y trazabilidad institucional.
DO $patch$
DECLARE
 v_src text;
 v_anchor text;
 v_new text;
BEGIN
 SELECT pg_get_functiondef('public.process_matrimonial_notification_recipient(uuid)'::regprocedure)
 INTO v_src;
 v_src:=replace(v_src,E'\r\n',E'\n');
 v_anchor:='  v_notification_type := lower(coalesce(nullif(v_doc.notification_type,''''),''matrimonio''));';
 v_new:=$block$
  IF lower(coalesce(v_doc.status,'sent')) IN ('cancelled','reversed','revertida') THEN
    RAISE EXCEPTION 'El documento de origen está cancelado o revertido; no puede aplicarse ninguna nota marginal'
      USING ERRCODE='23514';
  END IF;

  IF lower(coalesce(v_doc.notification_type,'matrimonio'))='nulidad_matrimonial' THEN
    DECLARE
      v_decree public.decretos%rowtype;
      v_decree_raw text := nullif(v_doc.payload->>'decreeId','');
    BEGIN
      IF v_row.target_baptism_id IS NULL
         OR v_doc.marriage_id IS NULL
         OR v_doc.source_baptism_id IS DISTINCT FROM v_row.target_baptism_id
         OR v_decree_raw IS NULL
         OR v_decree_raw !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN
        RAISE EXCEPTION 'Notificación de nulidad sin identificadores completos y verificables'
          USING ERRCODE='23514';
      END IF;

      SELECT * INTO v_decree FROM public.decretos
      WHERE id=v_decree_raw::uuid FOR SHARE;
      IF NOT FOUND
         OR v_decree.tipo<>'nulidad_matrimonial'
         OR v_decree.sacrament_type<>'matrimonio'
         OR lower(coalesce(v_decree.status,'')) NOT IN ('active','vigente')
         OR v_decree.original_record_id IS DISTINCT FROM v_doc.marriage_id
         OR v_decree.parish_id IS DISTINCT FROM v_doc.sender_parish_id
         OR v_decree.decree_number IS DISTINCT FROM (v_doc.payload->>'decreeNumber')
         OR v_decree.decree_number IS DISTINCT FROM (v_row.payload->>'decreeNumber')
         OR coalesce(v_decree.payload->'baptismIds','[]'::jsonb)
              @> jsonb_build_array(v_row.target_baptism_id::text) IS NOT TRUE
      THEN
        RAISE EXCEPTION 'La notificación no corresponde a una sentencia de nulidad vigente y vinculada al Bautismo'
          USING ERRCODE='23514';
      END IF;

      -- Defensa adicional contra alteraciones posteriores de partidas o enlaces.
      PERFORM private.assert_nullity_baptism_link_v105(
        v_doc.marriage_id,v_row.target_baptism_id);
    END;
  END IF;

$block$||v_anchor;
 IF strpos(v_src,v_anchor)=0 OR strpos(v_src,'private.assert_nullity_baptism_link_v105')>0 THEN
  RAISE EXCEPTION 'V106: función receptora no coincide con versión auditada';
 END IF;
 EXECUTE replace(v_src,v_anchor,v_new);

 SELECT pg_get_functiondef('public.archive_matrimonial_notification_recipient(uuid)'::regprocedure)
 INTO v_src;
 v_src:=replace(v_src,E'\r\n',E'\n');
 v_anchor:='  update public.matrimonial_notification_recipients';
 v_new:=$block$
  IF lower(coalesce(v_row.status,'pending'))='processed'
      OR coalesce(v_row.note_applied,false)
      OR v_row.receipt_document_number IS NOT NULL
  THEN
    RAISE EXCEPTION 'La recepción ya fue procesada; no puede archivarse como cancelada después de asentar una nota'
      USING ERRCODE='23514';
  END IF;

  IF lower(coalesce(v_row.status,'pending'))='cancelled' THEN
    RETURN true; -- Archivar dos veces un aviso sin efectos resulta idempotente.
  END IF;

$block$||v_anchor;
 IF strpos(v_src,v_anchor)=0 OR strpos(v_src,'v_row.note_applied,false')>0 THEN
  RAISE EXCEPTION 'V106: archivador no coincide con versión auditada';
 END IF;
 EXECUTE replace(v_src,v_anchor,v_new);
END$patch$;
