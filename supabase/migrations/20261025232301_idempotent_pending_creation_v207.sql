-- V207: one durable receipt per creation attempt, scoped to the owning parish and sacrament.
CREATE TABLE public.pending_creation_requests (
  parish_id uuid NOT NULL REFERENCES public.parishes(id),
  sacrament_type text NOT NULL CHECK (sacrament_type IN ('bautismo','confirmacion','matrimonio','exequias')),
  request_id uuid NOT NULL,
  payload_hash text NOT NULL,
  response jsonb NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (parish_id,sacrament_type,request_id)
);
ALTER TABLE public.pending_creation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pending_creation_requests FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.pending_creation_requests IS 'Private creation receipts; deny all direct client access. Read/write only through parish-authorized create_pending_registration_v207.';

CREATE FUNCTION public.create_pending_registration_v207(
  p_kind text, p_request_id uuid, p_parish_id uuid, p_record jsonb,
  p_confirmation_record jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  actor uuid := auth.uid();
  fingerprint text;
  receipt public.pending_creation_requests%ROWTYPE;
  result record;
  answer jsonb;
BEGIN
  IF actor IS NULL OR p_request_id IS NULL OR p_parish_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Sesión parroquial y solicitud identificada obligatorias';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles up JOIN public.parishes p
      ON p.id=up.parish_id AND p.diocese_id=up.diocese_id
    WHERE up.auth_user_id=actor AND up.role='parish'
      AND up.is_active IS TRUE AND upper(up.status)='ACTIVE'
      AND up.parish_id=p_parish_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Solo la parroquia propietaria activa puede reservar esta boleta';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('bautismo','confirmacion','matrimonio','exequias')
    OR p_record IS NULL OR jsonb_typeof(p_record)<>'object'
    OR (p_kind<>'bautismo' AND p_confirmation_record IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Solicitud de reserva inválida';
  END IF;
  fingerprint := md5(jsonb_build_object('record',p_record,'confirmation',p_confirmation_record)::text);
  -- Acquired before the existing RPC takes parish_parameters; serializes only this attempt.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_parish_id::text||':'||p_kind||':'||p_request_id::text,207));
  SELECT * INTO receipt FROM public.pending_creation_requests
    WHERE parish_id=p_parish_id AND sacrament_type=p_kind AND request_id=p_request_id;
  IF FOUND THEN
    IF receipt.payload_hash IS DISTINCT FROM fingerprint THEN
      RAISE EXCEPTION USING ERRCODE='22023',
        MESSAGE='Esta solicitud ya fue guardada con otros datos. Consulte las boletas antes de iniciar otra inscripción.';
    END IF;
    RETURN receipt.response;
  END IF;
  CASE p_kind
    WHEN 'bautismo' THEN
      SELECT * INTO STRICT result FROM public.create_pending_baptism_with_confirmation_flow(p_parish_id,p_record,p_confirmation_record);
    WHEN 'confirmacion' THEN
      SELECT * INTO STRICT result FROM public.create_pending_confirmation(p_parish_id,p_record);
    WHEN 'matrimonio' THEN
      SELECT * INTO STRICT result FROM public.create_pending_marriage(p_parish_id,p_record);
    WHEN 'exequias' THEN
      SELECT * INTO STRICT result FROM public.create_pending_funeral(p_parish_id,p_record);
  END CASE;
  answer := to_jsonb(result);
  INSERT INTO public.pending_creation_requests(parish_id,sacrament_type,request_id,payload_hash,response,created_by)
    VALUES(p_parish_id,p_kind,p_request_id,fingerprint,answer,actor);
  RETURN answer;
END;
$function$;
REVOKE ALL ON FUNCTION public.create_pending_registration_v207(text,uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_pending_registration_v207(text,uuid,uuid,jsonb,jsonb) TO authenticated;
