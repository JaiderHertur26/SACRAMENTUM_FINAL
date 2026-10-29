BEGIN;
-- V280: el asiento pertenece a la parroquia, nunca a Cancillería.
-- Una transacción: secuencia validada + nueva partida + anulación (si procede)
-- + decreto completo + aviso de regreso a Cancillería.
CREATE FUNCTION public.seat_chancery_decree_v280(
 p_decree_id uuid,p_book_code text,p_book_id uuid,
 p_folio integer,p_number integer,p_partidas_per_folio integer,
 p_restart_number_each_folio boolean,p_expected_version bigint,p_operation_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a uuid:=auth.uid(); p uuid; di uuid; ch uuid;
 d public.decretos%rowtype; notice public.official_notifications%rowtype;
 book sacramentum_ledger.book_memories%rowtype;
 prior uuid; pending uuid; old_row jsonb;
 t text; code text:=upper(btrim(coalesce(p_book_code,'')));
 canon text; raw jsonb; outcome jsonb; seat jsonb; rec uuid;
 num int; capacity int; v_affected int;
 effect text; v_noted text;
BEGIN
 IF a IS NULL OR p_decree_id IS NULL OR p_operation_id IS NULL
  OR code !~ '^[A-Z0-9]{1,32}$'
  OR p_folio IS NULL OR p_folio<1 OR p_number IS NULL OR p_number<1
  OR p_partidas_per_folio IS NULL OR p_partidas_per_folio NOT BETWEEN 1 AND 200
  OR p_restart_number_each_folio IS NULL
  OR p_expected_version IS NULL OR p_expected_version<0 THEN
   RAISE EXCEPTION 'V280: Libro, Folio, Número y capacidad manuales obligatorios';
 END IF;
 SELECT up.parish_id,up.diocese_id INTO p,di FROM public.user_profiles up
 JOIN public.parishes pa ON pa.id=up.parish_id AND pa.diocese_id=up.diocese_id
 WHERE up.auth_user_id=a AND up.role='parish' AND up.is_active
   AND upper(coalesce(up.status,''))='ACTIVE' AND pa.is_operational;
 IF p IS NULL THEN RAISE EXCEPTION 'V280: solo parroquia de asiento autenticada' USING ERRCODE='42501'; END IF;
 -- Bloquea TODOS los decretos de esta parroquia; imposibilita carreras de orden.
 PERFORM 1 FROM public.parishes WHERE id=p FOR UPDATE;
 SELECT * INTO d FROM public.decretos WHERE id=p_decree_id AND parish_id=p FOR UPDATE;
 IF NOT FOUND OR d.diocese_id IS DISTINCT FROM di
  OR d.status<>'active'
  OR d.payload->>'recordOrigin'<>'chancery_pending_seat_v280'
  OR d.replacement_record_id IS NOT NULL
  OR d.sacrament_type NOT IN ('bautismo','confirmacion','matrimonio','exequias')
  OR d.tipo NOT IN('correccion','reposicion')
  OR d.decree_date IS NULL OR d.decree_date>current_date THEN
  RAISE EXCEPTION 'V280: decreto ajeno, histórico, archivado o ya asentado';
 END IF;
 SELECT * INTO notice FROM public.official_notifications n
 WHERE n.decree_id=d.id AND n.receiver_parish_id=p
   AND n.category='decree' FOR UPDATE;
 IF NOT FOUND OR notice.status<>'read' THEN
   RAISE EXCEPTION 'V280: debe leer la notificación antes de sentar el decreto';
 END IF;
 -- ORDEN ESTRICTO: fecha de decreto ascendente, después recepción, después UUID.
 SELECT q.id INTO prior FROM public.decretos q
 JOIN public.official_notifications no ON no.decree_id=q.id
  AND no.receiver_parish_id=p AND no.category='decree'
 WHERE q.parish_id=p AND q.status='active'
  AND q.payload->>'recordOrigin'='chancery_pending_seat_v280'
  AND q.replacement_record_id IS NULL
  AND NOT EXISTS(SELECT 1 FROM sacramentum_ledger.decree_seat_receipts_v280 r
    WHERE r.decree_id=q.id)
 ORDER BY q.decree_date ASC,no.created_at ASC,q.id ASC LIMIT 1;
 IF prior IS DISTINCT FROM d.id THEN
  RAISE EXCEPTION 'V280: hay un decreto anterior pendiente. Debe sentarse primero.';
 END IF;
 IF EXISTS(SELECT 1 FROM sacramentum_ledger.decree_seat_receipts_v280
   WHERE decree_id=d.id OR operation_id=p_operation_id) THEN
   RAISE EXCEPTION 'V280: asiento o identificador de operación ya utilizado';
 END IF;
 BEGIN pending:=(d.payload->>'pendingId')::uuid;
 EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'V280: origen pendiente inválido'; END;
 IF pending IS NULL THEN RAISE EXCEPTION 'V280: no hay boleta vinculada al decreto'; END IF;
 IF NOT EXISTS(SELECT 1 FROM sacramentum_ledger.celebration_attestations_v263 e
   WHERE e.pending_id=pending AND e.decree_id=d.id AND e.parish_id=p
   AND e.sacrament=d.sacrament_type AND e.origin='new_decree_supplement'
   AND e.decree_effect='create_supplementary_record') THEN
   RAISE EXCEPTION 'V280: falta certificación exclusiva del decreto';
 END IF;
 effect:=d.payload->>'decreeEffect';
 IF (d.tipo='correccion' AND (effect<>'annul_and_create' OR d.original_record_id IS NULL))
 OR (d.tipo='reposicion' AND (effect<>'create_only' OR d.original_record_id IS NOT NULL)) THEN
  RAISE EXCEPTION 'V280: efecto jurídico del decreto inconsistente';
 END IF;
 -- Libro 0001 y 0001A se preservan literalmente; la forma canónica evita
 -- abrir accidentalmente dos libros diferentes con el mismo identificador.
 canon:=CASE WHEN code~'^[0-9]+$'
   THEN coalesce(nullif(ltrim(code,'0'),''),'0') ELSE code END;
 SELECT * INTO book FROM sacramentum_ledger.book_memories m
 WHERE m.parish_id=p AND m.sacrament=d.sacrament_type
  AND m.book_type='suplementario' AND m.canonical_code=canon
  AND m.retired_at IS NULL FOR UPDATE;
 IF FOUND THEN
   IF book.closed_at IS NOT NULL OR book.id IS DISTINCT FROM p_book_id
    OR book.book_code<>code
    OR book.partidas_per_folio IS DISTINCT FROM p_partidas_per_folio
    OR book.restart_partida_each_folio IS DISTINCT FROM p_restart_number_each_folio THEN
     RAISE EXCEPTION 'V280: libro ya configurado; no se cambia capacidad, reinicio ni identidad';
   END IF;
 ELSE
   IF p_book_id IS NOT NULL OR p_expected_version<>0 THEN
     RAISE EXCEPTION 'V280: libro sin abrir; seleccione primer Libro, Folio y Número';
   END IF;
   IF EXISTS(SELECT 1 FROM sacramentum_ledger.book_memories m
    WHERE m.parish_id=p AND m.sacrament=d.sacrament_type
      AND m.book_type='suplementario' AND m.closed_at IS NULL
      AND m.retired_at IS NULL) THEN
     RAISE EXCEPTION 'V280: ya hay libro supletorio abierto para este sacramento';
   END IF;
   t:=CASE d.sacrament_type WHEN 'bautismo' THEN 'baptisms'
    WHEN 'confirmacion' THEN 'confirmations'
    WHEN 'matrimonio' THEN 'marriages' ELSE 'funerals' END;
   EXECUTE format('SELECT count(*) FROM public.%I
     WHERE parish_id=$1 AND
     (CASE WHEN book_number ~ ''^[0-9]+$''
      THEN coalesce(nullif(ltrim(book_number,''0''),''''),''0'')
      ELSE upper(book_number) END)=$2',t)
    INTO num USING p,canon;
   IF num<>0 THEN RAISE EXCEPTION 'V280: este libro ya contiene partidas físicas no conciliadas'; END IF;
   INSERT INTO sacramentum_ledger.book_memories(
    parish_id,sacrament,book_type,book_code,first_folio,first_partida,
    partidas_per_folio,restart_partida_each_folio,legacy_reconciled)
   VALUES(p,d.sacrament_type,'suplementario',code,p_folio,p_number,
    p_partidas_per_folio,p_restart_number_each_folio,true)
   RETURNING * INTO book;
 END IF;
 IF book.version<>p_expected_version THEN
   RAISE EXCEPTION 'V280: versión de libro cambió; relea la memoria antes de continuar';
 END IF;
 outcome:=sacramentum_ledger.real_seat_v263(p,d.sacrament_type,book.id,
    p_expected_version,p_folio,p_number,p_operation_id,jsonb_build_array(pending));
 seat:=outcome->'seats'->0;
 IF jsonb_array_length(outcome->'seats')<>1 OR seat->>'book'<>code THEN
   RAISE EXCEPTION 'V280: no se pudo verificar la partida creada';
 END IF;
 t:=CASE d.sacrament_type WHEN 'bautismo' THEN 'pending_baptisms'
  WHEN 'confirmacion' THEN 'pending_confirmations'
  WHEN 'matrimonio' THEN 'pending_marriages' ELSE 'pending_funerals' END;
 EXECUTE format('SELECT (raw_data->>''record_id'')::uuid FROM public.%I
   WHERE id=$1 AND parish_id=$2 AND status=''seated'' AND reportado IS TRUE',t)
 INTO rec USING pending,p;
 IF rec IS NULL THEN RAISE EXCEPTION 'V280: asiento sin partida nueva comprobable'; END IF;
 t:=CASE d.sacrament_type WHEN 'bautismo' THEN 'baptisms'
  WHEN 'confirmacion' THEN 'confirmations'
  WHEN 'matrimonio' THEN 'marriages' ELSE 'funerals' END;
 IF effect='annul_and_create' THEN
  -- La partida antigua solo se anula DESPUÉS de existir la nueva, en la
  -- misma transacción. Nunca se renumeran asientos anteriores.
  EXECUTE format('UPDATE public.%I SET status=''anulada'',
    raw_data=coalesce(raw_data,''{}''::jsonb) ||
      jsonb_build_object(''status'',''anulada'',''annulledByDecree'',$1,
       ''replacementRecordId'',$2) WHERE id=$3 AND parish_id=$4
       AND lower(coalesce(status,''seated'')) NOT IN
         (''anulada'',''annulled'',''cancelled'',''reversed'',''deleted'')',t)
   USING d.id,rec,d.original_record_id,p;
  GET DIAGNOSTICS v_affected=ROW_COUNT;
  IF v_affected<>1 THEN RAISE EXCEPTION 'V280: partida original cambió; anulación no autorizada'; END IF;
  v_noted:='PARTIDA ANULADA Y REEMPLAZADA POR DECRETO '||d.decree_number||
    ' DEL '||to_char(d.decree_date,'DD/MM/YYYY')||
    '. NUEVA PARTIDA: LIBRO '||code||' FOLIO '||(seat->>'folio')||
    ' NÚMERO '||(seat->>'number')||'.';
  INSERT INTO public.marginal_notes(
    sacrament_type,note_type,content,parish_id,sacrament_id,note_date,
    source_type,source_id,created_by,status)
  VALUES(d.sacrament_type,'decreto_anulacion',v_noted,p,d.original_record_id,
     d.decree_date,'decree',d.id,a,'active');
 END IF;
 INSERT INTO sacramentum_ledger.decree_seat_receipts_v280(
  decree_id,notification_id,parish_id,diocese_id,sacrament,decree_effect,
  original_record_id,created_record_id,book_id,book_code,folio,number,
  partidas_per_folio,operation_id,seated_by)
 VALUES(d.id,notice.id,p,di,d.sacrament_type,effect,
  d.original_record_id,rec,book.id,code,(seat->>'folio')::integer,
  (seat->>'number')::integer,book.partidas_per_folio,p_operation_id,a);
 UPDATE public.decretos SET replacement_record_id=rec,
   payload=payload||jsonb_build_object(
    'seatStatus','seated','seatBook',code,
    'seatFolio',seat->>'folio','seatNumber',seat->>'number',
    'seatCapacity',book.partidas_per_folio,'seatDate',clock_timestamp(),
    'seatBy',a,'replacementRecordId',rec)
 WHERE id=d.id AND parish_id=p AND replacement_record_id IS NULL;
 GET DIAGNOSTICS v_affected=ROW_COUNT;
 IF v_affected<>1 THEN RAISE EXCEPTION 'V280: el decreto ya no acepta vínculo con partida'; END IF;
 UPDATE public.official_notifications
 SET status='processed',processed_at=clock_timestamp(),
   payload=payload||jsonb_build_object('seatStatus','seated',
    'seatBook',code,'seatFolio',seat->>'folio',
    'seatNumber',seat->>'number','replacementRecordId',rec)
 WHERE id=notice.id AND receiver_parish_id=p AND status='read';
 GET DIAGNOSTICS v_affected=ROW_COUNT;
 IF v_affected<>1 THEN RAISE EXCEPTION 'V280: fallo el cierre de la notificación parroquial'; END IF;
 SELECT chancery_id INTO ch FROM public.decretos WHERE id=d.id;
 IF ch IS NULL THEN RAISE EXCEPTION 'V280: falta Cancillería de retorno'; END IF;
 INSERT INTO sacramentum_ledger.chancery_decree_receipts_v280(
  decree_id,diocese_id,chancery_id) VALUES(d.id,di,ch);
 INSERT INTO public.registry_audit_log(
 actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
 VALUES(a,p,di,'decree',d.id,'seat_chancery_decree_v280',
  jsonb_build_object('decreeNumber',d.decree_number,
    'createdRecordId',rec,'originalRecordId',d.original_record_id,
    'effect',effect,'book',code,'folio',seat->>'folio','number',seat->>'number'),
  jsonb_build_object('operationId',p_operation_id,'notificationId',notice.id,
    'chanceryReturn',true,'capacity',book.partidas_per_folio));
 RETURN jsonb_build_object('decreeId',d.id,'decreeNumber',d.decree_number,
  'book',code,'folio',seat->>'folio','number',seat->>'number',
  'partidasPorFolio',book.partidas_per_folio,
  'recordId',rec,'originalRecordId',d.original_record_id,
  'chanceryNotified',true,'notificationCompleted',true,'seats',outcome->'seats');
END $fn$;
REVOKE ALL ON FUNCTION public.seat_chancery_decree_v280(
 uuid,text,uuid,integer,integer,integer,boolean,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.seat_chancery_decree_v280(
 uuid,text,uuid,integer,integer,integer,boolean,bigint,uuid) TO authenticated;

CREATE FUNCTION public.get_parish_decree_queue_v280()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a uuid:=auth.uid();p uuid; result jsonb;
BEGIN
 SELECT up.parish_id INTO p FROM public.user_profiles up
 JOIN public.parishes par ON par.id=up.parish_id AND par.diocese_id=up.diocese_id
 WHERE up.auth_user_id=a AND up.role='parish' AND up.is_active
 AND upper(coalesce(up.status,''))='ACTIVE' AND par.is_operational;
 IF p IS NULL THEN RAISE EXCEPTION 'V280: se requiere sesión parroquial' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id',d.id,'decreeNumber',d.decree_number,'decreeDate',d.decree_date,
   'sacrament',d.sacrament_type,'decreeType',d.tipo,
   'effect',d.payload->>'decreeEffect',
   'pendingId',d.payload->>'pendingId',
   'originalRecordId',d.original_record_id,
   'notificationId',n.id,'notificationStatus',n.status,
   'receivedAt',n.created_at,
   'seatBook',d.payload->>'seatBook','seatFolio',d.payload->>'seatFolio',
   'seatNumber',d.payload->>'seatNumber',
   'seatStatus',coalesce(d.payload->>'seatStatus','awaiting_parish'),
   'readyToSeat',n.status='read' AND d.replacement_record_id IS NULL
   ) ORDER BY d.decree_date ASC,n.created_at ASC,d.id ASC),'[]'::jsonb)
  INTO result
 FROM public.decretos d JOIN public.official_notifications n ON n.decree_id=d.id
 AND n.receiver_parish_id=p AND n.category='decree'
 WHERE d.parish_id=p AND d.payload->>'recordOrigin'='chancery_pending_seat_v280'
  AND d.status='active';
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION public.get_parish_decree_queue_v280() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_parish_decree_queue_v280() TO authenticated;

CREATE FUNCTION public.get_chancery_decree_receipts_v280()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a uuid:=auth.uid();di uuid;ch uuid;result jsonb;
BEGIN
 SELECT diocese_id,chancery_id INTO di,ch FROM public.user_profiles up
 WHERE up.auth_user_id=a AND up.role='chancery' AND up.is_active
 AND upper(coalesce(up.status,''))='ACTIVE';
 IF di IS NULL THEN RAISE EXCEPTION 'V280: solo Cancillería autenticada' USING ERRCODE='42501'; END IF;
 IF ch IS NULL THEN SELECT id INTO ch FROM public.chancelleries
    WHERE diocese_id=di ORDER BY id LIMIT 1; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'decreeId',d.id,'decreeNumber',d.decree_number,'parishId',d.parish_id,
   'sacrament',r.sacrament,'effect',r.decree_effect,
   'createdRecordId',r.created_record_id,'originalRecordId',r.original_record_id,
   'book',r.book_code,'folio',r.folio,'number',r.number,
   'partidasPorFolio',r.partidas_per_folio,'seatedAt',r.seated_at,
   'readAt',a2.read_at,'notificationPending',a2.read_at IS NULL
 ) ORDER BY r.seated_at DESC),'[]'::jsonb) INTO result
 FROM sacramentum_ledger.chancery_decree_receipts_v280 a2
 JOIN sacramentum_ledger.decree_seat_receipts_v280 r ON r.decree_id=a2.decree_id
 JOIN public.decretos d ON d.id=r.decree_id
 WHERE a2.diocese_id=di AND a2.chancery_id=ch;
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION public.get_chancery_decree_receipts_v280() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_chancery_decree_receipts_v280() TO authenticated;

CREATE FUNCTION public.mark_chancery_decree_receipt_read_v280(p_decree_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a uuid:=auth.uid();di uuid;ch uuid;affected integer;
BEGIN
 SELECT diocese_id,chancery_id INTO di,ch FROM public.user_profiles up
 WHERE up.auth_user_id=a AND up.role='chancery' AND up.is_active
 AND upper(coalesce(up.status,''))='ACTIVE';
 IF di IS NULL OR p_decree_id IS NULL THEN
  RAISE EXCEPTION 'V280: permiso de Cancillería obligatorio' USING ERRCODE='42501'; END IF;
 IF ch IS NULL THEN SELECT id INTO ch FROM public.chancelleries
    WHERE diocese_id=di ORDER BY id LIMIT 1; END IF;
 UPDATE sacramentum_ledger.chancery_decree_receipts_v280
 SET read_by=a,read_at=coalesce(read_at,clock_timestamp())
 WHERE decree_id=p_decree_id AND diocese_id=di AND chancery_id=ch;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'V280: constancia ajena o inexistente'; END IF;
 RETURN jsonb_build_object('decreeId',p_decree_id,'acknowledged',true);
END $fn$;
REVOKE ALL ON FUNCTION public.mark_chancery_decree_receipt_read_v280(uuid)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mark_chancery_decree_receipt_read_v280(uuid)
 TO authenticated;
COMMIT;
