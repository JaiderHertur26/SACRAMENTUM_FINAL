-- V325: reparación única del último asiento ordinario desviado desde un decreto.
-- Solo actúa sobre la huella previamente cotejada; preserva originales y decretos.
-- La protección monotónica se repone antes de confirmar, bajo bloqueo de escrituras.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='20s';
DO $repair$
DECLARE
 bad_id uuid;
 pending_id uuid;
 decree_id uuid;
 parish uuid;
 params_id uuid;
 repair_tag constant text := 'V325_decree_002_misrouted_ordinary_seat';
 b public.baptisms%rowtype; p public.pending_baptisms%rowtype;
 cfg public.parish_parameters%rowtype; d public.decretos%rowtype;
 originals jsonb; decree_snapshot jsonb; audit_id uuid:=gen_random_uuid();
BEGIN
 LOCK TABLE public.baptisms,public.pending_baptisms,public.parish_parameters,public.decretos,
 public.marginal_notes,public.official_notifications,public.matrimonial_notifications,
 public.matrimonial_notification_recipients,public.funerals,public.pending_funerals,
 public.confirmations,public.pending_confirmations IN SHARE ROW EXCLUSIVE MODE;
 IF EXISTS(SELECT 1 FROM public.registry_audit_log WHERE metadata->>'repair_tag'=repair_tag) THEN
  RAISE NOTICE 'V325: reparación ya registrada; no se repite'; RETURN;
 END IF;
 SELECT * INTO b FROM public.baptisms
 WHERE created_at='2026-11-02T01:11:42.108449Z'::timestamptz
 AND raw_data->>'recordOrigin' LIKE 'chancery_pending_seat_%' AND status='seated';
 IF NOT FOUND THEN RAISE NOTICE 'V325: este entorno no contiene el incidente cotejado'; RETURN; END IF;
 bad_id:=b.id;parish:=b.parish_id;pending_id:=(b.raw_data->>'pendingRegistryId')::uuid;
 SELECT * INTO STRICT cfg FROM public.parish_parameters WHERE parish_id=parish FOR UPDATE;
 params_id:=cfg.id;
 SELECT * INTO STRICT p FROM public.pending_baptisms WHERE id=pending_id FOR UPDATE;
 SELECT * INTO STRICT d FROM public.decretos WHERE parish_id=parish AND sacrament_type='bautismo'
 AND payload->>'pendingId'=pending_id::text FOR UPDATE;
 decree_id:=d.id;
 IF md5(to_jsonb(b)::text)<>'14b7dd1b6489af21b1f3d0cb9f20ffcb'
 OR md5(to_jsonb(p)::text)<>'685617325ad4a8d381c4215a00ae4d05'
 OR md5(to_jsonb(d)::text)<>'3b6c2713ecdd6cbdf87df16b37fd4b4e'
 THEN RAISE EXCEPTION 'V325: el incidente cambió después del cotejo; no se modifica'; END IF;
 IF b.parish_id<>parish OR p.parish_id<>parish OR cfg.parish_id<>parish OR d.parish_id<>parish
 OR b.book_number<>'0001' OR b.folio<>'0001' OR b.number<>'0002' OR b.status<>'seated'
 OR p.raw_data->>'seated_baptism_id'<>bad_id::text OR p.reportado IS NOT TRUE OR p.status<>'seated'
 OR d.payload->>'pendingId'<>pending_id::text OR d.payload->>'seatStatus'<>'awaiting_parish'
 OR d.status<>'active' OR d.replacement_record_id IS NOT NULL
 OR NOT sacramentum_private.is_decree_pending_v325(pending_id,'bautismo',p.raw_data)
 THEN RAISE EXCEPTION 'V325: estado no coincide con el asiento improcedente'; END IF;
 IF cfg.updated_at IS DISTINCT FROM '2026-11-02T01:11:42.108449Z'::timestamptz
 OR cfg.bautizos_params->>'ordinarioLibro' IS DISTINCT FROM '1'
 OR cfg.bautizos_params->>'ordinarioFolio' IS DISTINCT FROM '2'
 OR cfg.bautizos_params->>'ordinarioNumero' IS DISTINCT FROM '3'
 OR cfg.bautizos_params->>'ordinarioPartidas' IS DISTINCT FROM '2'
 OR cfg.bautizos_params->>'ordinarioRestartNumber' IS DISTINCT FROM 'false'
 OR cfg.bautizos_params->>'ordinarioBlocked' IS DISTINCT FROM 'false'
 OR EXISTS(SELECT 1 FROM public.baptisms WHERE parish_id=parish AND created_at>b.created_at)
 OR EXISTS(SELECT 1 FROM public.registry_audit_log WHERE parish_id=parish AND action='seat'
  AND entity_type IN ('baptism','bautismo') AND created_at>b.created_at)
 THEN RAISE EXCEPTION 'V325: el consecutivo avanzó o cambió; no se retrocede'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.registry_audit_log WHERE created_at=b.created_at
  AND entity_id=bad_id AND action='seat' AND metadata->>'pending_id'=pending_id::text)
 THEN RAISE EXCEPTION 'V325: falta la auditoría original del asiento'; END IF;
 IF EXISTS(SELECT 1 FROM public.matrimonial_notifications WHERE source_baptism_id=bad_id OR spouse_baptism_id=bad_id)
 OR EXISTS(SELECT 1 FROM public.matrimonial_notification_recipients WHERE target_baptism_id=bad_id)
 OR EXISTS(SELECT 1 FROM public.funerals WHERE baptism_id=bad_id)
 OR EXISTS(SELECT 1 FROM public.pending_funerals WHERE baptism_id=bad_id)
 OR EXISTS(SELECT 1 FROM public.confirmations x WHERE to_jsonb(x)::text LIKE '%'||bad_id::text||'%')
 OR EXISTS(SELECT 1 FROM public.pending_confirmations x WHERE to_jsonb(x)::text LIKE '%'||bad_id::text||'%')
 OR EXISTS(SELECT 1 FROM public.marginal_notes x WHERE to_jsonb(x)::text LIKE '%'||bad_id::text||'%')
 OR EXISTS(SELECT 1 FROM public.decretos x WHERE to_jsonb(x)::text LIKE '%'||bad_id::text||'%')
 OR EXISTS(SELECT 1 FROM public.official_notifications x WHERE to_jsonb(x)::text LIKE '%'||bad_id::text||'%')
 THEN RAISE EXCEPTION 'V325: el asiento tiene vínculos posteriores; requiere conciliación'; END IF;
 SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) INTO originals FROM public.baptisms x
  WHERE id IN (SELECT original_record_id FROM public.decretos WHERE parish_id=parish AND sacrament_type='bautismo' AND payload->>'seatStatus'='awaiting_parish' AND replacement_record_id IS NULL);
 IF jsonb_array_length(originals) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'V325: faltan originales'; END IF;
 SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) INTO decree_snapshot FROM public.decretos x
  WHERE parish_id=parish AND sacrament_type='bautismo' AND payload->>'seatStatus'='awaiting_parish' AND replacement_record_id IS NULL;
 IF jsonb_array_length(decree_snapshot) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'V325: faltan decretos'; END IF;
 INSERT INTO public.registry_audit_log(id,actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,before_data,metadata)
 VALUES(audit_id,NULL,parish,d.diocese_id,'baptism',bad_id,'repair_misrouted_decree',
 jsonb_build_object('baptism',to_jsonb(b),'pending',to_jsonb(p),'parameters',to_jsonb(cfg),
 'originals',originals,'decrees',decree_snapshot),
 jsonb_build_object('repair_tag',repair_tag,'protocol','V325','pending_id',pending_id,'decree_id',decree_id,
 'reason','Decreto desviado al RPC ordinario; se restaura pendiente sin ejecutar su acto legal',
 'original_seat_audit_id',(SELECT id FROM public.registry_audit_log WHERE entity_id=bad_id AND action='seat' AND created_at=b.created_at LIMIT 1),'maintenance_actor','authorized_supabase_maintenance'));
 DELETE FROM public.baptisms WHERE id=bad_id;
 UPDATE public.pending_baptisms SET status='pending',reportado=false,
 raw_data=raw_data-ARRAY['Libro','folio','number','numero','book_number','estado','status',
 'seated_book','seated_folio','seated_number','seated_baptism_id','boleta_archived']
 WHERE id=pending_id;
 IF (SELECT tgenabled FROM pg_trigger WHERE tgrelid='public.parish_parameters'::regclass AND tgname='trg_guard_baptism_parameter_monotonicity') IS DISTINCT FROM 'O'::"char" THEN
  RAISE EXCEPTION 'V325: estado inesperado de la protección monotónica';
 END IF;
 ALTER TABLE public.parish_parameters DISABLE TRIGGER trg_guard_baptism_parameter_monotonicity;
 UPDATE public.parish_parameters SET
 bautizos_params=jsonb_set(jsonb_set(jsonb_set(bautizos_params,'{ordinarioLibro}','1'),'{ordinarioFolio}','1'),'{ordinarioNumero}','2'),
 updated_at=now() WHERE id=params_id;
 ALTER TABLE public.parish_parameters ENABLE TRIGGER trg_guard_baptism_parameter_monotonicity;
 IF originals IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.baptisms x
  WHERE id IN (SELECT original_record_id FROM public.decretos WHERE parish_id=parish AND sacrament_type='bautismo' AND payload->>'seatStatus'='awaiting_parish' AND replacement_record_id IS NULL))
 OR decree_snapshot IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.decretos x
  WHERE parish_id=parish AND sacrament_type='bautismo' AND payload->>'seatStatus'='awaiting_parish' AND replacement_record_id IS NULL)
 THEN RAISE EXCEPTION 'V325: se detectó modificación ajena al incidente'; END IF;
 UPDATE public.registry_audit_log SET after_data=jsonb_build_object('baptism_removed_from_active_registry',true,
  'pending',(SELECT to_jsonb(x) FROM public.pending_baptisms x WHERE id=pending_id),
  'parameters',(SELECT to_jsonb(x) FROM public.parish_parameters x WHERE id=params_id),
  'originals_unchanged',true,'decrees_unchanged',true,'decree_seated',false)
 WHERE id=audit_id;
END $repair$;