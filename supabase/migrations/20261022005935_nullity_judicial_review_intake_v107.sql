-- SACRAMENTUM V107 · Solicitud de revisión jurídico-eclesiástica de nulidad.
-- NO revoca una sentencia, NO devuelve estado de Matrimonio, NO borra notas.
-- Una decisión firme posterior necesita otro instrumento jurídico autenticado.
CREATE TABLE IF NOT EXISTS public.nullity_judicial_review_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nullity_decree_id uuid NOT NULL REFERENCES public.decretos(id) ON DELETE RESTRICT,
  marriage_id uuid NOT NULL REFERENCES public.marriages(id) ON DELETE RESTRICT,
  diocese_id uuid NOT NULL REFERENCES public.dioceses(id) ON DELETE RESTRICT,
  parish_id uuid NOT NULL REFERENCES public.parishes(id) ON DELETE RESTRICT,
  request_reference text NOT NULL,
  authority_document_reference text NOT NULL,
  review_reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','under_legal_review','closed')),
  original_state_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  affected_records_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nullity_review_reason_substantive CHECK (char_length(trim(review_reason)) >= 30),
  CONSTRAINT nullity_review_document_reference_required CHECK (char_length(trim(authority_document_reference)) >= 8),
  CONSTRAINT nullity_review_reference_required CHECK (char_length(trim(request_reference)) >= 5)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_nullity_review_open_decree_v107
  ON public.nullity_judicial_review_cases (nullity_decree_id)
  WHERE status IN ('pending_review','under_legal_review');
CREATE INDEX IF NOT EXISTS ix_nullity_reviews_diocese_status_v107
  ON public.nullity_judicial_review_cases (diocese_id,status,created_at DESC);
ALTER TABLE public.nullity_judicial_review_cases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nullity_judicial_review_cases FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.nullity_judicial_review_cases TO authenticated;
CREATE POLICY nullity_review_read_scoped_v107
  ON public.nullity_judicial_review_cases FOR SELECT TO authenticated
  USING (
    (
      public.current_app_role() IN ('chancery','diocese')
      AND diocese_id=public.current_app_diocese_id()
    )
    OR (
      public.current_app_role()='parish'
      AND parish_id=public.current_app_parish_id()
    )
  );

CREATE OR REPLACE FUNCTION public.request_nullity_judicial_review_v107(
  p_nullity_decree_id uuid,
  p_request_reference text,
  p_authority_document_reference text,
  p_review_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
 v_role text;
 v_user_diocese uuid;
 v_decree public.decretos%rowtype;
 v_marriage public.marriages%rowtype;
 v_actual_diocese uuid;
 v_case uuid;
 v_notice_count integer;
 v_processed_count integer;
 v_note_count integer;
BEGIN
 IF auth.uid() IS NULL THEN
   RAISE EXCEPTION 'Se requiere una sesión autenticada' USING ERRCODE='42501';
 END IF;
 SELECT lower(coalesce(up.role,'')),up.diocese_id
   INTO v_role,v_user_diocese
 FROM public.user_profiles up
 WHERE up.auth_user_id=auth.uid() AND coalesce(up.is_active,false)
   AND lower(coalesce(up.status,'active')) NOT IN ('blocked','disabled','inactive')
 LIMIT 1;
 IF v_role IS DISTINCT FROM 'chancery' OR v_user_diocese IS NULL THEN
   RAISE EXCEPTION 'Sólo Cancillería puede solicitar revisión jurídica de una sentencia matrimonial'
    USING ERRCODE='42501';
 END IF;
 IF p_nullity_decree_id IS NULL
   OR char_length(trim(coalesce(p_request_reference,''))) < 5
   OR char_length(trim(coalesce(p_authority_document_reference,''))) < 8
   OR char_length(trim(coalesce(p_review_reason,''))) < 30
 THEN
   RAISE EXCEPTION 'Identifique sentencia, referencia del trámite, documento de sustento y motivo detallado'
    USING ERRCODE='23514';
 END IF;

 SELECT * INTO v_decree FROM public.decretos
 WHERE id=p_nullity_decree_id
 FOR SHARE;
 IF NOT FOUND OR v_decree.tipo <> 'nulidad_matrimonial'
   OR v_decree.sacrament_type <> 'matrimonio'
   OR lower(coalesce(v_decree.status,'')) NOT IN ('active','vigente')
   OR v_decree.original_record_id IS NULL
   OR v_decree.parish_id IS NULL
 THEN
   RAISE EXCEPTION 'No existe una sentencia activa de nulidad matrimonial con partida original'
    USING ERRCODE='23514';
 END IF;
 SELECT p.diocese_id INTO v_actual_diocese
 FROM public.parishes p WHERE p.id=v_decree.parish_id;
 IF v_decree.diocese_id IS DISTINCT FROM v_user_diocese
   OR v_actual_diocese IS DISTINCT FROM v_user_diocese THEN
   RAISE EXCEPTION 'La sentencia pertenece a otra jurisdicción'
    USING ERRCODE='42501';
 END IF;

 SELECT * INTO v_marriage FROM public.marriages
 WHERE id=v_decree.original_record_id FOR SHARE;
 IF NOT FOUND OR v_marriage.parish_id IS DISTINCT FROM v_decree.parish_id THEN
   RAISE EXCEPTION 'La partida matrimonial original no corresponde a la sentencia'
    USING ERRCODE='23514';
 END IF;
 SELECT count(*) INTO v_notice_count
 FROM public.matrimonial_notifications n
 WHERE n.marriage_id=v_marriage.id
   AND n.notification_type='nulidad_matrimonial'
   AND n.payload->>'decreeId'=v_decree.id::text;
 SELECT count(*) INTO v_processed_count
 FROM public.matrimonial_notification_recipients r
 JOIN public.matrimonial_notifications n ON n.id=r.notification_id
 WHERE n.marriage_id=v_marriage.id
   AND n.notification_type='nulidad_matrimonial'
   AND n.payload->>'decreeId'=v_decree.id::text
   AND lower(coalesce(r.status,''))='processed';
 SELECT count(*) INTO v_note_count
 FROM public.marginal_notes mn
 WHERE mn.decree_id=v_decree.id
   OR (
     mn.note_type='nulidad_matrimonial'
     AND mn.source_type='sacramental_notification'
     AND mn.source_id IN (
       SELECT n.id FROM public.matrimonial_notifications n
       WHERE n.marriage_id=v_marriage.id AND n.payload->>'decreeId'=v_decree.id::text
     )
   );

 INSERT INTO public.nullity_judicial_review_cases(
  nullity_decree_id,marriage_id,diocese_id,parish_id,
  request_reference,authority_document_reference,review_reason,
  original_state_snapshot,affected_records_snapshot,requested_by
 ) VALUES(
  v_decree.id,v_marriage.id,v_user_diocese,v_decree.parish_id,
  trim(p_request_reference),trim(p_authority_document_reference),trim(p_review_reason),
  jsonb_build_object(
    'decree_status',v_decree.status,'marriage_status',v_marriage.status,
    'decree_number',v_decree.decree_number,'decree_date',v_decree.decree_date
  ),
  jsonb_build_object(
    'notifications',v_notice_count,
    'processed_recipients',v_processed_count,
    'existing_marginal_notes',v_note_count,
    'effects_modified',false
  ),
  auth.uid()
 ) RETURNING id INTO v_case;

 INSERT INTO public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
 ) VALUES(
   auth.uid(),v_decree.parish_id,v_user_diocese,
   'nullity_judicial_review',v_case,'request_review',
   jsonb_build_object(
     'status','pending_review',
     'request_reference',trim(p_request_reference),
     'authority_document_reference',trim(p_authority_document_reference)
   ),
   jsonb_build_object(
     'nullity_decree_id',v_decree.id,
     'marriage_id',v_marriage.id,
     'effects_modified',false,
     'notifications',v_notice_count,
     'processed_recipients',v_processed_count,
     'marginal_notes',v_note_count
   )
 );
 RETURN v_case;
EXCEPTION WHEN unique_violation THEN
 RAISE EXCEPTION 'Ya existe una solicitud de revisión jurídica abierta para esta sentencia'
   USING ERRCODE='23505';
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.request_nullity_judicial_review_v107(uuid,text,text,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_nullity_judicial_review_v107(uuid,text,text,text)
  TO authenticated;

COMMENT ON TABLE public.nullity_judicial_review_cases
 IS 'Expedientes de revisión jurídica de sentencias de nulidad. Solicitar revisión nunca revoca sentencia ni altera partidas o notas.';
COMMENT ON FUNCTION public.request_nullity_judicial_review_v107(uuid,text,text,text)
 IS 'Solo Cancillería de la diócesis registra solicitud con documento de sustento; no ejecuta revocación ni elimina anotaciones.';
