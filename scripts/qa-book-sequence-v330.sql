-- PostgreSQL desechable. Todos los actores, partidas y decretos son ficticios.
BEGIN;
DO $qa$
<<qa>>
DECLARE
  diocese_id uuid:=gen_random_uuid();
  parish_id uuid:=gen_random_uuid();
  parish_actor uuid:=gen_random_uuid();
  m record;
  pending uuid;
  context_before jsonb;
  context_after jsonb;
  result jsonb:='{}';
  memory_before jsonb;
  memory_after jsonb;
  failure text;
BEGIN
  INSERT INTO public.dioceses(id) VALUES(diocese_id);
  INSERT INTO public.parishes(id,diocese_id,is_operational) VALUES(parish_id,diocese_id,true);
  INSERT INTO public.user_profiles(auth_user_id,role,parish_id,diocese_id,is_active,status)
    VALUES(parish_actor,'parish',parish_id,diocese_id,true,'ACTIVE');
  PERFORM public.sacramentum_ensure_parish_parameters(parish_id);
  FOR m IN SELECT * FROM (VALUES ('bautismo','pending_baptisms','bautizos_params'),('confirmacion','pending_confirmations','confirmaciones_params'),
    ('matrimonio','pending_marriages','matrimonios_params'),('exequias','pending_funerals','exequias_params')) s(sacrament,pending_table,param) LOOP
    pending:=gen_random_uuid();
    EXECUTE format('INSERT INTO public.%I(id,parish_id,status,reportado,raw_data) VALUES($1,$2,''pending'',false,$3)',m.pending_table)
      USING pending,parish_id,jsonb_build_object('source','current_parish_registration','fechaSacramento','1990-01-01',
        'fecha_exequias','1990-01-01','fecha_defuncion','1989-12-29','numeroRegistro','8100','nombres','PERSONA',
        'apellidos','DE ENSAYO','novioNombres','PERSONA UNO','noviaNombres','PERSONA DOS');
    SELECT to_jsonb(p) INTO STRICT memory_before FROM public.parish_parameters p WHERE p.parish_id=qa.parish_id;
    PERFORM set_config('request.jwt.claim.sub',parish_actor::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',parish_actor,'role','authenticated')::text,true);
    SET LOCAL ROLE authenticated;
    context_before:=public.get_parish_seat_context_v328(parish_id,m.sacrament,ARRAY[pending]);
    PERFORM public.register_historical_narrative(parish_id,m.sacrament,
      '{"book_number":"1","folio":"15","number":"20","book_type":"ordinario",
        "literalTranscription":"Partida física anterior ficticia"}');
    context_after:=public.get_parish_seat_context_v328(parish_id,m.sacrament,ARRAY[pending]);
    RESET ROLE;
    SELECT to_jsonb(p) INTO STRICT memory_after FROM public.parish_parameters p WHERE p.parish_id=qa.parish_id;
    IF context_before->>'initial' IS DISTINCT FROM 'true' OR context_after IS DISTINCT FROM context_before
      OR memory_before IS DISTINCT FROM memory_after THEN
      RAISE EXCEPTION 'La entrada histórica inició o consumió memoria ordinaria en %',m.sacrament;
    END IF;
    failure:=NULL;
    SET LOCAL ROLE authenticated;
    BEGIN
      PERFORM public.seat_parish_records_v328(parish_id,m.sacrament,jsonb_build_array(jsonb_build_object('pending_id',pending)),
        context_after,'{"book":1,"folio":15,"number":20,"capacity":2,"restart":false}');
    EXCEPTION WHEN check_violation THEN failure:=SQLSTATE;
    END;
    RESET ROLE;
    IF failure IS DISTINCT FROM '23514' THEN RAISE EXCEPTION 'Se aceptó una primera posición ocupada en %',m.sacrament; END IF;
    SET LOCAL ROLE authenticated;
    PERFORM public.seat_parish_records_v328(parish_id,m.sacrament,jsonb_build_array(jsonb_build_object('pending_id',pending)),
      context_after,jsonb_build_object('book',1,'folio',15,'number',21,'capacity',2,'firstFolioUsed',1,
        'restart',m.sacrament='confirmacion'));
    RESET ROLE;
    SELECT to_jsonb(p) INTO STRICT memory_after FROM public.parish_parameters p WHERE p.parish_id=qa.parish_id;
    IF (memory_after->m.param->>'ordinarioFirstNumber') IS DISTINCT FROM '21'
       OR (memory_after->m.param->>'ordinarioFolio') IS DISTINCT FROM '16'
       OR (memory_after->m.param->>'ordinarioNumero') IS DISTINCT FROM
         (CASE WHEN m.sacrament='confirmacion' THEN '1' ELSE '22' END) THEN
      RAISE EXCEPTION 'No se fijó la memoria desde la continuación física en %',m.sacrament;
    END IF;
    result:=result||jsonb_build_object(m.sacrament,CASE WHEN m.sacrament='confirmacion'
      THEN 'histórica 1/15/20 → nuevo 1/15/21 → próximo 1/16/1'
      ELSE 'histórica 1/15/20 → nuevo 1/15/21 → próximo 1/16/22' END);
  END LOOP;
  PERFORM set_config('qa_libros.initial_history',jsonb_build_object('tested',result,'rolled_back',true)::text,true);
END;
$qa$;

DO $qa$
<<qa>>
DECLARE
  diocese_id uuid:=gen_random_uuid();
  parish_id uuid:=gen_random_uuid();
  parish_actor uuid:=gen_random_uuid();
  m record;
  ids uuid[];
  idx integer;
  context jsonb;
  subset jsonb;
  shown_again jsonb;
  saved jsonb;
  bapt uuid;
  note text;
  count_saved integer;
  pass_count integer:=0;
BEGIN
  INSERT INTO public.dioceses(id) VALUES(diocese_id);
  INSERT INTO public.parishes(id,diocese_id,is_operational) VALUES(parish_id,diocese_id,true);
  INSERT INTO public.user_profiles(auth_user_id,role,parish_id,diocese_id,is_active,status)
    VALUES(parish_actor,'parish',parish_id,diocese_id,true,'ACTIVE');
  PERFORM public.sacramentum_ensure_parish_parameters(parish_id);
  PERFORM set_config('request.jwt.claim.sub',parish_actor::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',parish_actor,'role','authenticated')::text,true);
  FOR m IN SELECT * FROM (VALUES ('bautismo','pending_baptisms','baptisms'),('confirmacion','pending_confirmations','confirmations'),
    ('matrimonio','pending_marriages','marriages')) s(sacrament,pending_table,registry_table)
  LOOP
    ids:=ARRAY[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
    FOR idx IN 1..3 LOOP
      EXECUTE format('INSERT INTO public.%I(id,parish_id,status,reportado,raw_data) VALUES($1,$2,''pending'',false,$3)',m.pending_table)
        USING ids[idx],parish_id,jsonb_build_object('source','current_parish_registration','fechaSacramento','1990-01-01',
          'fechaMatrimonio','1990-01-01','numeroRegistro',8200+idx,'nombres','PERSONA','apellidos','DE ENSAYO',
          'novioNombres','PERSONA UNO','noviaNombres','PERSONA DOS');
    END LOOP;
    SET LOCAL ROLE authenticated;
    context:=public.get_parish_seat_context_v328(parish_id,m.sacrament,ids[1:1]);
    PERFORM public.seat_parish_records_v328(parish_id,m.sacrament,jsonb_build_array(jsonb_build_object('pending_id',ids[1])),
      context,'{"book":1,"folio":8,"number":2,"capacity":2,"restart":false}');
    PERFORM public.register_historical_narrative(parish_id,m.sacrament,
      '{"book_number":"1","folio":"9","number":"4","book_type":"ordinario","literalTranscription":"Partida ya registrada en papel antes de digitalizar"}');
    context:=public.get_parish_seat_context_v328(parish_id,m.sacrament,ids[2:3]);
    IF context->>'number' IS DISTINCT FROM '3' OR context->>'folio' IS DISTINCT FROM '8' THEN
      RAISE EXCEPTION 'Contexto para el lote contrario al siguiente asiento válido en %',m.sacrament;
    END IF;
    IF m.sacrament='confirmacion' THEN
      SELECT d.record_id INTO STRICT bapt FROM public.register_historical_narrative(parish_id,'bautismo',
        '{"book_number":"2","folio":"31","number":"4","literalTranscription":"Partida bautismal para la nota de Confirmación"}') d;
    END IF;
    SELECT jsonb_agg(jsonb_build_object('pending_id',item,'cross_baptism_id',bapt,
      'cross_note_template','CONFIRMACIÓN ASENTADA EN LIBRO [LIBRO_CONF], FOLIO [FOLIO_CONF], NÚMERO [NUMERO_CONF]') ORDER BY ord)
      INTO subset FROM unnest(ids[2:3]) WITH ORDINALITY t(item,ord);
    saved:=public.seat_parish_records_v328(parish_id,m.sacrament,subset,context,'{"book":1,"folio":8,"number":3}');
    RESET ROLE;
    IF saved->>'seated_count' IS DISTINCT FROM '2' OR saved->>'next_folio' IS DISTINCT FROM '10'
      OR saved->>'next_number' IS DISTINCT FROM '6' THEN
      RAISE EXCEPTION 'No se completó el lote en las posiciones libres en %',m.sacrament;
    END IF;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE parish_id=$1 AND book_number=''0001'' AND
      ((folio=''0008'' AND number=''0003'') OR (folio=''0009'' AND number=''0005'') OR
      (folio=''0009'' AND number=''0004'' AND raw_data->>''source''=''historical_book_digitization''))',m.registry_table)
      INTO count_saved USING parish_id;
    IF count_saved<>3 THEN RAISE EXCEPTION 'Se modificó una ubicación física en %',m.sacrament; END IF;
    IF m.sacrament='confirmacion' THEN
      SELECT b.nota_marginal INTO STRICT note FROM public.baptisms b WHERE b.id=bapt;
      IF note NOT LIKE '%LIBRO 0001, FOLIO 0008, NÚMERO 0003%'
         OR note NOT LIKE '%LIBRO 0001, FOLIO 0009, NÚMERO 0005%' THEN
        RAISE EXCEPTION 'La nota marginal quedó con coordenadas incorrectas';
      END IF;
    END IF;
    pass_count:=pass_count+1;
  END LOOP;
  PERFORM set_config('qa_libros.batch_result',jsonb_build_object('batches_processed_atomically',pass_count,
    'marginal_uses_exact_position',true,'occupied','1/9/4','next_available','1/9/5','rolled_back',true)::text,true);
END;
$qa$;

DO $qa$
<<qa>>
DECLARE
  diocese_id uuid:=gen_random_uuid();
  parish_id uuid:=gen_random_uuid();
  parish_actor uuid:=gen_random_uuid();
  chancery_actor uuid:=gen_random_uuid();
  chancery_id uuid:=gen_random_uuid();
  concept_id uuid:=gen_random_uuid();
  section record;
  doc jsonb;
  decree_date date:=(clock_timestamp() at time zone 'America/Bogota')::date-15;
  book_code text:='330A';
  issued jsonb[];
  seated jsonb;
  context jsonb;
  refs jsonb:='{}';
  current_memory uuid;
  version bigint;
  params_before jsonb;
  params_after jsonb;
  failure text;
  passed jsonb:='{}';
  memory_before jsonb;
  memory_after jsonb;
  remaining_book jsonb;
BEGIN
  INSERT INTO public.dioceses(id) VALUES(diocese_id);
  INSERT INTO public.parishes(id,diocese_id,is_operational) VALUES(parish_id,diocese_id,true);
  INSERT INTO public.user_profiles(auth_user_id,role,parish_id,diocese_id,is_active,status)
    VALUES(parish_actor,'parish',parish_id,diocese_id,true,'ACTIVE');
  PERFORM public.sacramentum_ensure_parish_parameters(parish_id);
  INSERT INTO public.chancelleries(id,name,diocese_id) VALUES(chancery_id,'Cancillería ficticia ensayo de libros',diocese_id);
  INSERT INTO public.user_profiles(auth_user_id,role,chancery_id,diocese_id,status,is_active,full_name)
    VALUES(chancery_actor,'chancery',chancery_id,diocese_id,'ACTIVE',true,'Canciller de ensayo ficticio');
  UPDATE public.chancelleries SET chancellor_name='Canciller de ensayo ficticio' WHERE id=qa.chancery_id;
  INSERT INTO public.conceptos_anulacion(id,diocese_id,tipo,concepto,codigo,sacrament_type,seinscribe,enlibro)
  VALUES(concept_id,diocese_id,'porreposicion','Reposición de ensayo','QA330R','general',true,2);


  FOR section IN SELECT * FROM (VALUES
    ('bautismo','baptisms'), ('confirmacion','confirmations'), ('matrimonio','marriages'), ('exequias','funerals')
  ) AS b(sacrament,registry_table) LOOP
    PERFORM set_config('request.jwt.claim.sub',parish_actor::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',parish_actor,'role','authenticated')::text,true);
    SET LOCAL ROLE authenticated;
    RESET ROLE;
    PERFORM set_config('request.jwt.claim.sub',chancery_actor::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',chancery_actor,'role','authenticated')::text,true);
    SET LOCAL ROLE authenticated;
    doc:='{"nombres":"PERSONA","apellidos":"FICTICIA PRUEBA COLISION","novioNombres":"PERSONA UNO","noviaNombres":"PERSONA DOS","fechaSacramento":"1995-01-01","fechaMatrimonio":"1995-01-01","fecha_exequias":"1995-01-01","fecha_defuncion":"1994-12-31"}';
    issued:=ARRAY[
      public.issue_chancery_form_decree_v294(parish_id,section.sacrament,'reposicion',NULL,concept_id,
        'QA-330-X1-'||section.sacrament,decree_date,'PERSONA FICTICIA DE ENSAYO',
        'Auditoría transaccional de colisión entre actas históricas y nuevos decretos','QA330 EVIDENCIA',doc,'{}','canciller'),
      public.issue_chancery_form_decree_v294(parish_id,section.sacrament,'reposicion',NULL,concept_id,
        'QA-330-X2-'||section.sacrament,decree_date+1,'PERSONA FICTICIA DE ENSAYO',
        'Auditoría transaccional de colisión entre actas históricas y nuevos decretos','QA330 EVIDENCIA',doc,'{}','canciller')
    ];
    RESET ROLE;
    PERFORM set_config('request.jwt.claim.sub',parish_actor::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',parish_actor,'role','authenticated')::text,true);
    SET LOCAL ROLE authenticated;
    PERFORM public.mark_official_notification_read((issued[1]->>'notificationId')::uuid);
    PERFORM public.mark_official_notification_read((issued[2]->>'notificationId')::uuid);
    PERFORM public.register_historical_narrative(
      parish_id,section.sacrament,'{"book_number":"330A","folio":"2","number":"20","book_type":"suplementario",
      "literalTranscription":"Partida histórica de un libro supletorio en uso"}');
    failure:=NULL;
    BEGIN
      PERFORM public.seat_chancery_decree_v280((issued[1]->>'decreeId')::uuid,
        '330A',NULL,2,20,2,false,0,gen_random_uuid());
    EXCEPTION WHEN check_violation THEN failure:=SQLERRM;
    END;
    IF failure IS NULL OR failure NOT ILIKE '%ya está registrada%' THEN
      RAISE EXCEPTION 'Se aceptó una posición ocupada para iniciar libro en %',section.sacrament;
    END IF;
    seated:=public.seat_chancery_decree_v330((issued[1]->>'decreeId')::uuid,book_code,NULL,8,4,3,false,0,gen_random_uuid(),1);
    context:=public.get_parish_decree_books_v280((issued[2]->>'decreeId')::uuid);
    current_memory:=(context->'books'->0->>'id')::uuid;
    version:=(context->'books'->0->>'version')::bigint;
    PERFORM public.register_historical_narrative(
      parish_id,section.sacrament,'{"book_number":"330A","folio":"8","number":"5","book_type":"suplementario",
      "literalTranscription":"Partida histórica del mismo lugar que indica la memoria"}') h;
    remaining_book:=public.get_parish_decree_books_v280((issued[2]->>'decreeId')::uuid)->'books'->0;
    IF remaining_book->>'advanced' IS DISTINCT FROM 'true' OR remaining_book->>'nextFolio' IS DISTINCT FROM '9'
      OR remaining_book->>'nextNumber' IS DISTINCT FROM '6' OR remaining_book->>'version' IS DISTINCT FROM version::text
      OR remaining_book->>'activeCount' IS DISTINCT FROM '1' THEN
      RAISE EXCEPTION 'Consulta supletoria no encontró una posición libre sin consumir memoria en %',section.sacrament;
    END IF;
    RESET ROLE;
    SELECT to_jsonb(b) INTO STRICT memory_before FROM sacramentum_ledger.book_memories b WHERE b.id=current_memory;
    SELECT to_jsonb(pp) INTO STRICT params_before FROM public.parish_parameters pp WHERE pp.parish_id=qa.parish_id;
    failure:=NULL;
    SET LOCAL ROLE authenticated;
    BEGIN
      PERFORM public.seat_chancery_decree_v280((issued[2]->>'decreeId')::uuid,
        book_code,current_memory,8,5,3,false,version,gen_random_uuid());
    EXCEPTION WHEN raise_exception THEN failure:=SQLERRM;
    END;
    RESET ROLE;
    IF failure IS NULL OR failure NOT ILIKE '%siguiente posición libre%' THEN
      RAISE EXCEPTION 'Aceptó la posición supletoria histórica ocupada en %',section.sacrament;
    END IF;
    SELECT to_jsonb(b) INTO STRICT memory_after FROM sacramentum_ledger.book_memories b WHERE b.id=current_memory;
    SELECT to_jsonb(pp) INTO STRICT params_after FROM public.parish_parameters pp WHERE pp.parish_id=qa.parish_id;
    IF memory_before IS DISTINCT FROM memory_after OR params_before IS DISTINCT FROM params_after OR
      EXISTS(SELECT 1 FROM sacramentum_ledger.decree_seat_receipts_v280 r WHERE r.decree_id=(issued[2]->>'decreeId')::uuid)
      OR (SELECT n.status FROM public.official_notifications n WHERE n.id=(issued[2]->>'notificationId')::uuid) IS DISTINCT FROM 'read' THEN
      RAISE EXCEPTION 'El fallo dejó cambios en %',section.sacrament;
    END IF;
    SET LOCAL ROLE authenticated;
    seated:=public.seat_chancery_decree_v280((issued[2]->>'decreeId')::uuid,
      book_code,current_memory,9,6,3,false,version,gen_random_uuid());
    RESET ROLE;
    IF (seated->>'folio')::int<>9 OR (seated->>'number')::int<>6
      OR NOT EXISTS(SELECT 1 FROM sacramentum_ledger.active_seats a WHERE
        a.book_id=current_memory AND a.ordinal=1 AND a.folio=9 AND a.partida=6)
      OR (SELECT active_count FROM sacramentum_ledger.book_memories WHERE id=current_memory)<>2
      OR (SELECT first_folio_used FROM sacramentum_ledger.book_memories WHERE id=current_memory)<>1
      OR NOT EXISTS(SELECT 1 FROM sacramentum_ledger.chancery_decree_receipts_v280 r
        WHERE r.decree_id=(issued[2]->>'decreeId')::uuid) THEN
      RAISE EXCEPTION 'No se asentó en la posición supletoria libre de %',section.sacrament;
    END IF;
    passed:=passed||jsonb_build_object(section.sacrament,'histórica 330A/2/20 → decreto 330A/8/4 → histórica 330A/8/5 → decreto 330A/9/6');
  END LOOP;
  PERFORM set_config('qa_libros.collision_result',jsonb_build_object('continued_in_all_four_supplementary_books',passed,'rolled_back',true)::text,true);
END;
$qa$;

SELECT current_setting('qa_libros.initial_history')::jsonb AS opening,
  current_setting('qa_libros.batch_result')::jsonb AS batch,
  current_setting('qa_libros.collision_result')::jsonb AS supplementary;
ROLLBACK;
