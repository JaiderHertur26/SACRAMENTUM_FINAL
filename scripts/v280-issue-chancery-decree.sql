BEGIN;
-- V280: emisión sin coordenadas; asiento manual cronológico, auditable y atómico.
-- No se asienta ni se anula una partida al expedir un decreto.
CREATE TABLE sacramentum_ledger.decree_seat_receipts_v280 (
  decree_id uuid PRIMARY KEY REFERENCES public.decretos(id) ON DELETE RESTRICT,
  notification_id uuid NOT NULL UNIQUE REFERENCES public.official_notifications(id) ON DELETE RESTRICT,
  parish_id uuid NOT NULL REFERENCES public.parishes(id) ON DELETE RESTRICT,
  diocese_id uuid NOT NULL REFERENCES public.dioceses(id) ON DELETE RESTRICT,
  sacrament text NOT NULL CHECK(sacrament IN('bautismo','confirmacion','matrimonio','exequias')),
  decree_effect text NOT NULL CHECK(decree_effect IN('annul_and_create','create_only')),
  original_record_id uuid,
  created_record_id uuid NOT NULL,
  book_id uuid NOT NULL REFERENCES sacramentum_ledger.book_memories(id),
  book_code text NOT NULL,
  folio integer NOT NULL CHECK(folio>0),
  number integer NOT NULL CHECK(number>0),
  partidas_per_folio integer NOT NULL CHECK(partidas_per_folio BETWEEN 1 AND 200),
  operation_id uuid NOT NULL UNIQUE,
  seated_by uuid NOT NULL,
  seated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((decree_effect='annul_and_create' AND original_record_id IS NOT NULL)
     OR (decree_effect='create_only' AND original_record_id IS NULL))
);
ALTER TABLE sacramentum_ledger.decree_seat_receipts_v280 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sacramentum_ledger.decree_seat_receipts_v280 FROM PUBLIC,anon,authenticated;
CREATE TABLE sacramentum_ledger.chancery_decree_receipts_v280 (
  decree_id uuid PRIMARY KEY REFERENCES sacramentum_ledger.decree_seat_receipts_v280(decree_id) ON DELETE RESTRICT,
  diocese_id uuid NOT NULL REFERENCES public.dioceses(id),
  chancery_id uuid NOT NULL REFERENCES public.chancelleries(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  read_by uuid,
  read_at timestamptz
);
ALTER TABLE sacramentum_ledger.chancery_decree_receipts_v280 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sacramentum_ledger.chancery_decree_receipts_v280 FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.issue_chancery_decree_v280(
 p_parish_id uuid,p_sacrament text,p_pending_id uuid,p_original_record_id uuid,
 p_decree_type text,p_concept_id uuid,p_decree_number text,p_decree_date date,
 p_target_name text,p_reason text,p_evidence_ref text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a uuid:=auth.uid(); di uuid; ch uuid; c public.conceptos_anulacion%rowtype;
 t text; v_decree uuid; v_notice uuid; v_pending jsonb; v_raw jsonb;
 v_date text; v_reg text; v_receipts integer; v_original jsonb;
 v_num text:=btrim(coalesce(p_decree_number,''));
 v_ref text:=btrim(coalesce(p_evidence_ref,''));
 v_reason text:=btrim(coalesce(p_reason,''));
 v_target text:=btrim(coalesce(p_target_name,''));
 v_effect text; v_label text;
BEGIN
 IF a IS NULL OR p_parish_id IS NULL OR p_pending_id IS NULL OR p_concept_id IS NULL
 OR p_sacrament NOT IN ('bautismo','confirmacion','matrimonio','exequias')
 OR p_decree_type NOT IN ('correccion','reposicion')
 OR p_decree_date IS NULL OR p_decree_date>current_date
 OR length(v_num) NOT BETWEEN 4 AND 80
 OR length(v_ref) NOT BETWEEN 8 AND 120
 OR length(v_reason) NOT BETWEEN 15 AND 4000
 OR length(v_target) NOT BETWEEN 4 AND 300 THEN
  RAISE EXCEPTION 'V280: datos del decreto incompletos o no admitidos';
 END IF;
 SELECT up.diocese_id,up.chancery_id INTO di,ch
 FROM public.user_profiles up WHERE up.auth_user_id=a
 AND up.role='chancery' AND up.is_active IS TRUE
 AND upper(coalesce(up.status,''))='ACTIVE';
 IF di IS NULL OR NOT EXISTS (SELECT 1 FROM public.parishes p
   WHERE p.id=p_parish_id AND p.diocese_id=di AND p.is_operational) THEN
   RAISE EXCEPTION 'V280: solo Cancillería de esta diócesis' USING ERRCODE='42501';
 END IF;
 IF ch IS NULL THEN SELECT id INTO ch FROM public.chancelleries
   WHERE diocese_id=di ORDER BY id LIMIT 1; END IF;
 IF ch IS NULL OR NOT EXISTS(SELECT 1 FROM public.chancelleries
   WHERE id=ch AND diocese_id=di) THEN
   RAISE EXCEPTION 'V280: Cancillería sin jurisdicción válida';
 END IF;
 SELECT * INTO c FROM public.conceptos_anulacion
 WHERE id=p_concept_id AND diocese_id=di AND is_active IS TRUE FOR SHARE;
 IF NOT FOUND OR c.seinscribe IS DISTINCT FROM TRUE OR c.enlibro<>2
 OR lower(coalesce(c.sacrament_type,'')) NOT IN ('general',p_sacrament)
 OR (p_decree_type='correccion' AND lower(coalesce(c.tipo,'')) NOT IN('porcorreccion','correccion'))
 OR (p_decree_type='reposicion' AND lower(coalesce(c.tipo,'')) NOT IN('porreposicion','reposicion')) THEN
   RAISE EXCEPTION 'V280: concepto vigente, compatible y supletorio obligatorio';
 END IF;
 -- El concepto debe tener aprobación diocesana vigente con la política exacta.
 IF NOT EXISTS(
  SELECT 1 FROM sacramentum_ledger.supplementary_concept_approvals_v272 s
  WHERE s.concept_id=c.id AND s.diocese_id=di
  AND s.policy_snapshot=jsonb_build_object(
   'codigo',c.codigo,'concepto',c.concepto,'tipo',c.tipo,
   'sacrament_type',c.sacrament_type,'enlibro',c.enlibro,
   'seinscribe',c.seinscribe,'gennota',c.gennota,'gendocum',c.gendocum,
   'expide',c.expide,'source_kind',c.source_kind,
   'source_reference',c.source_reference,'is_active',c.is_active)
  AND s.approved_by IS NOT NULL
 ) THEN RAISE EXCEPTION 'V280: falta aprobación diocesana del concepto supletorio'; END IF;
 t:=CASE p_sacrament WHEN 'bautismo' THEN 'pending_baptisms'
  WHEN 'confirmacion' THEN 'pending_confirmations'
  WHEN 'matrimonio' THEN 'pending_marriages'
  ELSE 'pending_funerals' END;
 EXECUTE format('SELECT to_jsonb(p) FROM public.%I p
    WHERE p.id=$1 AND p.parish_id=$2 FOR UPDATE',t)
  INTO v_pending USING p_pending_id,p_parish_id;
 IF v_pending IS NULL OR lower(coalesce(v_pending->>'status',''))<>'pending'
 OR coalesce((v_pending->>'reportado')::boolean,false) THEN
   RAISE EXCEPTION 'V280: no existe boleta nueva pendiente en esta parroquia';
 END IF;
 v_raw:=coalesce(v_pending->'raw_data','{}'::jsonb);
 IF jsonb_typeof(v_raw)<>'object'
 OR coalesce(v_raw->>'source',v_raw->>'recordOrigin',v_raw->>'flow','')~*'historic|legacy|import'
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(v_raw) k
    WHERE k IN('book_number','Libro','libro','folio','page_number','number','entry_number')
     AND nullif(btrim(v_raw->>k),'') IS NOT NULL) THEN
   RAISE EXCEPTION 'V280: la memoria histórica o con libro previo no admite nuevo asiento';
 END IF;
 v_date:=coalesce(nullif(v_pending->>'celebration_date',''),
    nullif(v_pending->>'fecha_exequias',''),nullif(v_raw->>'celebration_date',''),
    nullif(v_raw->>'fechaSacramento',''),nullif(v_raw->>'fechaMatrimonio',''),
    nullif(v_raw->>'fecha_exequias',''));
 IF v_date IS NULL OR v_date!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 OR v_date::date>current_date THEN
   RAISE EXCEPTION 'V280: fecha de celebración comprobable obligatoria';
 END IF;
 SELECT count(*) INTO v_receipts FROM public.pending_creation_requests r
 WHERE r.parish_id=p_parish_id AND (
   (p_sacrament='bautismo' AND r.sacrament_type='bautismo'
    AND r.response->>'baptism_pending_id'=p_pending_id::text)
  OR (p_sacrament='confirmacion' AND (
    (r.sacrament_type='confirmacion' AND r.response->>'pending_id'=p_pending_id::text)
    OR (r.sacrament_type='bautismo' AND r.response->>'confirmation_pending_id'=p_pending_id::text)))
  OR (p_sacrament IN ('matrimonio','exequias')
    AND r.sacrament_type=p_sacrament AND r.response->>'pending_id'=p_pending_id::text)
 );
 IF v_receipts<>1 OR EXISTS(
   SELECT 1 FROM sacramentum_ledger.celebration_attestations_v263 x
   WHERE x.pending_id=p_pending_id) THEN
   RAISE EXCEPTION 'V280: falta origen nuevo único o la boleta ya tiene certificación';
 END IF;
 IF p_decree_type='correccion' THEN
  IF p_original_record_id IS NULL THEN
    RAISE EXCEPTION 'V280: la corrección debe vincular la partida original';
  END IF;
  t:=CASE p_sacrament WHEN 'bautismo' THEN 'baptisms'
    WHEN 'confirmacion' THEN 'confirmations' WHEN 'matrimonio' THEN 'marriages'
    ELSE 'funerals' END;
  EXECUTE format('SELECT to_jsonb(r) FROM public.%I r
      WHERE r.id=$1 AND r.parish_id=$2 FOR SHARE',t)
   INTO v_original USING p_original_record_id,p_parish_id;
  IF v_original IS NULL OR lower(coalesce(v_original->>'status','seated'))
       IN ('anulada','annulled','cancelled','reversed','deleted') THEN
   RAISE EXCEPTION 'V280: la partida original no existe o está anulada';
  END IF;
  IF EXISTS(SELECT 1 FROM public.decretos d
    WHERE d.original_record_id=p_original_record_id AND d.parish_id=p_parish_id
      AND d.sacrament_type=p_sacrament AND d.status='active'
      AND d.tipo='correccion' AND d.replacement_record_id IS NOT NULL) THEN
   RAISE EXCEPTION 'V280: ya hay corrección vigente de esta partida';
  END IF;
 ELSE
  IF p_original_record_id IS NOT NULL THEN
   RAISE EXCEPTION 'V280: reposición sin partida original, no admite anulación implícita';
  END IF;
 END IF;
 v_effect:=CASE WHEN p_decree_type='correccion' THEN 'annul_and_create' ELSE 'create_only' END;
 PERFORM pg_advisory_xact_lock(hashtextextended(di::text||':'||lower(v_num),280));
 IF EXISTS(SELECT 1 FROM public.decretos d
    WHERE d.diocese_id=di AND lower(btrim(d.decree_number))=lower(v_num))
 OR EXISTS(SELECT 1 FROM public.decretos d
    WHERE d.parish_id=p_parish_id AND d.payload->>'pendingId'=p_pending_id::text) THEN
    RAISE EXCEPTION 'V280: número de decreto o boleta ya utilizados';
 END IF;
 INSERT INTO public.decretos(
   parish_id,diocese_id,chancery_id,tipo,sacrament_type,
   decree_number,decree_date,original_record_id,
   replacement_record_id,status,issued_by,payload)
 VALUES(p_parish_id,di,ch,p_decree_type,p_sacrament,v_num,
   p_decree_date,p_original_record_id,NULL,'active',a,
   jsonb_build_object(
    'conceptoAnulacionId',p_concept_id,'recordOrigin','chancery_pending_seat_v280',
    'historical',false,'decreeEffect',v_effect,'decreeType',p_decree_type,
    'sacramentType',p_sacrament,'decreeNumber',v_num,
    'decreeDate',p_decree_date,'targetName',v_target,'reason',v_reason,
    'pendingId',p_pending_id,'bookType','suplementario',
    'evidenceRef',v_ref,'documentaryOnly',false,'registersEffect',true,
    'seatStatus','awaiting_parish','seatBook',null,'seatFolio',null,'seatNumber',null))
 RETURNING id INTO v_decree;
 INSERT INTO sacramentum_ledger.celebration_attestations_v263(
   pending_id,parish_id,sacrament,origin,verified_at,verified_by,evidence_ref,decree_id,decree_effect)
 VALUES(p_pending_id,p_parish_id,p_sacrament,'new_decree_supplement',clock_timestamp(),a,
   v_ref,v_decree,'create_supplementary_record');
 INSERT INTO public.official_notifications(
  diocese_id,sender_chancery_id,receiver_parish_id,decree_id,
  category,subject,message,status,payload,created_by)
 VALUES(di,ch,p_parish_id,v_decree,'decree',
   'Decreto '||v_num||' · pendiente de asiento',
   'Cancillería expidió el decreto. Debe sentarse en la parroquia por orden cronológico.',
   'pending',jsonb_build_object('decreeId',v_decree,'decreeType',p_decree_type,
    'sacramentType',p_sacrament,'decreeDate',p_decree_date,
    'pendingSeat',true,'recordOrigin','chancery_pending_seat_v280'),a)
 RETURNING id INTO v_notice;
 INSERT INTO public.registry_audit_log(actor_user_id,parish_id,diocese_id,
   entity_type,entity_id,action,after_data,metadata)
 VALUES(a,p_parish_id,di,'decree',v_decree,'issue_decree_pending_parish_seat_v280',
   jsonb_build_object('decree_number',v_num,'effect',v_effect,'pending_id',p_pending_id),
   jsonb_build_object('notification_id',v_notice,'coordinates_assigned',false));
 RETURN jsonb_build_object('decreeId',v_decree,'notificationId',v_notice,
  'status','awaiting_parish','decreeNumber',v_num,'physicalCoordinatesAssigned',false);
END $fn$;
REVOKE ALL ON FUNCTION public.issue_chancery_decree_v280(
 uuid,text,uuid,uuid,text,uuid,text,date,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.issue_chancery_decree_v280(
 uuid,text,uuid,uuid,text,uuid,text,date,text,text,text) TO authenticated;
COMMIT;
