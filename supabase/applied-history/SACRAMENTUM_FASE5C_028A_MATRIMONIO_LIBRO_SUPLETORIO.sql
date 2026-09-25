-- SACRAMENTUM · FASE 5C · HOTFIX 028A
-- MATRIMONIO: LIBRO SUPLETORIO REAL + ENRUTAMIENTO DE INSCRIPCIONES
-- 2026-09-08
--
-- Motivo:
-- La pantalla histórica de Matrimonio sí contemplaba Libro Supletorio.
-- La migración 028 conservó únicamente el Libro Ordinario porque el preflight
-- encontró matrimonios_params reducido. Este hotfix restaura el Supletorio
-- de forma funcional, no sólo visual.
--
-- Reglas:
--   * Matrimonio regular -> registroInscripcionEn (por defecto ORDINARIO)
--   * Inscripción por Decreto de Reposición -> registroDecretoEn
--     (por defecto SUPLETORIO)
--   * Libro/Folio/Número son consecutivos independientes por tipo de libro.
--   * Nº de Registro matrimonial sigue siendo global por parroquia.
--   * No se toca la función de nulidad matrimonial.
--
-- IMPORTANTE: este script NO elimina Primera Comunión. Su retiro es sólo
-- de la interfaz/rutas y se hará en el parche frontend posterior.

begin;

-- ---------------------------------------------------------------------------
-- 1. Distinguir físicamente Libro Ordinario y Libro Supletorio
-- ---------------------------------------------------------------------------
alter table public.marriages
  add column if not exists book_type varchar(20) not null default 'ordinario';

alter table public.pending_marriages
  add column if not exists book_type varchar(20) not null default 'ordinario';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='marriages_book_type_check'
  ) then
    alter table public.marriages
      add constraint marriages_book_type_check
      check (book_type in ('ordinario','suplementario'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='pending_marriages_book_type_check'
  ) then
    alter table public.pending_marriages
      add constraint pending_marriages_book_type_check
      check (book_type in ('ordinario','suplementario'));
  end if;
end
$$;

-- En cada tipo de libro, una localización L/F/N sólo puede existir una vez.
create unique index if not exists uq_marriages_parish_booktype_location
  on public.marriages(parish_id,book_type,book_number,folio,number)
  where parish_id is not null
    and book_number is not null
    and folio is not null
    and number is not null;

-- ---------------------------------------------------------------------------
-- 2. Defaults canónicos restaurados
-- ---------------------------------------------------------------------------
create or replace function public.sacramentum_default_marriage_params()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'enablePreview', true,
    'reportPrinting', false,

    'ordinarioBlocked', false,
    'ordinarioRestartNumber', false,
    'ordinarioPartidas', 1,
    'ordinarioLibro', 1,
    'ordinarioFolio', 1,
    'ordinarioNumero', 1,

    'suplementarioBlocked', false,
    'suplementarioReiniciar', false,
    'suplementarioPartidas', 1,
    'suplementarioLibro', 1,
    'suplementarioFolio', 1,
    'suplementarioNumero', 1,

    'registroInscripcionEn', 'ordinario',
    'registroDecretoEn', 'suplementario',

    'numeroRegistroActual', '00000000'
  );
$$;

-- Agrega las llaves faltantes sin pisar lo ya configurado.
update public.parish_parameters pp
set matrimonios_params =
      public.sacramentum_default_marriage_params()
      || coalesce(pp.matrimonios_params,'{}'::jsonb),
    updated_at=now();

-- ---------------------------------------------------------------------------
-- 3. Crear expediente pendiente: el servidor decide el tipo de libro destino
-- ---------------------------------------------------------------------------
create or replace function public.create_pending_marriage(
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
  v_date date;
  v_time_text text;
  v_time time;
  v_por_decreto boolean := false;
  v_book_type text;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  if p_parish_id is null then
    raise exception 'No se pudo determinar la parroquia';
  end if;

  if p_record is null or jsonb_typeof(p_record) <> 'object' then
    raise exception 'El expediente matrimonial no es válido';
  end if;

  select lower(coalesce(up.role,'')),up.parish_id,up.diocese_id
    into v_role,v_user_parish,v_diocese
  from public.user_profiles up
  where up.auth_user_id=auth.uid()
    and coalesce(up.is_active,true)=true
  limit 1;

  if v_role <> 'parish' or v_user_parish is distinct from p_parish_id then
    raise exception 'Sólo la parroquia propietaria puede crear expedientes matrimoniales';
  end if;

  if nullif(trim(coalesce(p_record->>'novioNombres','')),'') is null
     or nullif(trim(coalesce(p_record->>'novioApellidos','')),'') is null
     or nullif(trim(coalesce(p_record->>'noviaNombres','')),'') is null
     or nullif(trim(coalesce(p_record->>'noviaApellidos','')),'') is null then
    raise exception 'Nombres y apellidos de ambos contrayentes son obligatorios';
  end if;

  v_date_text := coalesce(
    nullif(p_record->>'fechaSacramento',''),
    nullif(p_record->>'fechaMatrimonio',''),
    nullif(p_record->>'celebration_date',''),
    nullif(p_record->>'fechaHoraPrevista','')
  );

  if v_date_text is null then
    raise exception 'La fecha del Matrimonio es obligatoria';
  end if;

  begin
    v_date := left(v_date_text,10)::date;
  exception when others then
    raise exception 'La fecha del Matrimonio no es válida';
  end;

  v_time_text := coalesce(
    nullif(p_record->>'hora',''),
    nullif(p_record->>'horaSacramento',''),
    nullif(p_record->>'hora_matrimonio',''),
    case
      when position('T' in coalesce(p_record->>'fechaHoraPrevista','')) > 0
      then substring(p_record->>'fechaHoraPrevista' from 12 for 5)
      else null
    end
  );

  if v_time_text is not null then
    begin
      v_time := v_time_text::time;
    exception when others then
      raise exception 'La hora del Matrimonio no es válida';
    end;
  else
    v_time := null;
  end if;

  perform public.sacramentum_ensure_parish_parameters(p_parish_id);

  select * into v_params_row
  from public.parish_parameters pp
  where pp.parish_id=p_parish_id
  for update;

  if not found then
    raise exception 'No fue posible inicializar los parámetros de Matrimonio';
  end if;

  v_params := public.sacramentum_default_marriage_params()
              || coalesce(v_params_row.matrimonios_params,'{}'::jsonb);

  v_por_decreto :=
    lower(trim(coalesce(p_record->>'porDecreto','false')))
      in ('true','1','yes','si','sí');

  if v_por_decreto then
    v_book_type := lower(coalesce(v_params->>'registroDecretoEn','suplementario'));
  else
    v_book_type := lower(coalesce(v_params->>'registroInscripcionEn','ordinario'));
  end if;

  if v_book_type not in ('ordinario','suplementario') then
    raise exception 'Tipo de libro matrimonial no válido: %',v_book_type;
  end if;

  select greatest(
    coalesce((
      select max((m.raw_data->>'numeroRegistro')::bigint)
      from public.marriages m
      where m.parish_id=p_parish_id
        and coalesce(m.raw_data->>'numeroRegistro','') ~ '^[0-9]+$'
    ),0),
    coalesce((
      select max((pm.raw_data->>'numeroRegistro')::bigint)
      from public.pending_marriages pm
      where pm.parish_id=p_parish_id
        and coalesce(pm.raw_data->>'numeroRegistro','') ~ '^[0-9]+$'
    ),0),
    coalesce((
      select max((pm.raw_data->>'numero_registro')::bigint)
      from public.pending_marriages pm
      where pm.parish_id=p_parish_id
        and coalesce(pm.raw_data->>'numero_registro','') ~ '^[0-9]+$'
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

  v_next_reg := v_last_reg+1;
  v_reg_text := lpad(v_next_reg::text,8,'0');

  v_raw := coalesce(p_record,'{}'::jsonb) || jsonb_build_object(
    'id',v_id,
    'parishId',p_parish_id,
    'parish_id',p_parish_id,
    'numero',v_reg_text,
    'numeroRegistro',v_reg_text,
    'numero_registro',v_reg_text,
    'bookType',v_book_type,
    'book_type',v_book_type,
    'tipoLibro',v_book_type,
    'status','pending',
    'estado','pending'
  );

  insert into public.pending_marriages(
    id,parish_id,status,reportado,celebration_date,hora,
    raw_data,created_at,updated_at,book_type
  )
  values(
    v_id,p_parish_id,'pending',false,v_date,v_time,
    v_raw,now(),now(),v_book_type
  );

  v_params := jsonb_set(
    v_params,
    '{numeroRegistroActual}',
    to_jsonb(v_reg_text),
    true
  );

  update public.parish_parameters pp
  set matrimonios_params=v_params,
      updated_at=now()
  where pp.id=v_params_row.id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,
    action,after_data,metadata
  )
  values(
    auth.uid(),p_parish_id,v_diocese,'pending_marriage',v_id,
    'create_pending',v_raw,
    jsonb_build_object(
      'numero_registro',v_reg_text,
      'book_type',v_book_type,
      'por_decreto',v_por_decreto
    )
  );

  return query select v_id,v_reg_text;
end;
$$;

revoke all on function public.create_pending_marriage(uuid,jsonb) from public;
grant execute on function public.create_pending_marriage(uuid,jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Guardar ambos juegos de consecutivos sin dejarlos "decorativos"
-- ---------------------------------------------------------------------------
create or replace function public.save_marriage_parameters(
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

  v_sbook integer;
  v_sfolio integer;
  v_snumber integer;
  v_slimit integer;

  v_expected_sbook integer;
  v_expected_sfolio integer;
  v_expected_snumber integer;

  v_reg bigint;
  v_max_reg bigint := 0;
  v_regular_target text;
  v_decree_target text;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  if p_parish_id is null then
    raise exception 'Parroquia no válida';
  end if;

  if p_params is null or jsonb_typeof(p_params) <> 'object' then
    raise exception 'Parámetros de Matrimonio no válidos';
  end if;

  select lower(coalesce(up.role,'')),up.parish_id
    into v_role,v_user_parish
  from public.user_profiles up
  where up.auth_user_id=auth.uid()
    and coalesce(up.is_active,true)=true
  limit 1;

  if v_role <> 'parish' or v_user_parish is distinct from p_parish_id then
    raise exception 'Sólo la parroquia propietaria puede modificar sus parámetros de Matrimonio';
  end if;

  perform public.sacramentum_ensure_parish_parameters(p_parish_id);

  select * into v_row
  from public.parish_parameters pp
  where pp.parish_id=p_parish_id
  for update;

  if not found then
    raise exception 'Parámetros de la parroquia no encontrados';
  end if;

  v_current := public.sacramentum_default_marriage_params()
               || coalesce(v_row.matrimonios_params,'{}'::jsonb);

  if p_expected_book is not null
     and greatest(coalesce(nullif(v_current->>'ordinarioLibro','')::integer,1),1)
         <> p_expected_book then
    raise exception 'El Libro Ordinario cambió en otra sesión. Recargue los parámetros.';
  end if;

  if p_expected_folio is not null
     and greatest(coalesce(nullif(v_current->>'ordinarioFolio','')::integer,1),1)
         <> p_expected_folio then
    raise exception 'El Folio Ordinario cambió en otra sesión. Recargue los parámetros.';
  end if;

  if p_expected_number is not null
     and greatest(coalesce(nullif(v_current->>'ordinarioNumero','')::integer,1),1)
         <> p_expected_number then
    raise exception 'El Número Ordinario cambió en otra sesión. Recargue los parámetros.';
  end if;

  begin
    v_expected_sbook := nullif(p_params->>'_expectedSuplementarioLibro','')::integer;
    v_expected_sfolio := nullif(p_params->>'_expectedSuplementarioFolio','')::integer;
    v_expected_snumber := nullif(p_params->>'_expectedSuplementarioNumero','')::integer;
  exception when others then
    raise exception 'Control de concurrencia del Libro Supletorio no válido';
  end;

  if v_expected_sbook is not null
     and greatest(coalesce(nullif(v_current->>'suplementarioLibro','')::integer,1),1)
         <> v_expected_sbook then
    raise exception 'El Libro Supletorio cambió en otra sesión. Recargue los parámetros.';
  end if;

  if v_expected_sfolio is not null
     and greatest(coalesce(nullif(v_current->>'suplementarioFolio','')::integer,1),1)
         <> v_expected_sfolio then
    raise exception 'El Folio Supletorio cambió en otra sesión. Recargue los parámetros.';
  end if;

  if v_expected_snumber is not null
     and greatest(coalesce(nullif(v_current->>'suplementarioNumero','')::integer,1),1)
         <> v_expected_snumber then
    raise exception 'El Número Supletorio cambió en otra sesión. Recargue los parámetros.';
  end if;

  v_new := public.sacramentum_default_marriage_params()
           || v_current
           || (
             p_params
             - '_expectedSuplementarioLibro'
             - '_expectedSuplementarioFolio'
             - '_expectedSuplementarioNumero'
           );

  v_book := greatest(coalesce(nullif(v_new->>'ordinarioLibro','')::integer,1),1);
  v_folio := greatest(coalesce(nullif(v_new->>'ordinarioFolio','')::integer,1),1);
  v_number := greatest(coalesce(nullif(v_new->>'ordinarioNumero','')::integer,1),1);
  v_limit := greatest(coalesce(nullif(v_new->>'ordinarioPartidas','')::integer,1),1);

  v_sbook := greatest(coalesce(nullif(v_new->>'suplementarioLibro','')::integer,1),1);
  v_sfolio := greatest(coalesce(nullif(v_new->>'suplementarioFolio','')::integer,1),1);
  v_snumber := greatest(coalesce(nullif(v_new->>'suplementarioNumero','')::integer,1),1);
  v_slimit := greatest(coalesce(nullif(v_new->>'suplementarioPartidas','')::integer,1),1);

  if v_limit < 1 or v_slimit < 1 then
    raise exception 'Partidas por folio debe ser mayor que cero';
  end if;

  v_regular_target := lower(coalesce(v_new->>'registroInscripcionEn','ordinario'));
  v_decree_target := lower(coalesce(v_new->>'registroDecretoEn','suplementario'));

  if v_regular_target not in ('ordinario','suplementario') then
    raise exception 'Destino de inscripción regular no válido';
  end if;

  if v_decree_target not in ('ordinario','suplementario') then
    raise exception 'Destino de inscripción por decreto no válido';
  end if;

  if exists(
    select 1
    from public.marriages m
    where m.parish_id=p_parish_id
      and m.book_type='ordinario'
      and m.book_number=lpad(v_book::text,4,'0')
      and m.folio=lpad(v_folio::text,4,'0')
      and m.number=lpad(v_number::text,4,'0')
  ) then
    raise exception 'El consecutivo Ordinario propuesto L %, F %, N % ya está ocupado',
      v_book,v_folio,v_number;
  end if;

  if exists(
    select 1
    from public.marriages m
    where m.parish_id=p_parish_id
      and m.book_type='suplementario'
      and m.book_number=lpad(v_sbook::text,4,'0')
      and m.folio=lpad(v_sfolio::text,4,'0')
      and m.number=lpad(v_snumber::text,4,'0')
  ) then
    raise exception 'El consecutivo Supletorio propuesto L %, F %, N % ya está ocupado',
      v_sbook,v_sfolio,v_snumber;
  end if;

  select greatest(
    coalesce((
      select max((m.raw_data->>'numeroRegistro')::bigint)
      from public.marriages m
      where m.parish_id=p_parish_id
        and coalesce(m.raw_data->>'numeroRegistro','') ~ '^[0-9]+$'
    ),0),
    coalesce((
      select max((pm.raw_data->>'numeroRegistro')::bigint)
      from public.pending_marriages pm
      where pm.parish_id=p_parish_id
        and coalesce(pm.raw_data->>'numeroRegistro','') ~ '^[0-9]+$'
    ),0),
    coalesce((
      select max((pm.raw_data->>'numero_registro')::bigint)
      from public.pending_marriages pm
      where pm.parish_id=p_parish_id
        and coalesce(pm.raw_data->>'numero_registro','') ~ '^[0-9]+$'
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
      lpad(v_max_reg::text,8,'0');
  end if;

  v_new := jsonb_set(
    v_new,
    '{numeroRegistroActual}',
    to_jsonb(lpad(v_reg::text,8,'0')),
    true
  );

  update public.parish_parameters pp
  set matrimonios_params=v_new,
      updated_at=now()
  where pp.id=v_row.id;

  return v_new;
end;
$$;

revoke all on function public.save_marriage_parameters(uuid,jsonb,integer,integer,integer) from public;
grant execute on function public.save_marriage_parameters(uuid,jsonb,integer,integer,integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Asentar en el libro configurado: Ordinario o Supletorio
-- ---------------------------------------------------------------------------
create or replace function public.seat_pending_marriage(p_pending_id uuid)
returns table(
  marriage_id uuid,
  book_number text,
  folio text,
  number text,
  next_book integer,
  next_folio integer,
  next_number integer
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text;
  v_parish uuid;
  v_diocese uuid;
  v_pending public.pending_marriages%rowtype;
  v_params_row public.parish_parameters%rowtype;
  v_params jsonb;
  v_book_type text;

  v_book integer;
  v_folio integer;
  v_number integer;
  v_limit integer;
  v_restart boolean;

  v_next_book integer;
  v_next_folio integer;
  v_next_number integer;

  v_marriage_id uuid;
  v_date date;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select lower(coalesce(up.role,'')),up.parish_id,up.diocese_id
    into v_role,v_parish,v_diocese
  from public.user_profiles up
  where up.auth_user_id=auth.uid()
    and coalesce(up.is_active,true)=true
  limit 1;

  if v_role <> 'parish' or v_parish is null then
    raise exception 'Sólo una parroquia activa puede asentar matrimonios';
  end if;

  select * into v_pending
  from public.pending_marriages pm
  where pm.id=p_pending_id
    and pm.parish_id=v_parish
  for update;

  if not found then
    raise exception 'Expediente matrimonial pendiente no encontrado';
  end if;

  if lower(coalesce(v_pending.status,'pending')) <> 'pending'
     or coalesce(v_pending.reportado,false)=true then
    raise exception 'El expediente matrimonial ya fue procesado';
  end if;

  v_date := v_pending.celebration_date;
  if v_date is null then
    begin
      v_date := coalesce(
        nullif(left(v_pending.raw_data->>'fechaSacramento',10),'')::date,
        nullif(left(v_pending.raw_data->>'fechaMatrimonio',10),'')::date,
        nullif(left(v_pending.raw_data->>'fechaHoraPrevista',10),'')::date
      );
    exception when others then
      v_date := null;
    end;
  end if;

  if v_date is null then
    raise exception 'La fecha del matrimonio es obligatoria';
  end if;

  select * into v_params_row
  from public.parish_parameters pp
  where pp.parish_id=v_parish
  order by pp.created_at nulls last
  limit 1
  for update;

  if not found then
    raise exception 'La parroquia no tiene parámetros de Matrimonio configurados';
  end if;

  v_params := public.sacramentum_default_marriage_params()
              || coalesce(v_params_row.matrimonios_params,'{}'::jsonb);

  v_book_type := lower(coalesce(
    nullif(v_pending.book_type,''),
    nullif(v_pending.raw_data->>'bookType',''),
    nullif(v_pending.raw_data->>'book_type',''),
    'ordinario'
  ));

  if v_book_type not in ('ordinario','suplementario') then
    raise exception 'Tipo de libro matrimonial no válido: %',v_book_type;
  end if;

  if v_book_type='suplementario' then
    v_book := greatest(1,coalesce(nullif(v_params->>'suplementarioLibro','')::integer,1));
    v_folio := greatest(1,coalesce(nullif(v_params->>'suplementarioFolio','')::integer,1));
    v_number := greatest(1,coalesce(nullif(v_params->>'suplementarioNumero','')::integer,1));
    v_limit := greatest(1,coalesce(nullif(v_params->>'suplementarioPartidas','')::integer,1));
    v_restart := coalesce((v_params->>'suplementarioReiniciar')::boolean,false);
  else
    v_book := greatest(1,coalesce(nullif(v_params->>'ordinarioLibro','')::integer,1));
    v_folio := greatest(1,coalesce(nullif(v_params->>'ordinarioFolio','')::integer,1));
    v_number := greatest(1,coalesce(nullif(v_params->>'ordinarioNumero','')::integer,1));
    v_limit := greatest(1,coalesce(nullif(v_params->>'ordinarioPartidas','')::integer,1));
    v_restart := coalesce((v_params->>'ordinarioRestartNumber')::boolean,false);
  end if;

  if exists(
    select 1
    from public.marriages m
    where m.parish_id=v_parish
      and m.book_type=v_book_type
      and m.book_number=lpad(v_book::text,4,'0')
      and m.folio=lpad(v_folio::text,4,'0')
      and m.number=lpad(v_number::text,4,'0')
  ) then
    raise exception 'El consecutivo de Matrimonio % L %, F %, N % ya está ocupado. Recargue los parámetros.',
      upper(v_book_type),v_book,v_folio,v_number;
  end if;

  insert into public.marriages(
    parish_id,celebration_date,book_number,folio,number,
    observations,status,raw_data,book_type
  )
  values(
    v_parish,v_date,
    lpad(v_book::text,4,'0'),
    lpad(v_folio::text,4,'0'),
    lpad(v_number::text,4,'0'),
    coalesce(v_pending.raw_data->>'observations',v_pending.raw_data->>'observaciones'),
    'seated',
    coalesce(v_pending.raw_data,'{}'::jsonb) || jsonb_build_object(
      'book_type',v_book_type,
      'bookType',v_book_type,
      'tipoLibro',v_book_type,
      'book_number',lpad(v_book::text,4,'0'),
      'page_number',lpad(v_folio::text,4,'0'),
      'entry_number',lpad(v_number::text,4,'0'),
      'libro',lpad(v_book::text,4,'0'),
      'folio',lpad(v_folio::text,4,'0'),
      'numero',lpad(v_number::text,4,'0'),
      'status','seated'
    ),
    v_book_type
  )
  returning id into v_marriage_id;

  v_next_book:=v_book;
  v_next_folio:=v_folio;
  v_next_number:=v_number;

  if v_restart then
    if v_next_number >= v_limit then
      v_next_folio:=v_next_folio+1;
      v_next_number:=1;
    else
      v_next_number:=v_next_number+1;
    end if;
  else
    v_next_number:=v_next_number+1;
    if mod(v_next_number-1,v_limit)=0 then
      v_next_folio:=v_next_folio+1;
    end if;
  end if;

  if v_book_type='suplementario' then
    v_params := jsonb_set(
      jsonb_set(
        jsonb_set(v_params,'{suplementarioLibro}',to_jsonb(v_next_book),true),
        '{suplementarioFolio}',to_jsonb(v_next_folio),true
      ),
      '{suplementarioNumero}',to_jsonb(v_next_number),true
    );
  else
    v_params := jsonb_set(
      jsonb_set(
        jsonb_set(v_params,'{ordinarioLibro}',to_jsonb(v_next_book),true),
        '{ordinarioFolio}',to_jsonb(v_next_folio),true
      ),
      '{ordinarioNumero}',to_jsonb(v_next_number),true
    );
  end if;

  update public.parish_parameters pp
  set matrimonios_params=v_params,
      updated_at=now()
  where pp.id=v_params_row.id;

  update public.pending_marriages pm
  set status='seated',
      reportado=true,
      book_type=v_book_type,
      raw_data=coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
        'book_type',v_book_type,
        'bookType',v_book_type,
        'tipoLibro',v_book_type,
        'record_id',v_marriage_id
      ),
      updated_at=now()
  where pm.id=v_pending.id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,
    action,after_data,metadata
  )
  values(
    auth.uid(),v_parish,v_diocese,'matrimonio',v_marriage_id,'seat',
    v_pending.raw_data || jsonb_build_object(
      'book_type',v_book_type,
      'book_number',lpad(v_book::text,4,'0'),
      'folio',lpad(v_folio::text,4,'0'),
      'number',lpad(v_number::text,4,'0')
    ),
    jsonb_build_object(
      'pending_id',v_pending.id,
      'book_type',v_book_type
    )
  );

  return query
  select
    v_marriage_id,
    lpad(v_book::text,4,'0'),
    lpad(v_folio::text,4,'0'),
    lpad(v_number::text,4,'0'),
    v_next_book,
    v_next_folio,
    v_next_number;
end;
$$;

revoke all on function public.seat_pending_marriage(uuid) from public;
grant execute on function public.seat_pending_marriage(uuid) to authenticated;

commit;
