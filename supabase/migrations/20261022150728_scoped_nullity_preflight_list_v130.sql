-- V130 · Vista institucional acotada de solicitudes de nulidad antes de ejecutar efectos.
CREATE OR REPLACE FUNCTION public.list_marriage_nullity_execution_v130(p_status text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_actor uuid:=auth.uid();v_role text;v_diocese uuid;v_rows jsonb;
BEGIN
 IF v_actor IS NULL THEN RAISE EXCEPTION 'Se requiere sesión autenticada' USING errcode='42501'; END IF;
 SELECT lower(u.role),u.diocese_id INTO v_role,v_diocese
 FROM public.user_profiles u WHERE u.auth_user_id=v_actor AND coalesce(u.is_active,false)
 AND lower(coalesce(u.status,'active')) NOT IN ('blocked','disabled','inactive') LIMIT 1;
 IF v_role NOT IN ('chancery','diocese') OR v_diocese IS NULL THEN
  RAISE EXCEPTION 'Sólo Cancillería y Diócesis consultan esta revisión previa' USING errcode='42501';
 END IF;
 IF p_status IS NOT NULL AND p_status NOT IN
 ('pending_diocesan_review','authorized','rejected','executed') THEN
  RAISE EXCEPTION 'Filtro de estado no permitido' USING errcode='23514';
 END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) INTO v_rows
 FROM (
  SELECT a.id,a.marriage_id,a.parish_id,a.diocese_id,
   a.decree_number,a.decree_date,a.court_issuer,a.court_document_reference,
   a.court_document_date,a.court_document_sha256,a.request_justification,
   a.status,a.requested_at,a.reviewed_at,a.diocesan_review_note,
   a.external_verification_reference,a.executed_at,a.decree_id,
   a.institutional_assessment
  FROM public.nullity_execution_authorizations_v128 a
  WHERE a.diocese_id=v_diocese AND
  (p_status IS NULL OR a.status=p_status)
  AND EXISTS(SELECT 1 FROM public.parishes p WHERE p.id=a.parish_id
    AND p.diocese_id=v_diocese)
  ORDER BY a.requested_at DESC,a.id DESC LIMIT 200
 ) q;
 RETURN v_rows;
END $function$;
REVOKE ALL ON FUNCTION public.list_marriage_nullity_execution_v130(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_marriage_nullity_execution_v130(text) TO authenticated;
