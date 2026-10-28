BEGIN;
-- SACRAMENTUM V277: preparación de la correspondencia de Matrimonio y Confirmación.
-- NO se concede EXECUTE a usuarios: activación únicamente tras corte oficial.
-- La parroquia fuera de SACRAMENTUM no obtiene usuario ni se inventa un registro.
CREATE TABLE IF NOT EXISTS public.sacramental_external_returns_v277 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.matrimonial_notifications(id) ON DELETE RESTRICT,
  party_role text NOT NULL CHECK (party_role IN ('principal','conyuge','confirmando')),
  person_name text NOT NULL CHECK (length(btrim(person_name)) BETWEEN 4 AND 240),
  destination_parish text NOT NULL CHECK (length(btrim(destination_parish)) BETWEEN 3 AND 250),
  destination_diocese text NOT NULL CHECK (length(btrim(destination_diocese)) BETWEEN 3 AND 250),
  delivery_reference text NOT NULL CHECK (length(btrim(delivery_reference)) BETWEEN 4 AND 240),
  sent_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  status text NOT NULL DEFAULT 'awaiting_return' CHECK (status IN ('awaiting_return','returned')),
  returned_at timestamptz,
  returned_via text,
  evidence_reference text,
  physical_note_certified boolean NOT NULL DEFAULT false,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_v277_one_external_per_party UNIQUE(notification_id,party_role),
  CONSTRAINT ck_v277_verified_external_return CHECK (
    (status='awaiting_return' AND verified_at IS NULL AND verified_by IS NULL AND returned_at IS NULL AND evidence_reference IS NULL AND NOT physical_note_certified)
    OR (status='returned' AND returned_at IS NOT NULL AND verified_at IS NOT NULL
      AND verified_by IS NOT NULL AND physical_note_certified
      AND length(btrim(coalesce(evidence_reference,''))) BETWEEN 8 AND 240
      AND length(btrim(coalesce(returned_via,''))) BETWEEN 4 AND 100)
  )
);
CREATE INDEX IF NOT EXISTS idx_v277_external_notification ON public.sacramental_external_returns_v277(notification_id,status);
ALTER TABLE public.sacramental_external_returns_v277 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sacramental_external_returns_v277 FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.issue_sacramental_case_v277(
 p_sacrament text,p_source_record_id uuid,p_parties jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_sender uuid;v_diocese uuid;v_sender_name text;v_actor uuid:=auth.uid();
 v_source jsonb;v_date date;v_book text;v_folio text;v_number text;
 v_note text;v_type text;v_n integer;v_party jsonb;v_idx integer;
 v_role text;v_expected_role text;v_name text;v_other_name text;
 v_receiver uuid;v_receiver_name text;v_baptism uuid;v_baptism_row public.baptisms%rowtype;
 v_locator jsonb;v_search text;v_ext_name text;v_ext_diocese text;v_delivery text;
 v_note_text text;v_document uuid;v_seq bigint;v_document_number text;v_recipient uuid;
 v_local_ids uuid[]:=array[]::uuid[];v_receiver_count integer:=0;v_external_count integer:=0;v_local_count integer:=0;
 v_seen_baptisms uuid[]:=array[]::uuid[];v_party_summaries jsonb:='[]'::jsonb;
BEGIN
 IF v_actor IS NULL OR p_source_record_id IS NULL
   OR p_sacrament NOT IN ('matrimonio','confirmacion')
   OR jsonb_typeof(p_parties) IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'V277: sesión, origen y personas del sacramento obligatorios' USING ERRCODE='22023';
 END IF;
 v_n:=jsonb_array_length(p_parties);
 IF v_n IS DISTINCT FROM (CASE WHEN p_sacrament='matrimonio' THEN 2 ELSE 1 END) THEN
   RAISE EXCEPTION 'V277: una persona en Confirmación y dos en Matrimonio';
 END IF;
 SELECT up.parish_id,up.diocese_id,p.name INTO v_sender,v_diocese,v_sender_name
 FROM public.user_profiles up JOIN public.parishes p ON p.id=up.parish_id
 WHERE up.auth_user_id=v_actor AND up.role='parish' AND up.is_active IS TRUE
   AND upper(coalesce(up.status,''))='ACTIVE' AND p.diocese_id=up.diocese_id
   AND p.is_operational IS TRUE
 ORDER BY up.id LIMIT 1;
 IF v_sender IS NULL THEN
   RAISE EXCEPTION 'V277: solo una parroquia auténtica y operativa puede emitir' USING ERRCODE='42501';
 END IF;
 IF p_sacrament='matrimonio' THEN
   SELECT to_jsonb(m),m.celebration_date,m.book_number,m.folio,m.number
     INTO v_source,v_date,v_book,v_folio,v_number FROM public.marriages m
   WHERE m.id=p_source_record_id AND m.parish_id=v_sender
     AND lower(coalesce(m.status,'seated')) NOT IN ('anulada','annulled','deleted','reversed','cancelled')
   FOR SHARE;
 ELSE
   SELECT to_jsonb(c),c.celebration_date,c.book_number,c.folio,c.number
     INTO v_source,v_date,v_book,v_folio,v_number FROM public.confirmations c
   WHERE c.id=p_source_record_id AND c.parish_id=v_sender
     AND lower(coalesce(c.status,'seated')) NOT IN ('anulada','annulled','deleted','reversed','cancelled')
   FOR SHARE;
 END IF;
 IF v_source IS NULL OR v_date IS NULL OR v_date>current_date
   OR nullif(btrim(coalesce(v_book,'')),'') IS NULL
   OR nullif(btrim(coalesce(v_folio,'')),'') IS NULL
   OR nullif(btrim(coalesce(v_number,'')),'') IS NULL THEN
   RAISE EXCEPTION 'V277: el sacramento de origen debe estar asentado, vigente y con Libro/Folio/Número';
 END IF;
 IF EXISTS (
   SELECT 1 FROM public.matrimonial_notifications n
   WHERE n.sender_parish_id=v_sender AND n.notification_type=p_sacrament
   AND n.payload->>'caseVersion'='V277' AND n.payload->>'sourceRecordId'=p_source_record_id::text
   AND lower(coalesce(n.status,'sent')) <> 'cancelled'
 ) THEN RAISE EXCEPTION 'V277: ya existe correspondencia activa de este sacramento'; END IF;

 -- Separación de funciones: dos bautizados = dos comprobaciones y dos acuses.
 FOR v_idx IN 0..v_n-1 LOOP
   v_party:=p_parties->v_idx;
   v_role:=v_party->>'role';
   v_expected_role:=CASE WHEN p_sacrament='confirmacion' THEN 'confirmando'
                 WHEN v_idx=0 THEN 'principal' ELSE 'conyuge' END;
   v_name:=btrim(coalesce(v_party->>'name',''));
   IF v_role IS DISTINCT FROM v_expected_role OR length(v_name) NOT BETWEEN 4 AND 240 THEN
     RAISE EXCEPTION 'V277: orden, función o identidad de persona inválidos';
   END IF;
   IF p_sacrament='matrimonio' THEN
     DECLARE
       v_raw jsonb:=coalesce(v_source->'raw_data','{}'::jsonb);
       v_original_name text;
     BEGIN
       v_original_name:=CASE WHEN v_idx=0 THEN
         btrim(concat_ws(' ',coalesce(nullif(v_raw->>'novioNombres',''),v_raw->>'nombr1'),
           coalesce(nullif(v_raw->>'novioApellidos',''),v_raw->>'apell1')))
       ELSE
         btrim(concat_ws(' ',coalesce(nullif(v_raw->>'noviaNombres',''),v_raw->>'nombr2'),
           coalesce(nullif(v_raw->>'noviaApellidos',''),v_raw->>'apell2')))
       END;
       IF length(v_original_name)<4 OR
          lower(regexp_replace(v_name,'[[:space:]]+','','g')) <>
          lower(regexp_replace(v_original_name,'[[:space:]]+','','g')) THEN
         RAISE EXCEPTION 'V277: nombres de contrayentes deben coincidir con la partida matrimonial de origen';
       END IF;
     END;
   END IF;
   IF p_sacrament='confirmacion' AND
     lower(regexp_replace(v_name,'[[:space:]]+','','g')) <>
     lower(regexp_replace(btrim(concat_ws(' ',v_source->>'nombres',v_source->>'apellidos')),'[[:space:]]+','','g')) THEN
     RAISE EXCEPTION 'V277: la persona no coincide con la Confirmación de origen';
   END IF;
   v_receiver:=NULL;v_baptism:=NULL;v_receiver_name:=NULL;
   v_ext_name:=nullif(btrim(coalesce(v_party->>'externalParishName','')),'');
   v_ext_diocese:=nullif(btrim(coalesce(v_party->>'externalDioceseName','')),'');
   v_delivery:=nullif(btrim(coalesce(v_party->>'deliveryReference','')),'');
   v_search:=nullif(btrim(coalesce(v_party->>'searchReference','')),'');
   v_locator:=coalesce(v_party->'locator','{}'::jsonb);
   IF v_party->>'parishId' IS NOT NULL THEN
     IF (v_party->>'parishId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
       RAISE EXCEPTION 'V277: parroquia destinataria inválida';
     END IF;
     v_receiver:=(v_party->>'parishId')::uuid;
     SELECT p.name INTO v_receiver_name FROM public.parishes p
       WHERE p.id=v_receiver AND p.is_operational IS TRUE;
     IF v_receiver_name IS NULL OR v_ext_name IS NOT NULL OR v_ext_diocese IS NOT NULL THEN
       RAISE EXCEPTION 'V277: destino del sistema no disponible o mezclado con destino externo';
     END IF;
     IF nullif(v_party->>'baptismId','') IS NOT NULL THEN
       IF (v_party->>'baptismId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
         RAISE EXCEPTION 'V277: UUID de Bautismo inválido';
       END IF;
       v_baptism:=(v_party->>'baptismId')::uuid;
       IF v_baptism=ANY(v_seen_baptisms) THEN
         RAISE EXCEPTION 'V277: dos personas no pueden compartir una misma partida';
       END IF;
       SELECT * INTO v_baptism_row FROM public.baptisms b
         WHERE b.id=v_baptism AND b.parish_id=v_receiver
         AND lower(coalesce(b.status,'seated')) NOT IN ('anulada','annulled','deleted','reversed','cancelled','replaced');
       IF NOT FOUND OR
           lower(regexp_replace(v_name,'[[:space:]]+','','g')) <>
           lower(regexp_replace(btrim(concat_ws(' ',v_baptism_row.nombres,v_baptism_row.apellidos)),'[[:space:]]+','','g')) THEN
         RAISE EXCEPTION 'V277: la partida no pertenece a la parroquia ni coincide con la identidad';
       END IF;
       v_seen_baptisms:=array_append(v_seen_baptisms,v_baptism);
     ELSE
       IF (nullif(btrim(coalesce(v_locator->>'book','')),'') IS NULL
          OR nullif(btrim(coalesce(v_locator->>'folio','')),'') IS NULL
          OR nullif(btrim(coalesce(v_locator->>'number','')),'') IS NULL)
          AND length(coalesce(v_search,''))<8 THEN
         RAISE EXCEPTION 'V277: libro físico no identificado; indique coordenadas o referencia de búsqueda';
       END IF;
     END IF;
   ELSE
     IF v_ext_name IS NULL OR v_ext_diocese IS NULL
        OR length(coalesce(v_delivery,''))<4 OR v_party->>'baptismId' IS NOT NULL THEN
       RAISE EXCEPTION 'V277: nombre, diócesis y medio externo obligatorios';
     END IF;
   END IF;
 END LOOP;

 SELECT sequence_value,document_number INTO v_seq,v_document_number
 FROM public.next_document_sequence(v_sender,
   CASE WHEN p_sacrament='matrimonio' THEN 'matrimonial_notification_v277'
        ELSE 'confirmation_notification_v277' END,
   CASE WHEN p_sacrament='matrimonio' THEN 'NM' ELSE 'NCF' END);
 INSERT INTO public.matrimonial_notifications(
   sender_parish_id,diocese_id,marriage_id,consecutive,document_number,
   person_name,spouse_name,marriage_date,marriage_book,marriage_folio,marriage_number,
   marriage_diocese_id,marriage_parish_id,status,notification_type,payload,created_by
 ) VALUES(
   v_sender,v_diocese,CASE WHEN p_sacrament='matrimonio' THEN p_source_record_id ELSE NULL END,
   v_seq,v_document_number,p_parties->0->>'name',
   CASE WHEN p_sacrament='matrimonio' THEN p_parties->1->>'name' ELSE NULL END,
   CASE WHEN p_sacrament='matrimonio' THEN v_date ELSE NULL END,
   CASE WHEN p_sacrament='matrimonio' THEN v_book ELSE NULL END,
   CASE WHEN p_sacrament='matrimonio' THEN v_folio ELSE NULL END,
   CASE WHEN p_sacrament='matrimonio' THEN v_number ELSE NULL END,
   v_diocese,v_sender,'sent',p_sacrament,
   jsonb_build_object('caseVersion','V277','sourceRecordId',p_source_record_id,
     'notificationType',p_sacrament,'senderParishName',v_sender_name,
     'sourceDate',v_date,'sourceBook',v_book,'sourceFolio',v_folio,
     'sourceNumber',v_number,'sourceParties',p_parties,
     'requiresExternalReturn',EXISTS(SELECT 1 FROM jsonb_array_elements(p_parties) a WHERE a->>'parishId' IS NULL)),
   v_actor
 ) RETURNING id INTO v_document;

 FOR v_idx IN 0..v_n-1 LOOP
   v_party:=p_parties->v_idx;v_role:=v_party->>'role';v_name:=btrim(v_party->>'name');
   v_receiver:=nullif(v_party->>'parishId','')::uuid;
   v_baptism:=nullif(v_party->>'baptismId','')::uuid;
   v_locator:=coalesce(v_party->'locator','{}'::jsonb);
   v_other_name:=CASE WHEN p_sacrament='matrimonio' THEN p_parties->(1-v_idx)->>'name' ELSE '' END;
   IF p_sacrament='matrimonio' THEN
     v_note_text:='CONTRAJO MATRIMONIO CON '||upper(v_other_name)||' EL '||
       to_char(v_date,'DD/MM/YYYY')||' EN '||upper(v_sender_name)||
       '. LIBRO '||v_book||', FOLIO '||v_folio||', NÚMERO '||v_number||'.';
   ELSE
     v_note_text:='RECIBIÓ LA CONFIRMACIÓN EL '||to_char(v_date,'DD/MM/YYYY')||
       ' EN '||upper(v_sender_name)||'. LIBRO '||v_book||
       ', FOLIO '||v_folio||', NÚMERO '||v_number||'.';
   END IF;
   IF v_receiver IS NULL THEN
     INSERT INTO public.sacramental_external_returns_v277(
       notification_id,party_role,person_name,destination_parish,destination_diocese,delivery_reference
     ) VALUES(v_document,v_role,v_name,btrim(v_party->>'externalParishName'),
       btrim(v_party->>'externalDioceseName'),btrim(v_party->>'deliveryReference'));
     v_external_count:=v_external_count+1;
   ELSE
     SELECT p.name INTO v_receiver_name FROM public.parishes p WHERE p.id=v_receiver;
     INSERT INTO public.matrimonial_notification_recipients(
       notification_id,receiver_parish_id,target_baptism_id,status,note_applied,payload
     ) VALUES (
       v_document,v_receiver,v_baptism,'pending',false,
       jsonb_build_object('caseVersion','V277','partyRole',v_role,'personName',v_name,
         'receiverParishName',v_receiver_name,'marginalNote',v_note_text,
         'manualLocator',CASE WHEN v_baptism IS NULL THEN v_locator ELSE NULL END,
         'searchReference',v_party->>'searchReference',
         'referenceResolution',CASE WHEN v_baptism IS NULL THEN 'pending_physical_review' ELSE 'exact_baptism_id' END)
     ) RETURNING id INTO v_recipient;
     v_receiver_count:=v_receiver_count+1;
     IF v_receiver=v_sender AND v_baptism IS NOT NULL THEN
       v_local_ids:=array_append(v_local_ids,v_recipient);
     END IF;
   END IF;
   v_party_summaries:=v_party_summaries||jsonb_build_array(jsonb_build_object(
     'role',v_role,'name',v_name,'receiverParishId',v_receiver,
     'external',v_receiver IS NULL,'local',v_receiver=v_sender,
     'baptismLinked',v_baptism IS NOT NULL));
 END LOOP;
 -- Todos los destinos deben existir antes de procesar las notas locales.
 FOREACH v_recipient IN ARRAY v_local_ids LOOP
   PERFORM public.process_matrimonial_notification_recipient(v_recipient);
   v_local_count:=v_local_count+1;
 END LOOP;
 IF v_receiver_count=v_local_count AND v_external_count=0 THEN
   UPDATE public.matrimonial_notifications SET status='processed' WHERE id=v_document;
 END IF;
 INSERT INTO public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
 VALUES(v_actor,v_sender,v_diocese,'sacramental_notification',v_document,'issue_case_v277',
   jsonb_build_object('notification',v_document_number,'sacrament',p_sacrament),
   jsonb_build_object('internal',v_receiver_count,'external',v_external_count,'localApplied',v_local_count));
 RETURN jsonb_build_object('notification_id',v_document,'document_number',v_document_number,
   'internal',v_receiver_count,'external',v_external_count,'localApplied',v_local_count,
   'parties',v_party_summaries,'complete',(v_receiver_count=v_local_count AND v_external_count=0));
END $fn$;
REVOKE ALL ON FUNCTION public.issue_sacramental_case_v277(text,uuid,jsonb) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.list_external_sacramental_returns_v277()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_parish uuid;v_result jsonb;
BEGIN
 SELECT up.parish_id INTO v_parish FROM public.user_profiles up
 JOIN public.parishes p ON p.id=up.parish_id AND p.diocese_id=up.diocese_id
 WHERE up.auth_user_id=auth.uid() AND up.role='parish' AND up.is_active
 AND upper(coalesce(up.status,''))='ACTIVE' AND p.is_operational IS TRUE
 ORDER BY up.id LIMIT 1;
 IF v_parish IS NULL THEN RAISE EXCEPTION 'V277: sesión parroquial verificada requerida' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id',e.id,'notificationId',e.notification_id,'partyRole',e.party_role,
   'personName',e.person_name,'destinationParish',e.destination_parish,
   'destinationDiocese',e.destination_diocese,'deliveryReference',e.delivery_reference,
   'status',e.status,'returnedAt',e.returned_at,'returnedVia',e.returned_via,
   'evidenceReference',e.evidence_reference,'returnEvidenceVerified',e.physical_note_certified,
   'verifiedAt',e.verified_at) ORDER BY e.created_at DESC), '[]'::jsonb)
 INTO v_result FROM public.sacramental_external_returns_v277 e
 JOIN public.matrimonial_notifications n ON n.id=e.notification_id
 WHERE n.sender_parish_id=v_parish;
 RETURN v_result;
END $fn$;
REVOKE ALL ON FUNCTION public.list_external_sacramental_returns_v277() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.record_external_sacramental_return_v277(
 p_delivery_id uuid,p_evidence_reference text,p_returned_at date,
 p_returned_via text,p_confirmed_written boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_parish uuid;v_diocese uuid;v_row public.sacramental_external_returns_v277%rowtype;
 v_doc public.matrimonial_notifications%rowtype;v_pending integer;
BEGIN
 SELECT up.parish_id,up.diocese_id INTO v_parish,v_diocese FROM public.user_profiles up
 JOIN public.parishes p ON p.id=up.parish_id AND p.diocese_id=up.diocese_id
 WHERE up.auth_user_id=auth.uid() AND up.role='parish'
 AND up.is_active AND upper(coalesce(up.status,''))='ACTIVE' AND p.is_operational
 ORDER BY up.id LIMIT 1;
 IF v_parish IS NULL THEN RAISE EXCEPTION 'Solo parroquia emisora verificada' USING ERRCODE='42501'; END IF;
 IF length(btrim(coalesce(p_evidence_reference,''))) NOT BETWEEN 8 AND 240
 OR length(btrim(coalesce(p_returned_via,''))) NOT BETWEEN 4 AND 100
 OR p_returned_at IS NULL OR p_returned_at>current_date
 OR p_confirmed_written IS DISTINCT FROM TRUE THEN
   RAISE EXCEPTION 'V277: devolución documental y asiento físico certificado son obligatorios';
 END IF;
 SELECT * INTO v_row FROM public.sacramental_external_returns_v277 WHERE id=p_delivery_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'V277: solicitud externa inexistente'; END IF;
 SELECT * INTO v_doc FROM public.matrimonial_notifications WHERE id=v_row.notification_id FOR UPDATE;
 IF NOT FOUND OR v_doc.sender_parish_id IS DISTINCT FROM v_parish
 OR lower(coalesce(v_doc.status,'sent')) IN ('cancelled','reversed','archived') THEN
   RAISE EXCEPTION 'V277: documento externo ajeno, cancelado o archivado' USING ERRCODE='42501';
 END IF;
 IF v_row.status='returned' THEN RAISE EXCEPTION 'V277: esta devolución ya se certificó'; END IF;
 UPDATE public.sacramental_external_returns_v277 SET
   status='returned',returned_at=p_returned_at::timestamptz,returned_via=btrim(p_returned_via),
   evidence_reference=btrim(p_evidence_reference),
   physical_note_certified=true,verified_by=auth.uid(),verified_at=clock_timestamp()
 WHERE id=v_row.id;
 SELECT count(*) INTO v_pending FROM (
   SELECT id FROM public.matrimonial_notification_recipients r
     WHERE r.notification_id=v_doc.id AND r.status<>'processed' AND r.status<>'cancelled'
   UNION ALL SELECT id FROM public.sacramental_external_returns_v277 e
     WHERE e.notification_id=v_doc.id AND e.status<>'returned'
 ) s;
 IF v_pending=0 THEN
   UPDATE public.matrimonial_notifications SET status='processed' WHERE id=v_doc.id;
 END IF;
 INSERT INTO public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,
 action,after_data,metadata) VALUES(auth.uid(),v_parish,v_diocese,
 'sacramental_external_delivery',v_row.id,'record_external_return_v277',
 jsonb_build_object('returned_at',p_returned_at,'evidence_reference',btrim(p_evidence_reference),
   'returned_via',btrim(p_returned_via),'note_certified',true),
 jsonb_build_object('notification_id',v_doc.id,'document_number',v_doc.document_number,'pending',v_pending));
 RETURN jsonb_build_object('notification_id',v_doc.id,'delivery_id',v_row.id,
    'evidence_verified',true,'document_complete',v_pending=0,'pending',v_pending);
END $fn$;
REVOKE ALL ON FUNCTION public.record_external_sacramental_return_v277(uuid,text,date,text,boolean) FROM PUBLIC,anon,authenticated;

-- Nunca se marca completo un expediente con devoluciones o parroquias pendientes.
CREATE FUNCTION public.guard_v277_case_completion()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN
 IF coalesce(new.payload->>'caseVersion','')<>'V277' THEN RETURN NEW; END IF;
 IF new.status='processed' AND (
   EXISTS(SELECT 1 FROM public.matrimonial_notification_recipients r
     WHERE r.notification_id=new.id AND r.status NOT IN ('processed','cancelled'))
   OR EXISTS(SELECT 1 FROM public.sacramental_external_returns_v277 e
     WHERE e.notification_id=new.id AND e.status<>'returned')
 ) THEN NEW.status:='sent'; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER trg_guard_v277_case_completion BEFORE UPDATE OF status
 ON public.matrimonial_notifications FOR EACH ROW
 EXECUTE FUNCTION public.guard_v277_case_completion();
REVOKE ALL ON FUNCTION public.guard_v277_case_completion() FROM PUBLIC,anon,authenticated;
COMMIT;
