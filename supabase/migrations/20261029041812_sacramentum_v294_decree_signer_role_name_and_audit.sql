BEGIN;
-- V294: elector de autoridad que da fe y persistencia inmutable por decreto.
-- Todos los nombres provienen del directorio institucional, no del cliente.
CREATE FUNCTION public.list_chancery_decree_signers_v294()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE di uuid;ch uuid;cn text;vn text;
BEGIN
 SELECT up.diocese_id,up.chancery_id INTO di,ch
 FROM public.user_profiles up WHERE up.auth_user_id=auth.uid()
 AND up.role='chancery' AND up.is_active IS TRUE
 AND upper(coalesce(up.status,''))='ACTIVE'
 LIMIT 1;
 IF di IS NULL THEN RAISE EXCEPTION 'V294: sesión de Cancillería inválida' USING ERRCODE='42501';END IF;
 SELECT nullif(btrim(c.chancellor_name),''),
        nullif(btrim(c.vice_chancellor_name),'') INTO cn,vn
 FROM public.chancelleries c WHERE c.diocese_id=di
 AND (ch IS NULL OR c.id=ch) ORDER BY c.id LIMIT 1;
 IF cn IS NULL AND vn IS NULL THEN
   RAISE EXCEPTION 'V294: registre Canciller o Vicecanciller en los datos institucionales';
 END IF;
 RETURN jsonb_build_object('canciller',cn,'viceCanciller',vn);
END $fn$;
REVOKE ALL ON FUNCTION public.list_chancery_decree_signers_v294() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_chancery_decree_signers_v294() TO authenticated;

CREATE FUNCTION public.issue_chancery_form_decree_v294(
 p_parish_id uuid,p_sacrament text,p_decree_type text,
 p_original_record_id uuid,p_concept_id uuid,
 p_decree_number text,p_decree_date date,p_target_name text,
 p_reason text,p_evidence_ref text,p_new_record jsonb,p_details jsonb,
 p_signer_office text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE actor uuid:=auth.uid();di uuid;ch uuid;chosen_name text;
 signer_title text;result jsonb; decree uuid;
BEGIN
 IF p_signer_office NOT IN ('canciller','vice_canciller') THEN
   RAISE EXCEPTION 'V294: seleccione Canciller o Vicecanciller' USING ERRCODE='22023';
 END IF;
 SELECT up.diocese_id,up.chancery_id INTO di,ch
 FROM public.user_profiles up WHERE up.auth_user_id=actor
 AND up.role='chancery' AND up.is_active IS TRUE
 AND upper(coalesce(up.status,''))='ACTIVE' LIMIT 1;
 IF di IS NULL THEN RAISE EXCEPTION 'V294: rol institucional no autorizado' USING ERRCODE='42501'; END IF;
 SELECT CASE WHEN p_signer_office='canciller'
   THEN nullif(btrim(c.chancellor_name),'')
   ELSE nullif(btrim(c.vice_chancellor_name),'') END
 INTO chosen_name FROM public.chancelleries c WHERE c.diocese_id=di
 AND (ch IS NULL OR c.id=ch) ORDER BY c.id LIMIT 1;
 IF chosen_name IS NULL THEN
   RAISE EXCEPTION 'V294: el firmante seleccionado no tiene nombre configurado en Cancillería';
 END IF;
 signer_title:=CASE WHEN p_signer_office='canciller'
   THEN 'CANCILLER' ELSE 'VICECANCILLER' END;
 -- V287 y V280 conservan sus verificaciones previas e insertan decreto y aviso.
 result:=public.issue_chancery_form_decree_v287(
 p_parish_id,p_sacrament,p_decree_type,p_original_record_id,p_concept_id,
 p_decree_number,p_decree_date,p_target_name,p_reason,p_evidence_ref,
 p_new_record,coalesce(p_details,'{}'::jsonb));
 decree:=(result->>'decreeId')::uuid;
 IF decree IS NULL OR result->>'status'<>'awaiting_parish' THEN
   RAISE EXCEPTION 'V294: decreto no expedido, no se puede fijar DA FE';
 END IF;
 UPDATE public.decretos SET payload=payload||jsonb_build_object(
   'issuingSigner',jsonb_build_object('office',p_signer_office,
     'name',upper(chosen_name),'title',signer_title,
     'chosenBy',actor,'registeredAt',clock_timestamp()),
   'decreeDocumentCode','CAL-ODC-022',
   'decreeDocumentVersion','002'
 ) WHERE id=decree AND diocese_id=di AND issued_by=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'V294: no se pudo fijar autoridad que da fe';END IF;
 INSERT INTO public.registry_audit_log(actor_user_id,parish_id,diocese_id,
 entity_type,entity_id,action,after_data,metadata)
 VALUES(actor,p_parish_id,di,'decree',decree,'record_decree_signer_v294',
 jsonb_build_object('office',p_signer_office,'name',upper(chosen_name)),
 jsonb_build_object('physical_coordinates_assigned',false));
 RETURN result||jsonb_build_object('signerOffice',p_signer_office,
 'signerName',upper(chosen_name));
END $fn$;
REVOKE ALL ON FUNCTION public.issue_chancery_form_decree_v294(
 uuid,text,text,uuid,uuid,text,date,text,text,text,jsonb,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.issue_chancery_form_decree_v294(
 uuid,text,text,uuid,uuid,text,date,text,text,text,jsonb,jsonb,text) TO authenticated;
COMMIT;
