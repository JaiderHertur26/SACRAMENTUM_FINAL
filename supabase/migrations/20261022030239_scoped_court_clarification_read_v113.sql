-- V113 · Fuente recuperada de la función instalada en Supabase; archivo reconstruible.
CREATE OR REPLACE FUNCTION public.get_court_clarifications_v113(p_receipt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_actor uuid := auth.uid();
 v_role text;
 v_diocese uuid;
 v_receipt public.nullity_court_decision_receipts%rowtype;
 v_case public.nullity_judicial_review_cases%rowtype;
 v_items jsonb;
BEGIN
 IF v_actor IS NULL THEN RAISE EXCEPTION 'Sesión obligatoria' USING ERRCODE='42501'; END IF;
 SELECT lower(u.role),u.diocese_id INTO v_role,v_diocese
 FROM public.user_profiles u WHERE u.auth_user_id=v_actor
 AND coalesce(u.is_active,false)
 AND lower(coalesce(u.status,'active')) NOT IN ('blocked','disabled','inactive') LIMIT 1;
 IF v_role IS NULL OR v_role NOT IN ('chancery','diocese') OR v_diocese IS NULL THEN
  RAISE EXCEPTION 'Acceso institucional denegado' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_receipt FROM public.nullity_court_decision_receipts WHERE id=p_receipt_id;
 IF NOT FOUND OR v_receipt.diocese_id IS DISTINCT FROM v_diocese THEN
  RAISE EXCEPTION 'Recepción ajena o inexistente' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_case FROM public.nullity_judicial_review_cases WHERE id=v_receipt.review_case_id;
 IF NOT FOUND OR v_case.diocese_id IS DISTINCT FROM v_diocese
 OR v_case.parish_id IS DISTINCT FROM v_receipt.parish_id
 OR v_case.nullity_decree_id IS DISTINCT FROM v_receipt.nullity_decree_id THEN
  RAISE EXCEPTION 'Vínculos discordantes del expediente' USING ERRCODE='23514'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',c.id,'request_text',c.request_text,'request_reference',c.request_reference,
  'requested_at',c.requested_at,'requested_by',c.requested_by,
  'response_text',c.response_text,'response_reference',c.response_reference,
  'responded_at',c.responded_at,'responded_by',c.responded_by,
  'status',CASE WHEN c.responded_at IS NULL THEN 'awaiting_response' ELSE 'responded_pending_juridical_review' END
 ) ORDER BY c.requested_at,c.id),'[]'::jsonb) INTO v_items
 FROM public.nullity_court_clarifications_v112 c
 WHERE c.receipt_id=p_receipt_id AND c.diocese_id=v_diocese
 AND c.parish_id=v_receipt.parish_id;
 RETURN jsonb_build_object('receipt_id',p_receipt_id,'items',v_items,
 'authenticity_certified',false,'registral_effects_authorized',false);
END $function$
;
REVOKE ALL ON FUNCTION public.get_court_clarifications_v113(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_court_clarifications_v113(uuid) TO authenticated;
