BEGIN;
-- V293: Cancillería tiene facultad de expedición por su rol, no se exige visto bueno diocesano adicional por concepto.
-- Se conserva íntegramente el control de jurisdicción, vigencia y compatibilidad de concepto, y la emisión sin coordenadas.
CREATE OR REPLACE FUNCTION public.issue_chancery_decree_v280(p_parish_id uuid, p_sacrament text, p_pending_id uuid, p_original_record_id uuid, p_decree_type text, p_concept_id uuid, p_decree_number text, p_decree_date date, p_target_name text, p_reason text, p_evidence_ref text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 -- Cancillería activa de la jurisdicción expide sin otra autorización por concepto.
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
END $function$
;
CREATE OR REPLACE FUNCTION public.get_chancery_decree_issue_context_v280(p_parish_id uuid, p_sacrament text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a uuid:=auth.uid();di uuid;pending_table text;registry_table text;
 pending_rows jsonb;original_rows jsonb; concepts jsonb;v_q text;
BEGIN
 SELECT up.diocese_id INTO di FROM public.user_profiles up
 WHERE up.auth_user_id=a AND up.role='chancery' AND up.is_active
 AND upper(coalesce(up.status,''))='ACTIVE';
 IF di IS NULL OR NOT EXISTS(SELECT 1 FROM public.parishes p
   WHERE p.id=p_parish_id AND p.diocese_id=di AND p.is_operational)
 OR p_sacrament NOT IN('bautismo','confirmacion','matrimonio','exequias') THEN
  RAISE EXCEPTION 'V280: jurisdicción de Cancillería inválida' USING ERRCODE='42501'; END IF;
 pending_table:=CASE p_sacrament WHEN 'bautismo' THEN 'pending_baptisms'
  WHEN 'confirmacion' THEN 'pending_confirmations'
  WHEN 'matrimonio' THEN 'pending_marriages' ELSE 'pending_funerals' END;
 registry_table:=CASE p_sacrament WHEN 'bautismo' THEN 'baptisms'
  WHEN 'confirmacion' THEN 'confirmations'
  WHEN 'matrimonio' THEN 'marriages' ELSE 'funerals' END;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'codigo',c.codigo,'concepto',c.concepto,'type',c.tipo,
    'seinscribe',c.seinscribe,'enLibro',c.enlibro)
    ORDER BY c.codigo), '[]'::jsonb) INTO concepts
 FROM public.conceptos_anulacion c
 WHERE c.diocese_id=di AND c.is_active AND c.enlibro=2 AND c.seinscribe
 AND lower(coalesce(c.sacrament_type,'')) IN('general',p_sacrament)
 AND lower(coalesce(c.tipo,'')) IN
  ('porcorreccion','correccion','porreposicion','reposicion');
 v_q:=format($query$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',x.id,'createdAt',x.created_at,
    'name',coalesce(nullif(btrim(concat_ws(' ',x.raw_data->>'nombres',
      x.raw_data->>'apellidos')),''),nullif(x.raw_data->>'novioNombres',''),
      nullif(x.raw_data->>'nombres',''),'Pendiente documental'),
    'celebrationDate',coalesce(to_jsonb(x)->>'celebration_date',
      to_jsonb(x)->>'fecha_exequias',x.raw_data->>'fechaSacramento',
      x.raw_data->>'fechaMatrimonio'),
    'registrationNumber',coalesce(x.raw_data->>'numeroRegistro',
      x.raw_data->>'numero_registro',to_jsonb(x)->>'numero_registro')
  ) ORDER BY x.created_at DESC),'[]'::jsonb)
  FROM public.%I x WHERE x.parish_id=$1
  AND x.status='pending' AND coalesce(x.reportado,false)=false
  AND EXISTS(SELECT 1 FROM public.pending_creation_requests r
    WHERE r.parish_id=$1 AND (
     (r.sacrament_type='bautismo' AND r.response->>'baptism_pending_id'=x.id::text)
     OR (r.sacrament_type='bautismo' AND r.response->>'confirmation_pending_id'=x.id::text)
     OR (r.sacrament_type=$2 AND r.response->>'pending_id'=x.id::text)))
  AND NOT EXISTS(SELECT 1 FROM sacramentum_ledger.celebration_attestations_v263 a
    WHERE a.pending_id=x.id)
  AND NOT EXISTS(SELECT 1 FROM public.decretos d WHERE d.parish_id=$1
    AND d.payload->>'pendingId'=x.id::text)
 $query$,pending_table);
 EXECUTE v_q INTO pending_rows USING p_parish_id,p_sacrament;
 v_q:=format($query$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'name',coalesce(nullif(btrim(concat_ws(' ',
      to_jsonb(r)->>'nombres',to_jsonb(r)->>'apellidos')),''),
       nullif(to_jsonb(r)->'raw_data'->>'novioNombres',''),'Partida'),
    'book',r.book_number,'folio',r.folio,'number',r.number,
    'status',r.status) ORDER BY r.created_at DESC), '[]'::jsonb)
  FROM public.%I r WHERE r.parish_id=$1
  AND lower(coalesce(r.status,'seated')) NOT IN
    ('anulada','annulled','cancelled','reversed','deleted')
 $query$,registry_table);
 EXECUTE v_q INTO original_rows USING p_parish_id;
 RETURN jsonb_build_object('parishId',p_parish_id,'sacrament',p_sacrament,
    'pending',pending_rows,'originals',original_rows,'concepts',concepts);
END $function$
;
DROP FUNCTION IF EXISTS public.check_chancery_decree_concept_v292(uuid,text,text);
COMMIT;
