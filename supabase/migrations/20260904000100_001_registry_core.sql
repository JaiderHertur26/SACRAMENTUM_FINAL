-- ============================================================================
-- SACRAMENTUM · Núcleo canónico de registros, decretos y comunicaciones
-- 2026-09-04
-- Migración ADITIVA y NO DESTRUCTIVA.
--
-- Objetivos:
--   1. Mantener intactos los registros existentes.
--   2. Convertir decretos en expedientes enlazables a cualquier sacramento.
--   3. Dar persistencia real en Supabase a Exequias.
--   4. Dar persistencia real a notificaciones oficiales de Cancillería.
--   5. Dar persistencia real a Notificaciones Matrimoniales y sus avisos.
--   6. Añadir auditoría y secuencias atómicas para documentos.
--   7. Completar Matrimonio con las columnas que el frontend ya necesita.
-- ============================================================================

create extension if not exists pgcrypto;

-- --------------------------------------------------------------------------
-- Helpers comunes
-- --------------------------------------------------------------------------
create or replace function public.sacramentum_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- --------------------------------------------------------------------------
-- 1. DECRETOS: convertir la tabla genérica existente en expediente canónico
-- --------------------------------------------------------------------------
alter table if exists public.decretos
  add column if not exists diocese_id uuid,
  add column if not exists chancery_id uuid,
  add column if not exists sacrament_type varchar(32),
  add column if not exists decree_number varchar(80),
  add column if not exists decree_date date,
  add column if not exists original_record_id uuid,
  add column if not exists replacement_record_id uuid,
  add column if not exists status varchar(32) not null default 'active',
  add column if not exists issued_by uuid,
  add column if not exists updated_at timestamptz default now();

-- Backfill tolerante con los payloads históricos.
update public.decretos
set sacrament_type = case
  when lower(coalesce(payload->>'sacramentType', payload->>'sacramento', payload->>'sacrament', '')) like '%confirm%'
    then 'confirmacion'
  when lower(coalesce(payload->>'sacramentType', payload->>'sacramento', payload->>'sacrament', '')) like '%matrim%'
    then 'matrimonio'
  when lower(coalesce(payload->>'sacramentType', payload->>'sacramento', payload->>'sacrament', '')) like '%exequ%'
    or lower(coalesce(payload->>'sacramentType', payload->>'sacramento', payload->>'sacrament', '')) like '%funer%'
    then 'exequias'
  else 'bautismo'
end
where sacrament_type is null;

update public.decretos
set decree_number = coalesce(
  nullif(payload->>'decreeNumber', ''),
  nullif(payload->>'numeroDeDecreto', ''),
  nullif(payload->>'numeroDecreto', '')
)
where decree_number is null;

update public.decretos
set decree_date = coalesce(
  case when coalesce(payload->>'decreeDate', '') ~ '^\d{4}-\d{2}-\d{2}$' then (payload->>'decreeDate')::date end,
  case when coalesce(payload->>'fechaEmision', '') ~ '^\d{4}-\d{2}-\d{2}$' then (payload->>'fechaEmision')::date end,
  created_at::date
)
where decree_date is null;

update public.decretos
set original_record_id = coalesce(
  case when coalesce(payload->>'originalPartidaId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then (payload->>'originalPartidaId')::uuid end,
  case when coalesce(payload->>'originalRecordId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then (payload->>'originalRecordId')::uuid end
)
where original_record_id is null;

update public.decretos
set replacement_record_id = coalesce(
  case when coalesce(payload->>'newPartidaId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then (payload->>'newPartidaId')::uuid end,
  case when coalesce(payload->>'replacementRecordId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then (payload->>'replacementRecordId')::uuid end
)
where replacement_record_id is null;

update public.decretos d
set diocese_id = p.diocese_id
from public.parishes p
where d.diocese_id is null
  and d.parish_id = p.id;

create index if not exists idx_decretos_parish_sacrament_type
  on public.decretos(parish_id, sacrament_type, tipo);
create index if not exists idx_decretos_diocese_date
  on public.decretos(diocese_id, decree_date desc);
create index if not exists idx_decretos_decree_number
  on public.decretos(decree_number);
create index if not exists idx_decretos_original_record
  on public.decretos(original_record_id);

-- --------------------------------------------------------------------------
-- 2. MATRIMONIOS: completar el esquema sin perder compatibilidad
--    La tabla actual carece de status/raw_data/book_number, pero el frontend
--    ya trabaja con esos conceptos.
-- --------------------------------------------------------------------------
alter table if exists public.marriages
  add column if not exists book_number varchar(32),
  add column if not exists status varchar(32) not null default 'seated',
  add column if not exists raw_data jsonb not null default '{}'::jsonb;

create table if not exists public.pending_marriages (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid references public.parishes(id) on delete cascade,
  status varchar(32) not null default 'pending',
  reportado boolean not null default false,
  celebration_date date,
  hora time,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pending_marriages_parish_status
  on public.pending_marriages(parish_id, status, created_at desc);

-- --------------------------------------------------------------------------
-- 3. EXEQUIAS: registro canónico + pendientes
-- --------------------------------------------------------------------------
create table if not exists public.funerals (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete restrict,
  book_id uuid references public.sacrament_books(id) on delete set null,
  parishioner_id uuid references public.parishioners(id) on delete set null,
  celebrant_id uuid,

  book_number varchar(32),
  folio varchar(32),
  number varchar(32),
  status varchar(32) not null default 'seated',

  nombres varchar(180),
  apellidos varchar(180),
  document_id varchar(80),
  sexo varchar(32),
  fecha_nacimiento date,
  lugar_nacimiento varchar(180),
  fecha_defuncion date not null,
  lugar_defuncion varchar(180),
  fecha_exequias date,
  hora_exequias time,
  lugar_exequias varchar(240),
  cementerio varchar(240),
  causa_muerte text,

  nombre_padre varchar(240),
  nombre_madre varchar(240),
  conyuge varchar(240),
  ministro varchar(240),
  da_fe varchar(240),
  observations text,
  nota_marginal text,
  raw_data jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_funerals_parish_date
  on public.funerals(parish_id, fecha_exequias desc, fecha_defuncion desc);
create index if not exists idx_funerals_book_lookup
  on public.funerals(parish_id, book_number, folio, number);
create index if not exists idx_funerals_person_search
  on public.funerals(parish_id, apellidos, nombres);

create table if not exists public.pending_funerals (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete cascade,
  status varchar(32) not null default 'pending',
  reportado boolean not null default false,
  fecha_exequias date,
  hora time,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pending_funerals_parish_status
  on public.pending_funerals(parish_id, status, created_at desc);

alter table if exists public.parish_parameters
  add column if not exists exequias_params jsonb not null default
    '{"libro":1,"folio":1,"numero":1,"partidasPorFolio":2,"reiniciarNumeroEnFolio":false}'::jsonb;

-- --------------------------------------------------------------------------
-- 3B. NOTAS MARGINALES: enlazar su origen documental sin romper el esquema
-- --------------------------------------------------------------------------
alter table if exists public.marginal_notes
  add column if not exists source_type varchar(64),
  add column if not exists source_id uuid,
  add column if not exists decree_id uuid references public.decretos(id) on delete set null,
  add column if not exists created_by uuid;

create index if not exists idx_marginal_notes_source
  on public.marginal_notes(source_type, source_id);
create index if not exists idx_marginal_notes_decree
  on public.marginal_notes(decree_id);

-- --------------------------------------------------------------------------
-- 4. NOTIFICACIONES OFICIALES DE CANCILLERÍA A PARROQUIA
-- --------------------------------------------------------------------------
create table if not exists public.official_notifications (
  id uuid primary key default gen_random_uuid(),
  diocese_id uuid references public.dioceses(id) on delete restrict,
  sender_chancery_id uuid references public.chancelleries(id) on delete set null,
  receiver_parish_id uuid not null references public.parishes(id) on delete cascade,
  decree_id uuid references public.decretos(id) on delete cascade,
  category varchar(64) not null default 'decree',
  subject varchar(240) not null,
  message text,
  status varchar(32) not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  created_by uuid,
  read_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_official_notification_decree_receiver
  on public.official_notifications(decree_id, receiver_parish_id, category)
  where decree_id is not null;
create index if not exists idx_official_notifications_inbox
  on public.official_notifications(receiver_parish_id, status, created_at desc);

-- --------------------------------------------------------------------------
-- 5. NOTIFICACIÓN MATRIMONIAL: documento + uno o varios destinatarios
-- --------------------------------------------------------------------------
create table if not exists public.matrimonial_notifications (
  id uuid primary key default gen_random_uuid(),
  sender_parish_id uuid not null references public.parishes(id) on delete restrict,
  diocese_id uuid references public.dioceses(id) on delete set null,
  source_baptism_id uuid references public.baptisms(id) on delete set null,
  spouse_baptism_id uuid references public.baptisms(id) on delete set null,
  marriage_id uuid references public.marriages(id) on delete set null,

  consecutive bigint not null,
  document_number varchar(80) not null,
  person_name varchar(300) not null,
  spouse_name varchar(300),
  marriage_date date,
  marriage_book varchar(32),
  marriage_folio varchar(32),
  marriage_number varchar(32),
  marriage_diocese_id uuid references public.dioceses(id) on delete set null,
  marriage_parish_id uuid references public.parishes(id) on delete set null,
  external_marriage_parish_name varchar(300),

  status varchar(32) not null default 'sent',
  payload jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(sender_parish_id, consecutive),
  unique(sender_parish_id, document_number)
);

create index if not exists idx_matrimonial_notifications_sender
  on public.matrimonial_notifications(sender_parish_id, created_at desc);
create index if not exists idx_matrimonial_notifications_marriage
  on public.matrimonial_notifications(marriage_id);

create table if not exists public.matrimonial_notification_recipients (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.matrimonial_notifications(id) on delete cascade,
  receiver_parish_id uuid not null references public.parishes(id) on delete cascade,
  target_baptism_id uuid references public.baptisms(id) on delete set null,
  status varchar(32) not null default 'pending',
  note_applied boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  read_by uuid,
  read_at timestamptz,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(notification_id, receiver_parish_id, target_baptism_id)
);

create index if not exists idx_matrimonial_recipients_inbox
  on public.matrimonial_notification_recipients(receiver_parish_id, status, created_at desc);

-- --------------------------------------------------------------------------
-- 6. AUDITORÍA INSTITUCIONAL
-- --------------------------------------------------------------------------
create table if not exists public.registry_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  parish_id uuid references public.parishes(id) on delete set null,
  diocese_id uuid references public.dioceses(id) on delete set null,
  entity_type varchar(80) not null,
  entity_id uuid,
  action varchar(80) not null,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_registry_audit_entity
  on public.registry_audit_log(entity_type, entity_id, created_at desc);
create index if not exists idx_registry_audit_scope
  on public.registry_audit_log(diocese_id, parish_id, created_at desc);

-- --------------------------------------------------------------------------
-- 7. SECUENCIAS DOCUMENTALES ATÓMICAS (p.ej. NM-000001)
-- --------------------------------------------------------------------------
create table if not exists public.document_sequences (
  scope_id uuid not null,
  document_type varchar(80) not null,
  current_value bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key(scope_id, document_type)
);

create or replace function public.next_document_sequence(
  p_scope_id uuid,
  p_document_type text,
  p_prefix text default null
)
returns table(sequence_value bigint, document_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_value bigint;
  v_prefix text;
  v_role text;
  v_parish uuid;
  v_diocese uuid;
begin
  if p_scope_id is null then
    raise exception 'scope_id es obligatorio';
  end if;
  if nullif(trim(p_document_type), '') is null then
    raise exception 'document_type es obligatorio';
  end if;

  select lower(coalesce(role,'')), parish_id, diocese_id
    into v_role, v_parish, v_diocese
  from public.user_profiles
  where auth_user_id = auth.uid() and coalesce(is_active, true) = true
  limit 1;

  if auth.uid() is null or v_role is null then
    raise exception 'Usuario no autorizado para numeración documental';
  end if;
  if v_role <> 'admin_general'
     and p_scope_id is distinct from v_parish
     and p_scope_id is distinct from v_diocese then
    raise exception 'El ámbito solicitado no pertenece a la jurisdicción del usuario';
  end if;

  insert into public.document_sequences(scope_id, document_type, current_value)
  values (p_scope_id, lower(trim(p_document_type)), 1)
  on conflict(scope_id, document_type)
  do update set current_value = public.document_sequences.current_value + 1,
                updated_at = now()
  returning current_value into v_value;

  v_prefix := coalesce(nullif(trim(p_prefix), ''), upper(left(trim(p_document_type), 2)));
  return query select v_value, v_prefix || '-' || lpad(v_value::text, 6, '0');
end;
$$;

revoke all on function public.next_document_sequence(uuid, text, text) from public;
grant execute on function public.next_document_sequence(uuid, text, text) to authenticated;

-- --------------------------------------------------------------------------
-- 8. CONSECUTIVOS SACRAMENTALES: crear unicidad sólo si los datos actuales
--    ya están limpios. Si hay duplicados, se deja NOTICE en vez de abortar.
-- --------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from public.baptisms
    where parish_id is not null and book_number is not null and folio is not null and number is not null
    group by parish_id, book_number, folio, number having count(*) > 1
  ) then
    execute 'create unique index if not exists uq_baptisms_registry_number on public.baptisms(parish_id, book_number, folio, number) where parish_id is not null and book_number is not null and folio is not null and number is not null';
  else
    raise notice 'SACRAMENTUM: baptisms contiene consecutivos duplicados; revisar antes de crear índice único.';
  end if;

  if not exists (
    select 1 from public.confirmations
    where parish_id is not null and book_number is not null and folio is not null and number is not null
    group by parish_id, book_number, folio, number having count(*) > 1
  ) then
    execute 'create unique index if not exists uq_confirmations_registry_number on public.confirmations(parish_id, book_number, folio, number) where parish_id is not null and book_number is not null and folio is not null and number is not null';
  else
    raise notice 'SACRAMENTUM: confirmations contiene consecutivos duplicados; revisar antes de crear índice único.';
  end if;

  if not exists (
    select 1 from public.marriages
    where parish_id is not null and book_number is not null and folio is not null and number is not null
    group by parish_id, book_number, folio, number having count(*) > 1
  ) then
    execute 'create unique index if not exists uq_marriages_registry_number on public.marriages(parish_id, book_number, folio, number) where parish_id is not null and book_number is not null and folio is not null and number is not null';
  else
    raise notice 'SACRAMENTUM: marriages contiene consecutivos duplicados; revisar antes de crear índice único.';
  end if;
end;
$$;

create unique index if not exists uq_funerals_registry_number
  on public.funerals(parish_id, book_number, folio, number)
  where book_number is not null and folio is not null and number is not null;

-- --------------------------------------------------------------------------
-- 9. updated_at triggers
-- --------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'decretos', 'marriages', 'pending_marriages', 'funerals', 'pending_funerals',
    'official_notifications', 'matrimonial_notifications',
    'matrimonial_notification_recipients'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || t || '_updated_at', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.sacramentum_set_updated_at()',
      'trg_' || t || '_updated_at', t
    );
  end loop;
end;
$$;

-- --------------------------------------------------------------------------
-- 10. Validaciones suaves de dominio
-- --------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_decretos_sacrament_type') then
    alter table public.decretos
      add constraint chk_decretos_sacrament_type
      check (sacrament_type in ('bautismo','confirmacion','matrimonio','exequias')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_decretos_status') then
    alter table public.decretos
      add constraint chk_decretos_status
      check (status in ('active','archived','cancelled','reversed')) not valid;
  end if;
end;
$$;

comment on table public.funerals is 'Registro canónico parroquial de Exequias de SACRAMENTUM.';
comment on table public.official_notifications is 'Bandeja oficial de comunicaciones de Cancillería vinculadas a decretos/expedientes.';
comment on table public.matrimonial_notifications is 'Documento de Notificación Matrimonial emitido por una parroquia.';
comment on table public.matrimonial_notification_recipients is 'Destinatarios/avisos de una Notificación Matrimonial y su estado de procesamiento.';
comment on table public.registry_audit_log is 'Trazabilidad institucional de operaciones sensibles en registros y decretos.';

-- --------------------------------------------------------------------------
-- 11. BÚSQUEDA BAUTISMAL LIMITADA PARA NOTIFICACIONES MATRIMONIALES
--     Permite localizar una partida en otra parroquia sin exponer raw_data,
--     notas marginales, documentos civiles ni el registro completo.
-- --------------------------------------------------------------------------
create or replace function public.search_baptisms_for_matrimonial_notification(
  p_diocese_id uuid default null,
  p_book text default null,
  p_folio text default null,
  p_number text default null,
  p_first_name text default null,
  p_last_name text default null,
  p_limit integer default 50
)
returns table(
  id uuid,
  parish_id uuid,
  parish_name text,
  diocese_id uuid,
  nombres text,
  apellidos text,
  book_number text,
  folio text,
  number text,
  celebration_date date,
  fecha_nacimiento date,
  lugar_nacimiento text,
  nombre_padre text,
  nombre_madre text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.user_profiles up
    where up.auth_user_id = auth.uid()
      and coalesce(up.is_active, true) = true
      and coalesce(up.status, 'active') not in ('blocked','disabled','inactive')
  ) then
    raise exception 'Usuario no autorizado';
  end if;

  if nullif(trim(coalesce(p_book,'')), '') is null
     and nullif(trim(coalesce(p_folio,'')), '') is null
     and nullif(trim(coalesce(p_number,'')), '') is null
     and nullif(trim(coalesce(p_first_name,'')), '') is null
     and nullif(trim(coalesce(p_last_name,'')), '') is null then
    raise exception 'Debe indicar al menos un criterio de búsqueda';
  end if;

  return query
  select
    b.id,
    b.parish_id,
    p.name::text,
    p.diocese_id,
    b.nombres::text,
    b.apellidos::text,
    b.book_number::text,
    b.folio::text,
    b.number::text,
    b.celebration_date,
    b.fecha_nacimiento,
    b.lugar_nacimiento::text,
    b.nombre_padre::text,
    b.nombre_madre::text
  from public.baptisms b
  join public.parishes p on p.id = b.parish_id
  where (p_diocese_id is null or p.diocese_id = p_diocese_id)
    and (nullif(trim(coalesce(p_book,'')), '') is null or b.book_number::text = trim(p_book))
    and (nullif(trim(coalesce(p_folio,'')), '') is null or b.folio::text = trim(p_folio))
    and (nullif(trim(coalesce(p_number,'')), '') is null or b.number::text = trim(p_number))
    and (nullif(trim(coalesce(p_first_name,'')), '') is null or coalesce(b.nombres,'') ilike '%' || trim(p_first_name) || '%')
    and (nullif(trim(coalesce(p_last_name,'')), '') is null or coalesce(b.apellidos,'') ilike '%' || trim(p_last_name) || '%')
    and coalesce(lower(b.status), 'active') not in ('anulada','annulled','deleted')
  order by b.apellidos nulls last, b.nombres nulls last, b.celebration_date desc nulls last
  limit greatest(1, least(coalesce(p_limit, 50), 100));
end;
$$;

revoke all on function public.search_baptisms_for_matrimonial_notification(uuid,text,text,text,text,text,integer) from public;
grant execute on function public.search_baptisms_for_matrimonial_notification(uuid,text,text,text,text,text,integer) to authenticated;

comment on function public.search_baptisms_for_matrimonial_notification(uuid,text,text,text,text,text,integer)
  is 'Búsqueda bautismal interparroquial de mínima exposición, exclusivamente para corresponsalía/notificación matrimonial.';

-- --------------------------------------------------------------------------
-- 12. CORRECCIÓN DE CONFIRMACIÓN TRANSACCIONAL
--     Todo el expediente se aplica en una sola transacción PostgreSQL:
--     original + supletoria + consecutivo + decreto + notas + aviso + auditoría.
-- --------------------------------------------------------------------------
create or replace function public.apply_confirmation_correction(
  p_parish_id uuid,
  p_original_confirmation_id uuid,
  p_decree_number text,
  p_decree_date date,
  p_concept_id uuid,
  p_corrected_data jsonb,
  p_decree_payload jsonb,
  p_annulled_note text,
  p_replacement_note text,
  p_expected_book integer,
  p_expected_folio integer,
  p_expected_number integer
)
returns table(
  decree_id uuid,
  replacement_confirmation_id uuid,
  book_number text,
  folio text,
  number text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_user_parish uuid;
  v_user_diocese uuid;
  v_chancery uuid;
  v_parish_diocese uuid;
  v_original public.confirmations%rowtype;
  v_params jsonb;
  v_book integer;
  v_folio integer;
  v_number integer;
  v_limit integer;
  v_restart boolean;
  v_next_number integer;
  v_next_folio integer;
  v_next_book integer;
  v_next_params jsonb;
  v_new_id uuid;
  v_decree_id uuid;
  v_created_payload jsonb;
  v_birth_date date;
  v_celebration_date date;
  v_baptism_date date;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select lower(coalesce(up.role,'')), up.parish_id, up.diocese_id, up.chancery_id
    into v_role, v_user_parish, v_user_diocese, v_chancery
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
    and coalesce(up.is_active, true) = true
  limit 1;

  if v_role not in ('chancery','diocese','admin_general') then
    raise exception 'Sólo Cancillería, Diócesis o Administración General pueden emitir este decreto';
  end if;

  select p.diocese_id into v_parish_diocese
  from public.parishes p
  where p.id = p_parish_id;

  if v_parish_diocese is null then
    raise exception 'Parroquia no encontrada o sin diócesis';
  end if;

  if v_role <> 'admin_general' and v_user_diocese is distinct from v_parish_diocese then
    raise exception 'La parroquia no pertenece a la jurisdicción del usuario';
  end if;

  if nullif(trim(p_decree_number), '') is null or p_decree_date is null then
    raise exception 'Número y fecha de decreto son obligatorios';
  end if;

  if exists (
    select 1 from public.decretos d
    where d.diocese_id = v_parish_diocese
      and lower(coalesce(d.status,'active')) <> 'reversed'
      and lower(trim(coalesce(d.decree_number,''))) = lower(trim(p_decree_number))
  ) then
    raise exception 'El número de decreto % ya existe en esta diócesis', p_decree_number;
  end if;

  select * into v_original
  from public.confirmations c
  where c.id = p_original_confirmation_id
    and c.parish_id = p_parish_id
  for update;

  if not found then
    raise exception 'La partida original de Confirmación no existe en la parroquia seleccionada';
  end if;

  if lower(coalesce(v_original.status,'')) in ('anulada','annulled','reversed') then
    raise exception 'La partida original ya está anulada o revertida';
  end if;

  select pp.confirmaciones_params into v_params
  from public.parish_parameters pp
  where pp.parish_id = p_parish_id
  for update;

  if not found then
    raise exception 'La parroquia no tiene parámetros de Confirmación configurados';
  end if;

  v_book := greatest(coalesce(nullif(v_params->>'suplementarioLibro','')::integer, 1), 1);
  v_folio := greatest(coalesce(nullif(v_params->>'suplementarioFolio','')::integer, 1), 1);
  v_number := greatest(coalesce(nullif(v_params->>'suplementarioNumero','')::integer, 1), 1);
  v_limit := greatest(coalesce(nullif(v_params->>'suplementarioPartidas','')::integer, 2), 1);
  v_restart := coalesce((v_params->>'suplementarioReiniciar')::boolean, false);

  if v_book <> p_expected_book or v_folio <> p_expected_folio or v_number <> p_expected_number then
    raise exception 'El consecutivo supletorio cambió. Recargue la parroquia antes de emitir el decreto.';
  end if;

  if exists (
    select 1 from public.confirmations c
    where c.parish_id = p_parish_id
      and c.book_number = lpad(v_book::text, 4, '0')
      and c.folio = lpad(v_folio::text, 4, '0')
      and c.number = lpad(v_number::text, 4, '0')
  ) then
    raise exception 'El consecutivo supletorio Libro %, Folio %, Número % ya está ocupado', v_book, v_folio, v_number;
  end if;

  v_celebration_date := case
    when coalesce(p_corrected_data->>'fechaSacramento','') ~ '^\d{4}-\d{2}-\d{2}$'
      then (p_corrected_data->>'fechaSacramento')::date
    else null
  end;
  v_birth_date := case
    when coalesce(p_corrected_data->>'fechaNacimiento','') ~ '^\d{4}-\d{2}-\d{2}$'
      then (p_corrected_data->>'fechaNacimiento')::date
    else null
  end;
  v_baptism_date := case
    when coalesce(p_corrected_data->>'fechaBautismo','') ~ '^\d{4}-\d{2}-\d{2}$'
      then (p_corrected_data->>'fechaBautismo')::date
    else null
  end;

  if v_celebration_date is null then
    raise exception 'La fecha de Confirmación corregida es obligatoria';
  end if;

  insert into public.confirmations (
    parish_id, book_number, folio, number,
    celebration_date, nombres, apellidos, sexo,
    fecha_nacimiento, lugar_nacimiento, fecha_bautismo, lugar_bautismo,
    nuip, direccion, numero_registro, hora_sacramento,
    nombre_padre, cedula_padre, nombre_madre, cedula_madre,
    abuelos_paternos, abuelos_maternos, tipo_union_padres,
    padrinos, ministro, da_fe, observations,
    status, nota_marginal, raw_data
  ) values (
    p_parish_id,
    lpad(v_book::text, 4, '0'), lpad(v_folio::text, 4, '0'), lpad(v_number::text, 4, '0'),
    v_celebration_date,
    nullif(trim(p_corrected_data->>'nombres'), ''),
    nullif(trim(p_corrected_data->>'apellidos'), ''),
    nullif(trim(p_corrected_data->>'sexo'), ''),
    v_birth_date,
    nullif(trim(p_corrected_data->>'lugarNacimiento'), ''),
    v_baptism_date,
    nullif(trim(p_corrected_data->>'lugarBautismo'), ''),
    nullif(trim(p_corrected_data->>'nuip'), ''),
    nullif(trim(p_corrected_data->>'direccion'), ''),
    nullif(trim(p_corrected_data->>'numeroRegistro'), ''),
    nullif(trim(p_corrected_data->>'horaSacramento'), ''),
    nullif(trim(p_corrected_data->>'nombrePadre'), ''),
    nullif(trim(p_corrected_data->>'cedulaPadre'), ''),
    nullif(trim(p_corrected_data->>'nombreMadre'), ''),
    nullif(trim(p_corrected_data->>'cedulaMadre'), ''),
    nullif(p_corrected_data->>'abuelosPaternos', ''),
    nullif(p_corrected_data->>'abuelosMaternos', ''),
    nullif(trim(p_corrected_data->>'tipoUnionPadres'), ''),
    nullif(trim(p_corrected_data->>'padrinos'), ''),
    nullif(trim(p_corrected_data->>'ministro'), ''),
    nullif(trim(p_corrected_data->>'daFe'), ''),
    nullif(p_corrected_data->>'observaciones', ''),
    'seated', p_replacement_note,
    coalesce(p_corrected_data, '{}'::jsonb)
      || jsonb_build_object(
        'Libro', lpad(v_book::text, 4, '0'),
        'folio', lpad(v_folio::text, 4, '0'),
        'numero', lpad(v_number::text, 4, '0'),
        'book_number', lpad(v_book::text, 4, '0'),
        'notaMarginal', p_replacement_note,
        'estado', 'permanente',
        'status', 'seated'
      )
  ) returning id into v_new_id;

  update public.confirmations
  set status = 'anulada',
      nota_marginal = concat_ws(E'\n\n', nullif(v_original.nota_marginal,''), p_annulled_note),
      raw_data = coalesce(raw_data, '{}'::jsonb)
        || jsonb_build_object(
          'anulado', true,
          'status', 'anulada',
          'notaMarginal', concat_ws(E'\n\n', nullif(v_original.nota_marginal,''), p_annulled_note),
          'annulmentDecree', p_decree_number,
          'annulmentDate', p_decree_date
        ),
      updated_at = now()
  where id = p_original_confirmation_id;

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

  v_next_params := jsonb_set(
    jsonb_set(
      jsonb_set(v_params, '{suplementarioLibro}', to_jsonb(v_next_book), true),
      '{suplementarioFolio}', to_jsonb(v_next_folio), true
    ),
    '{suplementarioNumero}', to_jsonb(v_next_number), true
  );

  update public.parish_parameters
  set confirmaciones_params = v_next_params,
      updated_at = now()
  where parish_id = p_parish_id;

  v_created_payload := coalesce(p_decree_payload, '{}'::jsonb)
    || jsonb_build_object(
      'sacramentType', 'confirmacion',
      'sacramento', 'confirmacion',
      'decreeNumber', p_decree_number,
      'decreeDate', p_decree_date,
      'conceptoAnulacionId', p_concept_id,
      'originalPartidaId', p_original_confirmation_id,
      'newPartidaId', v_new_id,
      'targetParishId', p_parish_id,
      'issuedFrom', 'chancery',
      'newPartidaSummary', coalesce(p_decree_payload->'newPartidaSummary','{}'::jsonb)
        || jsonb_build_object('book',v_book,'page',v_folio,'entry',v_number)
    );

  insert into public.decretos (
    parish_id, diocese_id, chancery_id, tipo, sacrament_type,
    decree_number, decree_date, original_record_id, replacement_record_id,
    status, issued_by, payload
  ) values (
    p_parish_id, v_parish_diocese, v_chancery, 'correccion', 'confirmacion',
    trim(p_decree_number), p_decree_date, p_original_confirmation_id, v_new_id,
    'active', auth.uid(), v_created_payload
  ) returning id into v_decree_id;

  insert into public.marginal_notes (
    sacrament_type, note_type, decree_number, content, parish_id,
    sacrament_id, note_date, source_type, source_id, decree_id, created_by
  ) values
    ('confirmacion','correccion_anulacion',trim(p_decree_number),p_annulled_note,p_parish_id,
      p_original_confirmation_id,p_decree_date,'decree',v_decree_id,v_decree_id,auth.uid()),
    ('confirmacion','correccion_supletoria',trim(p_decree_number),p_replacement_note,p_parish_id,
      v_new_id,p_decree_date,'decree',v_decree_id,v_decree_id,auth.uid());

  insert into public.official_notifications (
    diocese_id, sender_chancery_id, receiver_parish_id, decree_id,
    category, subject, message, status, payload, created_by
  ) values (
    v_parish_diocese, v_chancery, p_parish_id, v_decree_id,
    'decree',
    'Decreto de corrección de Confirmación ' || trim(p_decree_number),
    'Cancillería ha emitido un decreto de corrección que afecta una partida de Confirmación de esta parroquia.',
    'pending',
    jsonb_build_object(
      'sacramentType','confirmacion',
      'decreeType','correccion',
      'decreeNumber',trim(p_decree_number),
      'originalRecordId',p_original_confirmation_id,
      'replacementRecordId',v_new_id
    ),
    auth.uid()
  );

  insert into public.registry_audit_log (
    actor_user_id, parish_id, diocese_id, entity_type, entity_id, action,
    before_data, after_data, metadata
  ) values
    (auth.uid(),p_parish_id,v_parish_diocese,'confirmation',p_original_confirmation_id,'annul_by_decree',
      to_jsonb(v_original),
      jsonb_build_object('status','anulada','nota_marginal',p_annulled_note),
      jsonb_build_object('decree_number',trim(p_decree_number))),
    (auth.uid(),p_parish_id,v_parish_diocese,'confirmation',v_new_id,'create_supplementary_by_decree',
      null,
      p_corrected_data || jsonb_build_object('book',v_book,'folio',v_folio,'number',v_number),
      jsonb_build_object('decree_number',trim(p_decree_number))),
    (auth.uid(),p_parish_id,v_parish_diocese,'decree',v_decree_id,'issue',
      null,v_created_payload,
      jsonb_build_object('sacrament_type','confirmacion','decree_type','correccion'));

  return query
  select v_decree_id, v_new_id,
         lpad(v_book::text,4,'0'), lpad(v_folio::text,4,'0'), lpad(v_number::text,4,'0');
end;
$$;

revoke all on function public.apply_confirmation_correction(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer) from public;
grant execute on function public.apply_confirmation_correction(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer) to authenticated;

comment on function public.apply_confirmation_correction(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer)
is 'Aplica de forma atómica una corrección de Confirmación emitida por Cancillería/Diócesis: anula original, crea supletoria, avanza consecutivo, crea decreto, notas marginales, aviso y auditoría.';

-- --------------------------------------------------------------------------
-- 13. CORRECCIÓN DE EXEQUIAS TRANSACCIONAL
--     Registro + decreto + nota marginal + aviso + auditoría, en una sola
--     transacción y con numeración documental reservada sólo al emitir.
-- --------------------------------------------------------------------------
create or replace function public.apply_funeral_correction(
  p_funeral_id uuid,
  p_decree_date date,
  p_reason text,
  p_changes jsonb,
  p_decree_number text default null
)
returns table(
  decree_id uuid,
  funeral_id uuid,
  decree_number text,
  note_text text
)
language plpgsql
security definer
set search_path = public
as $$
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

  select f.* into v_original
  from public.funerals f
  where f.id = p_funeral_id
  for update;

  if not found then
    raise exception 'Registro de Exequias no encontrado';
  end if;

  select p.diocese_id, p.name into v_diocese, v_parish_name
  from public.parishes p
  where p.id = v_original.parish_id;

  if v_diocese is null then
    raise exception 'El registro de Exequias no tiene una parroquia con diócesis válida';
  end if;

  if v_role <> 'admin_general' and v_user_diocese is distinct from v_diocese then
    raise exception 'El registro no pertenece a la jurisdicción del usuario';
  end if;

  if p_decree_date is null or nullif(trim(p_reason),'') is null then
    raise exception 'Fecha y fundamento del decreto son obligatorios';
  end if;

  if coalesce(jsonb_object_length(coalesce(p_changes,'{}'::jsonb)), 0) = 0 then
    raise exception 'Debe existir al menos una corrección respecto del registro original';
  end if;

  -- Sólo se aceptan campos expresamente corregibles en el registro de Exequias.
  if exists (
    select 1 from jsonb_object_keys(coalesce(p_changes,'{}'::jsonb)) k
    where k not in (
      'nombres','apellidos','fecha_defuncion','lugar_defuncion','fecha_exequias',
      'lugar_exequias','cementerio','ministro','da_fe'
    )
  ) then
    raise exception 'La solicitud contiene campos de Exequias no autorizados para corrección';
  end if;

  v_decree_number := nullif(upper(trim(coalesce(p_decree_number,''))), '');
  if v_decree_number is null then
    insert into public.document_sequences(scope_id, document_type, current_value)
    values (v_diocese, 'decreto_exequias_' || extract(year from p_decree_date)::integer, 1)
    on conflict(scope_id, document_type)
    do update set current_value = public.document_sequences.current_value + 1,
                  updated_at = now()
    returning current_value into v_sequence;

    v_decree_number := 'DEX-' || extract(year from p_decree_date)::integer || '-' || lpad(v_sequence::text, 6, '0');
  end if;

  if exists (
    select 1 from public.decretos d
    where d.diocese_id = v_diocese
      and lower(coalesce(d.status,'active')) <> 'reversed'
      and lower(trim(coalesce(d.decree_number,''))) = lower(v_decree_number)
  ) then
    raise exception 'El número de decreto % ya existe en esta diócesis', v_decree_number;
  end if;

  v_death_date := case
    when not (p_changes ? 'fecha_defuncion') then v_original.fecha_defuncion
    when coalesce(p_changes->>'fecha_defuncion','') ~ '^\d{4}-\d{2}-\d{2}$' then (p_changes->>'fecha_defuncion')::date
    else null
  end;
  v_funeral_date := case
    when not (p_changes ? 'fecha_exequias') then v_original.fecha_exequias
    when coalesce(p_changes->>'fecha_exequias','') ~ '^\d{4}-\d{2}-\d{2}$' then (p_changes->>'fecha_exequias')::date
    else null
  end;

  if v_death_date is null then
    raise exception 'La fecha de defunción no puede quedar vacía';
  end if;

  v_note := 'CORREGIDO MEDIANTE DECRETO ' || v_decree_number || ' DE FECHA ' || p_decree_date::text || '. ' || upper(trim(p_reason));

  update public.funerals
  set nombres = case when p_changes ? 'nombres' then nullif(trim(p_changes->>'nombres'),'') else nombres end,
      apellidos = case when p_changes ? 'apellidos' then nullif(trim(p_changes->>'apellidos'),'') else apellidos end,
      fecha_defuncion = v_death_date,
      lugar_defuncion = case when p_changes ? 'lugar_defuncion' then nullif(trim(p_changes->>'lugar_defuncion'),'') else lugar_defuncion end,
      fecha_exequias = v_funeral_date,
      lugar_exequias = case when p_changes ? 'lugar_exequias' then nullif(trim(p_changes->>'lugar_exequias'),'') else lugar_exequias end,
      cementerio = case when p_changes ? 'cementerio' then nullif(trim(p_changes->>'cementerio'),'') else cementerio end,
      ministro = case when p_changes ? 'ministro' then nullif(trim(p_changes->>'ministro'),'') else ministro end,
      da_fe = case when p_changes ? 'da_fe' then nullif(trim(p_changes->>'da_fe'),'') else da_fe end,
      nota_marginal = concat_ws(E'\n\n', nullif(nota_marginal,''), v_note),
      raw_data = coalesce(raw_data,'{}'::jsonb)
        || p_changes
        || jsonb_build_object(
          'notaMarginal', concat_ws(E'\n\n', nullif(nota_marginal,''), v_note),
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
    'targetName', trim(concat_ws(' ',v_original.nombres,v_original.apellidos)),
    'parishName', v_parish_name,
    'reason', trim(p_reason),
    'before', to_jsonb(v_original),
    'changes', p_changes,
    'noteText', v_note,
    'issuedFrom', 'chancery'
  );

  insert into public.decretos (
    parish_id, diocese_id, chancery_id, tipo, sacrament_type,
    decree_number, decree_date, original_record_id, replacement_record_id,
    status, issued_by, payload
  ) values (
    v_original.parish_id, v_diocese, v_chancery, 'correccion', 'exequias',
    v_decree_number, p_decree_date, p_funeral_id, p_funeral_id,
    'active', auth.uid(), v_payload
  ) returning id into v_decree_id;

  insert into public.marginal_notes (
    sacrament_type, note_type, decree_number, content, parish_id,
    sacrament_id, note_date, source_type, source_id, decree_id, created_by
  ) values (
    'exequias','correccion',v_decree_number,v_note,v_original.parish_id,
    p_funeral_id,p_decree_date,'decree',v_decree_id,v_decree_id,auth.uid()
  );

  insert into public.official_notifications (
    diocese_id, sender_chancery_id, receiver_parish_id, decree_id,
    category, subject, message, status, payload, created_by
  ) values (
    v_diocese,v_chancery,v_original.parish_id,v_decree_id,'decree',
    'Decreto de corrección de Exequias ' || v_decree_number,
    'Cancillería ha emitido un decreto que corrige un registro de Exequias de esta parroquia.',
    'pending',
    jsonb_build_object('sacramentType','exequias','decreeType','correccion','decreeNumber',v_decree_number,'recordId',p_funeral_id),
    auth.uid()
  );

  insert into public.registry_audit_log (
    actor_user_id, parish_id, diocese_id, entity_type, entity_id, action,
    before_data, after_data, metadata
  ) values (
    auth.uid(),v_original.parish_id,v_diocese,'funeral',p_funeral_id,'correct_by_decree',
    to_jsonb(v_original),
    p_changes || jsonb_build_object('nota_marginal',v_note),
    jsonb_build_object('decree_id',v_decree_id,'decree_number',v_decree_number)
  );

  return query select v_decree_id, p_funeral_id, v_decree_number, v_note;
end;
$$;

revoke all on function public.apply_funeral_correction(uuid,date,text,jsonb,text) from public;
grant execute on function public.apply_funeral_correction(uuid,date,text,jsonb,text) to authenticated;

comment on function public.apply_funeral_correction(uuid,date,text,jsonb,text)
is 'Aplica de forma atómica una corrección de Exequias con decreto, nota marginal, notificación oficial y auditoría.';

-- --------------------------------------------------------------------------
-- 14. EMISIÓN TRANSACCIONAL DE NOTIFICACIÓN MATRIMONIAL
-- --------------------------------------------------------------------------
create or replace function public.issue_matrimonial_notification(
  p_source_baptism_id uuid,
  p_spouse_baptism_id uuid,
  p_manual_receiver_parish_id uuid,
  p_manual_locator jsonb,
  p_marriage_date date,
  p_marriage_book text,
  p_marriage_folio text,
  p_marriage_number text,
  p_marriage_diocese_id uuid,
  p_marriage_parish_id uuid,
  p_external_marriage_parish_name text,
  p_manual_person_name text,
  p_manual_spouse_name text,
  p_main_note text,
  p_spouse_note text,
  p_payload jsonb
)
returns table(
  notification_id uuid,
  document_number text,
  consecutive bigint,
  recipients_created integer,
  local_notes_applied integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_sender_parish uuid;
  v_sender_diocese uuid;
  v_source_parish uuid;
  v_spouse_parish uuid;
  v_person_name text;
  v_spouse_name text;
  v_doc_id uuid;
  v_sequence bigint;
  v_document_number text;
  v_year integer;
  v_recipients integer := 0;
  v_local_notes integer := 0;
  v_is_manual boolean;
  v_existing_note text;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select lower(coalesce(up.role,'')), up.parish_id, up.diocese_id
    into v_role, v_sender_parish, v_sender_diocese
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
    and coalesce(up.is_active,true) = true
  limit 1;

  if v_role <> 'parish' or v_sender_parish is null then
    raise exception 'Sólo una cuenta parroquial activa puede emitir notificaciones matrimoniales';
  end if;
  if p_marriage_date is null then raise exception 'La fecha de matrimonio es obligatoria'; end if;
  if nullif(trim(coalesce(p_main_note,'')),'') is null then raise exception 'La nota marginal principal es obligatoria'; end if;

  v_is_manual := p_source_baptism_id is null and p_spouse_baptism_id is null;

  if v_is_manual then
    if p_manual_receiver_parish_id is null then raise exception 'La notificación manual requiere parroquia destinataria'; end if;
    if not exists (select 1 from public.parishes p where p.id = p_manual_receiver_parish_id) then
      raise exception 'La parroquia destinataria no existe';
    end if;
    v_source_parish := p_manual_receiver_parish_id;
    v_person_name := nullif(trim(p_manual_person_name),'');
    v_spouse_name := nullif(trim(p_manual_spouse_name),'');
  else
    if p_source_baptism_id is null or p_spouse_baptism_id is null then
      raise exception 'La notificación digital requiere las dos partidas de Bautismo';
    end if;
    if p_source_baptism_id = p_spouse_baptism_id then
      raise exception 'Las partidas bautismales de los contrayentes no pueden ser la misma';
    end if;

    select b.parish_id, trim(concat_ws(' ',b.nombres,b.apellidos))
      into v_source_parish, v_person_name
    from public.baptisms b
    where b.id = p_source_baptism_id
      and coalesce(lower(b.status),'active') not in ('anulada','annulled','deleted');
    if not found then raise exception 'No se encontró la partida bautismal principal activa'; end if;

    select b.parish_id, trim(concat_ws(' ',b.nombres,b.apellidos))
      into v_spouse_parish, v_spouse_name
    from public.baptisms b
    where b.id = p_spouse_baptism_id
      and coalesce(lower(b.status),'active') not in ('anulada','annulled','deleted');
    if not found then raise exception 'No se encontró la partida bautismal del cónyuge activa'; end if;

    if exists (
      select 1 from public.matrimonial_notifications n
      where n.sender_parish_id = v_sender_parish
        and n.source_baptism_id = p_source_baptism_id
        and n.spouse_baptism_id = p_spouse_baptism_id
        and n.marriage_date = p_marriage_date
        and lower(coalesce(n.status,'sent')) <> 'cancelled'
    ) then
      raise exception 'Ya existe una notificación activa para estas partidas y esta fecha de matrimonio';
    end if;
  end if;

  if nullif(v_person_name,'') is null then raise exception 'El nombre del contrayente principal es obligatorio'; end if;
  if nullif(v_spouse_name,'') is null then raise exception 'El nombre del cónyuge es obligatorio'; end if;

  v_year := extract(year from p_marriage_date)::integer;
  insert into public.document_sequences(scope_id, document_type, current_value)
  values (v_sender_parish, 'matrimonial_notification_' || v_year, 1)
  on conflict(scope_id, document_type)
  do update set current_value = public.document_sequences.current_value + 1,
                updated_at = now()
  returning current_value into v_sequence;
  v_document_number := 'NM-' || v_year || '-' || lpad(v_sequence::text,6,'0');

  insert into public.matrimonial_notifications (
    sender_parish_id, diocese_id, source_baptism_id, spouse_baptism_id,
    consecutive, document_number, person_name, spouse_name,
    marriage_date, marriage_book, marriage_folio, marriage_number,
    marriage_diocese_id, marriage_parish_id, external_marriage_parish_name,
    status, payload, created_by
  ) values (
    v_sender_parish, v_sender_diocese,
    case when v_is_manual then null else p_source_baptism_id end,
    case when v_is_manual then null else p_spouse_baptism_id end,
    v_sequence, v_document_number, v_person_name, v_spouse_name,
    p_marriage_date, nullif(trim(p_marriage_book),''), nullif(trim(p_marriage_folio),''), nullif(trim(p_marriage_number),''),
    p_marriage_diocese_id, p_marriage_parish_id, nullif(trim(p_external_marriage_parish_name),''),
    'sent',
    coalesce(p_payload,'{}'::jsonb)
      || jsonb_build_object(
        'consecutivo',v_document_number,
        'parishId',v_sender_parish,
        'senderParishName',(select p.name from public.parishes p where p.id=v_sender_parish),
        'personName',v_person_name,
        'spouseName',v_spouse_name,
        'isManual',v_is_manual,
        'marriageDate',p_marriage_date
      ),
    auth.uid()
  ) returning id into v_doc_id;

  if v_is_manual then
    insert into public.matrimonial_notification_recipients (
      notification_id, receiver_parish_id, target_baptism_id, status, payload
    ) values (
      v_doc_id, p_manual_receiver_parish_id, null, 'pending',
      jsonb_build_object('partyRole','principal','marginalNote',p_main_note,'manualLocator',coalesce(p_manual_locator,'{}'::jsonb),'receiverParishName',(select p.name from public.parishes p where p.id=p_manual_receiver_parish_id))
    );
    v_recipients := 1;
  else
    -- Contrayente principal: si la partida está en la parroquia emisora, la nota
    -- queda aplicada en esta misma transacción; si no, se crea aviso receptor.
    if v_source_parish = v_sender_parish then
      select b.nota_marginal into v_existing_note from public.baptisms b where b.id = p_source_baptism_id for update;
      update public.baptisms
      set nota_marginal = concat_ws(E'\n\n',nullif(v_existing_note,''),p_main_note),
          raw_data = coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
            'notaMarginal',concat_ws(E'\n\n',nullif(v_existing_note,''),p_main_note),
            'lastMatrimonialNotificationId',v_doc_id
          ), updated_at = now()
      where id = p_source_baptism_id;
      insert into public.marginal_notes (
        sacrament_type,note_type,content,parish_id,sacrament_id,note_date,source_type,source_id,created_by
      ) values ('bautismo','matrimonio',p_main_note,v_sender_parish,p_source_baptism_id,current_date,'matrimonial_notification',v_doc_id,auth.uid());
      v_local_notes := v_local_notes + 1;
    else
      insert into public.matrimonial_notification_recipients (
        notification_id,receiver_parish_id,target_baptism_id,status,payload
      ) values (
        v_doc_id,v_source_parish,p_source_baptism_id,'pending',jsonb_build_object('partyRole','principal','marginalNote',p_main_note,'receiverParishName',(select p.name from public.parishes p where p.id=v_source_parish))
      );
      v_recipients := v_recipients + 1;
    end if;

    if v_spouse_parish = v_sender_parish then
      select b.nota_marginal into v_existing_note from public.baptisms b where b.id = p_spouse_baptism_id for update;
      update public.baptisms
      set nota_marginal = concat_ws(E'\n\n',nullif(v_existing_note,''),p_spouse_note),
          raw_data = coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
            'notaMarginal',concat_ws(E'\n\n',nullif(v_existing_note,''),p_spouse_note),
            'lastMatrimonialNotificationId',v_doc_id
          ), updated_at = now()
      where id = p_spouse_baptism_id;
      insert into public.marginal_notes (
        sacrament_type,note_type,content,parish_id,sacrament_id,note_date,source_type,source_id,created_by
      ) values ('bautismo','matrimonio',p_spouse_note,v_sender_parish,p_spouse_baptism_id,current_date,'matrimonial_notification',v_doc_id,auth.uid());
      v_local_notes := v_local_notes + 1;
    else
      insert into public.matrimonial_notification_recipients (
        notification_id,receiver_parish_id,target_baptism_id,status,payload
      ) values (
        v_doc_id,v_spouse_parish,p_spouse_baptism_id,'pending',jsonb_build_object('partyRole','conyuge','marginalNote',p_spouse_note,'receiverParishName',(select p.name from public.parishes p where p.id=v_spouse_parish))
      );
      v_recipients := v_recipients + 1;
    end if;
  end if;

  if v_recipients = 0 then
    update public.matrimonial_notifications set status='processed',updated_at=now() where id=v_doc_id;
  end if;

  insert into public.registry_audit_log (
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values (
    auth.uid(),v_sender_parish,v_sender_diocese,'matrimonial_notification',v_doc_id,'issue',
    jsonb_build_object('document_number',v_document_number,'person_name',v_person_name,'spouse_name',v_spouse_name),
    jsonb_build_object('mode',case when v_is_manual then 'manual' else 'digital' end,'recipients',v_recipients,'local_notes',v_local_notes)
  );

  return query select v_doc_id,v_document_number,v_sequence,v_recipients,v_local_notes;
end;
$$;

revoke all on function public.issue_matrimonial_notification(uuid,uuid,uuid,jsonb,date,text,text,text,uuid,uuid,text,text,text,text,text,jsonb) from public;
grant execute on function public.issue_matrimonial_notification(uuid,uuid,uuid,jsonb,date,text,text,text,uuid,uuid,text,text,text,text,text,jsonb) to authenticated;

-- --------------------------------------------------------------------------
-- 15. PROCESAMIENTO TRANSACCIONAL DEL AVISO MATRIMONIAL RECIBIDO
-- --------------------------------------------------------------------------
create or replace function public.process_matrimonial_notification_recipient(p_recipient_id uuid)
returns table(recipient_id uuid, notification_id uuid, status text, note_applied boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_parish uuid;
  v_row public.matrimonial_notification_recipients%rowtype;
  v_doc public.matrimonial_notifications%rowtype;
  v_note text;
  v_existing_note text;
  v_applied boolean := false;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  select lower(coalesce(up.role,'')),up.parish_id into v_role,v_parish
  from public.user_profiles up
  where up.auth_user_id=auth.uid() and coalesce(up.is_active,true)=true
  limit 1;

  if v_role <> 'parish' or v_parish is null then
    raise exception 'Sólo la parroquia destinataria puede procesar el aviso matrimonial';
  end if;

  select * into v_row
  from public.matrimonial_notification_recipients r
  where r.id=p_recipient_id
  for update;
  if not found then raise exception 'Aviso matrimonial no encontrado'; end if;
  if v_row.receiver_parish_id is distinct from v_parish then raise exception 'El aviso no pertenece a esta parroquia'; end if;

  if lower(coalesce(v_row.status,'pending'))='processed' then
    return query select v_row.id,v_row.notification_id,'processed'::text,v_row.note_applied;
    return;
  end if;
  if lower(coalesce(v_row.status,'pending'))='cancelled' then raise exception 'El aviso está archivado/cancelado'; end if;

  select * into v_doc from public.matrimonial_notifications n where n.id=v_row.notification_id;
  if not found then raise exception 'Documento matrimonial asociado no encontrado'; end if;

  v_note := nullif(v_row.payload->>'marginalNote','');
  if v_note is null then raise exception 'El aviso no contiene la nota marginal requerida'; end if;

  if v_row.target_baptism_id is not null then
    select b.nota_marginal into v_existing_note
    from public.baptisms b
    where b.id=v_row.target_baptism_id and b.parish_id=v_parish
    for update;
    if not found then raise exception 'La partida bautismal destinataria no pertenece a esta parroquia'; end if;

    if not exists (
      select 1 from public.marginal_notes mn
      where mn.sacrament_type='bautismo'
        and mn.sacrament_id=v_row.target_baptism_id
        and mn.source_type='matrimonial_notification'
        and mn.source_id=v_row.notification_id
    ) then
      update public.baptisms
      set nota_marginal=concat_ws(E'\n\n',nullif(v_existing_note,''),v_note),
          raw_data=coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
            'notaMarginal',concat_ws(E'\n\n',nullif(v_existing_note,''),v_note),
            'lastMatrimonialNotificationId',v_row.notification_id
          ), updated_at=now()
      where id=v_row.target_baptism_id;

      insert into public.marginal_notes (
        sacrament_type,note_type,content,parish_id,sacrament_id,note_date,source_type,source_id,created_by
      ) values (
        'bautismo','matrimonio',v_note,v_parish,v_row.target_baptism_id,current_date,'matrimonial_notification',v_row.notification_id,auth.uid()
      );
    end if;
    v_applied := true;
  end if;

  update public.matrimonial_notification_recipients
  set status='processed',note_applied=v_applied,processed_by=auth.uid(),processed_at=now(),read_at=coalesce(read_at,now()),updated_at=now()
  where id=v_row.id;

  if not exists (
    select 1 from public.matrimonial_notification_recipients r
    where r.notification_id=v_row.notification_id
      and lower(coalesce(r.status,'pending')) not in ('processed','cancelled')
  ) then
    update public.matrimonial_notifications set status='processed',updated_at=now() where id=v_row.notification_id;
  end if;

  insert into public.registry_audit_log (
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values (
    auth.uid(),v_parish,(select p.diocese_id from public.parishes p where p.id=v_parish),
    'matrimonial_notification_recipient',v_row.id,'process',
    jsonb_build_object('status','processed','note_applied',v_applied),
    jsonb_build_object('notification_id',v_row.notification_id,'target_baptism_id',v_row.target_baptism_id)
  );

  return query select v_row.id,v_row.notification_id,'processed'::text,v_applied;
end;
$$;

revoke all on function public.process_matrimonial_notification_recipient(uuid) from public;
grant execute on function public.process_matrimonial_notification_recipient(uuid) to authenticated;

create or replace function public.cancel_matrimonial_notification(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_parish uuid;
begin
  select up.parish_id into v_parish from public.user_profiles up
  where up.auth_user_id=auth.uid() and lower(coalesce(up.role,''))='parish' and coalesce(up.is_active,true)=true limit 1;
  if v_parish is null then raise exception 'Cuenta parroquial no autorizada'; end if;
  if not exists(select 1 from public.matrimonial_notifications n where n.id=p_notification_id and n.sender_parish_id=v_parish) then
    raise exception 'La notificación no pertenece a esta parroquia';
  end if;
  update public.matrimonial_notifications set status='cancelled',updated_at=now() where id=p_notification_id;
  update public.matrimonial_notification_recipients
    set status='cancelled',updated_at=now()
    where notification_id=p_notification_id and status in ('pending','read');
  return true;
end;
$$;
revoke all on function public.cancel_matrimonial_notification(uuid) from public;
grant execute on function public.cancel_matrimonial_notification(uuid) to authenticated;
