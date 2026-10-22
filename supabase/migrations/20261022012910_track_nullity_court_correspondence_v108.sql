-- SACRAMENTUM V108: seguimiento documental NO dispositivo de nulidad matrimonial.
-- Los pasos administrativos no equivalen a validar la autenticidad de un
-- documento judicial y NUNCA cambian sentencia, partidas, notas ni acuses.
CREATE TABLE public.nullity_judicial_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_case_id uuid NOT NULL REFERENCES public.nullity_judicial_review_cases(id) ON DELETE RESTRICT,
  nullity_decree_id uuid NOT NULL REFERENCES public.decretos(id) ON DELETE RESTRICT,
  diocese_id uuid NOT NULL REFERENCES public.dioceses(id) ON DELETE RESTRICT,
  parish_id uuid NOT NULL REFERENCES public.parishes(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK(action IN ('start_review','record_court_correspondence')),
  document_reference text NOT NULL CHECK(char_length(trim(document_reference))>=8),
  document_date date NOT NULL CHECK(document_date<=CURRENT_DATE),
  record_description text NOT NULL CHECK(char_length(trim(record_description))>=30),
  submitted_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_nullity_review_event_document_v108
    UNIQUE (review_case_id,action,document_reference)
);
CREATE INDEX ix_nullity_review_events_case_date_v108
 ON public.nullity_judicial_review_events(review_case_id,created_at DESC,id DESC);
ALTER TABLE public.nullity_judicial_review_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nullity_judicial_review_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.nullity_judicial_review_events TO authenticated;
CREATE POLICY nullity_review_event_read_scoped_v108
  ON public.nullity_judicial_review_events
  FOR SELECT TO authenticated
  USING (
    (public.current_app_role() IN ('chancery','diocese')
      AND diocese_id=public.current_app_diocese_id())
    OR (public.current_app_role()='parish'
      AND parish_id=public.current_app_parish_id())
  );

CREATE OR REPLACE FUNCTION public.record_nullity_judicial_review_step_v108(
  p_review_case_id uuid,
  p_action text,
  p_document_reference text,
  p_document_date date,
  p_record_description text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 v_role text;
 v_diocese uuid;
 v_case public.nullity_judicial_review_cases%rowtype;
 v_decree public.decretos%rowtype;
 v_parish_diocese uuid;
 v_event_id uuid;
 v_status_after text;
BEGIN
 IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'No hay sesión autenticada' USING ERRCODE='42501';
 END IF;
 SELECT lower(coalesce(up.role,'')),up.diocese_id INTO v_role,v_diocese
 FROM public.user_profiles up
 WHERE up.auth_user_id=auth.uid()
   AND coalesce(up.is_active,false)=true
   AND lower(coalesce(up.status,'active')) NOT IN ('blocked','disabled','inactive')
 LIMIT 1;
 IF v_role IS DISTINCT FROM 'chancery' OR v_diocese IS NULL THEN
  RAISE EXCEPTION 'Sólo Cancillería puede registrar actuaciones de revisión de nulidad'
    USING ERRCODE='42501';
 END IF;
 IF p_action NOT IN ('start_review','record_court_correspondence')
   OR p_action IS NULL
   OR length(trim(coalesce(p_document_reference,'')))<8
   OR p_document_date IS NULL OR p_document_date>CURRENT_DATE
   OR length(trim(coalesce(p_record_description,'')))<30
 THEN
  RAISE EXCEPTION 'Actuación, documento, fecha y explicación detallada son obligatorios'
    USING ERRCODE='23514';
 END IF;

 SELECT * INTO v_case FROM public.nullity_judicial_review_cases
 WHERE id=p_review_case_id FOR UPDATE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Expediente de revisión jurídica inexistente' USING ERRCODE='23514';
 END IF;
 SELECT * INTO v_decree FROM public.decretos
 WHERE id=v_case.nullity_decree_id FOR SHARE;
 SELECT diocese_id INTO v_parish_diocese FROM public.parishes
 WHERE id=v_case.parish_id;
 IF v_case.diocese_id IS DISTINCT FROM v_diocese
   OR v_parish_diocese IS DISTINCT FROM v_diocese
   OR v_decree.diocese_id IS DISTINCT FROM v_diocese
   OR v_decree.parish_id IS DISTINCT FROM v_case.parish_id
   OR v_decree.original_record_id IS DISTINCT FROM v_case.marriage_id
 THEN
  RAISE EXCEPTION 'Expediente o sentencia fuera de la jurisdicción de Cancillería'
    USING ERRCODE='42501';
 END IF;
 IF v_decree.id IS NULL
   OR v_decree.tipo<>'nulidad_matrimonial'
   OR v_decree.sacrament_type<>'matrimonio'
   OR lower(coalesce(v_decree.status,'')) NOT IN ('active','vigente')
 THEN
  RAISE EXCEPTION 'La sentencia original no está vigente; requiere revisión individual'
    USING ERRCODE='23514';
 END IF;
 IF (p_action='start_review' AND v_case.status<>'pending_review')
    OR (p_action='record_court_correspondence' AND v_case.status<>'under_legal_review') THEN
  RAISE EXCEPTION 'La actuación no es compatible con el estado actual de la revisión'
    USING ERRCODE='23514';
 END IF;
 v_status_after:=CASE WHEN p_action='start_review' THEN 'under_legal_review'
                      ELSE v_case.status END;

 INSERT INTO public.nullity_judicial_review_events(
   review_case_id,nullity_decree_id,diocese_id,parish_id,action,
   document_reference,document_date,record_description,submitted_by
 ) VALUES (
   v_case.id,v_decree.id,v_case.diocese_id,v_case.parish_id,p_action,
   trim(p_document_reference),p_document_date,trim(p_record_description),auth.uid()
 ) RETURNING id INTO v_event_id;

 IF p_action='start_review' THEN
  UPDATE public.nullity_judicial_review_cases
  SET status='under_legal_review',updated_at=now()
  WHERE id=v_case.id AND status='pending_review';
  IF NOT FOUND THEN
   RAISE EXCEPTION 'El estado de revisión cambió durante esta actuación'
    USING ERRCODE='40001';
  END IF;
 END IF;

 INSERT INTO public.registry_audit_log(
   actor_user_id,parish_id,diocese_id,entity_type,entity_id,
   action,before_data,after_data,metadata
 ) VALUES(
   auth.uid(),v_case.parish_id,v_diocese,
   'nullity_judicial_review',v_case.id,p_action,
   jsonb_build_object('status',v_case.status),
   jsonb_build_object('status',v_status_after,'event_id',v_event_id,
     'document_reference',trim(p_document_reference),'document_date',p_document_date),
   jsonb_build_object('nullity_decree_id',v_decree.id,
     'document_authenticity_verified',false,
     'decree_or_sacrament_modified',false,
     'court_resolution_executed',false)
 );
 RETURN v_event_id;
EXCEPTION WHEN unique_violation THEN
 RAISE EXCEPTION 'Esta referencia documental ya fue registrada para la misma actuación'
  USING ERRCODE='23505';
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.record_nullity_judicial_review_step_v108(uuid,text,text,date,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_nullity_judicial_review_step_v108(uuid,text,text,date,text)
  TO authenticated;
COMMENT ON TABLE public.nullity_judicial_review_events
 IS 'Actuaciones documentales de revisión; no registran resolución judicial auténtica ni ejecutan revocación.';
COMMENT ON FUNCTION public.record_nullity_judicial_review_step_v108(uuid,text,text,date,text)
 IS 'Solo Cancillería. Inicia revisión o registra comunicación sin modificar sentencia, partidas, notas ni acuses.';
