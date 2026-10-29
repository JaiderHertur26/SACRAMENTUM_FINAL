BEGIN;
-- V289: documento íntegro de correspondencia para emisor y parroquias
-- destinatarias, sin exponer documentos externos adjuntos a terceros.
CREATE FUNCTION public.get_sacramental_case_document_v289(p_notification_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE n public.matrimonial_notifications%rowtype; recipients jsonb;
 externals jsonb; actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL OR p_notification_id IS NULL OR
 NOT public.can_read_matrimonial_notification(p_notification_id) THEN
   RAISE EXCEPTION 'V289: expediente ajeno o sesión no autorizada' USING ERRCODE='42501';
 END IF;
 SELECT * INTO n FROM public.matrimonial_notifications WHERE id=p_notification_id;
 IF NOT FOUND OR n.payload->>'caseVersion'<>'V277' THEN
   RAISE EXCEPTION 'V289: no es correspondencia sacramental V277';
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',r.id,'partyRole',r.payload->>'partyRole',
  'receiverParishId',r.receiver_parish_id,
  'receiverParishName',r.payload->>'receiverParishName',
  'targetBaptismId',r.target_baptism_id,
  'status',r.status,'noteApplied',r.note_applied,
  'physicalNoteCertified',coalesce((r.payload->>'physicalNoteCertified')::boolean,false),
  'receiptDocumentNumber',r.receipt_document_number,
  'acceptedAt',r.processed_at,'payload',r.payload)
  ORDER BY r.created_at),'[]'::jsonb) INTO recipients
 FROM public.matrimonial_notification_recipients r
 WHERE r.notification_id=p_notification_id;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',e.id,'notificationId',e.notification_id,
  'partyRole',e.party_role,'status',e.status,
  'destinationParish',e.destination_parish,
  'destinationDiocese',e.destination_diocese,
  'returnedAt',e.returned_at,'returnedVia',e.returned_via,
  'evidenceReference',e.evidence_reference,
  'evidenceFilePath',CASE WHEN e.evidence_object_path IS NULL THEN NULL ELSE 'VERIFIED_PRIVATE_FILE' END,
  'returnEvidenceVerified',e.physical_note_certified)
  ORDER BY e.created_at),'[]'::jsonb) INTO externals
 FROM public.sacramental_external_returns_v277 e
 WHERE e.notification_id=p_notification_id;
 RETURN n.payload||jsonb_build_object(
  'id',n.id,'parishId',n.sender_parish_id,
  'status',n.status,'notificationType',n.notification_type,
  'documentNumber',n.document_number,'personName',n.person_name,
  'spouseName',n.spouse_name,'recipientTracking',recipients,
  'externals',externals,'sourceParties',coalesce(n.payload->'sourceParties','[]'::jsonb),
  'closedAt',n.updated_at,'senderParishName',n.payload->>'senderParishName');
END $fn$;
REVOKE ALL ON FUNCTION public.get_sacramental_case_document_v289(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_sacramental_case_document_v289(uuid) TO authenticated;
COMMIT;
