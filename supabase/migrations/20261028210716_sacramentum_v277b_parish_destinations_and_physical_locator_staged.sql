BEGIN;
-- V277B — Catálogo mínimo interdiocesano y resolución de localización física.
-- Sin concesión inicial de EXECUTE; sujeto al corte de permisos institucional.
CREATE FUNCTION public.list_sacramental_parish_destinations_v277()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_parish uuid; v_rows jsonb;
BEGIN
 SELECT up.parish_id INTO v_parish
 FROM public.user_profiles up JOIN public.parishes p ON p.id=up.parish_id
   AND p.diocese_id=up.diocese_id
 WHERE up.auth_user_id=auth.uid() AND up.role='parish' AND up.is_active IS TRUE
   AND upper(coalesce(up.status,''))='ACTIVE' AND p.is_operational IS TRUE
 ORDER BY up.id LIMIT 1;
 IF v_parish IS NULL THEN RAISE EXCEPTION 'V277: requiere parroquia con identidad verificada' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,
   'name',p.name,'dioceseName',d.name,'dioceseId',p.diocese_id)
   ORDER BY d.name,p.name), '[]'::jsonb) INTO v_rows
 FROM public.parishes p JOIN public.dioceses d ON d.id=p.diocese_id
 WHERE p.is_operational IS TRUE AND length(btrim(coalesce(p.name,'')))>2;
 RETURN v_rows;
END $fn$;
REVOKE ALL ON FUNCTION public.list_sacramental_parish_destinations_v277() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.update_sacramental_physical_locator_v277(
 p_recipient_id uuid,p_book text,p_folio text,p_number text,p_reference text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_parish uuid;v_row public.matrimonial_notification_recipients%rowtype;
 v_doc public.matrimonial_notifications%rowtype;v_matches integer;
 v_locator jsonb;
BEGIN
 SELECT up.parish_id INTO v_parish
 FROM public.user_profiles up JOIN public.parishes p
   ON p.id=up.parish_id AND p.diocese_id=up.diocese_id
 WHERE up.auth_user_id=auth.uid() AND up.role='parish' AND up.is_active
   AND upper(coalesce(up.status,''))='ACTIVE' AND p.is_operational
 ORDER BY up.id LIMIT 1;
 IF v_parish IS NULL THEN RAISE EXCEPTION 'V277: destinatario parroquial válido obligatorio' USING ERRCODE='42501'; END IF;
 IF p_recipient_id IS NULL OR length(btrim(coalesce(p_book,''))) NOT BETWEEN 1 AND 32
 OR length(btrim(coalesce(p_folio,''))) NOT BETWEEN 1 AND 30
 OR length(btrim(coalesce(p_number,''))) NOT BETWEEN 1 AND 30
 OR length(btrim(coalesce(p_reference,''))) NOT BETWEEN 8 AND 240 THEN
   RAISE EXCEPTION 'V277: coordenadas de Bautismo y referencia documental obligatorias';
 END IF;
 v_locator:=jsonb_build_object('book',btrim(p_book),'folio',btrim(p_folio),'number',btrim(p_number));
 SELECT * INTO v_row FROM public.matrimonial_notification_recipients
 WHERE id=p_recipient_id FOR UPDATE;
 IF NOT FOUND OR v_row.receiver_parish_id IS DISTINCT FROM v_parish
    OR v_row.status NOT IN ('pending','read')
    OR v_row.target_baptism_id IS NOT NULL
    OR v_row.payload->>'caseVersion' IS DISTINCT FROM 'V277' THEN
   RAISE EXCEPTION 'V277: aviso ajeno, cerrado o ya vinculado digitalmente' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_doc FROM public.matrimonial_notifications
   WHERE id=v_row.notification_id FOR SHARE;
 IF NOT FOUND OR lower(coalesce(v_doc.status,'sent')) IN ('cancelled','reversed','archived') THEN
   RAISE EXCEPTION 'V277: documento de origen no vigente';
 END IF;
 SELECT count(*) INTO v_matches FROM public.baptisms b
 WHERE b.parish_id=v_parish
   AND public.sacramentum_registry_ref(b.book_number)=public.sacramentum_registry_ref(p_book)
   AND public.sacramentum_registry_ref(b.folio)=public.sacramentum_registry_ref(p_folio)
   AND public.sacramentum_registry_ref(b.number)=public.sacramentum_registry_ref(p_number)
   AND lower(coalesce(b.status,'seated')) NOT IN ('anulada','annulled','deleted','reversed','cancelled','replaced');
 IF v_matches>0 THEN
   RAISE EXCEPTION 'V277: existe partida digital con esas coordenadas; vincúlela antes de aceptar';
 END IF;
 UPDATE public.matrimonial_notification_recipients
 SET payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object(
   'manualLocator',v_locator,'searchReference',btrim(p_reference),
   'referenceResolution','physical_book_verified_by_destination',
   'locatorConfirmedBy',auth.uid(),'locatorConfirmedAt',clock_timestamp())
 WHERE id=p_recipient_id;
 INSERT INTO public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
 VALUES(auth.uid(),v_parish,
 (SELECT diocese_id FROM public.parishes WHERE id=v_parish),
 'sacramental_notification_recipient',p_recipient_id,'update_physical_locator_v277',
 jsonb_build_object('book',btrim(p_book),'folio',btrim(p_folio),'number',btrim(p_number)),
 jsonb_build_object('source','destination_parish_physical_review','reference',btrim(p_reference)));
 RETURN jsonb_build_object('recipient_id',p_recipient_id,'locator_ready',true);
END $fn$;
REVOKE ALL ON FUNCTION public.update_sacramental_physical_locator_v277(uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
COMMIT;
