-- SACRAMENTUM · FASE 5B · CONFIRMACIÓN CLOUD-NATIVE
-- Migración 027 · 2026-09-07
--
-- Objetivos:
--   1) Reservar el Nº de Registro de Confirmación en PostgreSQL, no en el navegador.
--   2) Guardar borradores de Confirmación de forma atómica y auditada.
--   3) Proteger los parámetros/consecutivos contra sesiones concurrentes.
--   4) Conservar sin reemplazar los workflows ya existentes:
--      seat_confirmation_records(...)
--      register_historical_confirmation(...)
--      apply_confirmation_correction(...)
--      apply_confirmation_replacement(...)

begin;

-- ---------------------------------------------------------------------------
-- 0. Precondiciones
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.confirmations') is null
     or to_regclass('public.pending_confirmations') is null
     or to_regclass('public.parish_parameters') is null then
    raise exception 'Fase 5B detenida: faltan tablas base de Confirmación';
  end if;

  if to_regprocedure('public.seat_confirmation_records(uuid,jsonb,integer,integer,integer)') is null then
    raise exception 'Fase 5B detenida: falta seat_confirmation_records(...)';
  end if;

  if to_regprocedure('public.register_historical_confirmation(uuid,jsonb,uuid,text)') is null then
    raise exception 'Fase 5B detenida: falta register_historical_confirmation(...)';
  end if;

  if to_regprocedure('public.sacramentum_ensure_parish_parameters(uuid)') is null then
    raise exception 'Fase 5B detenida: falta sacramentum_ensure_parish_parameters(uuid) de Fase 5A';
  end if;

  if to_regprocedure('public.sacramentum_default_confirmation_params()') is null then
    raise exception 'Fase 5B detenida: falta sacramentum_default_confirmation_params()';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 1. Nunca dejar numeroRegistroActual por debajo de datos ya existentes
-- ---------------------------------------------------------------------------
with max_regs as (
  select parish_id, max(reg_num) as max_reg
  from (
    select parish_id, numero_registro::bigint as reg_num
    from public.confirmations
    where numero_registro ~ '^[0-9]+$'

    union all

    select parish_id, (raw_data->>'numeroRegistro')::bigint as reg_num
    from public.pending_confirmations
    where coalesce(raw_data->>'numeroRegistro','') ~ '^[0-9]+$'

    union all

    select parish_id, (raw_data->>'numero_registro')::bigint as reg_num
    from public.pending_confirmations
    where coalesce(raw_data->>'numero_registro','') ~ '^[0-9]+$'
  ) x
  where parish_id is not null
  group by parish_id
)
update public.parish_parameters pp
set confirmaciones_params = jsonb_set(
      coalesce(pp.confirmaciones_params, public.sacramentum_default_confirmation_params()),
      '{numeroRegistroActual}',
      to_jsonb(lpad(m.max_reg::text,6,'0')),
      true
    ),
    updated_at = now()
from max_regs m
where pp.parish_id = m.parish_id
  and coalesce(
        nullif(
          regexp_replace(
            coalesce(pp.confirmaciones_params->>'numeroRegistroActual',''),
            '[^0-9]','','g'
          ),
          ''
        ),
        '0'
      )::bigint < m.max_reg;

-- ---------------------------------------------------------------------------
-- 2. Crear borrador + reservar Nº Registro en una sola transacción
-- ---------------------------------------------------------------------------
create or replace function public.create_pending_confirmation(
  p_parish_id uuid,
  p_record jsonb
)
returns table(pending_id uuid, numero_registro text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text;
  v_user_parish uuid;
  v_diocese uuid;
  v_params_row public.parish_parameters%rowtype;
  v_params jsonb;
  v_last_reg bigint;
  v_max_reg bigint := 0;
  v_next_reg bigint;
  v_reg_text text;
  v_id uuid := gen_random_uuid();
  v_raw jsonb;
  v_date_text text;
  v_time_text text;
  v_time time;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  if p_parish_id is null then
    raise exception 'No se pudo determinar la parroquia';
  end if;

  if p_record is null or jsonb_typeof(p_record) <> 'object' then
    raise exception 'El registro de Confirmación no es válido';
  end if;

  select lower(coalesce(up.role,'')), up.parish_id, up.diocese_id
    into v_role, v_user_parish, v_diocese
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
    and coalesce(up.is_active,true) = true
  limit 1;

  if v_role <> 'parish' or v_user_parish is distinct from p_parish_id then
    raise exception 'Sólo la parroquia propietaria puede crear borradores de Confirmación';
  end if;

  if nullif(trim(coalesce(p_record->>'nombres','')),'') is null
     or nullif(trim(coalesce(p_record->>'apellidos','')),'') is null then
    raise exception 'Nombres y apellidos son obligatorios';
  end if;

  v_date_text := coalesce(
    nullif(p_record->>'fechaSacramento',''),
    nullif(p_record->>'fechaConfirmacion',''),
    nullif(p_record->>'celebration_date',''),
    nullif(p_record->>'feccon','')
  );

  if v_date_text is null then
    raise exception 'La fecha de la Confirmación es obligatoria';
  end if;

  begin
    perform v_date_text::date;
  exception when others then
    raise exception 'La fecha de la Confirmación no es válida';
  end;

  v_time_text := coalesce(
    nullif(p_record->>'horaSacramento',''),
    nullif(p_record->>'hora_sacramento',''),
    nullif(p_record->>'hora','')
  );

  if v_time_text is not null then
    begin
      v_time := v_time_text::time;
    exception when others then
      raise exception 'La hora de la Confirmación no es válida';
    end;
  else
    v_time := null;
  end if;

  perform public.sacramentum_ensure_parish_parameters(p_parish_id);

  select *
    into v_params_row
  from public.parish_parameters
  where parish_id = p_parish_id
  for update;

  if not found then
    raise exception 'No fue posible inicializar los parámetros de Confirmación';
  end if;

  v_params := coalesce(
    v_params_row.confirmaciones_params,
    public.sacramentum_default_confirmation_params()
  );

  select greatest(
    coalesce((
      select max(numero_registro::bigint)
      from public.confirmations
      where parish_id = p_parish_id
        and numero_registro ~ '^[0-9]+$'
    ),0),
    coalesce((
      select max((raw_data->>'numeroRegistro')::bigint)
      from public.pending_confirmations
      where parish_id = p_parish_id
        and coalesce(raw_data->>'numeroRegistro','') ~ '^[0-9]+$'
    ),0),
    coalesce((
      select max((raw_data->>'numero_registro')::bigint)
      from public.pending_confirmations
      where parish_id = p_parish_id
        and coalesce(raw_data->>'numero_registro','') ~ '^[0-9]+$'
    ),0)
  ) into v_max_reg;

  v_last_reg := greatest(
    coalesce(
      nullif(
        regexp_replace(
          coalesce(v_params->>'numeroRegistroActual',''),
          '[^0-9]','','g'
        ),
        ''
      )::bigint,
      0
    ),
    v_max_reg
  );

  v_next_reg := v_last_reg + 1;
  v_reg_text := lpad(v_next_reg::text,6,'0');

  v_raw := coalesce(p_record,'{}'::jsonb) || jsonb_build_object(
    'id', v_id,
    'parishId', p_parish_id,
    'parish_id', p_parish_id,
    'numeroRegistro', v_reg_text,
    'numero_registro', v_reg_text,
    'status', 'pending',
    'estado', 'pending'
  );

  insert into public.pending_confirmations(
    id, parish_id, status, reportado, created_at, hora, raw_data
  )
  values(
    v_id, p_parish_id, 'pending', false, now(), v_time, v_raw
  );

  v_params := jsonb_set(
    v_params,
    '{numeroRegistroActual}',
    to_jsonb(v_reg_text),
    true
  );

  update public.parish_parameters
  set confirmaciones_params = v_params,
      updated_at = now()
  where id = v_params_row.id;

  insert into public.registry_audit_log(
    actor_user_id,
    parish_id,
    diocese_id,
    entity_type,
    entity_id,
    action,
    after_data,
    metadata
  )
  values(
    auth.uid(),
    p_parish_id,
    v_diocese,
    'pending_confirmation',
    v_id,
    'create_pending',
    v_raw,
    jsonb_build_object('numero_registro',v_reg_text)
  );

  return query
  select v_id, v_reg_text;
end;
$$;

revoke all on function public.create_pending_confirmation(uuid,jsonb) from public;
grant execute on function public.create_pending_confirmation(uuid,jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Guardado seguro de parámetros de Confirmación
-- ---------------------------------------------------------------------------
create or replace function public.save_confirmation_parameters(
  p_parish_id uuid,
  p_params jsonb,
  p_expected_book integer default null,
  p_expected_folio integer default null,
  p_expected_number integer default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text;
  v_user_parish uuid;
  v_row public.parish_parameters%rowtype;
  v_current jsonb;
  v_new jsonb;
  v_book integer;
  v_folio integer;
  v_number integer;
  v_limit integer;
  v_reg bigint;
  v_max_reg bigint := 0;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  if p_parish_id is null then
    raise exception 'Parroquia no válida';
  end if;

  if p_params is null or jsonb_typeof(p_params) <> 'object' then
    raise exception 'Parámetros de Confirmación no válidos';
  end if;

  select lower(coalesce(role,'')), parish_id
    into v_role, v_user_parish
  from public.user_profiles
  where auth_user_id = auth.uid()
    and coalesce(is_active,true) = true
  limit 1;

  if v_role <> 'parish' or v_user_parish is distinct from p_parish_id then
    raise exception 'Sólo la parroquia propietaria puede modificar sus parámetros de Confirmación';
  end if;

  perform public.sacramentum_ensure_parish_parameters(p_parish_id);

  select *
    into v_row
  from public.parish_parameters
  where parish_id = p_parish_id
  for update;

  if not found then
    raise exception 'Parámetros de la parroquia no encontrados';
  end if;

  v_current := coalesce(
    v_row.confirmaciones_params,
    public.sacramentum_default_confirmation_params()
  );

  if p_expected_book is not null
     and greatest(coalesce(nullif(v_current->>'ordinarioLibro','')::integer,1),1) <> p_expected_book then
    raise exception 'El Libro cambió en otra sesión. Recargue los parámetros.';
  end if;

  if p_expected_folio is not null
     and greatest(coalesce(nullif(v_current->>'ordinarioFolio','')::integer,1),1) <> p_expected_folio then
    raise exception 'El Folio cambió en otra sesión. Recargue los parámetros.';
  end if;

  if p_expected_number is not null
     and greatest(coalesce(nullif(v_current->>'ordinarioNumero','')::integer,1),1) <> p_expected_number then
    raise exception 'El Número cambió en otra sesión. Recargue los parámetros.';
  end if;

  v_new := public.sacramentum_default_confirmation_params()
           || v_current
           || p_params;

  v_book := greatest(coalesce(nullif(v_new->>'ordinarioLibro','')::integer,1),1);
  v_folio := greatest(coalesce(nullif(v_new->>'ordinarioFolio','')::integer,1),1);
  v_number := greatest(coalesce(nullif(v_new->>'ordinarioNumero','')::integer,1),1);
  v_limit := greatest(coalesce(nullif(v_new->>'ordinarioPartidas','')::integer,2),1);

  if v_limit < 1 then
    raise exception 'Partidas por folio debe ser mayor que cero';
  end if;

  if exists(
    select 1
    from public.confirmations c
    where c.parish_id = p_parish_id
      and c.book_number = lpad(v_book::text,4,'0')
      and c.folio = lpad(v_folio::text,4,'0')
      and c.number = lpad(v_number::text,4,'0')
  ) then
    raise exception 'El consecutivo propuesto L %, F %, N % ya está ocupado',
      v_book, v_folio, v_number;
  end if;

  select greatest(
    coalesce((
      select max(numero_registro::bigint)
      from public.confirmations
      where parish_id = p_parish_id
        and numero_registro ~ '^[0-9]+$'
    ),0),
    coalesce((
      select max((raw_data->>'numeroRegistro')::bigint)
      from public.pending_confirmations
      where parish_id = p_parish_id
        and coalesce(raw_data->>'numeroRegistro','') ~ '^[0-9]+$'
    ),0),
    coalesce((
      select max((raw_data->>'numero_registro')::bigint)
      from public.pending_confirmations
      where parish_id = p_parish_id
        and coalesce(raw_data->>'numero_registro','') ~ '^[0-9]+$'
    ),0)
  ) into v_max_reg;

  v_reg := coalesce(
    nullif(
      regexp_replace(
        coalesce(v_new->>'numeroRegistroActual',''),
        '[^0-9]','','g'
      ),
      ''
    )::bigint,
    0
  );

  if v_reg < v_max_reg then
    raise exception 'El Número de Registro no puede retroceder por debajo de %',
      lpad(v_max_reg::text,6,'0');
  end if;

  v_new := jsonb_set(
    v_new,
    '{numeroRegistroActual}',
    to_jsonb(lpad(v_reg::text,6,'0')),
    true
  );

  update public.parish_parameters
  set confirmaciones_params = v_new,
      updated_at = now()
  where id = v_row.id;

  return v_new;
end;
$$;

revoke all on function public.save_confirmation_parameters(uuid,jsonb,integer,integer,integer) from public;
grant execute on function public.save_confirmation_parameters(uuid,jsonb,integer,integer,integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Comentarios de gobierno
-- ---------------------------------------------------------------------------
comment on function public.create_pending_confirmation(uuid,jsonb) is
'Fase 5B: crea el borrador de Confirmación y reserva atómicamente el Nº de Registro para la parroquia autenticada.';

comment on function public.save_confirmation_parameters(uuid,jsonb,integer,integer,integer) is
'Fase 5B: guarda parámetros de Confirmación con control de concurrencia y sin permitir retroceso del Nº de Registro.';

commit;
