-- SACRAMENTUM V109 · Recepción de decisión judicial alegada; SIN ejecutar efectos.
-- Se guarda constancia de lo recibido, nunca se presume autenticidad judicial.
-- No revoca sentencias ni cambia Matrimonio, Bautismos, avisos o notas marginales.
CREATE TABLE public.nullity_court_decision_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_case_id uuid NOT NULL REFERENCES public.nullity_judicial_review_cases(id) ON DELETE RESTRICT,
  nullity_decree_id uuid NOT NULL REFERENCES public.decretos(id) ON DELETE RESTRICT,
  diocese_id uuid NOT NULL REFERENCES public.dioceses(id) ON DELETE RESTRICT,
  parish_id uuid NOT NULL REFERENCES public.parishes(id) ON DELETE RESTRICT,
  reported_outcome text NOT NULL CHECK (reported_outcome IN (
    'maintains_nullity','orders_further_review','claims_rectification'
  )),
  issuing_authority_reported text NOT NULL CHECK (length(trim(issuing_authority_reported)) >= 8),
  court_document_reference text NOT NULL CHECK (length(trim(court_document_reference)) >= 8),
  court_document_date date NOT NULL,
  received_summary text NOT NULL CHECK (length(trim(received_summary)) >= 50),
  verification_state text NOT NULL DEFAULT 'unverified'
    CHECK (verification_state='unverified'),
  registrar_attestation text NOT NULL DEFAULT 'receipt_only_no_authenticity_or_effects'
    CHECK (registrar_attestation='receipt_only_no_authenticity_or_effects'),
  received_by uuid NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_nullity_court_receipt_reference_v109 UNIQUE(review_case_id,court_document_reference)
);
CREATE INDEX ix_nullity_court_receipts_review_v109
 ON public.nullity_court_decision_receipts (review_case_id,received_at DESC);
ALTER TABLE public.nullity_court_decision_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nullity_court_decision_receipts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.nullity_court_decision_receipts TO authenticated;
CREATE POLICY nullity_court_receipts_read_scoped_v109
 ON public.nullity_court_decision_receipts FOR SELECT TO authenticated
 USING (
   (public.current_app_role() IN ('chancery','diocese')
    AND diocese_id=public.current_app_diocese_id())
   OR (public.current_app_role()='parish'
    AND parish_id=public.current_app_parish_id())
 );

CREATE OR REPLACE FUNCTION public.register_nullity_court_decision_receipt_v109(
 p_review_case_id uuid,
 p_reported_outcome text,
 p_issuing_authority_reported text,
 p_court_document_reference text,
 p_court_document_date date,
 p_received_summary text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 v_role text;
 v_diocese uuid;
 v_case public.nullity_judicial_review_cases%rowtype;
 v_decree public.decretos%rowtype;
 v_marriage public.marriages%rowtype;
 v_parish_diocese uuid;
 v_event_count integer;
 v_receipt_id uuid;
BEGIN
 IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Se requiere autenticación' USING ERRCODE='42501';
 END IF;
 SELECT lower(coalesce(up.role,'')),up.diocese_id INTO v_role,v_diocese
 FROM public.user_profiles up
 WHERE up.auth_user_id=auth.uid()
  AND coalesce(up.is_active,false)
  AND lower(coalesce(up.status,'active')) NOT IN ('blocked','disabled','inactive')
 LIMIT 1;
 IF v_role IS DISTINCT FROM 'chancery' OR v_diocese IS NULL THEN
  RAISE EXCEPTION 'Sólo Cancillería puede registrar recepción de comunicaciones judiciales'
   USING ERRCODE='42501';
 END IF;
 IF p_reported_outcome IS NULL
   OR p_reported_outcome NOT IN ('maintains_nullity','orders_further_review','claims_rectification')
   OR length(trim(coalesce(p_issuing_authority_reported,'')))<8
   OR length(trim(coalesce(p_court_document_reference,'')))<8
   OR p_court_document_date IS NULL OR p_court_document_date>CURRENT_DATE
   OR length(trim(coalesce(p_received_summary,'')))<50
 THEN
  RAISE EXCEPTION 'Faltan tipo alegado de decisión, Tribunal, referencia, fecha o explicación detallada'
    USING ERRCODE='23514';
 END IF;

 SELECT * INTO v_case FROM public.nullity_judicial_review_cases
 WHERE id=p_review_case_id FOR UPDATE;
 IF NOT FOUND OR v_case.status<>'under_legal_review' THEN
  RAISE EXCEPTION 'El expediente debe estar en estudio jurídico activo antes de recibir una decisión'
    USING ERRCODE='23514';
 END IF;
 SELECT * INTO v_decree FROM public.decretos
 WHERE id=v_case.nullity_decree_id FOR SHARE;
 SELECT * INTO v_marriage FROM public.marriages
 WHERE id=v_case.marriage_id FOR SHARE;
 SELECT diocese_id INTO v_parish_diocese FROM public.parishes WHERE id=v_case.parish_id;
 IF v_case.diocese_id IS DISTINCT FROM v_diocese
  OR v_parish_diocese IS DISTINCT FROM v_diocese
  OR v_decree.diocese_id IS DISTINCT FROM v_diocese
  OR v_decree.parish_id IS DISTINCT FROM v_case.parish_id
  OR v_decree.original_record_id IS DISTINCT FROM v_case.marriage_id
  OR v_marriage.parish_id IS DISTINCT FROM v_case.parish_id
 THEN
  RAISE EXCEPTION 'Expediente, sentencia o Matrimonio fuera de la jurisdicción'
   USING ERRCODE='42501';
 END IF;
 IF v_decree.id IS NULL OR v_marriage.id IS NULL
  OR v_decree.tipo<>'nulidad_matrimonial'
  OR v_decree.sacrament_type<>'matrimonio'
  OR lower(coalesce(v_decree.status,'')) NOT IN ('active','vigente')
  OR lower(coalesce(v_marriage.status,''))<>'nullified'
 THEN
  RAISE EXCEPTION 'La sentencia y el Matrimonio deben conservar sus estados originales vigentes'
   USING ERRCODE='23514';
 END IF;
 SELECT count(*) INTO v_event_count FROM public.nullity_judicial_review_events e
 WHERE e.review_case_id=v_case.id AND e.action='start_review';
 IF v_event_count<>1 THEN
  RAISE EXCEPTION 'El estudio jurídico debe haberse iniciado formalmente'
   USING ERRCODE='23514';
 END IF;

 INSERT INTO public.nullity_court_decision_receipts(
  review_case_id,nullity_decree_id,diocese_id,parish_id,
  reported_outcome,issuing_authority_reported,court_document_reference,
  court_document_date,received_summary,received_by
 ) VALUES (
  v_case.id,v_decree.id,v_diocese,v_case.parish_id,p_reported_outcome,
  trim(p_issuing_authority_reported),trim(p_court_document_reference),
  p_court_document_date,trim(p_received_summary),auth.uid()
 ) RETURNING id INTO v_receipt_id;

 INSERT INTO public.registry_audit_log(
   actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
 ) VALUES (
   auth.uid(),v_case.parish_id,v_diocese,'nullity_court_decision_receipt',
   v_receipt_id,'receipt_unverified',
   jsonb_build_object(
    'review_case_id',v_case.id,'court_document_reference',trim(p_court_document_reference),
    'reported_outcome',p_reported_outcome,'verification_state','unverified'
   ),
   jsonb_build_object(
    'nullity_decree_id',v_decree.id,'marriage_id',v_case.marriage_id,
    'document_authenticity_verified',false,
    'court_decision_executed',false,'sacramental_registers_modified',false
   )
 );
 RETURN v_receipt_id;
EXCEPTION WHEN unique_violation THEN
 RAISE EXCEPTION 'Ya consta recibida una comunicación con esta referencia en el expediente'
  USING ERRCODE='23505';
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.register_nullity_court_decision_receipt_v109(uuid,text,text,text,date,text)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.register_nullity_court_decision_receipt_v109(uuid,text,text,text,date,text)
 TO authenticated;
COMMENT ON TABLE public.nullity_court_decision_receipts
 IS 'Constancia de documento presuntamente judicial recibido; toda entrada se considera no verificada y jamás ejecuta efectos registrales.';
COMMENT ON FUNCTION public.register_nullity_court_decision_receipt_v109(uuid,text,text,text,date,text)
 IS 'Cancillería registra recepción de decisión alegada. No autentica sentencia ni cambia decreto, Matrimonio, Bautismos, notas o acuses.';
