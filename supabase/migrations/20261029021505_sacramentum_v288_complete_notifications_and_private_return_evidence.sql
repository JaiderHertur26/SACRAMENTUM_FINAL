BEGIN;
-- V288: cierre de la correspondencia sacramental de Matrimonio / Confirmación.
-- Ninguna cancelación cuenta como anotación ejecutada; se exige cada persona.
CREATE OR REPLACE FUNCTION public.guard_v277_case_completion()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $fn$
DECLARE expected_count integer;actual_count integer;done_count integer;invalid_count integer;
BEGIN
 IF coalesce(NEW.payload->>'caseVersion','')<>'V277' OR NEW.status<>'processed' THEN RETURN NEW; END IF;
 expected_count:=jsonb_array_length(coalesce(NEW.payload->'sourceParties','[]'::jsonb));
 SELECT count(*),count(*) FILTER(
   WHERE r.status='processed' AND r.note_applied IS TRUE
 ),count(*) FILTER(WHERE r.status='cancelled')
 INTO actual_count,done_count,invalid_count
 FROM public.matrimonial_notification_recipients r
 WHERE r.notification_id=NEW.id;
 SELECT actual_count+count(*),
   done_count+count(*) FILTER (WHERE e.status='returned' AND e.physical_note_certified IS TRUE),
   invalid_count+count(*) FILTER (WHERE e.status<>'returned' OR e.physical_note_certified IS DISTINCT FROM TRUE)
 INTO actual_count,done_count,invalid_count
 FROM public.sacramental_external_returns_v277 e
 WHERE e.notification_id=NEW.id;
 IF expected_count<1 OR actual_count<>expected_count OR done_count<>expected_count OR invalid_count>0 THEN
    NEW.status:='sent';
 END IF;
 RETURN NEW;
END $fn$;

-- Guardar copia digital del acuse devuelto sin hacer público el documento.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('sacramental-return-evidence','sacramental-return-evidence',false,10485760,
 ARRAY['application/pdf','image/png','image/jpeg'])
ON CONFLICT(id) DO NOTHING;
ALTER TABLE public.sacramental_external_returns_v277
 ADD COLUMN IF NOT EXISTS evidence_object_path text;

DROP POLICY IF EXISTS sacramental_evidence_sender_insert_v288 ON storage.objects;
CREATE POLICY sacramental_evidence_sender_insert_v288 ON storage.objects
 FOR INSERT TO authenticated WITH CHECK (
 bucket_id='sacramental-return-evidence'
 AND EXISTS(
  SELECT 1 FROM public.sacramental_external_returns_v277 e
  JOIN public.matrimonial_notifications n ON n.id=e.notification_id
  JOIN public.user_profiles up ON up.parish_id=n.sender_parish_id
  JOIN public.parishes p ON p.id=up.parish_id AND p.diocese_id=up.diocese_id
  WHERE up.auth_user_id=auth.uid() AND up.role='parish'
    AND up.is_active AND upper(coalesce(up.status,''))='ACTIVE'
    AND p.is_operational IS TRUE
    AND e.status<>'returned'
    AND split_part(name,'/',1)=n.sender_parish_id::text
    AND split_part(name,'/',2)=n.id::text
    AND split_part(name,'/',3)=e.id::text
    AND length(split_part(name,'/',4)) BETWEEN 40 AND 60
    AND split_part(name,'/',5)=''
    AND (right(lower(name),4) IN ('.pdf','.png','.jpg') OR right(lower(name),5)='.jpeg')
 )
);
DROP POLICY IF EXISTS sacramental_evidence_sender_read_v288 ON storage.objects;
CREATE POLICY sacramental_evidence_sender_read_v288 ON storage.objects
 FOR SELECT TO authenticated USING (
 bucket_id='sacramental-return-evidence'
 AND EXISTS(
  SELECT 1 FROM public.sacramental_external_returns_v277 e
  JOIN public.matrimonial_notifications n ON n.id=e.notification_id
  JOIN public.user_profiles up ON up.parish_id=n.sender_parish_id
  JOIN public.parishes p ON p.id=up.parish_id AND p.diocese_id=up.diocese_id
  WHERE up.auth_user_id=auth.uid() AND up.role='parish'
   AND up.is_active AND upper(coalesce(up.status,''))='ACTIVE'
   AND p.is_operational
   AND split_part(name,'/',1)=n.sender_parish_id::text
   AND split_part(name,'/',2)=n.id::text
   AND split_part(name,'/',3)=e.id::text
 )
);
CREATE FUNCTION public.record_external_sacramental_return_v288(
 p_delivery_id uuid,p_evidence_reference text,p_returned_at date,
 p_returned_via text,p_confirmed_written boolean,p_evidence_path text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE e public.sacramental_external_returns_v277%rowtype;n public.matrimonial_notifications%rowtype;
 actor_parish uuid;result jsonb;
BEGIN
 SELECT up.parish_id INTO actor_parish FROM public.user_profiles up
 JOIN public.parishes p ON p.id=up.parish_id AND p.diocese_id=up.diocese_id
 WHERE up.auth_user_id=auth.uid() AND up.role='parish' AND up.is_active
 AND upper(coalesce(up.status,''))='ACTIVE' AND p.is_operational LIMIT 1;
 SELECT * INTO e FROM public.sacramental_external_returns_v277 WHERE id=p_delivery_id FOR UPDATE;
 SELECT * INTO n FROM public.matrimonial_notifications WHERE id=e.notification_id;
 IF actor_parish IS NULL OR n.sender_parish_id IS DISTINCT FROM actor_parish
 OR e.status='returned' THEN
  RAISE EXCEPTION 'V288: devolución externa ajena o ya certificada' USING ERRCODE='42501';
 END IF;
 IF nullif(btrim(coalesce(p_evidence_path,'')),'') IS NULL
 OR NOT starts_with(p_evidence_path,actor_parish::text||'/'||n.id::text||'/'||e.id::text||'/')
 OR NOT EXISTS (SELECT 1 FROM storage.objects o
   WHERE o.bucket_id='sacramental-return-evidence' AND o.name=p_evidence_path
   AND o.metadata->>'mimetype' IN ('application/pdf','image/png','image/jpeg'))
 THEN RAISE EXCEPTION 'V288: adjunte documento devuelto válido y privado'; END IF;
 result:=public.record_external_sacramental_return_v277(
   p_delivery_id,p_evidence_reference,p_returned_at,p_returned_via,p_confirmed_written);
 UPDATE public.sacramental_external_returns_v277
 SET evidence_object_path=p_evidence_path WHERE id=p_delivery_id;
 RETURN result||jsonb_build_object('evidenceFilePath',p_evidence_path);
END $fn$;
REVOKE ALL ON FUNCTION public.record_external_sacramental_return_v288(uuid,text,date,text,boolean,text)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_external_sacramental_return_v288(uuid,text,date,text,boolean,text)
 TO authenticated;
CREATE FUNCTION public.list_external_sacramental_returns_v288()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a uuid;result jsonb;
BEGIN
 SELECT up.parish_id INTO a FROM public.user_profiles up
 JOIN public.parishes p ON p.id=up.parish_id AND p.diocese_id=up.diocese_id
 WHERE up.auth_user_id=auth.uid() AND up.role='parish' AND up.is_active
 AND upper(coalesce(up.status,''))='ACTIVE' AND p.is_operational LIMIT 1;
 IF a IS NULL THEN RAISE EXCEPTION 'V288: sesión parroquial inválida' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',e.id,'notificationId',e.notification_id,'partyRole',e.party_role,
  'personName',e.person_name,'destinationParish',e.destination_parish,
  'destinationDiocese',e.destination_diocese,'deliveryReference',e.delivery_reference,
  'status',e.status,'returnedAt',e.returned_at,'returnedVia',e.returned_via,
  'evidenceReference',e.evidence_reference,'returnEvidenceVerified',e.physical_note_certified,
  'evidenceFilePath',e.evidence_object_path,'verifiedAt',e.verified_at)
  ORDER BY e.created_at DESC),'[]'::jsonb) INTO result
 FROM public.sacramental_external_returns_v277 e
 JOIN public.matrimonial_notifications n ON n.id=e.notification_id
 WHERE n.sender_parish_id=a;
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION public.list_external_sacramental_returns_v288() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_external_sacramental_returns_v288() TO authenticated;
COMMIT;
