-- V312: Decreto de Repetición / error de transcripción. Diferente de Reposición.
-- Sin nuevos asientos, sin renumeración, sin notas marginales automáticas.
-- Flujo: Cancillería -> Parroquia -> constancia o devolución -> Cancillería.
BEGIN;
CREATE OR REPLACE FUNCTION public.issue_repetition_decree_v312(
 p_parish_id uuid,p_sacrament text,p_concept_id uuid,p_number text,p_date date,
 p_target text,p_reason text,p_evidence text,p_instruction text,p_signer text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE actor uuid:=auth.uid(); di uuid;ch uuid;profile_role text;
 concept public.conceptos_anulacion%rowtype; signer_name text;rec uuid;notice uuid;
 n text:=btrim(coalesce(p_number,'')); target text:=btrim(coalesce(p_target,''));
 reason text:=btrim(coalesce(p_reason,'')); evidence text:=btrim(coalesce(p_evidence,''));
 instruction text:=btrim(coalesce(p_instruction,''));
BEGIN
 SELECT role,diocese_id,chancery_id INTO profile_role,di,ch FROM public.user_profiles
 WHERE auth_user_id=actor AND role='chancery' AND is_active IS TRUE AND upper(status)='ACTIVE' LIMIT 1;
 IF actor IS NULL OR profile_role IS DISTINCT FROM 'chancery' OR di IS NULL OR ch IS NULL
 OR NOT EXISTS(SELECT 1 FROM public.chancelleries c WHERE c.id=ch AND c.diocese_id=di)
 THEN RAISE EXCEPTION 'Solo Cancillería activa puede expedir este decreto' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.parishes p WHERE p.id=p_parish_id
 AND p.diocese_id=di AND p.is_operational IS TRUE) THEN
 RAISE EXCEPTION 'Parroquia destinataria no operativa o fuera de jurisdicción' USING ERRCODE='42501'; END IF;
 IF p_sacrament NOT IN ('bautismo','confirmacion','matrimonio','exequias')
 OR p_date IS NULL OR p_date>current_date OR length(n) NOT BETWEEN 4 AND 80
 OR length(target) NOT BETWEEN 4 AND 300 OR length(reason) NOT BETWEEN 20 AND 4000
 OR length(evidence) NOT BETWEEN 8 AND 1000 OR length(instruction) NOT BETWEEN 15 AND 4000
 OR p_signer NOT IN ('canciller','vicecanciller') THEN
 RAISE EXCEPTION 'Datos incompletos, fuera de límites o firmante inválido'; END IF;
 SELECT * INTO concept FROM public.conceptos_anulacion
 WHERE id=p_concept_id AND diocese_id=di AND is_active IS TRUE FOR SHARE;
 IF NOT FOUND OR lower(concept.tipo)<>'porrepeticion'
 OR lower(coalesce(concept.sacrament_type,'')) NOT IN ('general',p_sacrament)
 OR concept.seinscribe IS DISTINCT FROM false OR concept.gennota IS DISTINCT FROM false
 OR concept.enlibro<>0 THEN
 RAISE EXCEPTION 'Concepto de Repetición no habilitado o con efectos registrales incompatibles'; END IF;
 SELECT CASE p_signer WHEN 'canciller' THEN nullif(btrim(chancellor_name),'')
 ELSE nullif(btrim(vice_chancellor_name),'') END INTO signer_name
 FROM public.chancelleries WHERE id=ch;
 IF signer_name IS NULL THEN RAISE EXCEPTION 'El firmante debe figurar en Cancillería'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(di::text||':'||lower(n),312));
 IF EXISTS(SELECT 1 FROM public.decretos WHERE diocese_id=di AND lower(btrim(decree_number))=lower(n)) THEN
 RAISE EXCEPTION 'Ya existe un decreto con este número en la diócesis'; END IF;
 INSERT INTO public.decretos(parish_id,diocese_id,chancery_id,tipo,sacrament_type,
 decree_number,decree_date,status,issued_by,payload)
 VALUES(p_parish_id,di,ch,'repeticion',p_sacrament,n,p_date,'active',actor,
 jsonb_build_object(
 'decreeType','repeticion','sacramentType',p_sacrament,'decreeNumber',n,'decreeDate',p_date,
 'targetName',target,'reason',reason,'evidenceRef',evidence,'instruction',instruction,
 'conceptoAnulacionId',p_concept_id,'conceptPolicy',jsonb_build_object(
 'code',concept.codigo,'concept',concept.concepto,'registersEffect',false,
 'generatesMarginalNote',false,'generatesDocument',true,'bookMode',0,
 'decreeType','porRepeticion','sacramentType',concept.sacrament_type),
 'signerRole',p_signer,'signerName',signer_name,'signerTitle',
 CASE p_signer WHEN 'canciller' THEN 'CANCILLER' ELSE 'VICECANCILLER' END,
 'recordOrigin','chancery_repetition_v312','documentaryOnly',true,'registersEffect',false,
 'generatesMarginalNote',false,'affectsSacramentalRecord',false,
 'repetitionWorkflowStatus','awaiting_parish','historical',false))
 RETURNING id INTO rec;
 -- La garantía automática crea la notificación al insertar el decreto.
 SELECT id INTO notice FROM public.official_notifications
 WHERE decree_id=rec AND receiver_parish_id=p_parish_id AND category='decree'
 ORDER BY created_at DESC LIMIT 1;
 IF notice IS NULL THEN
 INSERT INTO public.official_notifications(diocese_id,sender_chancery_id,receiver_parish_id,
 decree_id,category,subject,message,status,payload,created_by)
 VALUES(di,ch,p_parish_id,rec,'decree','Decreto de Repetición '||n,
 'Cancillería remite un decreto de repetición documental para verificación y constancia.',
 'pending',jsonb_build_object('decreeId',rec,'decreeType','repeticion'),actor)
 RETURNING id INTO notice;
 END IF;
 UPDATE public.official_notifications SET
  subject='Decreto de Repetición '||n||' · pendiente de verificación',
  message='Cancillería expidió el Decreto de Repetición. Examine el fundamento y deje constancia documental o solicite aclaración. No debe crear ni anular partidas desde este procedimiento.',
  payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object(
    'decreeType','repeticion','sacramentType',p_sacrament,
    'repetitionWorkflowStatus','awaiting_parish','decreeId',rec),
  updated_at=clock_timestamp()
 WHERE id=notice;
 INSERT INTO public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,
 action,after_data,metadata)
 VALUES(actor,p_parish_id,di,'decree',rec,'issue_repetition_decree_v312',
 jsonb_build_object('decreeNumber',n,'sacrament',p_sacrament,'evidenceRef',evidence,
 'signerRole',p_signer,'status','awaiting_parish'),
 jsonb_build_object('notificationId',notice,'registersEffect',false,'conceptId',p_concept_id));
 RETURN jsonb_build_object('decreeId',rec,'notificationId',notice,'status','awaiting_parish','decreeNumber',n);
END $$;
REVOKE ALL ON FUNCTION public.issue_repetition_decree_v312(uuid,text,uuid,text,date,text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.issue_repetition_decree_v312(uuid,text,uuid,text,date,text,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_parish_repetition_v312(
 p_decree_id uuid,p_resolution text,p_evidence text,p_observation text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE actor uuid:=auth.uid(); parish uuid;di uuid;row public.decretos%rowtype;
 evidence text:=btrim(coalesce(p_evidence,'')); observation text:=btrim(coalesce(p_observation,''));
 new_status text; old_status text;
BEGIN
 SELECT parish_id,diocese_id INTO parish,di FROM public.user_profiles
 WHERE auth_user_id=actor AND role='parish' AND is_active IS TRUE AND upper(status)='ACTIVE' LIMIT 1;
 IF actor IS NULL OR parish IS NULL OR di IS NULL THEN
 RAISE EXCEPTION 'Solo párroco de parroquia activa' USING ERRCODE='42501'; END IF;
 SELECT * INTO row FROM public.decretos WHERE id=p_decree_id AND parish_id=parish AND diocese_id=di
 AND tipo='repeticion' AND status='active' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Decreto no disponible para esta parroquia' USING ERRCODE='42501'; END IF;
 IF row.payload->>'recordOrigin'<>'chancery_repetition_v312' OR
 coalesce(row.payload->>'repetitionWorkflowStatus','')<>'awaiting_parish' THEN
 RAISE EXCEPTION 'El decreto ya se gestionó o no pertenece al circuito de Repetición'; END IF;
 IF p_resolution NOT IN ('documented','needs_review')
 OR length(observation) NOT BETWEEN 15 AND 1500
 OR (p_resolution='documented' AND length(evidence) NOT BETWEEN 8 AND 500)
 OR length(evidence)>500 THEN RAISE EXCEPTION 'Constancia, observación o decisión inválida'; END IF;
 new_status:=CASE p_resolution WHEN 'documented' THEN 'completed_documentary' ELSE 'needs_chancery_review' END;
 UPDATE public.decretos SET payload=payload||jsonb_build_object(
 'repetitionWorkflowStatus',new_status,'parishResolution',jsonb_build_object(
 'outcome',p_resolution,'evidenceRef',evidence,'observations',observation,
 'actorAuthId',actor,'registeredAt',clock_timestamp())),
 updated_at=clock_timestamp()
 WHERE id=p_decree_id;
 UPDATE public.official_notifications SET status=CASE WHEN p_resolution='documented' THEN 'processed' ELSE 'read' END,
 read_at=coalesce(read_at,clock_timestamp()),
 processed_at=CASE WHEN p_resolution='documented' THEN clock_timestamp() ELSE NULL END,
 updated_at=clock_timestamp()
 WHERE decree_id=p_decree_id AND receiver_parish_id=parish AND category='decree';
 INSERT INTO public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,before_data,after_data,metadata)
 VALUES(actor,parish,di,'decree',p_decree_id,'resolve_parish_repetition_v312',
 jsonb_build_object('status','awaiting_parish'),
 jsonb_build_object('status',new_status,'evidenceRef',evidence,'observations',observation),
 jsonb_build_object('noSacramentalMutation',true,'outcome',p_resolution));
 RETURN jsonb_build_object('decreeId',p_decree_id,'status',new_status);
END $$;
REVOKE ALL ON FUNCTION public.resolve_parish_repetition_v312(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resolve_parish_repetition_v312(uuid,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.return_repetition_to_parish_v312(
 p_decree_id uuid,p_instruction text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE actor uuid:=auth.uid();di uuid;ch uuid;row public.decretos%rowtype;
 new_instruction text:=btrim(coalesce(p_instruction,''));
BEGIN
 SELECT diocese_id,chancery_id INTO di,ch FROM public.user_profiles
 WHERE auth_user_id=actor AND role='chancery' AND is_active IS TRUE AND upper(status)='ACTIVE' LIMIT 1;
 IF actor IS NULL OR di IS NULL OR ch IS NULL THEN RAISE EXCEPTION 'Solo Cancillería activa' USING ERRCODE='42501'; END IF;
 IF length(new_instruction) NOT BETWEEN 15 AND 1500 THEN RAISE EXCEPTION 'Motivo de devolución inválido'; END IF;
 SELECT * INTO row FROM public.decretos WHERE id=p_decree_id AND diocese_id=di AND chancery_id=ch
 AND tipo='repeticion' AND status='active' FOR UPDATE;
 IF NOT FOUND OR row.payload->>'recordOrigin'<>'chancery_repetition_v312'
 OR row.payload->>'repetitionWorkflowStatus'<>'needs_chancery_review' THEN
 RAISE EXCEPTION 'El decreto no está pendiente de aclaración en esta Cancillería' USING ERRCODE='42501'; END IF;
 UPDATE public.decretos SET payload=payload||jsonb_build_object(
 'repetitionWorkflowStatus','awaiting_parish',
 'chanceryClarification',jsonb_build_object('instruction',new_instruction,
 'actorAuthId',actor,'sentAt',clock_timestamp())),
 updated_at=clock_timestamp() WHERE id=p_decree_id;
 UPDATE public.official_notifications SET status='pending',processed_at=NULL,
 read_at=NULL,updated_at=clock_timestamp()
 WHERE decree_id=p_decree_id AND receiver_parish_id=row.parish_id AND category='decree';
 INSERT INTO public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,
 before_data,after_data,metadata)
 VALUES(actor,row.parish_id,di,'decree',p_decree_id,'return_repetition_to_parish_v312',
 jsonb_build_object('status','needs_chancery_review'),
 jsonb_build_object('status','awaiting_parish','instruction',new_instruction),
 jsonb_build_object('noSacramentalMutation',true));
 RETURN jsonb_build_object('decreeId',p_decree_id,'status','awaiting_parish');
END $$;
REVOKE ALL ON FUNCTION public.return_repetition_to_parish_v312(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.return_repetition_to_parish_v312(uuid,text) TO authenticated;

-- Close older SECURITY DEFINER trace path, which previously inherited
-- can_access_parish() and could expose decree metadata to a diocesan role.
CREATE OR REPLACE FUNCTION public.get_decree_trace_v89(p_decree_id uuid)
 RETURNS TABLE(action text, actor_name text, actor_role text, created_at timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $trace$
 SELECT a.action::text,
  coalesce(nullif(trim(up.full_name),''),nullif(trim(up.username),''),
   case when a.actor_user_id is null then 'Sistema de importación histórica' else 'Usuario institucional' end)::text,
  coalesce(nullif(trim(up.role),''),'system')::text,
  a.created_at
 FROM public.decretos d
 JOIN public.registry_audit_log a ON a.entity_type='decree' AND a.entity_id=d.id
 LEFT JOIN public.user_profiles up ON up.auth_user_id=a.actor_user_id
 WHERE d.id=p_decree_id AND auth.uid() IS NOT NULL
 AND (
   (public.current_app_role()='chancery' AND d.diocese_id=public.current_app_diocese_id())
   OR (public.current_app_role()='parish' AND d.parish_id=public.current_app_parish_id()
    AND d.diocese_id=public.current_app_diocese_id())
 )
 ORDER BY a.created_at ASC,a.id ASC LIMIT 40;
$trace$;

-- Restrict decree notifications in ALL jurisdictions to Chancery and destination Parish;
-- earlier broad diocesan SELECT policies must not expose subject/payload.
DROP POLICY IF EXISTS decree_notification_private_v312 ON public.official_notifications;
CREATE POLICY decree_notification_private_v312 ON public.official_notifications
 AS RESTRICTIVE FOR SELECT TO authenticated
 USING (
 category <> 'decree'
 OR (auth.uid() IS NOT NULL AND
 ((public.current_app_role()='chancery' AND diocese_id=public.current_app_diocese_id())
 OR (public.current_app_role()='parish' AND receiver_parish_id=public.current_app_parish_id()
 AND diocese_id=public.current_app_diocese_id())))
 );
COMMIT;