-- SACRAMENTUM V110: two distinct institutional actors review unverified
-- court-correspondence metadata. A match is NOT judicial authentication and
-- never permits effects on decrees, marriages, baptisms, notes or notices.
CREATE TABLE public.nullity_court_receipt_checks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 receipt_id uuid NOT NULL REFERENCES public.nullity_court_decision_receipts(id) ON DELETE RESTRICT,
 review_case_id uuid NOT NULL REFERENCES public.nullity_judicial_review_cases(id) ON DELETE RESTRICT,
 diocese_id uuid NOT NULL REFERENCES public.dioceses(id) ON DELETE RESTRICT,
 parish_id uuid NOT NULL REFERENCES public.parishes(id) ON DELETE RESTRICT,
 stage text NOT NULL CHECK(stage IN ('chancery_reference_check','diocesan_independent_check')),
 reported_finding text NOT NULL CHECK(reported_finding IN
   ('reference_matches','requires_clarification','discrepancy_detected')),
 verification_channel text NOT NULL CHECK(verification_channel IN
   ('official_office_contact','official_email','official_letter')),
 external_contact_reference text NOT NULL CHECK(length(trim(external_contact_reference))>=12),
 checked_on date NOT NULL CHECK(checked_on<=CURRENT_DATE),
 assessment_notes text NOT NULL CHECK(length(trim(assessment_notes))>=40),
 actor_user_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT uq_court_receipt_stage_v110 UNIQUE(receipt_id,stage)
);
CREATE INDEX ix_court_receipt_checks_scope_v110
 ON public.nullity_court_receipt_checks (diocese_id,created_at DESC);
ALTER TABLE public.nullity_court_receipt_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nullity_court_receipt_checks FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.nullity_court_receipt_checks TO authenticated;
CREATE POLICY court_receipt_checks_scoped_v110
 ON public.nullity_court_receipt_checks FOR SELECT TO authenticated
 USING (
   (public.current_app_role() IN ('chancery','diocese')
    AND diocese_id=public.current_app_diocese_id())
   OR (public.current_app_role()='parish'
    AND parish_id=public.current_app_parish_id())
 );

CREATE OR REPLACE FUNCTION public.record_court_receipt_independent_check_v110(
 p_receipt_id uuid,
 p_finding text,
 p_verification_channel text,
 p_external_contact_reference text,
 p_checked_on date,
 p_assessment_notes text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 v_role text;
 v_diocese uuid;
 v_receipt public.nullity_court_decision_receipts%rowtype;
 v_case public.nullity_judicial_review_cases%rowtype;
 v_decree public.decretos%rowtype;
 v_parish_diocese uuid;
 v_stage text;
 v_first_actor uuid;
 v_first_finding text;
 v_current_stage_count integer;
 v_check_id uuid;
BEGIN
 IF auth.uid() IS NULL THEN
   RAISE EXCEPTION 'Se requiere sesión autenticada' USING ERRCODE='42501';
 END IF;
 SELECT lower(coalesce(u.role,'')),u.diocese_id INTO v_role,v_diocese
 FROM public.user_profiles u
 WHERE u.auth_user_id=auth.uid()
   AND coalesce(u.is_active,false)
   AND lower(coalesce(u.status,'active')) NOT IN ('blocked','disabled','inactive')
 LIMIT 1;
 IF v_role NOT IN ('chancery','diocese') OR v_role IS NULL OR v_diocese IS NULL THEN
  RAISE EXCEPTION 'Solo Cancillería y Diócesis pueden cotejar documentos de su jurisdicción'
    USING ERRCODE='42501';
 END IF;
 IF p_finding IS NULL OR p_finding NOT IN (
    'reference_matches','requires_clarification','discrepancy_detected')
   OR p_verification_channel IS NULL OR p_verification_channel NOT IN (
    'official_office_contact','official_email','official_letter')
   OR length(trim(coalesce(p_external_contact_reference,'')))<12
   OR p_checked_on IS NULL OR p_checked_on>CURRENT_DATE
   OR length(trim(coalesce(p_assessment_notes,'')))<40 THEN
  RAISE EXCEPTION 'Complete hallazgo, medio oficial, referencia de contraste, fecha y evaluación detallada'
   USING ERRCODE='23514';
 END IF;

 SELECT * INTO v_receipt FROM public.nullity_court_decision_receipts
 WHERE id=p_receipt_id FOR UPDATE;
 IF NOT FOUND OR v_receipt.verification_state<>'unverified'
   OR v_receipt.registrar_attestation<>'receipt_only_no_authenticity_or_effects' THEN
  RAISE EXCEPTION 'Debe existir una recepción pendiente sin efectos'
   USING ERRCODE='23514';
 END IF;
 SELECT * INTO v_case FROM public.nullity_judicial_review_cases
 WHERE id=v_receipt.review_case_id FOR SHARE;
 SELECT * INTO v_decree FROM public.decretos
 WHERE id=v_receipt.nullity_decree_id FOR SHARE;
 SELECT diocese_id INTO v_parish_diocese FROM public.parishes
 WHERE id=v_receipt.parish_id;
 IF v_case.id IS NULL OR v_decree.id IS NULL
   OR v_receipt.diocese_id IS DISTINCT FROM v_diocese
   OR v_case.diocese_id IS DISTINCT FROM v_diocese
   OR v_decree.diocese_id IS DISTINCT FROM v_diocese
   OR v_parish_diocese IS DISTINCT FROM v_diocese
   OR v_case.parish_id IS DISTINCT FROM v_receipt.parish_id
   OR v_decree.parish_id IS DISTINCT FROM v_receipt.parish_id
   OR v_decree.id IS DISTINCT FROM v_case.nullity_decree_id
   OR v_decree.original_record_id IS DISTINCT FROM v_case.marriage_id
 THEN
  RAISE EXCEPTION 'Recepción y sentencia fuera del ámbito institucional'
   USING ERRCODE='42501';
 END IF;
 IF v_case.status<>'under_legal_review'
   OR v_decree.tipo<>'nulidad_matrimonial'
   OR v_decree.sacrament_type<>'matrimonio'
   OR lower(coalesce(v_decree.status,'')) NOT IN ('active','vigente') THEN
  RAISE EXCEPTION 'La sentencia debe estar vigente y su revisión jurídica activa'
   USING ERRCODE='23514';
 END IF;

 IF v_role='chancery' THEN
  v_stage:='chancery_reference_check';
  SELECT count(*) INTO v_current_stage_count
   FROM public.nullity_court_receipt_checks
   WHERE receipt_id=v_receipt.id;
  IF v_current_stage_count<>0 THEN
   RAISE EXCEPTION 'El cotejo de Cancillería ya existe o hay un contraste previo'
    USING ERRCODE='23514';
  END IF;
 ELSE
  v_stage:='diocesan_independent_check';
  SELECT actor_user_id,reported_finding
    INTO v_first_actor,v_first_finding
  FROM public.nullity_court_receipt_checks
  WHERE receipt_id=v_receipt.id AND stage='chancery_reference_check';
  IF v_first_actor IS NULL THEN
    RAISE EXCEPTION 'Primero debe registrarse el cotejo de Cancillería'
      USING ERRCODE='23514';
  END IF;
  IF v_first_actor IS NOT DISTINCT FROM auth.uid()
     OR v_receipt.received_by IS NOT DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'El contraste diocesano exige una identidad distinta'
      USING ERRCODE='42501';
  END IF;
  IF EXISTS (
   SELECT 1 FROM public.nullity_court_receipt_checks
   WHERE receipt_id=v_receipt.id AND stage='diocesan_independent_check'
  ) THEN
   RAISE EXCEPTION 'El contraste independiente ya fue documentado'
    USING ERRCODE='23514';
  END IF;
 END IF;

 INSERT INTO public.nullity_court_receipt_checks(
  receipt_id,review_case_id,diocese_id,parish_id,stage,
  reported_finding,verification_channel,external_contact_reference,
  checked_on,assessment_notes,actor_user_id
 ) VALUES(
  v_receipt.id,v_case.id,v_diocese,v_receipt.parish_id,v_stage,
  p_finding,p_verification_channel,trim(p_external_contact_reference),
  p_checked_on,trim(p_assessment_notes),auth.uid()
 ) RETURNING id INTO v_check_id;

 INSERT INTO public.registry_audit_log(
   actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
 ) VALUES(
   auth.uid(),v_receipt.parish_id,v_diocese,
   'nullity_court_receipt_check',v_check_id,v_stage,
   jsonb_build_object('receipt_id',v_receipt.id,'stage',v_stage,
     'finding',p_finding,'reference',trim(p_external_contact_reference)),
   jsonb_build_object('review_case_id',v_case.id,'decree_id',v_decree.id,
     'independent_actor',v_role='diocese',
     'original_document_still_unverified',true,
     'authenticity_certified',false,
     'registral_effects_executed',false)
 );
 RETURN v_check_id;
EXCEPTION WHEN unique_violation THEN
 RAISE EXCEPTION 'Ya existe cotejo para esta etapa' USING ERRCODE='23505';
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.record_court_receipt_independent_check_v110(uuid,text,text,text,date,text)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_court_receipt_independent_check_v110(uuid,text,text,text,date,text)
 TO authenticated;
COMMENT ON TABLE public.nullity_court_receipt_checks IS
 'Bitácora inmutable de cotejos de Cancillería y contraste independiente de Diócesis. No certifica autenticidad judicial ni ejecución registral.';
COMMENT ON FUNCTION public.record_court_receipt_independent_check_v110(uuid,text,text,text,date,text) IS
 'Cotejo documental de dos actores distintos: primero Cancillería, después Diócesis. Sin mutaciones ni certificación automática de sentencia.';
