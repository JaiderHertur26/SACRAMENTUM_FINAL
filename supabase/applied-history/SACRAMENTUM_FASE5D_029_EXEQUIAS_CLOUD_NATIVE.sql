-- ============================================================================
-- SACRAMENTUM · FASE 5D · 029 · EXEQUIAS CLOUD-NATIVE
-- Fecha: 2026-09-13
--
-- Objetivos:
--  1) Modernizar Exequias sin perder compatibilidad con la estructura existente.
--  2) Incorporar borrador reservado -> asiento definitivo.
--  3) Añadir N.º de Registro interno y Libro Ordinario / Supletorio.
--  4) Mantener Libro / Folio / Número como identidad de la partida oficial.
--  5) Cerrar DML directo y exponer sólo RPC auditadas.
--  6) Preservar digitalización histórica y decreto de corrección existentes.
--
-- IMPORTANTE:
--  - Idempotente en estructura/políticas/índices.
--  - No elimina registros.
--  - No ejecuta limpieza de datos.
-- ============================================================================

begin;

-- ============================================================================
-- 1. ESTRUCTURA MODERNA
-- ============================================================================

alter table public.funerals
  add column if not exists numero_registro character varying,
  add column if not exists book_type character varying not null default 'ordinario';

alter table public.pending_funerals
  add column if not exists numero_registro character varying,
  add column if not exists book_type character varying not null default 'ordinario';

-- Normalización defensiva para instalaciones previas.
update public.funerals
set book_type = 'ordinario'
where book_type is null
   or lower(trim(book_type)) not in ('ordinario','suplementario');

update public.pending_funerals
set book_type = 'ordinario'
where book_type is null
   or lower(trim(book_type)) not in ('ordinario','suplementario');

update public.funerals
set book_type = lower(trim(book_type));

update public.pending_funerals
set book_type = lower(trim(book_type));

-- Checks de tipo de libro.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'funerals_book_type_check'
      and conrelid = 'public.funerals'::regclass
  ) then
    alter table public.funerals
      add constraint funerals_book_type_check
      check (book_type in ('ordinario','suplementario'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pending_funerals_book_type_check'
      and conrelid = 'public.pending_funerals'::regclass
  ) then
    alter table public.pending_funerals
      add constraint pending_funerals_book_type_check
      check (book_type in ('ordinario','suplementario'));
  end if;
end
$$;

-- El índice histórico no distinguía Libro Ordinario / Supletorio.
drop index if exists public.uq_funerals_registry_number;

create unique index if not exists uq_funerals_location_by_book_type
  on public.funerals(parish_id, book_type, book_number, folio, number)
  where book_number is not null
    and folio is not null
    and number is not null;

create unique index if not exists uq_funerals_internal_registration
  on public.funerals(parish_id, numero_registro)
  where numero_registro is not null;

create unique index if not exists uq_pending_funerals_internal_registration
  on public.pending_funerals(parish_id, numero_registro)
  where numero_registro is not null;

create index if not exists idx_funerals_book_type_lookup
  on public.funerals(parish_id, book_type, book_number, folio, number);

create index if not exists idx_pending_funerals_book_type
  on public.pending_funerals(parish_id, book_type, status, created_at desc);


-- ============================================================================
-- 2. PARÁMETROS POR DEFECTO
--    Se conservan también las claves antiguas libro/folio/numero para no romper
--    código legado hasta instalar el frontend Fase 5D.
-- ============================================================================

create or replace function public.sacramentum_default_funeral_params()
returns jsonb
language sql
immutable
as $function$
  select jsonb_build_object(
    -- compatibilidad histórica
    'libro', 1,
    'folio', 1,
    'numero', 1,
    'partidasPorFolio', 2,
    'reiniciarNumeroEnFolio', false,

    -- configuración documental
    'enablePreview', true,
    'reportPrinting', false,
    'numeroRegistroActual', '000000',

    -- libro ordinario
    'ordinarioLibro', 1,
    'ordinarioFolio', 1,
    'ordinarioNumero', 1,
    'ordinarioPartidas', 2,
    'ordinarioRestartNumber', false,
    'ordinarioBlocked', false,

    -- libro supletorio
    'suplementarioLibro', 1,
    'suplementarioFolio', 1,
    'suplementarioNumero', 1,
    'suplementarioPartidas', 2,
    'suplementarioReiniciar', false,
    'suplementarioBlocked', false,

    -- reglas de asiento
    'registroInscripcionEn', 'ordinario',
    'registroDecretoEn', 'suplementario',
    'generarNotaMarginal', true
  );
$function$;

-- Migra parámetros actuales sin borrar valores existentes.
update public.parish_parameters pp
set exequias_params =
    public.sacramentum_default_funeral_params()
    || coalesce(pp.exequias_params, '{}'::jsonb)
    || jsonb_build_object(
      'ordinarioLibro',
        greatest(1, coalesce(
          case when coalesce(pp.exequias_params->>'ordinarioLibro','') ~ '^\d+$'
               then (pp.exequias_params->>'ordinarioLibro')::integer end,
          case when coalesce(pp.exequias_params->>'libro','') ~ '^\d+$'
               then (pp.exequias_params->>'libro')::integer end,
          1
        )),
      'ordinarioFolio',
        greatest(1, coalesce(
          case when coalesce(pp.exequias_params->>'ordinarioFolio','') ~ '^\d+$'
               then (pp.exequias_params->>'ordinarioFolio')::integer end,
          case when coalesce(pp.exequias_params->>'folio','') ~ '^\d+$'
               then (pp.exequias_params->>'folio')::integer end,
          1
        )),
      'ordinarioNumero',
        greatest(1, coalesce(
          case when coalesce(pp.exequias_params->>'ordinarioNumero','') ~ '^\d+$'
               then (pp.exequias_params->>'ordinarioNumero')::integer end,
          case when coalesce(pp.exequias_params->>'numero','') ~ '^\d+$'
               then (pp.exequias_params->>'numero')::integer end,
          1
        )),
      'ordinarioPartidas',
        greatest(1, coalesce(
          case when coalesce(pp.exequias_params->>'ordinarioPartidas','') ~ '^\d+$'
               then (pp.exequias_params->>'ordinarioPartidas')::integer end,
          case when coalesce(pp.exequias_params->>'partidasPorFolio','') ~ '^\d+$'
               then (pp.exequias_params->>'partidasPorFolio')::integer end,
          2
        )),
      'ordinarioRestartNumber',
        coalesce(
          case
            when lower(coalesce(pp.exequias_params->>'ordinarioRestartNumber','')) in ('true','false')
            then (pp.exequias_params->>'ordinarioRestartNumber')::boolean
          end,
          case
            when lower(coalesce(pp.exequias_params->>'reiniciarNumeroEnFolio','')) in ('true','false')
            then (pp.exequias_params->>'reiniciarNumeroEnFolio')::boolean
          end,
          false
        ),
      'numeroRegistroActual',
        case
          when coalesce(pp.exequias_params->>'numeroRegistroActual','') ~ '^\d+$'
          then lpad((pp.exequias_params->>'numeroRegistroActual')::bigint::text, 6, '0')
          else '000000'
        end
    ),
    updated_at = now();


-- ============================================================================
-- 3. GUARDAR PARÁMETROS DE EXEQUIAS
-- ============================================================================

create or replace function public.save_funeral_parameters(
  p_parish_id uuid,
  p_params jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text;
  v_user_parish uuid;
  v_row public.parish_parameters%rowtype;
  v_current jsonb;
  v_new jsonb;

  v_o_book integer;
  v_o_folio integer;
  v_o_number integer;
  v_o_limit integer;
  v_o_restart boolean;
  v_o_blocked boolean;

  v_s_book integer;
  v_s_folio integer;
  v_s_number integer;
  v_s_limit integer;
  v_s_restart boolean;
  v_s_blocked boolean;

  v_regular text;
  v_decree text;
  v_registry text;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select lower(coalesce(up.role,'')), up.parish_id
    into v_role, v_user_parish
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
    and coalesce(up.is_active,true) = true
    and coalesce(up.status,'active') not in ('blocked','disabled','inactive')
  limit 1;

  if v_role <> 'parish'
     or v_user_parish is null
     or v_user_parish is distinct from p_parish_id then
    raise exception 'Sólo la parroquia propietaria puede configurar Exequias';
  end if;

  if p_params is null or jsonb_typeof(p_params) <> 'object' then
    raise exception 'Parámetros de Exequias inválidos';
  end if;

  perform public.ensure_parish_parameters(p_parish_id);

  select *
    into v_row
  from public.parish_parameters pp
  where pp.parish_id = p_parish_id
  order by pp.created_at nulls last
  limit 1
  for update;

  if not found then
    raise exception 'No fue posible inicializar los parámetros parroquiales';
  end if;

  v_current := public.sacramentum_default_funeral_params()
               || coalesce(v_row.exequias_params,'{}'::jsonb);

  begin
    v_o_book := greatest(1, coalesce(
      nullif(p_params->>'ordinarioLibro','')::integer,
      nullif(v_current->>'ordinarioLibro','')::integer,
      1
    ));
    v_o_folio := greatest(1, coalesce(
      nullif(p_params->>'ordinarioFolio','')::integer,
      nullif(v_current->>'ordinarioFolio','')::integer,
      1
    ));
    v_o_number := greatest(1, coalesce(
      nullif(p_params->>'ordinarioNumero','')::integer,
      nullif(v_current->>'ordinarioNumero','')::integer,
      1
    ));
    v_o_limit := greatest(1, coalesce(
      nullif(p_params->>'ordinarioPartidas','')::integer,
      nullif(v_current->>'ordinarioPartidas','')::integer,
      2
    ));

    v_s_book := greatest(1, coalesce(
      nullif(p_params->>'suplementarioLibro','')::integer,
      nullif(v_current->>'suplementarioLibro','')::integer,
      1
    ));
    v_s_folio := greatest(1, coalesce(
      nullif(p_params->>'suplementarioFolio','')::integer,
      nullif(v_current->>'suplementarioFolio','')::integer,
      1
    ));
    v_s_number := greatest(1, coalesce(
      nullif(p_params->>'suplementarioNumero','')::integer,
      nullif(v_current->>'suplementarioNumero','')::integer,
      1
    ));
    v_s_limit := greatest(1, coalesce(
      nullif(p_params->>'suplementarioPartidas','')::integer,
      nullif(v_current->>'suplementarioPartidas','')::integer,
      2
    ));
  exception when others then
    raise exception 'Libro, Folio, Número y Partidas por Folio deben ser números enteros válidos';
  end;

  v_o_restart := coalesce(
    case
      when lower(coalesce(p_params->>'ordinarioRestartNumber','')) in ('true','false')
      then (p_params->>'ordinarioRestartNumber')::boolean
    end,
    coalesce((v_current->>'ordinarioRestartNumber')::boolean,false)
  );

  v_s_restart := coalesce(
    case
      when lower(coalesce(p_params->>'suplementarioReiniciar','')) in ('true','false')
      then (p_params->>'suplementarioReiniciar')::boolean
    end,
    coalesce((v_current->>'suplementarioReiniciar')::boolean,false)
  );

  v_o_blocked := coalesce(
    case
      when lower(coalesce(p_params->>'ordinarioBlocked','')) in ('true','false')
      then (p_params->>'ordinarioBlocked')::boolean
    end,
    coalesce((v_current->>'ordinarioBlocked')::boolean,false)
  );

  v_s_blocked := coalesce(
    case
      when lower(coalesce(p_params->>'suplementarioBlocked','')) in ('true','false')
      then (p_params->>'suplementarioBlocked')::boolean
    end,
    coalesce((v_current->>'suplementarioBlocked')::boolean,false)
  );

  v_regular := lower(coalesce(
    nullif(trim(p_params->>'registroInscripcionEn'),''),
    nullif(trim(v_current->>'registroInscripcionEn'),''),
    'ordinario'
  ));

  v_decree := lower(coalesce(
    nullif(trim(p_params->>'registroDecretoEn'),''),
    nullif(trim(v_current->>'registroDecretoEn'),''),
    'suplementario'
  ));

  if v_regular not in ('ordinario','suplementario') then
    raise exception 'registroInscripcionEn debe ser ordinario o suplementario';
  end if;

  if v_decree not in ('ordinario','suplementario') then
    raise exception 'registroDecretoEn debe ser ordinario o suplementario';
  end if;

  -- El N.º de Registro es controlado por el sistema y no puede retroceder
  -- mediante la pantalla de parámetros.
  v_registry := case
    when coalesce(v_current->>'numeroRegistroActual','') ~ '^\d+$'
    then lpad((v_current->>'numeroRegistroActual')::bigint::text, 6, '0')
    else '000000'
  end;

  v_new := v_current
    || coalesce(p_params,'{}'::jsonb)
    || jsonb_build_object(
      'enablePreview',
        coalesce(
          case when lower(coalesce(p_params->>'enablePreview','')) in ('true','false')
               then (p_params->>'enablePreview')::boolean end,
          coalesce((v_current->>'enablePreview')::boolean,true)
        ),
      'reportPrinting',
        coalesce(
          case when lower(coalesce(p_params->>'reportPrinting','')) in ('true','false')
               then (p_params->>'reportPrinting')::boolean end,
          coalesce((v_current->>'reportPrinting')::boolean,false)
        ),

      'numeroRegistroActual', v_registry,

      'ordinarioLibro', v_o_book,
      'ordinarioFolio', v_o_folio,
      'ordinarioNumero', v_o_number,
      'ordinarioPartidas', v_o_limit,
      'ordinarioRestartNumber', v_o_restart,
      'ordinarioBlocked', v_o_blocked,

      'suplementarioLibro', v_s_book,
      'suplementarioFolio', v_s_folio,
      'suplementarioNumero', v_s_number,
      'suplementarioPartidas', v_s_limit,
      'suplementarioReiniciar', v_s_restart,
      'suplementarioBlocked', v_s_blocked,

      'registroInscripcionEn', v_regular,
      'registroDecretoEn', v_decree,

      -- compatibilidad con el frontend antiguo
      'libro', v_o_book,
      'folio', v_o_folio,
      'numero', v_o_number,
      'partidasPorFolio', v_o_limit,
      'reiniciarNumeroEnFolio', v_o_restart
    );

  update public.parish_parameters
  set exequias_params = v_new,
      updated_at = now()
  where id = v_row.id;

  return v_new;
end;
$function$;


-- ============================================================================
-- 4. CREAR BORRADOR DE EXEQUIAS + RESERVAR N.º DE REGISTRO
-- ============================================================================

create or replace function public.create_pending_funeral(
  p_parish_id uuid,
  p_record jsonb
)
returns table(
  pending_id uuid,
  numero_registro text,
  book_type text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text;
  v_user_parish uuid;

  v_params_row public.parish_parameters%rowtype;
  v_params jsonb;

  v_death_date date;
  v_birth_date date;
  v_funeral_date date;
  v_funeral_time time;

  v_is_decree boolean;
  v_book_type text;

  v_current_registry bigint;
  v_new_registry bigint;
  v_registry text;

  v_pending_id uuid;
  v_payload jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select lower(coalesce(up.role,'')), up.parish_id
    into v_role, v_user_parish
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
    and coalesce(up.is_active,true) = true
    and coalesce(up.status,'active') not in ('blocked','disabled','inactive')
  limit 1;

  if v_role <> 'parish'
     or v_user_parish is null
     or v_user_parish is distinct from p_parish_id then
    raise exception 'Sólo la parroquia propietaria puede crear borradores de Exequias';
  end if;

  if p_record is null or jsonb_typeof(p_record) <> 'object' then
    raise exception 'Registro de Exequias inválido';
  end if;

  if nullif(trim(coalesce(p_record->>'nombres','')), '') is null
     or nullif(trim(coalesce(p_record->>'apellidos','')), '') is null then
    raise exception 'Nombres y apellidos son obligatorios';
  end if;

  if nullif(trim(coalesce(p_record->>'fecha_defuncion','')), '') is null then
    raise exception 'La fecha de defunción es obligatoria';
  end if;

  begin
    v_death_date := (p_record->>'fecha_defuncion')::date;
  exception when others then
    raise exception 'La fecha de defunción no es válida';
  end;

  if nullif(trim(coalesce(p_record->>'fecha_nacimiento','')), '') is not null then
    begin
      v_birth_date := (p_record->>'fecha_nacimiento')::date;
    exception when others then
      raise exception 'La fecha de nacimiento no es válida';
    end;
  end if;

  if v_birth_date is not null and v_birth_date > v_death_date then
    raise exception 'La fecha de nacimiento no puede ser posterior a la fecha de defunción';
  end if;

  if nullif(trim(coalesce(p_record->>'fecha_exequias','')), '') is not null then
    begin
      v_funeral_date := (p_record->>'fecha_exequias')::date;
    exception when others then
      raise exception 'La fecha de Exequias no es válida';
    end;

    if v_funeral_date < v_death_date then
      raise exception 'La fecha de Exequias no puede ser anterior a la fecha de defunción';
    end if;
  end if;

  if nullif(trim(coalesce(p_record->>'hora_exequias','')), '') is not null then
    begin
      v_funeral_time := (p_record->>'hora_exequias')::time;
    exception when others then
      raise exception 'La hora de Exequias no es válida';
    end;
  end if;

  perform public.ensure_parish_parameters(p_parish_id);

  select *
    into v_params_row
  from public.parish_parameters pp
  where pp.parish_id = p_parish_id
  order by pp.created_at nulls last
  limit 1
  for update;

  if not found then
    raise exception 'No fue posible inicializar los parámetros parroquiales';
  end if;

  v_params := public.sacramentum_default_funeral_params()
              || coalesce(v_params_row.exequias_params,'{}'::jsonb);

  v_is_decree :=
    lower(coalesce(p_record->>'porDecreto', p_record->>'por_decreto', 'false'))
    in ('true','1','yes','si','sí');

  v_book_type := lower(coalesce(
    nullif(trim(p_record->>'book_type'),''),
    nullif(trim(p_record->>'tipoLibro'),''),
    case
      when v_is_decree then nullif(trim(v_params->>'registroDecretoEn'),'')
      else nullif(trim(v_params->>'registroInscripcionEn'),'')
    end,
    case when v_is_decree then 'suplementario' else 'ordinario' end
  ));

  if v_book_type not in ('ordinario','suplementario') then
    raise exception 'Tipo de libro de Exequias inválido';
  end if;

  if v_book_type = 'ordinario'
     and coalesce((v_params->>'ordinarioBlocked')::boolean,false) then
    raise exception 'El Libro Ordinario de Exequias se encuentra bloqueado';
  end if;

  if v_book_type = 'suplementario'
     and coalesce((v_params->>'suplementarioBlocked')::boolean,false) then
    raise exception 'El Libro Supletorio de Exequias se encuentra bloqueado';
  end if;

  v_current_registry := case
    when coalesce(v_params->>'numeroRegistroActual','') ~ '^\d+$'
    then (v_params->>'numeroRegistroActual')::bigint
    else 0
  end;

  v_new_registry := v_current_registry + 1;
  v_registry := lpad(v_new_registry::text, 6, '0');

  v_payload :=
    p_record
    || jsonb_build_object(
      'numero_registro', v_registry,
      'numeroRegistro', v_registry,
      'book_type', v_book_type,
      'bookType', v_book_type,
      'fecha_defuncion', v_death_date,
      'fecha_exequias', v_funeral_date,
      'hora_exequias',
        case when v_funeral_time is null then null else v_funeral_time::text end,
      'status', 'pending',
      'estado', 'borrador'
    );

  insert into public.pending_funerals(
    parish_id,
    status,
    reportado,
    fecha_exequias,
    hora,
    numero_registro,
    book_type,
    raw_data
  )
  values(
    p_parish_id,
    'pending',
    false,
    v_funeral_date,
    v_funeral_time,
    v_registry,
    v_book_type,
    v_payload
  )
  returning id into v_pending_id;

  v_params := v_params
    || jsonb_build_object('numeroRegistroActual', v_registry);

  update public.parish_parameters
  set exequias_params = v_params,
      updated_at = now()
  where id = v_params_row.id;

  return query
  select v_pending_id, v_registry, v_book_type;
end;
$function$;


-- ============================================================================
-- 5. ASIENTO DEFINITIVO
--    Conserva la firma RPC existente para compatibilidad:
--      seat_funeral_record(p_form_data jsonb, p_pending_id uuid)
-- ============================================================================

create or replace function public.seat_funeral_record(
  p_form_data jsonb,
  p_pending_id uuid default null::uuid
)
returns table(
  funeral_id uuid,
  book_number text,
  folio text,
  number text,
  next_book integer,
  next_folio integer,
  next_number integer
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text;
  v_parish uuid;
  v_diocese uuid;

  v_pending public.pending_funerals%rowtype;
  v_data jsonb;

  v_params_row public.parish_parameters%rowtype;
  v_params jsonb;

  v_book_type text;
  v_book integer;
  v_folio integer;
  v_number integer;
  v_limit integer;
  v_restart boolean;
  v_blocked boolean;

  v_next_book integer;
  v_next_folio integer;
  v_next_number integer;

  v_registry_current bigint;
  v_registry text;

  v_funeral_id uuid;
  v_death_date date;
  v_birth_date date;
  v_funeral_date date;
  v_funeral_time time;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select lower(coalesce(up.role,'')), up.parish_id, up.diocese_id
    into v_role, v_parish, v_diocese
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
    and coalesce(up.is_active,true) = true
    and coalesce(up.status,'active') not in ('blocked','disabled','inactive')
  limit 1;

  if v_role <> 'parish' or v_parish is null then
    raise exception 'Sólo una cuenta parroquial activa puede asentar Exequias';
  end if;

  perform public.ensure_parish_parameters(v_parish);

  if p_pending_id is not null then
    select *
      into v_pending
    from public.pending_funerals pf
    where pf.id = p_pending_id
      and pf.parish_id = v_parish
    for update;

    if not found then
      raise exception 'El borrador de Exequias no existe o no pertenece a la parroquia';
    end if;

    if lower(coalesce(v_pending.status,'')) <> 'pending'
       or coalesce(v_pending.reportado,false) = true then
      raise exception 'El pendiente de Exequias ya no está disponible';
    end if;

    v_data := coalesce(v_pending.raw_data,'{}'::jsonb)
              || coalesce(p_form_data,'{}'::jsonb);

    v_book_type := lower(coalesce(
      nullif(trim(v_pending.book_type),''),
      nullif(trim(v_data->>'book_type'),''),
      nullif(trim(v_data->>'bookType'),''),
      'ordinario'
    ));

    v_registry := nullif(trim(coalesce(
      v_pending.numero_registro,
      v_data->>'numero_registro',
      v_data->>'numeroRegistro',
      ''
    )), '');
  else
    if p_form_data is null or jsonb_typeof(p_form_data) <> 'object' then
      raise exception 'Datos de Exequias inválidos';
    end if;

    v_data := p_form_data;

    v_book_type := lower(coalesce(
      nullif(trim(v_data->>'book_type'),''),
      nullif(trim(v_data->>'bookType'),''),
      'ordinario'
    ));

    v_registry := nullif(trim(coalesce(
      v_data->>'numero_registro',
      v_data->>'numeroRegistro',
      ''
    )), '');
  end if;

  if v_book_type not in ('ordinario','suplementario') then
    raise exception 'Tipo de libro de Exequias inválido';
  end if;

  if nullif(trim(coalesce(v_data->>'nombres','')), '') is null
     or nullif(trim(coalesce(v_data->>'apellidos','')), '') is null then
    raise exception 'Nombres y apellidos son obligatorios';
  end if;

  if nullif(trim(coalesce(v_data->>'fecha_defuncion','')), '') is null then
    raise exception 'La fecha de defunción es obligatoria';
  end if;

  begin
    v_death_date := (v_data->>'fecha_defuncion')::date;
  exception when others then
    raise exception 'La fecha de defunción no es válida';
  end;

  if nullif(trim(coalesce(v_data->>'fecha_nacimiento','')), '') is not null then
    begin
      v_birth_date := (v_data->>'fecha_nacimiento')::date;
    exception when others then
      raise exception 'La fecha de nacimiento no es válida';
    end;
  end if;

  if v_birth_date is not null and v_birth_date > v_death_date then
    raise exception 'La fecha de nacimiento no puede ser posterior a la fecha de defunción';
  end if;

  if nullif(trim(coalesce(v_data->>'fecha_exequias','')), '') is not null then
    begin
      v_funeral_date := (v_data->>'fecha_exequias')::date;
    exception when others then
      raise exception 'La fecha de Exequias no es válida';
    end;

    if v_funeral_date < v_death_date then
      raise exception 'La fecha de Exequias no puede ser anterior a la fecha de defunción';
    end if;
  end if;

  if nullif(trim(coalesce(v_data->>'hora_exequias','')), '') is not null then
    begin
      v_funeral_time := (v_data->>'hora_exequias')::time;
    exception when others then
      raise exception 'La hora de Exequias no es válida';
    end;
  end if;

  select *
    into v_params_row
  from public.parish_parameters pp
  where pp.parish_id = v_parish
  order by pp.created_at nulls last
  limit 1
  for update;

  if not found then
    raise exception 'No fue posible cargar los parámetros de Exequias';
  end if;

  v_params := public.sacramentum_default_funeral_params()
              || coalesce(v_params_row.exequias_params,'{}'::jsonb);

  if v_book_type = 'suplementario' then
    v_book := greatest(1, coalesce(nullif(v_params->>'suplementarioLibro','')::integer,1));
    v_folio := greatest(1, coalesce(nullif(v_params->>'suplementarioFolio','')::integer,1));
    v_number := greatest(1, coalesce(nullif(v_params->>'suplementarioNumero','')::integer,1));
    v_limit := greatest(1, coalesce(nullif(v_params->>'suplementarioPartidas','')::integer,2));
    v_restart := coalesce((v_params->>'suplementarioReiniciar')::boolean,false);
    v_blocked := coalesce((v_params->>'suplementarioBlocked')::boolean,false);
  else
    v_book := greatest(1, coalesce(
      nullif(v_params->>'ordinarioLibro','')::integer,
      nullif(v_params->>'libro','')::integer,
      1
    ));
    v_folio := greatest(1, coalesce(
      nullif(v_params->>'ordinarioFolio','')::integer,
      nullif(v_params->>'folio','')::integer,
      1
    ));
    v_number := greatest(1, coalesce(
      nullif(v_params->>'ordinarioNumero','')::integer,
      nullif(v_params->>'numero','')::integer,
      1
    ));
    v_limit := greatest(1, coalesce(
      nullif(v_params->>'ordinarioPartidas','')::integer,
      nullif(v_params->>'partidasPorFolio','')::integer,
      2
    ));
    v_restart := coalesce(
      (v_params->>'ordinarioRestartNumber')::boolean,
      (v_params->>'reiniciarNumeroEnFolio')::boolean,
      false
    );
    v_blocked := coalesce((v_params->>'ordinarioBlocked')::boolean,false);
  end if;

  if v_blocked then
    raise exception 'El Libro % de Exequias se encuentra bloqueado',
      case when v_book_type='suplementario' then 'Supletorio' else 'Ordinario' end;
  end if;

  if exists (
    select 1
    from public.funerals f
    where f.parish_id = v_parish
      and f.book_type = v_book_type
      and f.book_number = lpad(v_book::text,4,'0')
      and f.folio = lpad(v_folio::text,4,'0')
      and f.number = lpad(v_number::text,4,'0')
  ) then
    raise exception 'El consecutivo de Exequias % L %, F %, N % ya está ocupado. Recargue los parámetros.',
      upper(v_book_type), v_book, v_folio, v_number;
  end if;

  -- Compatibilidad: si un cliente antiguo llega sin borrador,
  -- se reserva el N.º de Registro en el momento del asiento.
  if v_registry is null then
    v_registry_current := case
      when coalesce(v_params->>'numeroRegistroActual','') ~ '^\d+$'
      then (v_params->>'numeroRegistroActual')::bigint
      else 0
    end;

    v_registry := lpad((v_registry_current + 1)::text, 6, '0');
    v_params := v_params || jsonb_build_object('numeroRegistroActual', v_registry);
  end if;

  if exists (
    select 1
    from public.funerals f
    where f.parish_id = v_parish
      and f.numero_registro = v_registry
  ) then
    raise exception 'El N.º de Registro de Exequias % ya está utilizado', v_registry;
  end if;

  insert into public.funerals(
    parish_id,
    book_number,
    folio,
    number,
    numero_registro,
    book_type,
    status,
    nombres,
    apellidos,
    document_id,
    sexo,
    fecha_nacimiento,
    lugar_nacimiento,
    fecha_defuncion,
    lugar_defuncion,
    fecha_exequias,
    hora_exequias,
    lugar_exequias,
    cementerio,
    causa_muerte,
    nombre_padre,
    nombre_madre,
    conyuge,
    ministro,
    da_fe,
    observations,
    nota_marginal,
    raw_data
  )
  values(
    v_parish,
    lpad(v_book::text,4,'0'),
    lpad(v_folio::text,4,'0'),
    lpad(v_number::text,4,'0'),
    v_registry,
    v_book_type,
    'seated',
    nullif(trim(v_data->>'nombres'),''),
    nullif(trim(v_data->>'apellidos'),''),
    nullif(trim(v_data->>'document_id'),''),
    nullif(trim(v_data->>'sexo'),''),
    v_birth_date,
    nullif(trim(v_data->>'lugar_nacimiento'),''),
    v_death_date,
    nullif(trim(v_data->>'lugar_defuncion'),''),
    v_funeral_date,
    v_funeral_time,
    nullif(trim(v_data->>'lugar_exequias'),''),
    nullif(trim(v_data->>'cementerio'),''),
    nullif(v_data->>'causa_muerte',''),
    nullif(trim(v_data->>'nombre_padre'),''),
    nullif(trim(v_data->>'nombre_madre'),''),
    nullif(trim(v_data->>'conyuge'),''),
    nullif(trim(v_data->>'ministro'),''),
    nullif(trim(v_data->>'da_fe'),''),
    nullif(v_data->>'observations',''),
    nullif(v_data->>'nota_marginal',''),
    coalesce(v_data,'{}'::jsonb)
      || jsonb_build_object(
        'book_number', lpad(v_book::text,4,'0'),
        'folio', lpad(v_folio::text,4,'0'),
        'number', lpad(v_number::text,4,'0'),
        'numero_registro', v_registry,
        'numeroRegistro', v_registry,
        'book_type', v_book_type,
        'bookType', v_book_type,
        'status', 'seated',
        'estado', 'permanente'
      )
  )
  returning id into v_funeral_id;

  v_next_book := v_book;
  v_next_folio := v_folio;
  v_next_number := v_number;

  if v_restart then
    if v_next_number >= v_limit then
      v_next_folio := v_next_folio + 1;
      v_next_number := 1;
    else
      v_next_number := v_next_number + 1;
    end if;
  else
    v_next_number := v_next_number + 1;
    if mod(v_next_number - 1, v_limit) = 0 then
      v_next_folio := v_next_folio + 1;
    end if;
  end if;

  if v_book_type = 'suplementario' then
    v_params := v_params
      || jsonb_build_object(
        'suplementarioLibro', v_next_book,
        'suplementarioFolio', v_next_folio,
        'suplementarioNumero', v_next_number
      );
  else
    v_params := v_params
      || jsonb_build_object(
        'ordinarioLibro', v_next_book,
        'ordinarioFolio', v_next_folio,
        'ordinarioNumero', v_next_number,

        -- compatibilidad con frontend antiguo
        'libro', v_next_book,
        'folio', v_next_folio,
        'numero', v_next_number
      );
  end if;

  update public.parish_parameters
  set exequias_params = v_params,
      updated_at = now()
  where id = v_params_row.id;

  if p_pending_id is not null then
    update public.pending_funerals
    set status = 'seated',
        reportado = true,
        raw_data = coalesce(raw_data,'{}'::jsonb)
          || jsonb_build_object(
            'status','seated',
            'estado','permanente',
            'funeral_id',v_funeral_id,
            'book_number',lpad(v_book::text,4,'0'),
            'folio',lpad(v_folio::text,4,'0'),
            'number',lpad(v_number::text,4,'0'),
            'numero_registro',v_registry,
            'book_type',v_book_type
          ),
        updated_at = now()
    where id = p_pending_id
      and parish_id = v_parish
      and status = 'pending'
      and reportado = false;

    if not found then
      raise exception 'El pendiente de Exequias ya no está disponible';
    end if;
  end if;

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
    v_parish,
    v_diocese,
    'exequias',
    v_funeral_id,
    'seat',
    v_data
      || jsonb_build_object(
        'book_number',lpad(v_book::text,4,'0'),
        'folio',lpad(v_folio::text,4,'0'),
        'number',lpad(v_number::text,4,'0'),
        'numero_registro',v_registry,
        'book_type',v_book_type
      ),
    jsonb_build_object(
      'pending_id',p_pending_id,
      'numero_registro',v_registry,
      'book_type',v_book_type
    )
  );

  return query
  select
    v_funeral_id,
    lpad(v_book::text,4,'0'),
    lpad(v_folio::text,4,'0'),
    lpad(v_number::text,4,'0'),
    v_next_book,
    v_next_folio,
    v_next_number;
end;
$function$;


-- ============================================================================
-- 6. DIGITALIZACIÓN HISTÓRICA
--    Se preserva la RPC y se amplía para distinguir tipo de libro.
--    NO altera los consecutivos vivos.
-- ============================================================================

create or replace function public.register_historical_funeral(
  p_parish_id uuid,
  p_record jsonb
)
returns table(
  record_id uuid,
  book_number text,
  folio text,
  number text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text;
  v_user_parish uuid;
  v_diocese uuid;

  v_id uuid;
  v_book text;
  v_folio text;
  v_number text;
  v_book_type text;
  v_registry text;

  v_death date;
  v_birth date;
  v_funeral date;
  v_hour time;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select lower(coalesce(role,'')), parish_id, diocese_id
    into v_role, v_user_parish, v_diocese
  from public.user_profiles
  where auth_user_id = auth.uid()
    and coalesce(is_active,true) = true
    and coalesce(status,'active') not in ('blocked','disabled','inactive')
  limit 1;

  if v_role <> 'parish'
     or v_user_parish is distinct from p_parish_id then
    raise exception 'Sólo la parroquia propietaria puede digitalizar su libro de Exequias';
  end if;

  if p_record is null or jsonb_typeof(p_record) <> 'object' then
    raise exception 'Registro de Exequias inválido';
  end if;

  v_book := public.sacramentum_registry_ref(
    coalesce(p_record->>'book_number',p_record->>'libro',p_record->>'Libro')
  );
  v_folio := public.sacramentum_registry_ref(
    coalesce(p_record->>'folio',p_record->>'page_number')
  );
  v_number := public.sacramentum_registry_ref(
    coalesce(p_record->>'number',p_record->>'numero',p_record->>'entry_number')
  );

  if v_book is null or v_folio is null or v_number is null then
    raise exception 'Libro, Folio y Número son obligatorios';
  end if;

  v_book_type := lower(coalesce(
    nullif(trim(p_record->>'book_type'),''),
    nullif(trim(p_record->>'bookType'),''),
    'ordinario'
  ));

  if v_book_type not in ('ordinario','suplementario') then
    raise exception 'Tipo de libro histórico inválido';
  end if;

  v_registry := nullif(trim(coalesce(
    p_record->>'numero_registro',
    p_record->>'numeroRegistro',
    ''
  )), '');

  begin
    v_death := nullif(p_record->>'fecha_defuncion','')::date;
  exception when others then
    raise exception 'Fecha de defunción inválida';
  end;

  begin
    v_birth := nullif(p_record->>'fecha_nacimiento','')::date;
  exception when others then
    raise exception 'Fecha de nacimiento inválida';
  end;

  begin
    v_funeral := nullif(p_record->>'fecha_exequias','')::date;
  exception when others then
    raise exception 'Fecha de Exequias inválida';
  end;

  begin
    v_hour := nullif(p_record->>'hora_exequias','')::time;
  exception when others then
    raise exception 'Hora de Exequias inválida';
  end;

  if v_death is null then
    raise exception 'La fecha de defunción es obligatoria';
  end if;

  if v_birth is not null and v_birth > v_death then
    raise exception 'La fecha de nacimiento no puede ser posterior a la fecha de defunción';
  end if;

  if v_funeral is not null and v_funeral < v_death then
    raise exception 'La fecha de Exequias no puede ser anterior a la fecha de defunción';
  end if;

  if exists(
    select 1
    from public.funerals f
    where f.parish_id = p_parish_id
      and f.book_type = v_book_type
      and public.sacramentum_registry_ref(f.book_number) = v_book
      and public.sacramentum_registry_ref(f.folio) = v_folio
      and public.sacramentum_registry_ref(f.number) = v_number
  ) then
    raise exception 'Ya existe un registro de Exequias % en Libro %, Folio %, Número %',
      upper(v_book_type), v_book, v_folio, v_number;
  end if;

  insert into public.funerals(
    parish_id,
    book_number,
    folio,
    number,
    numero_registro,
    book_type,
    status,
    nombres,
    apellidos,
    document_id,
    sexo,
    fecha_nacimiento,
    lugar_nacimiento,
    fecha_defuncion,
    lugar_defuncion,
    fecha_exequias,
    hora_exequias,
    lugar_exequias,
    cementerio,
    causa_muerte,
    nombre_padre,
    nombre_madre,
    conyuge,
    ministro,
    da_fe,
    observations,
    nota_marginal,
    raw_data
  )
  values(
    p_parish_id,
    v_book,
    v_folio,
    v_number,
    v_registry,
    v_book_type,
    'seated',
    nullif(p_record->>'nombres',''),
    nullif(p_record->>'apellidos',''),
    nullif(p_record->>'document_id',''),
    nullif(p_record->>'sexo',''),
    v_birth,
    nullif(p_record->>'lugar_nacimiento',''),
    v_death,
    nullif(p_record->>'lugar_defuncion',''),
    v_funeral,
    v_hour,
    nullif(p_record->>'lugar_exequias',''),
    nullif(p_record->>'cementerio',''),
    nullif(p_record->>'causa_muerte',''),
    nullif(p_record->>'nombre_padre',''),
    nullif(p_record->>'nombre_madre',''),
    nullif(p_record->>'conyuge',''),
    nullif(p_record->>'ministro',''),
    nullif(p_record->>'da_fe',''),
    nullif(p_record->>'observations',''),
    nullif(p_record->>'nota_marginal',''),
    p_record
      || jsonb_build_object(
        'book_number',v_book,
        'folio',v_folio,
        'number',v_number,
        'book_type',v_book_type,
        'status','seated',
        'source','historical_book_digitization'
      )
  )
  returning id into v_id;

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
    'funeral',
    v_id,
    'historical_digitization',
    p_record,
    jsonb_build_object(
      'book',v_book,
      'folio',v_folio,
      'number',v_number,
      'book_type',v_book_type,
      'changes_live_sequence',false
    )
  );

  return query select v_id,v_book,v_folio,v_number;
end;
$function$;


-- ============================================================================
-- 7. HOTFIX DECRETO DE CORRECCIÓN
--    En esta instalación jsonb_object_length no está disponible.
--    Se sustituye por EXISTS(jsonb_object_keys(...)) sin cambiar el contrato RPC.
-- ============================================================================

create or replace function public.apply_funeral_correction(
  p_funeral_id uuid,
  p_decree_date date,
  p_reason text,
  p_changes jsonb,
  p_decree_number text default null::text
)
returns table(
  decree_id uuid,
  funeral_id uuid,
  decree_number text,
  note_text text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text;
  v_user_diocese uuid;
  v_chancery uuid;
  v_original public.funerals%rowtype;
  v_diocese uuid;
  v_parish_name text;
  v_decree_number text;
  v_sequence bigint;
  v_decree_id uuid;
  v_note text;
  v_payload jsonb;
  v_death_date date;
  v_funeral_date date;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select lower(coalesce(up.role,'')), up.diocese_id, up.chancery_id
    into v_role, v_user_diocese, v_chancery
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
    and coalesce(up.is_active, true) = true
  limit 1;

  if v_role not in ('chancery','diocese','admin_general') then
    raise exception 'Sólo Cancillería, Diócesis o Administración General pueden emitir decretos de Exequias';
  end if;

  select f.*
    into v_original
  from public.funerals f
  where f.id = p_funeral_id
  for update;

  if not found then
    raise exception 'Registro de Exequias no encontrado';
  end if;

  select p.diocese_id, p.name
    into v_diocese, v_parish_name
  from public.parishes p
  where p.id = v_original.parish_id;

  if v_diocese is null then
    raise exception 'El registro de Exequias no tiene una parroquia con diócesis válida';
  end if;

  if v_role <> 'admin_general'
     and v_user_diocese is distinct from v_diocese then
    raise exception 'El registro no pertenece a la jurisdicción del usuario';
  end if;

  if p_decree_date is null
     or nullif(trim(p_reason),'') is null then
    raise exception 'Fecha y fundamento del decreto son obligatorios';
  end if;

  if not exists (
    select 1
    from jsonb_object_keys(coalesce(p_changes,'{}'::jsonb))
  ) then
    raise exception 'Debe existir al menos una corrección respecto del registro original';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(coalesce(p_changes,'{}'::jsonb)) k
    where k not in (
      'nombres',
      'apellidos',
      'fecha_defuncion',
      'lugar_defuncion',
      'fecha_exequias',
      'lugar_exequias',
      'cementerio',
      'ministro',
      'da_fe'
    )
  ) then
    raise exception 'La solicitud contiene campos de Exequias no autorizados para corrección';
  end if;

  v_decree_number := nullif(upper(trim(coalesce(p_decree_number,''))), '');

  if v_decree_number is null then
    insert into public.document_sequences(scope_id, document_type, current_value)
    values (
      v_diocese,
      'decreto_exequias_' || extract(year from p_decree_date)::integer,
      1
    )
    on conflict(scope_id, document_type)
    do update
      set current_value = public.document_sequences.current_value + 1,
          updated_at = now()
    returning current_value into v_sequence;

    v_decree_number :=
      'DEX-' ||
      extract(year from p_decree_date)::integer ||
      '-' ||
      lpad(v_sequence::text, 6, '0');
  end if;

  if exists (
    select 1
    from public.decretos d
    where d.diocese_id = v_diocese
      and lower(coalesce(d.status,'active')) <> 'reversed'
      and lower(trim(coalesce(d.decree_number,''))) = lower(v_decree_number)
  ) then
    raise exception 'El número de decreto % ya existe en esta diócesis', v_decree_number;
  end if;

  v_death_date := case
    when not (p_changes ? 'fecha_defuncion') then v_original.fecha_defuncion
    when coalesce(p_changes->>'fecha_defuncion','') ~ '^\d{4}-\d{2}-\d{2}$'
      then (p_changes->>'fecha_defuncion')::date
    else null
  end;

  v_funeral_date := case
    when not (p_changes ? 'fecha_exequias') then v_original.fecha_exequias
    when coalesce(p_changes->>'fecha_exequias','') ~ '^\d{4}-\d{2}-\d{2}$'
      then (p_changes->>'fecha_exequias')::date
    else null
  end;

  if v_death_date is null then
    raise exception 'La fecha de defunción no puede quedar vacía';
  end if;

  if v_funeral_date is not null and v_funeral_date < v_death_date then
    raise exception 'La fecha de Exequias no puede ser anterior a la fecha de defunción';
  end if;

  v_note :=
    'CORREGIDO MEDIANTE DECRETO ' ||
    v_decree_number ||
    ' DE FECHA ' ||
    p_decree_date::text ||
    '. ' ||
    upper(trim(p_reason));

  update public.funerals
  set
    nombres =
      case when p_changes ? 'nombres'
           then nullif(trim(p_changes->>'nombres'),'')
           else nombres end,
    apellidos =
      case when p_changes ? 'apellidos'
           then nullif(trim(p_changes->>'apellidos'),'')
           else apellidos end,
    fecha_defuncion = v_death_date,
    lugar_defuncion =
      case when p_changes ? 'lugar_defuncion'
           then nullif(trim(p_changes->>'lugar_defuncion'),'')
           else lugar_defuncion end,
    fecha_exequias = v_funeral_date,
    lugar_exequias =
      case when p_changes ? 'lugar_exequias'
           then nullif(trim(p_changes->>'lugar_exequias'),'')
           else lugar_exequias end,
    cementerio =
      case when p_changes ? 'cementerio'
           then nullif(trim(p_changes->>'cementerio'),'')
           else cementerio end,
    ministro =
      case when p_changes ? 'ministro'
           then nullif(trim(p_changes->>'ministro'),'')
           else ministro end,
    da_fe =
      case when p_changes ? 'da_fe'
           then nullif(trim(p_changes->>'da_fe'),'')
           else da_fe end,
    nota_marginal =
      concat_ws(E'\n\n', nullif(nota_marginal,''), v_note),
    raw_data =
      coalesce(raw_data,'{}'::jsonb)
      || p_changes
      || jsonb_build_object(
        'notaMarginal',
          concat_ws(E'\n\n', nullif(nota_marginal,''), v_note),
        'lastCorrectionDecree', v_decree_number,
        'lastCorrectionDate', p_decree_date
      ),
    updated_at = now()
  where id = p_funeral_id;

  v_payload := jsonb_build_object(
    'decreeNumber', v_decree_number,
    'decreeDate', p_decree_date,
    'sacramentType', 'exequias',
    'sacramento', 'exequias',
    'targetName',
      trim(concat_ws(' ',v_original.nombres,v_original.apellidos)),
    'parishName', v_parish_name,
    'reason', trim(p_reason),
    'before', to_jsonb(v_original),
    'changes', p_changes,
    'noteText', v_note,
    'issuedFrom', 'chancery'
  );

  insert into public.decretos(
    parish_id,
    diocese_id,
    chancery_id,
    tipo,
    sacrament_type,
    decree_number,
    decree_date,
    original_record_id,
    replacement_record_id,
    status,
    issued_by,
    payload
  )
  values(
    v_original.parish_id,
    v_diocese,
    v_chancery,
    'correccion',
    'exequias',
    v_decree_number,
    p_decree_date,
    p_funeral_id,
    p_funeral_id,
    'active',
    auth.uid(),
    v_payload
  )
  returning id into v_decree_id;

  insert into public.marginal_notes(
    sacrament_type,
    note_type,
    decree_number,
    content,
    parish_id,
    sacrament_id,
    note_date,
    source_type,
    source_id,
    decree_id,
    created_by
  )
  values(
    'exequias',
    'correccion',
    v_decree_number,
    v_note,
    v_original.parish_id,
    p_funeral_id,
    p_decree_date,
    'decree',
    v_decree_id,
    v_decree_id,
    auth.uid()
  );

  insert into public.official_notifications(
    diocese_id,
    sender_chancery_id,
    receiver_parish_id,
    decree_id,
    category,
    subject,
    message,
    status,
    payload,
    created_by
  )
  values(
    v_diocese,
    v_chancery,
    v_original.parish_id,
    v_decree_id,
    'decree',
    'Decreto de corrección de Exequias ' || v_decree_number,
    'Cancillería ha emitido un decreto que corrige un registro de Exequias de esta parroquia.',
    'pending',
    jsonb_build_object(
      'sacramentType','exequias',
      'decreeType','correccion',
      'decreeNumber',v_decree_number,
      'recordId',p_funeral_id
    ),
    auth.uid()
  );

  insert into public.registry_audit_log(
    actor_user_id,
    parish_id,
    diocese_id,
    entity_type,
    entity_id,
    action,
    before_data,
    after_data,
    metadata
  )
  values(
    auth.uid(),
    v_original.parish_id,
    v_diocese,
    'funeral',
    p_funeral_id,
    'correct_by_decree',
    to_jsonb(v_original),
    p_changes || jsonb_build_object('nota_marginal',v_note),
    jsonb_build_object(
      'decree_id',v_decree_id,
      'decree_number',v_decree_number
    )
  );

  return query
  select
    v_decree_id,
    p_funeral_id,
    v_decree_number,
    v_note;
end;
$function$;


-- ============================================================================
-- 8. RLS Y PERMISOS
-- ============================================================================

alter table public.funerals enable row level security;
alter table public.pending_funerals enable row level security;

drop policy if exists funerals_select_scoped on public.funerals;
create policy funerals_select_scoped
on public.funerals
for select
to authenticated
using (public.can_access_parish(parish_id));

drop policy if exists pending_funerals_select_scoped on public.pending_funerals;
create policy pending_funerals_select_scoped
on public.pending_funerals
for select
to authenticated
using (public.can_access_parish(parish_id));

-- El navegador no escribe directamente en tablas oficiales.
revoke all on table public.funerals from anon;
revoke all on table public.pending_funerals from anon;

revoke all on table public.funerals from authenticated;
revoke all on table public.pending_funerals from authenticated;

grant select on table public.funerals to authenticated;
grant select on table public.pending_funerals to authenticated;

-- RPC sensibles: nunca anónimas.
revoke execute on function public.create_pending_funeral(uuid,jsonb) from public;
revoke execute on function public.create_pending_funeral(uuid,jsonb) from anon;
grant execute on function public.create_pending_funeral(uuid,jsonb) to authenticated;
grant execute on function public.create_pending_funeral(uuid,jsonb) to service_role;

revoke execute on function public.save_funeral_parameters(uuid,jsonb) from public;
revoke execute on function public.save_funeral_parameters(uuid,jsonb) from anon;
grant execute on function public.save_funeral_parameters(uuid,jsonb) to authenticated;
grant execute on function public.save_funeral_parameters(uuid,jsonb) to service_role;

revoke execute on function public.seat_funeral_record(jsonb,uuid) from public;
revoke execute on function public.seat_funeral_record(jsonb,uuid) from anon;
grant execute on function public.seat_funeral_record(jsonb,uuid) to authenticated;
grant execute on function public.seat_funeral_record(jsonb,uuid) to service_role;

revoke execute on function public.register_historical_funeral(uuid,jsonb) from public;
revoke execute on function public.register_historical_funeral(uuid,jsonb) from anon;
grant execute on function public.register_historical_funeral(uuid,jsonb) to authenticated;
grant execute on function public.register_historical_funeral(uuid,jsonb) to service_role;

revoke execute on function public.apply_funeral_correction(uuid,date,text,jsonb,text) from public;
revoke execute on function public.apply_funeral_correction(uuid,date,text,jsonb,text) from anon;
grant execute on function public.apply_funeral_correction(uuid,date,text,jsonb,text) to authenticated;
grant execute on function public.apply_funeral_correction(uuid,date,text,jsonb,text) to service_role;

revoke execute on function public.sacramentum_default_funeral_params() from public;
revoke execute on function public.sacramentum_default_funeral_params() from anon;
grant execute on function public.sacramentum_default_funeral_params() to authenticated;
grant execute on function public.sacramentum_default_funeral_params() to service_role;


-- ============================================================================
-- 9. DOCUMENTACIÓN DE COLUMNAS
-- ============================================================================

comment on column public.funerals.numero_registro is
  'Consecutivo interno parroquial reservado en la etapa de borrador. No sustituye Libro/Folio/Número de la partida oficial.';

comment on column public.funerals.book_type is
  'Libro documental de Exequias: ordinario o suplementario.';

comment on column public.pending_funerals.numero_registro is
  'N.º de Registro interno reservado al crear el borrador de Exequias.';

comment on column public.pending_funerals.book_type is
  'Libro previsto para el asiento definitivo: ordinario o suplementario.';


commit;
