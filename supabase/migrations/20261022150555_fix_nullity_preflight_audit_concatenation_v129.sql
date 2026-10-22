-- V129: corregir concatenación en bitácora de autorización independiente de nulidad.
CREATE OR REPLACE FUNCTION public.review_marriage_nullity_execution_v128(p_authorization_id uuid, p_decision text, p_review_note text, p_external_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_actor uuid:=auth.uid();v_role text;v_diocese uuid;
 v_auth public.nullity_execution_authorizations_v128%rowtype;
 v_marriage public.marriages%rowtype;v_status text;
BEGIN
 IF v_actor IS NULL THEN RAISE EXCEPTION 'Se requiere autenticación' USING errcode='42501'; END IF;
 SELECT lower(up.role),up.diocese_id INTO v_role,v_diocese FROM public.user_profiles up
 WHERE up.auth_user_id=v_actor AND coalesce(up.is_active,false)
 AND lower(coalesce(up.status,'active')) NOT IN ('blocked','disabled','inactive') LIMIT 1;
 IF v_role IS DISTINCT FROM 'diocese' OR v_diocese IS NULL THEN
  RAISE EXCEPTION 'La revisión independiente corresponde exclusivamente a Diócesis' USING errcode='42501';
 END IF;
 IF p_decision NOT IN ('authorize','reject') OR length(btrim(coalesce(p_review_note,'')))<24 OR
 length(btrim(coalesce(p_external_reference,'')))<8 THEN
  RAISE EXCEPTION 'Decisión, motivación y comprobación externa son obligatorias' USING errcode='23514';
 END IF;
 SELECT * INTO v_auth FROM public.nullity_execution_authorizations_v128
 WHERE id=p_authorization_id FOR UPDATE;
 IF NOT FOUND OR v_auth.diocese_id IS DISTINCT FROM v_diocese OR
 NOT EXISTS(SELECT 1 FROM public.parishes p WHERE p.id=v_auth.parish_id AND p.diocese_id=v_diocese) THEN
  RAISE EXCEPTION 'Solicitud no localizada dentro de su jurisdicción' USING errcode='42501';
 END IF;
 IF v_auth.status<>'pending_diocesan_review' THEN
  RAISE EXCEPTION 'Solicitud ya revisada o ejecutada' USING errcode='23514';
 END IF;
 IF v_auth.requested_by IS NOT DISTINCT FROM v_actor THEN
  RAISE EXCEPTION 'La revisión diocesana debe ser independiente de Cancillería' USING errcode='42501';
 END IF;
 SELECT * INTO v_marriage FROM public.marriages WHERE id=v_auth.marriage_id FOR SHARE;
 IF v_marriage.parish_id IS DISTINCT FROM v_auth.parish_id OR
 lower(coalesce(v_marriage.status,'')) NOT IN ('seated','active','vigente') THEN
  RAISE EXCEPTION 'La partida original ya no es apta para este procedimiento' USING errcode='23514';
 END IF;
 v_status:=CASE WHEN p_decision='authorize' THEN 'authorized' ELSE 'rejected' END;
 UPDATE public.nullity_execution_authorizations_v128 SET
  status=v_status, reviewed_by=v_actor,reviewed_at=now(),
  diocesan_review_note=btrim(p_review_note),
  external_verification_reference=btrim(p_external_reference)
 WHERE id=v_auth.id;
 INSERT INTO public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,
 action,after_data,metadata) VALUES(v_actor,v_auth.parish_id,v_diocese,
 'nullity_execution_preflight',v_auth.id,'diocesan_'||v_status,
 jsonb_build_object('status',v_status,'external_reference',btrim(p_external_reference)),
 jsonb_build_object('registral_effects_executed',false,'court_authenticity_certified',false));
 RETURN jsonb_build_object('authorization_id',v_auth.id,'status',v_status,
  'institutional_preflight',true,'court_authenticity_certified',false,'registral_effects_executed',false);
END $function$
;
