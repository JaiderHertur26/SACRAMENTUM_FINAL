-- Aplica la hora civil de la jurisdicción colombiana a los asientos nuevos.
CREATE OR REPLACE FUNCTION sacramentum_private.require_completed_celebration_v326(
  p_date date, p_time time without time zone, p_label text
) RETURNS void
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = ''
AS $calendar$
BEGIN
  IF p_date IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22007',
      MESSAGE = format('La fecha de celebración es obligatoria para %s', p_label);
  END IF;

  IF p_date + coalesce(p_time, time '00:00') >
     (statement_timestamp() AT TIME ZONE 'America/Bogota') THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = format('No se puede asentar %s antes de su celebración', p_label);
  END IF;
END;
$calendar$;

REVOKE ALL ON FUNCTION sacramentum_private.require_completed_celebration_v326(
  date, time without time zone, text
) FROM PUBLIC, anon, authenticated;

-- Mantiene las firmas, los permisos y las transacciones de los cuatro RPC existentes.
DO $patch$
DECLARE
  item record;
  definition text;
  first_pos integer;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    (1, 'public.seat_baptism_records(uuid,jsonb,integer,integer,integer)', $before$    if v_celebration>current_date then
      raise exception 'No se puede asentar un Bautismo antes de su fecha de celebración (%)',v_celebration;
    end if;$before$,
     $after$    PERFORM sacramentum_private.require_completed_celebration_v326(
      v_celebration,
      coalesce(nullif(trim(v_data->>'horaSacramento'), ''), nullif(trim(v_data->>'hora_sacramento'), ''))::time,
      'el Bautismo'
    );$after$),
    (2, 'public.seat_confirmation_records(uuid,jsonb,integer,integer,integer)', $before$    if v_celebration>current_date then raise exception 'No se puede asentar una Confirmación antes de su celebración'; end if;$before$,
     $after$    PERFORM sacramentum_private.require_completed_celebration_v326(v_celebration, v_time, 'la Confirmación');$after$),
    (3, 'public.seat_pending_marriage(uuid)', $before$  if v_date is null then
    raise exception 'La fecha del matrimonio es obligatoria';
  end if;$before$,
     $after$  PERFORM sacramentum_private.require_completed_celebration_v326(
    v_date,
    coalesce(
      v_pending.hora,
      nullif(trim(v_pending.raw_data->>'hora'), '')::time,
      nullif(trim(v_pending.raw_data->>'horaSacramento'), '')::time,
      nullif(trim(v_pending.raw_data->>'hora_matrimonio'), '')::time,
      substring(v_pending.raw_data->>'fechaHoraPrevista' from 'T([0-9]{2}:[0-9]{2}(?::[0-9]{2})?)')::time
    ),
    'el Matrimonio'
  );$after$),
    (4, 'public.seat_pending_marriage(uuid)', $before$  if v_book_type='suplementario' then
    v_book := greatest$before$,
     $after$  IF coalesce((v_params->>(v_book_type || 'Blocked'))::boolean, false) THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = format('El Libro %s de Matrimonio está bloqueado', v_book_type);
  END IF;

  if v_book_type='suplementario' then
    v_book := greatest$after$),
    (5, 'public.seat_funeral_record(jsonb,uuid)', $before$    v_data := coalesce(v_pending.raw_data,'{}'::jsonb)
              || coalesce(p_form_data,'{}'::jsonb);$before$,
     $after$    -- La boleta almacenada determina las fechas del asiento.
    v_data := coalesce(v_pending.raw_data, '{}'::jsonb);
    IF v_pending.fecha_exequias IS NOT NULL THEN
      v_data := v_data || jsonb_build_object('fecha_exequias', v_pending.fecha_exequias);
    END IF;
    IF v_pending.hora IS NOT NULL THEN
      v_data := v_data || jsonb_build_object('hora_exequias', v_pending.hora);
    END IF;$after$),
    (6, 'public.seat_funeral_record(jsonb,uuid)', $before$  select *
    into v_params_row
  from public.parish_parameters pp
  where pp.parish_id = v_parish$before$,
     $after$  PERFORM sacramentum_private.require_completed_celebration_v326(v_funeral_date, v_funeral_time, 'las Exequias');

  select *
    into v_params_row
  from public.parish_parameters pp
  where pp.parish_id = v_parish$after$)
  ) AS patches(step, signature, before_text, after_text) ORDER BY step
  LOOP
    definition := pg_get_functiondef(to_regprocedure(item.signature));
    IF definition IS NULL THEN
      RAISE EXCEPTION 'Falta la operación de asiento %', item.signature;
    END IF;
    IF strpos(definition, item.after_text) > 0 THEN CONTINUE; END IF;

    first_pos := strpos(definition, item.before_text);
    IF first_pos = 0
       OR strpos(substr(definition, first_pos + length(item.before_text)), item.before_text) > 0 THEN
      RAISE EXCEPTION 'Revisar la definición de % antes del cambio %', item.signature, item.step;
    END IF;
    EXECUTE replace(definition, item.before_text, item.after_text);
  END LOOP;
END;
$patch$;
