BEGIN;
-- V271: NEW decree, not historical import and not documentary-only.
-- Staged: Cancilleria issues a pending supplement decree for a V207-origin
-- pending new sacramental record. Diocese approves independently, only then
-- does the V263 attestation authorize a MANUAL supplementary book seat.
-- This does not assign a physical Book/Folio/Number, and DOES NOT INSERT an
-- official sacramental record. Old imported decrees are explicitly excluded.
-- Extend the verified existing status CHECK (active, archived, cancelled, reversed)
-- for a NEW ACT awaiting an independent diocesan decision. Documentary and
-- historical decrees never enter this new state.
ALTER TABLE public.decretos DROP CONSTRAINT chk_decretos_status;
ALTER TABLE public.decretos ADD CONSTRAINT chk_decretos_status CHECK (
 status IN ('active','archived','cancelled','reversed','pending_diocesan_review'));
CREATE FUNCTION public.issue_new_supplementary_decree_v271(
 p_parish_id uuid,p_sacrament text,p_pending_id uuid,p_concept_id uuid,
 p_decree_number text,p_decree_date date,p_target_name text,
 p_reason text,p_evidence_ref text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_actor uuid:=auth.uid();
 v_diocese uuid;
 v_chancery uuid;
 v_concept public.conceptos_anulacion%rowtype;
 v_number text:=btrim(coalesce(p_decree_number,''));
 v_reason text:=btrim(coalesce(p_reason,''));
 v_ref text:=btrim(coalesce(p_evidence_ref,''));
 v_target text:=btrim(coalesce(p_target_name,''));
 v_table text;
 v_pending jsonb;
 v_raw jsonb;
 v_date_text text;
 v_date date;
 v_receipts integer;
 v_decree uuid;
BEGIN
 IF v_actor IS NULL OR p_parish_id IS NULL OR p_pending_id IS NULL
 OR p_concept_id IS NULL OR p_decree_date IS NULL OR p_decree_date>current_date
 OR p_sacrament NOT IN('bautismo','confirmacion','matrimonio','exequias')
 OR length(v_number) NOT BETWEEN 4 AND 80
 OR length(v_target) NOT BETWEEN 4 AND 300
 OR length(v_reason) NOT BETWEEN 15 AND 4000
 OR length(v_ref) NOT BETWEEN 8 AND 120 THEN
  RAISE EXCEPTION 'V271: número, parroquia, concepto, fecha, destinatario, fundamento y prueba obligatorios';
 END IF;
 SELECT up.diocese_id,up.chancery_id INTO v_diocese,v_chancery
 FROM public.user_profiles up WHERE up.auth_user_id=v_actor
  AND lower(up.role)='chancery' AND up.is_active IS TRUE
  AND upper(coalesce(up.status,''))='ACTIVE';
 IF v_diocese IS NULL OR NOT EXISTS(SELECT 1 FROM public.parishes p
  WHERE p.id=p_parish_id AND p.diocese_id=v_diocese AND p.is_operational IS TRUE) THEN
  RAISE EXCEPTION 'V271: Cancillería no autorizada para esta parroquia' USING ERRCODE='42501';
 END IF;
 IF v_chancery IS NULL THEN
   SELECT id INTO v_chancery FROM public.chancelleries c
    WHERE c.diocese_id=v_diocese ORDER BY c.id LIMIT 1;
 END IF;
 IF v_chancery IS NULL OR NOT EXISTS(SELECT 1 FROM public.chancelleries
   WHERE id=v_chancery AND diocese_id=v_diocese) THEN
  RAISE EXCEPTION 'V271: Cancillería sin adscripción diocesana válida'; END IF;
 SELECT * INTO v_concept FROM public.conceptos_anulacion c
  WHERE c.id=p_concept_id AND c.diocese_id=v_diocese
   AND c.is_active IS TRUE FOR SHARE;
 IF NOT FOUND OR v_concept.seinscribe IS DISTINCT FROM TRUE
  OR v_concept.enlibro IS DISTINCT FROM 2
  OR lower(coalesce(v_concept.tipo,'')) NOT IN ('porreposicion','reposicion')
  OR lower(coalesce(v_concept.sacrament_type,'')) NOT IN ('general',p_sacrament) THEN
   RAISE EXCEPTION 'V271: concepto de reposición en libro supletorio no habilitado por esta diócesis';
 END IF;
 -- A *separate diocesan approval* of this exact concept and its policy is
 -- required; merely adding a record to the shared concept catalog is not enough.
 IF NOT EXISTS(SELECT 1
  FROM sacramentum_ledger.supplementary_concept_approvals_v272 a
  WHERE a.concept_id=v_concept.id AND a.diocese_id=v_diocese
    AND a.approved_by IS NOT NULL
    AND a.policy_snapshot=jsonb_build_object(
      'codigo',v_concept.codigo,'concepto',v_concept.concepto,
      'tipo',v_concept.tipo,'sacrament_type',v_concept.sacrament_type,
      'enlibro',v_concept.enlibro,'seinscribe',v_concept.seinscribe,
      'gennota',v_concept.gennota,'gendocum',v_concept.gendocum,
      'expide',v_concept.expide,'source_kind',v_concept.source_kind,
      'source_reference',v_concept.source_reference,'is_active',v_concept.is_active)
 ) THEN
    RAISE EXCEPTION 'V272: el concepto no tiene autorización diocesana vigente'; END IF;
 v_table:=CASE p_sacrament WHEN 'bautismo' THEN 'pending_baptisms'
 WHEN 'confirmacion' THEN 'pending_confirmations' WHEN 'matrimonio' THEN 'pending_marriages'
 ELSE 'pending_funerals' END;
 EXECUTE format('SELECT to_jsonb(p) FROM public.%I p
  WHERE p.id=$1 AND p.parish_id=$2 FOR UPDATE',v_table)
  INTO v_pending USING p_pending_id,p_parish_id;
 IF v_pending IS NULL OR lower(coalesce(v_pending->>'status',''))<>'pending'
  OR coalesce((v_pending->>'reportado')::boolean,false) THEN
  RAISE EXCEPTION 'V271: únicamente una boleta nueva y todavía pendiente';
 END IF;
 v_raw:=coalesce(v_pending->'raw_data','{}'::jsonb);
 IF jsonb_typeof(v_raw)<>'object'
  OR coalesce(v_raw->>'source',v_raw->>'recordOrigin',v_raw->>'flow','') ~* 'historic|legacy|import'
  OR nullif(v_raw->>'historicalEntryMode','') IS NOT NULL
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(v_raw) k
    WHERE k IN('book_number','Libro','libro','folio','page_number','number','entry_number')
     AND nullif(btrim(v_raw->>k),'') IS NOT NULL)
  OR (p_sacrament<>'matrimonio' AND nullif(btrim(v_raw->>'numero'),'') IS NOT NULL)
  OR (p_sacrament='matrimonio' AND nullif(v_raw->>'numero','') IS NOT NULL
      AND v_raw->>'numero' IS DISTINCT FROM coalesce(v_raw->>'numeroRegistro',v_raw->>'numero_registro')) THEN
   RAISE EXCEPTION 'V271: una partida histórica, ya asentada o preasignada no admite nuevo decreto';
 END IF;
 v_date_text:=coalesce(nullif(v_pending->>'celebration_date',''),
  nullif(v_pending->>'fecha_exequias',''),nullif(v_raw->>'celebration_date',''),
  nullif(v_raw->>'fechaSacramento',''),nullif(v_raw->>'fechaMatrimonio',''),
  nullif(v_raw->>'fecha_exequias',''));
 IF v_date_text IS NULL OR v_date_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
  RAISE EXCEPTION 'V271: celebración no acreditada'; END IF;
 BEGIN v_date:=v_date_text::date;
 EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'V271: fecha inválida'; END;
 IF to_char(v_date,'YYYY-MM-DD')<>v_date_text OR v_date>current_date THEN
  RAISE EXCEPTION 'V271: la celebración todavía no ha ocurrido'; END IF;
 -- The server-owned V207 creation receipt is the only new-origin proof.
 SELECT count(*) INTO v_receipts FROM public.pending_creation_requests c
  WHERE c.parish_id=p_parish_id AND (
  (p_sacrament='bautismo' AND c.sacrament_type='bautismo'
   AND c.response->>'baptism_pending_id'=p_pending_id::text)
  OR(p_sacrament='confirmacion' AND
    ((c.sacrament_type='confirmacion' AND c.response->>'pending_id'=p_pending_id::text)
     OR(c.sacrament_type='bautismo' AND c.response->>'confirmation_pending_id'=p_pending_id::text)))
  OR(p_sacrament IN ('matrimonio','exequias') AND c.sacrament_type=p_sacrament
   AND c.response->>'pending_id'=p_pending_id::text));
 IF v_receipts<>1 THEN RAISE EXCEPTION 'V271: no hay constancia única de creación nueva'; END IF;
 IF EXISTS(SELECT 1 FROM sacramentum_ledger.celebration_attestations_v263
  WHERE pending_id=p_pending_id) THEN
  RAISE EXCEPTION 'V271: ya existe certificación de esta boleta'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_diocese::text||':'||lower(v_number),271));
 IF EXISTS(SELECT 1 FROM public.decretos d WHERE d.diocese_id=v_diocese
   AND lower(btrim(d.decree_number))=lower(v_number)) THEN
    RAISE EXCEPTION 'V271: número de decreto ya usado en esta diócesis'; END IF;
 IF EXISTS(SELECT 1 FROM public.decretos d
  WHERE d.parish_id=p_parish_id AND d.payload->>'pendingId'=p_pending_id::text) THEN
    RAISE EXCEPTION 'V271: esta boleta ya está vinculada a otro decreto'; END IF;
 INSERT INTO public.decretos(
 parish_id,diocese_id,chancery_id,tipo,sacrament_type,decree_number,
 decree_date,status,issued_by,payload)
 VALUES(p_parish_id,v_diocese,v_chancery,'reposicion',p_sacrament,
 v_number,p_decree_date,'pending_diocesan_review',v_actor,
 jsonb_build_object('conceptoAnulacionId',p_concept_id,
  'decreeNumber',v_number,'decreeDate',p_decree_date,
  'decreeType','reposicion','sacramentType',p_sacrament,
  'targetName',v_target,'reason',v_reason,
  'historical',false,'recordOrigin','new_decree_supplement_v271',
  'issuanceMode','chancery_pending_diocesan_review',
  'decreeEffect','create_supplementary_record',
  'registersEffect',true,'documentaryOnly',false,
  'bookType','suplementario','pendingId',p_pending_id,
  'evidenceRef',v_ref,'originalRecordId',null,'replacementRecordId',null))
 RETURNING id INTO v_decree;
 INSERT INTO public.registry_audit_log(actor_user_id,parish_id,diocese_id,
  entity_type,entity_id,action,after_data,metadata)
 VALUES(v_actor,p_parish_id,v_diocese,'decree',v_decree,
 'issue_pending_supplementary_decree_v271',
 jsonb_build_object('pending_id',p_pending_id,'concept_id',p_concept_id,
  'number',v_number,'review_status','pending_diocesan_review'),
 jsonb_build_object('source','V207_creation_receipt','evidence_ref',v_ref));
 RETURN jsonb_build_object('decreeId',v_decree,
  'pendingId',p_pending_id,'status','pending_diocesan_review',
  'sacrament',p_sacrament);
END $fn$;

CREATE FUNCTION public.approve_new_supplementary_decree_v271(
 p_decree_id uuid,p_review_reference text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_actor uuid:=auth.uid();
 v_diocese uuid;
 v_decree public.decretos%rowtype;
 v_att sacramentum_ledger.celebration_attestations_v263%rowtype;
 v_ref text:=btrim(coalesce(p_review_reference,''));
 v_pending uuid;
 v_pending_table text;
 v_p jsonb;
BEGIN
 IF v_actor IS NULL OR p_decree_id IS NULL OR length(v_ref) NOT BETWEEN 8 AND 120 THEN
  RAISE EXCEPTION 'V271: sesión, decreto y referencia de revisión obligatorios'; END IF;
 SELECT diocese_id INTO v_diocese FROM public.user_profiles up
  WHERE up.auth_user_id=v_actor AND lower(up.role)='diocese'
   AND up.is_active IS TRUE AND upper(coalesce(up.status,''))='ACTIVE';
 IF v_diocese IS NULL THEN
  RAISE EXCEPTION 'V271: solo autoridad diocesana activa revisa' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_decree FROM public.decretos
  WHERE id=p_decree_id AND diocese_id=v_diocese FOR UPDATE;
 IF NOT FOUND OR v_decree.issued_by IS NULL OR v_decree.issued_by=v_actor
  OR v_decree.parish_id IS NULL
  OR v_decree.tipo<>'reposicion'
  OR v_decree.sacrament_type NOT IN('bautismo','confirmacion','matrimonio','exequias')
  OR v_decree.decree_date>current_date
  OR v_decree.original_record_id IS NOT NULL
  OR v_decree.replacement_record_id IS NOT NULL
  OR v_decree.payload->>'recordOrigin'<>'new_decree_supplement_v271'
  OR v_decree.payload->>'decreeEffect'<>'create_supplementary_record'
  OR v_decree.payload->>'historical'<>'false'
  OR v_decree.payload->>'documentaryOnly'<>'false'
  OR coalesce((v_decree.payload#>>'{conceptPolicy,bookMode}')::integer,0)<>2
  OR coalesce((v_decree.payload#>>'{conceptPolicy,registersEffect}')::boolean,false) IS NOT TRUE THEN
   RAISE EXCEPTION 'V271: expediente no elegible para autorización supletoria'; END IF;
 IF v_decree.status='active' THEN
  IF v_decree.payload->>'diocesanReviewRef'<>v_ref THEN
   RAISE EXCEPTION 'V271: acto ya revisado con otra referencia'; END IF;
  RETURN jsonb_build_object('decreeId',p_decree_id,'status','active',
   'pendingId',v_decree.payload->>'pendingId','alreadyApproved',true);
 END IF;
 IF v_decree.status<>'pending_diocesan_review' THEN
  RAISE EXCEPTION 'V271: decreto no está pendiente de decisión diocesana'; END IF;
 BEGIN v_pending:=(v_decree.payload->>'pendingId')::uuid;
 EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'V271: boleta del expediente inválida'; END;
 IF v_pending IS NULL OR nullif(v_decree.payload->>'evidenceRef','') IS NULL THEN
  RAISE EXCEPTION 'V271: falta referencia de comprobación de la celebración'; END IF;
 v_pending_table:=CASE v_decree.sacrament_type
  WHEN 'bautismo' THEN 'pending_baptisms'
  WHEN 'confirmacion' THEN 'pending_confirmations'
  WHEN 'matrimonio' THEN 'pending_marriages'
  ELSE 'pending_funerals' END;
 EXECUTE format('SELECT to_jsonb(p) FROM public.%I p
  WHERE id=$1 AND parish_id=$2 FOR UPDATE',v_pending_table)
 INTO v_p USING v_pending,v_decree.parish_id;
 IF v_p IS NULL OR lower(coalesce(v_p->>'status',''))<>'pending'
  OR coalesce((v_p->>'reportado')::boolean,false) THEN
  RAISE EXCEPTION 'V271: boleta ya asentada, inexistente o ajena';
 END IF;
 -- Strict no-switch policy: an ordinary attestation cannot be overwritten.
 IF EXISTS(SELECT 1 FROM sacramentum_ledger.celebration_attestations_v263
   WHERE pending_id=v_pending) THEN
  RAISE EXCEPTION 'V271: la boleta ya tiene otro origen certificado';
 END IF;
 INSERT INTO sacramentum_ledger.celebration_attestations_v263(
  pending_id,parish_id,sacrament,origin,verified_at,verified_by,
  evidence_ref,decree_id,decree_effect)
 VALUES(v_pending,v_decree.parish_id,v_decree.sacrament_type,
  'new_decree_supplement',clock_timestamp(),v_actor,
  v_decree.payload->>'evidenceRef',p_decree_id,'create_supplementary_record');
 UPDATE public.decretos SET status='active',
  payload=payload||jsonb_build_object('diocesanApprovedBy',v_actor,
   'diocesanApprovedAt',clock_timestamp(),'diocesanReviewRef',v_ref,
   'issuanceMode','new_supplement_approved_v271')
 WHERE id=p_decree_id;
 INSERT INTO public.registry_audit_log(actor_user_id,parish_id,diocese_id,
  entity_type,entity_id,action,after_data,metadata)
 VALUES(v_actor,v_decree.parish_id,v_diocese,'decree',p_decree_id,
  'approve_new_supplementary_decree_v271',
  jsonb_build_object('pending_id',v_pending,'status','active',
   'effect','create_supplementary_record'),
  jsonb_build_object('issued_by',v_decree.issued_by,
   'diocesan_review_ref',v_ref,'book_type','suplementario'));
 RETURN jsonb_build_object('decreeId',p_decree_id,'status','active',
  'pendingId',v_pending,'alreadyApproved',false);
END $fn$;

REVOKE ALL ON FUNCTION public.issue_new_supplementary_decree_v271(
 uuid,text,uuid,uuid,text,date,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.approve_new_supplementary_decree_v271(
 uuid,text) FROM PUBLIC,anon,authenticated;
-- Permission is granted by V267 cutover ONLY after safe reset.
COMMIT;
