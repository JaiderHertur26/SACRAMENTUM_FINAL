-- Datos ficticios. Prueba el asiento real de los cuatro módulos y conserva la transacción.
BEGIN;
DO $audit$
DECLARE
  parish uuid;
  actor uuid;
  pending_id uuid;
  module record;
  scenario record;
  profile_params jsonb;
  record_data jsonb;
  local_now timestamp := statement_timestamp() AT TIME ZONE 'America/Bogota';
  local_date date := local_now::date;
  event_date date;
  event_time time;
  funeral_payload jsonb;
  seats_before integer;
  seats_after integer;
  params_before jsonb;
  params_after jsonb;
  message_text text;
  results jsonb := '{}'::jsonb;
BEGIN
  SELECT up.auth_user_id, up.parish_id INTO STRICT actor, parish
  FROM public.user_profiles up JOIN public.parishes p ON p.id = up.parish_id AND p.diocese_id = up.diocese_id
  WHERE up.role = 'parish' AND up.is_active IS TRUE AND upper(up.status) = 'ACTIVE'
  ORDER BY up.parish_id LIMIT 1;

  profile_params := '{"ordinarioLibro":9875,"ordinarioFolio":1,"ordinarioNumero":1,"ordinarioPartidas":2,"ordinarioBlocked":false,"ordinarioRestartNumber":false}'::jsonb;
  UPDATE public.parish_parameters SET
    bautizos_params = coalesce(bautizos_params, '{}') || profile_params,
    confirmaciones_params = coalesce(confirmaciones_params, '{}') || profile_params,
    matrimonios_params = coalesce(matrimonios_params, '{}') || profile_params,
    exequias_params = coalesce(exequias_params, '{}') || profile_params
  WHERE parish_id = parish;
  IF NOT FOUND THEN RAISE EXCEPTION 'Faltan parámetros en la parroquia de ensayo'; END IF;
  PERFORM set_config('request.jwt.claim.sub', actor::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'role', 'authenticated')::text, true);

  FOR module IN SELECT * FROM (VALUES
    ('bautismo', 'pending_baptisms', 'baptisms'),
    ('confirmacion', 'pending_confirmations', 'confirmations'),
    ('matrimonio', 'pending_marriages', 'marriages'),
    ('exequias', 'pending_funerals', 'funerals')
  ) AS modules(sacrament, source_table, result_table)
  LOOP
    FOR scenario IN SELECT * FROM (VALUES
      ('fecha_futura', local_date + 1, time '00:00', true),
      ('hora_futura', (local_now + interval '5 minutes')::date, (local_now + interval '5 minutes')::time, true),
      ('celebrado', local_date - 1, time '14:15', false),
      ('libro_bloqueado', local_date - 1, time '14:15', true),
      ('sin_fecha', NULL::date, NULL::time, true)
    ) AS cases(label, date_value, time_value, should_reject)
    LOOP
      IF scenario.label = 'libro_bloqueado' THEN
        IF module.sacrament <> 'matrimonio' THEN CONTINUE; END IF;
        UPDATE public.parish_parameters SET matrimonios_params =
          matrimonios_params || '{"ordinarioBlocked":true}'::jsonb WHERE parish_id = parish;
      ELSIF scenario.label = 'sin_fecha' AND module.sacrament <> 'exequias' THEN
        CONTINUE;
      END IF;
      pending_id := gen_random_uuid();
      event_date := scenario.date_value;
      event_time := scenario.time_value;
      record_data := jsonb_build_object(
        'nombres', 'PERSONA', 'apellidos', 'FICTICIA V326',
        'novioNombres', 'PERSONA', 'novioApellidos', 'FICTICIA V326',
        'noviaNombres', 'PERSONA', 'noviaApellidos', 'FICTICIA V326',
        'fechaSacramento', event_date::text, 'horaSacramento', event_time::text,
        'fechaHoraPrevista', event_date::text || 'T' || event_time::text,
        'fecha_exequias', event_date::text, 'hora_exequias', event_time::text,
        'fecha_defuncion', (local_date - 3)::text,
        'numeroRegistro', '9875326', 'source', 'current_parish_registration'
      );

      EXECUTE format('INSERT INTO public.%I (id, parish_id, status, reportado, raw_data) VALUES ($1,$2,''pending'',false,$3)', module.source_table)
        USING pending_id, parish, record_data;
      IF module.sacrament = 'matrimonio' THEN
        UPDATE public.pending_marriages SET celebration_date = event_date, hora = event_time, book_type = 'ordinario' WHERE id = pending_id;
      ELSIF module.sacrament = 'exequias' THEN
        UPDATE public.pending_funerals SET fecha_exequias = event_date, hora = event_time, book_type = 'ordinario' WHERE id = pending_id;
      END IF;
      EXECUTE format('SELECT count(*) FROM public.%I WHERE parish_id = $1', module.result_table) INTO seats_before USING parish;
      SELECT to_jsonb(p) INTO params_before FROM public.parish_parameters p WHERE parish_id = parish;

      funeral_payload := CASE WHEN scenario.label = 'fecha_futura'
        THEN jsonb_build_object('fecha_exequias', (local_date - 1)::text, 'hora_exequias', '00:00')
        ELSE '{}'::jsonb END;
      message_text := NULL;
      EXECUTE 'SET LOCAL ROLE authenticated';
      BEGIN
        CASE module.sacrament
          WHEN 'bautismo' THEN PERFORM public.seat_baptism_records(parish, jsonb_build_array(jsonb_build_object('pending_id', pending_id)), 9875, 1, 1);
          WHEN 'confirmacion' THEN PERFORM public.seat_confirmation_records(parish, jsonb_build_array(jsonb_build_object('pending_id', pending_id)), 9875, 1, 1);
          WHEN 'matrimonio' THEN PERFORM public.seat_pending_marriage(pending_id);
          WHEN 'exequias' THEN PERFORM public.seat_funeral_record(funeral_payload, pending_id);
        END CASE;
      EXCEPTION WHEN check_violation OR invalid_datetime_format THEN
        GET STACKED DIAGNOSTICS message_text = MESSAGE_TEXT;
      END;
      EXECUTE 'RESET ROLE';

      IF scenario.should_reject AND coalesce(message_text, '') NOT LIKE (
        CASE scenario.label
          WHEN 'libro_bloqueado' THEN '%Matrimonio está bloqueado%'
          WHEN 'sin_fecha' THEN '%fecha de celebración es obligatoria%'
          ELSE '%antes de su celebración%'
        END) THEN
        RAISE EXCEPTION 'No rechazó % %', module.sacrament, scenario.label;
      ELSIF NOT scenario.should_reject AND message_text IS NOT NULL THEN
        RAISE EXCEPTION 'Asiento válido rechazado en %: %', module.sacrament, message_text;
      END IF;
      EXECUTE format('SELECT count(*) FROM public.%I WHERE parish_id = $1', module.result_table) INTO seats_after USING parish;
      IF scenario.should_reject THEN
        SELECT to_jsonb(p) INTO params_after FROM public.parish_parameters p WHERE parish_id = parish;
        IF seats_after <> seats_before OR params_before IS DISTINCT FROM params_after THEN
          RAISE EXCEPTION 'Cambió el libro o su consecutivo con un asiento rechazado en %', module.sacrament;
        END IF;
      ELSIF seats_after <> seats_before + 1 THEN
        RAISE EXCEPTION 'Falta la partida del asiento válido de %', module.sacrament;
      END IF;
      results := jsonb_set(results, ARRAY[module.sacrament], coalesce(results->module.sacrament, '{}'::jsonb) || jsonb_build_object(scenario.label, true));
    END LOOP;
  END LOOP;
  PERFORM set_config('qa326.result', jsonb_build_object('checked',14,'records',results,'rollback',true)::text, true);
END;
$audit$;
SELECT current_setting('qa326.result')::jsonb AS result;
ROLLBACK;
