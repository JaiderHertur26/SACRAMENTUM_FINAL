-- V314 - Complemento no destructivo de V312 para dos o más partidas bautismales.
-- El decreto se expide una sola vez. Cada parroquia afectada recibe su propia notificación.
-- Las referencias se conservan; NO se borra, anula o altera automáticamente un asiento histórico.
BEGIN;
CREATE OR REPLACE FUNCTION public.issue_repetition_case_v314(
 p_parish_id uuid,p_sacrament text,p_concept_id uuid,p_number text,p_date date,
 p_target text,p_reason text,p_evidence text,p_instruction text,p_signer text,
 p_entries jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE actor uuid:=auth.uid(); di uuid; ch uuid; role_name text; result jsonb;
 d uuid; e jsonb; pid uuid; normalized jsonb:='[]'::jsonb;
 target_parish public.parishes%rowtype; i int:=0; key text; seen text[]:=ARRAY[]::text[];
 external_name text; external_entry boolean;
BEGIN
 SELECT role,diocese_id,chancery_id INTO role_name,di,ch FROM public.user_profiles
 WHERE auth_user_id=actor AND is_active IS TRUE AND upper(status)='ACTIVE' LIMIT 1;
 IF actor IS NULL OR role_name<>'chancery' OR di IS NULL OR ch IS NULL THEN
  RAISE EXCEPTION 'Solo Cancillería activa' USING ERRCODE='42501'; END IF;
 IF p_sacrament<>'bautismo' THEN
  RAISE EXCEPTION 'V314: la decisión sobre partidas múltiples está habilitada solo para Bautismo'; END IF;
 IF jsonb_typeof(p_entries)<>'array' OR jsonb_array_length(p_entries) NOT BETWEEN 2 AND 12 THEN
  RAISE EXCEPTION 'El decreto exige entre dos y doce partidas relacionadas'; END IF;
 FOR e IN SELECT value FROM jsonb_array_elements(p_entries) LOOP
  i:=i+1;
  external_entry:=coalesce(e->>'external','false')='true';
  IF external_entry THEN
   pid:=NULL;
   external_name:=btrim(coalesce(e->>'parishName',''));
   IF length(external_name) NOT BETWEEN 4 AND 200
    OR length(btrim(coalesce(e->>'externalJurisdiction','')))>200
    OR nullif(btrim(coalesce(e->>'recordId','')),'') IS NOT NULL THEN
    RAISE EXCEPTION 'La parroquia externa debe estar identificada por nombre; no se admite id interno'; END IF;
  ELSE
   IF coalesce(e->>'parishId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Parroquia afectada sin identidad en el sistema'; END IF;
   pid:=(e->>'parishId')::uuid;
   SELECT * INTO target_parish FROM public.parishes WHERE id=pid AND diocese_id=di
     AND is_operational IS TRUE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Parroquia afectada fuera de la jurisdicción operativa' USING ERRCODE='42501'; END IF;
   external_name:=target_parish.name;
  END IF;
  IF length(btrim(coalesce(e->>'book',''))) NOT BETWEEN 1 AND 60
   OR length(btrim(coalesce(e->>'folio',''))) NOT BETWEEN 1 AND 60
   OR length(btrim(coalesce(e->>'number',''))) NOT BETWEEN 1 AND 60
   OR length(btrim(coalesce(e->>'justification',''))) NOT BETWEEN 15 AND 1500
   OR e->>'disposition' NOT IN ('retain','without_effect','investigate') THEN
   RAISE EXCEPTION 'Faltan libro, folio, número, fundamento o disposición de partida'; END IF;
  key:=lower(coalesce(pid::text,'external/'||external_name)||'|'||btrim(e->>'book')||'|'||btrim(e->>'folio')||'|'||btrim(e->>'number'));
  IF key=ANY(seen) THEN RAISE EXCEPTION 'La misma partida figura dos veces'; END IF;
  seen:=array_append(seen,key);
  IF NOT external_entry AND e ? 'recordId' AND nullif(btrim(e->>'recordId'),'') IS NOT NULL THEN
    IF coalesce(e->>'recordId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
     RAISE EXCEPTION 'Id de partida inválido'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.baptisms b WHERE b.id=(e->>'recordId')::uuid
      AND b.parish_id=pid AND btrim(b.book_number)=btrim(e->>'book')
      AND btrim(b.folio)=btrim(e->>'folio') AND btrim(b.number)=btrim(e->>'number')) THEN
     RAISE EXCEPTION 'La partida vinculada no corresponde a parroquia/libro/folio/número'; END IF;
  END IF;
  normalized:=normalized||jsonb_build_array(jsonb_build_object(
    'parishId',pid,'parishName',external_name,'external',external_entry,
    'externalKey',CASE WHEN external_entry THEN 'external-'||i ELSE NULL END,
    'externalJurisdiction',btrim(coalesce(e->>'externalJurisdiction','')),
    'book',btrim(e->>'book'),
    'folio',btrim(e->>'folio'),'number',btrim(e->>'number'),
    'recordId',nullif(btrim(e->>'recordId'),''),'disposition',e->>'disposition',
    'justification',btrim(e->>'justification')));
 END LOOP;
 IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(normalized) x WHERE x->>'parishId'=p_parish_id::text) THEN
  RAISE EXCEPTION 'La parroquia principal debe estar entre las afectadas'; END IF;
 -- La v312 conserva los controles de concepto, jurisdicción, firmante y consecutivo.
 result:=public.issue_repetition_decree_v312(p_parish_id,p_sacrament,p_concept_id,
  p_number,p_date,p_target,p_reason,p_evidence,p_instruction,p_signer);
 d:=(result->>'decreeId')::uuid;
 UPDATE public.decretos SET payload=payload||jsonb_build_object(
  'affectedEntries',normalized,'repetitionParishActions','{}'::jsonb,
  'repetitionExternalActions','{}'::jsonb,
  'repetitionWorkflowStatus','awaiting_parishes','repetitionCaseMode','duplicate_baptism_entries_v314',
  'requiresIndividualDisposition',true,'automaticRegistryMutation',false),
  updated_at=clock_timestamp() WHERE id=d AND diocese_id=di;
 FOR pid IN SELECT DISTINCT (value->>'parishId')::uuid FROM jsonb_array_elements(normalized)
 WHERE value->>'parishId' IS NOT NULL LOOP
  IF pid<>p_parish_id THEN
   INSERT INTO public.official_notifications(diocese_id,sender_chancery_id,receiver_parish_id,
    decree_id,category,subject,message,status,payload,created_by)
   VALUES(di,ch,pid,d,'decree','Decreto de Repetición '||p_number,
    'Su parroquia figura en un expediente con varias partidas. Verifique la disposición de sus asientos y remita constancia a Cancillería.',
    'pending',jsonb_build_object('decreeId',d,'decreeType','repeticion',
      'repetitionWorkflowStatus','awaiting_parishes'),actor);
  END IF;
 END LOOP;
 UPDATE public.official_notifications SET
  subject='Decreto de Repetición '||p_number||' · varias partidas',
  payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('repetitionWorkflowStatus','awaiting_parishes'),
  updated_at=clock_timestamp()
 WHERE decree_id=d AND category='decree';
 INSERT INTO public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,
  action,after_data,metadata)
 VALUES(actor,p_parish_id,di,'decree',d,'issue_repetition_case_v314',
  jsonb_build_object('affectedEntries',normalized),jsonb_build_object('noSacramentalMutation',true));
 RETURN result||jsonb_build_object('status','awaiting_parishes','affectedEntries',normalized);
END $fn$;
REVOKE ALL ON FUNCTION public.issue_repetition_case_v314(uuid,text,uuid,text,date,text,text,text,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.issue_repetition_case_v314(uuid,text,uuid,text,date,text,text,text,text,text,jsonb) TO authenticated;

-- La parroquia secundaria no adquiere permiso general sobre otros decretos.
-- Esta función expone únicamente los expedientes donde está expresamente afectada.
CREATE OR REPLACE FUNCTION public.list_repetition_cases_v314()
 RETURNS SETOF public.decretos LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE actor uuid:=auth.uid(); role_name text; di uuid; parish uuid;
BEGIN
 SELECT role,diocese_id,parish_id INTO role_name,di,parish FROM public.user_profiles
 WHERE auth_user_id=actor AND is_active IS TRUE AND upper(status)='ACTIVE' LIMIT 1;
 IF actor IS NULL OR di IS NULL OR role_name NOT IN ('chancery','parish') THEN
  RAISE EXCEPTION 'Consulta reservada para Cancillería y parroquias afectadas' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT d.* FROM public.decretos d
 WHERE d.diocese_id=di AND d.tipo='repeticion' AND (
  role_name='chancery' OR (role_name='parish' AND (
   d.parish_id=parish OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(d.payload->'affectedEntries')='array'
    THEN d.payload->'affectedEntries' ELSE '[]'::jsonb END) e
    WHERE e->>'parishId'=parish::text))))
 ORDER BY d.created_at DESC,d.id DESC LIMIT 2000;
END $fn$;
REVOKE ALL ON FUNCTION public.list_repetition_cases_v314() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_repetition_cases_v314() TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_repetition_parish_v314(
 p_decree_id uuid,p_resolution text,p_evidence text,p_observation text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE actor uuid:=auth.uid();di uuid;parish uuid;role_name text;
 d public.decretos%rowtype; actions jsonb; entries jsonb; ids uuid[];pid uuid;
 new_status text; evidence text:=btrim(coalesce(p_evidence,''));
 observation text:=btrim(coalesce(p_observation,''));
BEGIN
 SELECT role,diocese_id,parish_id INTO role_name,di,parish FROM public.user_profiles
 WHERE auth_user_id=actor AND is_active IS TRUE AND upper(status)='ACTIVE' LIMIT 1;
 IF actor IS NULL OR role_name<>'parish' OR di IS NULL OR parish IS NULL THEN
  RAISE EXCEPTION 'Solo parroquia activa' USING ERRCODE='42501'; END IF;
 SELECT * INTO d FROM public.decretos WHERE id=p_decree_id AND diocese_id=di
  AND tipo='repeticion' AND status='active' FOR UPDATE;
 IF NOT FOUND OR d.payload->>'repetitionCaseMode'<>'duplicate_baptism_entries_v314' THEN
  RAISE EXCEPTION 'Expediente V314 no disponible'; END IF;
 entries:=d.payload->'affectedEntries';
 SELECT array_agg(DISTINCT (e->>'parishId')::uuid) INTO ids FROM jsonb_array_elements(entries) e;
 IF NOT parish=ANY(ids) THEN RAISE EXCEPTION 'La parroquia no es destinataria del decreto' USING ERRCODE='42501'; END IF;
 actions:=coalesce(d.payload->'repetitionParishActions','{}'::jsonb);
 IF actions ? parish::text THEN
  RAISE EXCEPTION 'La parroquia ya registró su actuación; solo Cancillería puede reabrir una solicitud de aclaración'; END IF;
 IF p_resolution NOT IN ('documented','needs_review') OR length(observation) NOT BETWEEN 15 AND 1500
  OR (p_resolution='documented' AND length(evidence) NOT BETWEEN 8 AND 500) OR length(evidence)>500 THEN
  RAISE EXCEPTION 'Debe informar la decisión, observaciones y evidencia'; END IF;
 actions:=jsonb_set(actions,ARRAY[parish::text],jsonb_build_object(
  'outcome',p_resolution,'evidenceRef',evidence,'observations',observation,
  'actorAuthId',actor,'registeredAt',clock_timestamp()),true);
 new_status:=CASE
  WHEN EXISTS (SELECT 1 FROM unnest(ids) x WHERE actions->x::text->>'outcome'='needs_review')
   THEN 'needs_chancery_review'
  WHEN NOT EXISTS (SELECT 1 FROM unnest(ids) x WHERE actions->x::text->>'outcome' IS DISTINCT FROM 'documented')
   AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(entries) x
    WHERE x->>'external'='true' AND length(coalesce(d.payload->'repetitionExternalActions'->(x->>'externalKey')->>'evidenceRef',''))<8)
   THEN 'completed_documentary'
  ELSE 'awaiting_parishes' END;
 UPDATE public.decretos SET payload=payload||jsonb_build_object('repetitionParishActions',actions,
  'repetitionWorkflowStatus',new_status),updated_at=clock_timestamp() WHERE id=p_decree_id;
 UPDATE public.official_notifications SET status=CASE WHEN p_resolution='documented' THEN 'processed' ELSE 'read' END,
  read_at=coalesce(read_at,clock_timestamp()),processed_at=CASE WHEN p_resolution='documented' THEN clock_timestamp() ELSE NULL END,
  updated_at=clock_timestamp()
 WHERE decree_id=p_decree_id AND receiver_parish_id=parish AND category='decree';
 INSERT INTO public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,
 action,after_data,metadata) VALUES(actor,parish,di,'decree',p_decree_id,
 'resolve_repetition_parish_v314',jsonb_build_object('status',new_status,'parishOutcome',p_resolution,
 'reference',evidence),jsonb_build_object('noSacramentalMutation',true));
 RETURN jsonb_build_object('decreeId',p_decree_id,'status',new_status,'parishId',parish);
END $fn$;
REVOKE ALL ON FUNCTION public.resolve_repetition_parish_v314(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resolve_repetition_parish_v314(uuid,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.return_repetition_parish_v314(
 p_decree_id uuid,p_parish_id uuid,p_instruction text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE actor uuid:=auth.uid();di uuid;ch uuid;role_name text;d public.decretos%rowtype;
 actions jsonb;new_status text;ids uuid[];
BEGIN
 SELECT role,diocese_id,chancery_id INTO role_name,di,ch FROM public.user_profiles
 WHERE auth_user_id=actor AND is_active IS TRUE AND upper(status)='ACTIVE' LIMIT 1;
 IF actor IS NULL OR role_name<>'chancery' OR di IS NULL OR ch IS NULL THEN
  RAISE EXCEPTION 'Solo Cancillería activa' USING ERRCODE='42501'; END IF;
 IF length(btrim(coalesce(p_instruction,''))) NOT BETWEEN 15 AND 1500 THEN
  RAISE EXCEPTION 'Aclaración requerida'; END IF;
 SELECT * INTO d FROM public.decretos WHERE id=p_decree_id AND diocese_id=di
 AND chancery_id=ch AND tipo='repeticion' AND status='active' FOR UPDATE;
 IF NOT FOUND OR d.payload->>'repetitionCaseMode'<>'duplicate_baptism_entries_v314' THEN
  RAISE EXCEPTION 'Expediente no disponible' USING ERRCODE='42501'; END IF;
 actions:=coalesce(d.payload->'repetitionParishActions','{}'::jsonb);
 IF actions->p_parish_id::text->>'outcome' IS DISTINCT FROM 'needs_review' THEN
  RAISE EXCEPTION 'Esta parroquia no solicitó aclaración'; END IF;
 actions:=actions-p_parish_id::text;
 SELECT array_agg(DISTINCT (e->>'parishId')::uuid) INTO ids
 FROM jsonb_array_elements(d.payload->'affectedEntries') e;
 new_status:=CASE WHEN EXISTS(SELECT 1 FROM unnest(ids) x
  WHERE actions->x::text->>'outcome'='needs_review') THEN 'needs_chancery_review'
  ELSE 'awaiting_parishes' END;
 UPDATE public.decretos SET payload=payload||jsonb_build_object('repetitionParishActions',actions,
 'repetitionWorkflowStatus',new_status,'chanceryClarification',jsonb_build_object(
  'parishId',p_parish_id,'instruction',btrim(p_instruction),'actorAuthId',actor,
  'sentAt',clock_timestamp())),updated_at=clock_timestamp() WHERE id=p_decree_id;
 UPDATE public.official_notifications SET status='pending',processed_at=NULL,read_at=NULL,
  updated_at=clock_timestamp() WHERE decree_id=p_decree_id AND receiver_parish_id=p_parish_id AND category='decree';
 INSERT INTO public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,
  action,after_data,metadata) VALUES(actor,p_parish_id,di,'decree',p_decree_id,
  'return_repetition_parish_v314',jsonb_build_object('status',new_status,'instruction',p_instruction),
  jsonb_build_object('noSacramentalMutation',true));
 RETURN jsonb_build_object('decreeId',p_decree_id,'status',new_status,'parishId',p_parish_id);
END $fn$;
REVOKE ALL ON FUNCTION public.return_repetition_parish_v314(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.return_repetition_parish_v314(uuid,uuid,text) TO authenticated;
-- Una parroquia externa no obtiene acceso al sistema; Cancillería registra su constancia recibida.
CREATE OR REPLACE FUNCTION public.register_external_repetition_constancy_v314(
 p_decree_id uuid,p_external_key text,p_evidence text,p_observation text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE actor uuid:=auth.uid(); role_name text; di uuid; ch uuid; d public.decretos%rowtype;
 entries jsonb; actions jsonb; ext_actions jsonb; ids uuid[]; new_status text;
 ev text:=btrim(coalesce(p_evidence,'')); obs text:=btrim(coalesce(p_observation,''));
BEGIN
 SELECT role,diocese_id,chancery_id INTO role_name,di,ch FROM public.user_profiles
 WHERE auth_user_id=actor AND is_active IS TRUE AND upper(status)='ACTIVE' LIMIT 1;
 IF actor IS NULL OR role_name<>'chancery' OR di IS NULL OR ch IS NULL THEN
  RAISE EXCEPTION 'Solo Cancillería activa puede registrar constancias externas' USING ERRCODE='42501'; END IF;
 IF length(ev) NOT BETWEEN 8 AND 500 OR length(obs) NOT BETWEEN 15 AND 1500 THEN
  RAISE EXCEPTION 'Constancia externa requiere referencia y observación'; END IF;
 SELECT * INTO d FROM public.decretos WHERE id=p_decree_id AND diocese_id=di AND chancery_id=ch
  AND tipo='repeticion' AND status='active' FOR UPDATE;
 IF NOT FOUND OR d.payload->>'repetitionCaseMode'<>'duplicate_baptism_entries_v314' THEN
  RAISE EXCEPTION 'Expediente no disponible' USING ERRCODE='42501'; END IF;
 entries:=d.payload->'affectedEntries';
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(entries) x
  WHERE x->>'external'='true' AND x->>'externalKey'=p_external_key) THEN
  RAISE EXCEPTION 'No existe esa parroquia externa en el decreto' USING ERRCODE='42501'; END IF;
 ext_actions:=coalesce(d.payload->'repetitionExternalActions','{}'::jsonb);
 IF ext_actions ? p_external_key THEN RAISE EXCEPTION 'Esta constancia externa ya está registrada'; END IF;
 ext_actions:=jsonb_set(ext_actions,ARRAY[p_external_key],jsonb_build_object(
  'evidenceRef',ev,'observations',obs,'actorAuthId',actor,'registeredAt',clock_timestamp()),true);
 actions:=coalesce(d.payload->'repetitionParishActions','{}'::jsonb);
 SELECT array_agg(DISTINCT (x->>'parishId')::uuid) INTO ids
  FROM jsonb_array_elements(entries) x WHERE x->>'parishId' IS NOT NULL;
 new_status:=CASE
  WHEN EXISTS(SELECT 1 FROM unnest(ids) x WHERE actions->x::text->>'outcome'='needs_review')
   THEN 'needs_chancery_review'
  WHEN NOT EXISTS(SELECT 1 FROM unnest(ids) x WHERE actions->x::text->>'outcome' IS DISTINCT FROM 'documented')
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(entries) x
     WHERE x->>'external'='true' AND length(coalesce(ext_actions->(x->>'externalKey')->>'evidenceRef',''))<8)
   THEN 'completed_documentary' ELSE 'awaiting_parishes' END;
 UPDATE public.decretos SET payload=payload||jsonb_build_object(
  'repetitionExternalActions',ext_actions,'repetitionWorkflowStatus',new_status),
  updated_at=clock_timestamp() WHERE id=p_decree_id;
 INSERT INTO public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,
  action,after_data,metadata) VALUES(actor,d.parish_id,di,'decree',p_decree_id,
  'register_external_repetition_constancy_v314',
  jsonb_build_object('externalKey',p_external_key,'evidenceRef',ev,'status',new_status),
  jsonb_build_object('noSacramentalMutation',true));
 RETURN jsonb_build_object('decreeId',p_decree_id,'externalKey',p_external_key,'status',new_status);
END $fn$;
REVOKE ALL ON FUNCTION public.register_external_repetition_constancy_v314(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.register_external_repetition_constancy_v314(uuid,text,text,text) TO authenticated;

COMMIT;
