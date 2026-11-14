-- La primera partida fija la capacidad y el origen del consecutivo. Dos modos de avance.
BEGIN;
DO $initial$
DECLARE
  actor uuid;
  parish uuid;
  row_data record;
  selected uuid;
  ids uuid[];
  book integer;
  ctx jsonb;
  coords jsonb;
  data jsonb;
  saved integer;
  count_checked integer:=0;
BEGIN
  SELECT u.auth_user_id,u.parish_id INTO STRICT actor,parish
  FROM public.user_profiles u JOIN public.parishes p ON p.id=u.parish_id AND p.is_operational
  WHERE u.role='parish' AND u.is_active AND upper(u.status)='ACTIVE' ORDER BY u.parish_id LIMIT 1;

  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);

  FOR row_data IN SELECT * FROM (VALUES ('bautismo','bautizos_params','pending_baptisms','baptisms',false),
    ('confirmacion','confirmaciones_params','pending_confirmations','confirmations',true),
    ('matrimonio','matrimonios_params','pending_marriages','marriages',false),
    ('exequias','exequias_params','pending_funerals','funerals',true)) t(sacrament,parameters,source_table,registry_table,restart)
  LOOP
    EXECUTE format('UPDATE public.parish_parameters SET %1$I=coalesce(%1$I,''{}''::jsonb) - ARRAY[''ordinarioFirstFolio'',''ordinarioFirstNumber'']
      || ''{"ordinarioLibro":1,"ordinarioFolio":1,"ordinarioNumero":1,"ordinarioPartidas":2,"ordinarioBlocked":false}''::jsonb WHERE parish_id=$1',
      row_data.parameters) USING parish;
    -- Todos los libros existentes conservan sus registros. En este ensayo se
    -- usa exclusivamente una parroquia que tenga el libro de partida vacío.
    EXECUTE format('SELECT count(*) FROM public.%I WHERE parish_id=$1 AND ltrim(book_number,''0'')=''1''',row_data.registry_table) INTO saved USING parish;
    IF saved>0 THEN RAISE EXCEPTION 'El fixture requiere vacío el libro de arranque en %',row_data.sacrament; END IF;
    ids:=ARRAY(SELECT gen_random_uuid() FROM generate_series(1,CASE WHEN row_data.sacrament='exequias' THEN 1 ELSE 3 END));
    FOREACH selected IN ARRAY ids LOOP
      EXECUTE format('INSERT INTO public.%I (id,parish_id,status,reportado,raw_data)
        VALUES ($1,$2,''pending'',false,$3)',row_data.source_table)
      USING selected,parish,jsonb_build_object('nombres','PERSONA','apellidos','FICTICIA V328',
        'novioNombres','PERSONA UNO','noviaNombres','PERSONA DOS',
        'fechaSacramento','1990-05-01','fecha_exequias','1990-05-01','fecha_defuncion','1990-04-30',
        'source','current_parish_registration','numeroRegistro','000016328');
    END LOOP;
    SELECT jsonb_agg(jsonb_build_object('pending_id',id) ORDER BY ord) INTO data FROM unnest(ids) WITH ORDINALITY a(id,ord);
    book:=9995;
    coords:=jsonb_build_object('book',book,'folio',8,'number',50,'capacity',2,'restart',row_data.restart);
    SET LOCAL ROLE authenticated;
    ctx:=public.get_parish_seat_context_v328(parish,row_data.sacrament,ids);
    IF (ctx->>'initial') IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Se esperaba libro sin iniciar en %',row_data.sacrament; END IF;
    PERFORM public.seat_parish_records_v328(parish,row_data.sacrament,data,ctx,coords);
    RESET ROLE;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE parish_id=$1 AND book_number=''9995''
      AND ((folio=''0008'' AND number IN (''0050'',''0051'')) OR
           (folio=''0009'' AND number=$2))',row_data.registry_table) INTO saved USING parish,CASE WHEN row_data.restart THEN '0001' ELSE '0052' END;
    IF saved<>cardinality(ids) THEN RAISE EXCEPTION 'Coordenadas iniciales y secuencia incorrectas para %',row_data.sacrament; END IF;
    count_checked:=count_checked+1;
  END LOOP;
  PERFORM set_config('qa328.initial',jsonb_build_object('first_books_tested',count_checked,'rollback',true)::text,true);
END;
$initial$;
SELECT current_setting('qa328.initial')::jsonb AS result;
ROLLBACK;
