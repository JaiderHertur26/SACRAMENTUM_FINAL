-- Registros ficticios. Siempre se revierten el asiento y su numeración.
BEGIN;
SET LOCAL statement_timeout='30000ms';
SET LOCAL lock_timeout='5s';
DO $qa$
DECLARE
  actor uuid;
  parish uuid;
  module record;
  ids uuid[];
  input jsonb;
  old_params jsonb;
  params jsonb;
  context jsonb;
  coordinates jsonb;
  response jsonb;
  checks integer:=0;
  trial text;
  trial_coords jsonb;
  rejected boolean;
  selected uuid;
  saved integer;
  start_date date:=(statement_timestamp() AT TIME ZONE 'America/Bogota')::date-4;
  definition regprocedure;
BEGIN
  SELECT u.auth_user_id,u.parish_id INTO STRICT actor,parish FROM public.user_profiles u
  JOIN public.parishes p ON p.id=u.parish_id AND p.diocese_id=u.diocese_id
  WHERE u.role='parish' AND u.is_active AND upper(u.status)='ACTIVE' AND p.is_operational
  ORDER BY u.parish_id LIMIT 1;

  FOREACH definition IN ARRAY ARRAY['public.seat_baptism_records(uuid,jsonb,integer,integer,integer)'::regprocedure,
    'public.seat_confirmation_records(uuid,jsonb,integer,integer,integer)'::regprocedure,
    'public.seat_pending_marriage(uuid)'::regprocedure,'public.seat_funeral_record(jsonb,uuid)'::regprocedure]
  LOOP
    IF coalesce(current_setting('qa328.cutover',true),'on')='on' AND has_function_privilege('authenticated',definition,'EXECUTE') THEN
      RAISE EXCEPTION 'El asiento antiguo conserva acceso de escritura: %',definition;
    END IF;
  END LOOP;
  IF has_function_privilege('anon','public.seat_parish_records_v328(uuid,text,jsonb,jsonb,jsonb)','EXECUTE')
     OR has_function_privilege('anon','public.get_parish_seat_context_v328(uuid,text,uuid[])','EXECUTE') THEN
     RAISE EXCEPTION 'Acceso anónimo a los asientos';
  END IF;

  FOR module IN SELECT * FROM (VALUES
      ('bautismo','pending_baptisms','baptisms','bautizos_params',3),
      ('confirmacion','pending_confirmations','confirmations','confirmaciones_params',3),
      ('matrimonio','pending_marriages','marriages','matrimonios_params',3),
      ('exequias','pending_funerals','funerals','exequias_params',1)
    ) AS m(sacrament,pending_table,registry_table,param_column,rows)
  LOOP
    EXECUTE format('SELECT %I FROM public.parish_parameters WHERE parish_id=$1',module.param_column) INTO old_params USING parish;
    EXECUTE format('UPDATE public.parish_parameters SET %I=$1 WHERE parish_id=$2',module.param_column)
      USING coalesce(old_params,'{}'::jsonb)-ARRAY['ordinarioFirstFolio','ordinarioFirstNumber']
        || '{"ordinarioLibro":9990,"ordinarioFolio":18,"ordinarioNumero":4,"ordinarioPartidas":2,"ordinarioBlocked":false,"ordinarioRestartNumber":false}'::jsonb,parish;
    ids:=ARRAY(SELECT gen_random_uuid() FROM generate_series(1,module.rows));
    FOREACH selected IN ARRAY ids LOOP
      EXECUTE format('INSERT INTO public.%I(id,parish_id,status,reportado,raw_data)
        VALUES($1,$2,''pending'',false,$3)',module.pending_table)
      USING selected,parish,jsonb_build_object('nombres','PERSONA','apellidos','FICTICIA V328',
        'novioNombres','PERSONA UNO','novioApellidos','FICTICIA','noviaNombres','PERSONA DOS','noviaApellidos','FICTICIA',
        'fechaSacramento',start_date::text,'fechaMatrimonio',start_date::text,'fecha_exequias',start_date::text,
        'fecha_defuncion',(start_date-2)::text,'horaSacramento','07:00','source','current_parish_registration','numeroRegistro',(976321+array_position(ids,selected))::text);
    END LOOP;
    SELECT jsonb_agg(jsonb_build_object('pending_id',i) ORDER BY ord) INTO input FROM unnest(ids) WITH ORDINALITY a(i,ord);
    PERFORM set_config('request.jwt.claim.sub',actor::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',actor)::text,true);
    SET LOCAL ROLE authenticated;
    context:=public.get_parish_seat_context_v328(parish,module.sacrament,ids);
    IF (context->>'initial')::boolean OR (context->>'book')::integer<>9990
        OR (context->>'folio')::integer<>18 OR (context->>'number')::integer<>4 THEN
      RAISE EXCEPTION 'Contexto erróneo para %',module.sacrament;
    END IF;
    coordinates:='{"book":9990,"folio":18,"number":4}'::jsonb;
    FOREACH trial IN ARRAY ARRAY['missing','zero','different','stale','foreign'] LOOP
      rejected:=false;
      trial_coords:=CASE trial WHEN 'missing' THEN coordinates-'number'
        WHEN 'zero' THEN coordinates||'{"folio":0}'::jsonb
        WHEN 'different' THEN coordinates||'{"number":5}'::jsonb ELSE coordinates END;
      BEGIN
        IF trial='foreign' THEN
          PERFORM public.get_parish_seat_context_v328(gen_random_uuid(),module.sacrament,ids);
        ELSE
          PERFORM public.seat_parish_records_v328(parish,module.sacrament,input,
            CASE WHEN trial='stale' THEN context||'{"capacity":8}'::jsonb ELSE context END,trial_coords);
        END IF;
      EXCEPTION WHEN invalid_parameter_value OR check_violation OR serialization_failure OR insufficient_privilege THEN
        rejected:=true;
      END;
      IF NOT rejected THEN RAISE EXCEPTION 'Aceptó asiento % en %',trial,module.sacrament; END IF;
      checks:=checks+1;
    END LOOP;
    RESET ROLE;
    EXECUTE format('SELECT %I FROM public.parish_parameters WHERE parish_id=$1',module.param_column) INTO params USING parish;
    IF (params->>'ordinarioNumero')::integer<>4 THEN RAISE EXCEPTION 'Un rechazo consumió la numeración'; END IF;

    SET LOCAL ROLE authenticated;
    response:=public.seat_parish_records_v328(parish,module.sacrament,input,context,coordinates);
    RESET ROLE;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE parish_id=$1 AND book_number=''9990''
      AND ((folio=''0018'' AND number=''0004'') OR
           (folio=''0019'' AND number IN (''0005'',''0006'')))',module.registry_table)
    INTO saved USING parish;
    IF saved<>module.rows OR coalesce((response->>'seated_count')::integer,1)<>module.rows THEN
      RAISE EXCEPTION 'Secuencia incorrecta de %: % de %',module.sacrament,saved,module.rows;
    END IF;
    checks:=checks+1;
  END LOOP;
  PERFORM set_config('qa328.control',jsonb_build_object('checks',checks,'ordinary_paths',4,'rollback',true)::text,true);
END;
$qa$;
SELECT current_setting('qa328.control')::jsonb AS result;
ROLLBACK;
