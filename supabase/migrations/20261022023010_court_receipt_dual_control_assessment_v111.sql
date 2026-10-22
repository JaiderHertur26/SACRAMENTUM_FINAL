-- V111: resultado del doble cotejo institucional, sin efecto registral.
CREATE OR REPLACE FUNCTION public.get_court_receipt_dual_control_summary_v111(p_receipt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_actor uuid := auth.uid();
 v_role text;
 v_diocese uuid;
 v_receipt public.nullity_court_decision_receipts%rowtype;
 v_first public.nullity_court_receipt_checks%rowtype;
 v_second public.nullity_court_receipt_checks%rowtype;
 v_case public.nullity_judicial_review_cases%rowtype;
 v_result text;
begin
 if v_actor is null then
  raise exception 'Se requiere sesión autenticada' using errcode='42501';
 end if;
 select lower(u.role), u.diocese_id into v_role,v_diocese
 from public.user_profiles u
 where u.auth_user_id=v_actor and coalesce(u.is_active,false)
 and lower(coalesce(u.status,'active')) not in ('blocked','disabled','inactive')
 limit 1;
 if v_role not in ('chancery','diocese') or v_diocese is null then
  raise exception 'Consulta limitada a Cancillería y Diócesis' using errcode='42501';
 end if;
 select * into v_receipt from public.nullity_court_decision_receipts where id=p_receipt_id;
 if not found or v_receipt.diocese_id is distinct from v_diocese then
  raise exception 'Recepción no localizada en la jurisdicción' using errcode='42501';
 end if;
 select * into v_case from public.nullity_judicial_review_cases where id=v_receipt.review_case_id;
 if not found or v_case.diocese_id is distinct from v_diocese or
 v_case.parish_id is distinct from v_receipt.parish_id or
 v_case.nullity_decree_id is distinct from v_receipt.nullity_decree_id then
  raise exception 'Inconsistencia institucional del expediente' using errcode='23514';
 end if;
 select * into v_first from public.nullity_court_receipt_checks
 where receipt_id=p_receipt_id and stage='chancery_reference_check';
 select * into v_second from public.nullity_court_receipt_checks
 where receipt_id=p_receipt_id and stage='diocesan_independent_check';
 if v_first.id is null then
  v_result := 'awaiting_chancery_check';
 elsif v_second.id is null then
  v_result := 'awaiting_diocesan_check';
 elsif v_first.actor_user_id is not distinct from v_second.actor_user_id
  or v_second.actor_user_id is not distinct from v_receipt.received_by then
  v_result := 'invalid_independence';
 elsif v_first.reported_finding='discrepancy_detected'
  or v_second.reported_finding='discrepancy_detected' then
  v_result := 'discrepancy_requires_resolution';
 elsif v_first.reported_finding='requires_clarification'
  or v_second.reported_finding='requires_clarification' then
  v_result := 'clarification_required';
 elsif v_first.reported_finding='reference_matches'
  and v_second.reported_finding='reference_matches' then
  v_result := 'reference_checks_concordant_not_certified';
 else
  v_result := 'manual_review_required';
 end if;
 return jsonb_build_object(
 'receipt_id',v_receipt.id,
 'review_case_id',v_receipt.review_case_id,
 'nullity_decree_id',v_receipt.nullity_decree_id,
 'diocese_id',v_diocese,
 'parish_id',v_receipt.parish_id,
 'institutional_assessment',v_result,
 'chancery_check_id',v_first.id,
 'chancery_finding',v_first.reported_finding,
 'diocesan_check_id',v_second.id,
 'diocesan_finding',v_second.reported_finding,
 'independent_actors',case when v_first.id is not null and v_second.id is not null then
 v_first.actor_user_id is distinct from v_second.actor_user_id
 and v_second.actor_user_id is distinct from v_receipt.received_by else false end,
 'receipt_verification_state',v_receipt.verification_state,
 'review_status',v_case.status,
 'authenticity_certified',false,
 'registral_effects_authorized',false,
 'requires_separate_juridical_decision',true
 );
end $function$
;
REVOKE ALL ON FUNCTION public.get_court_receipt_dual_control_summary_v111(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_court_receipt_dual_control_summary_v111(uuid) TO authenticated;
