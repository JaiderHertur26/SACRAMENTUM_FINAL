-- ============================================================================
-- SACRAMENTUM · Fase 3.17 · Fundación de migración histórica y directorios
-- 2026-09-05
-- Migración ADITIVA. No elimina ni renombra tablas de producción existentes.
-- ============================================================================

create extension if not exists pgcrypto;

-- --------------------------------------------------------------------------
-- 1. Perfiles de importación: describen estructuras legacy, no parroquias.
-- --------------------------------------------------------------------------
create table if not exists public.legacy_import_profiles (
  profile_key varchar(80) primary key,
  display_name varchar(180) not null,
  target_entity varchar(80) not null,
  import_mode varchar(32) not null default 'staging',
  requires_parish boolean not null default false,
  mapping jsonb not null default '{}'::jsonb,
  validation_rules jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 2. Lotes y filas de staging. El JSON original se conserva intacto.
-- --------------------------------------------------------------------------
create table if not exists public.legacy_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_system varchar(120) not null default 'SACRAMENTA_PLUS',
  source_name varchar(200),
  original_filename varchar(260) not null,
  profile_key varchar(80) references public.legacy_import_profiles(profile_key),
  sha256 varchar(128),
  parish_id uuid references public.parishes(id) on delete set null,
  diocese_id uuid references public.dioceses(id) on delete set null,
  status varchar(32) not null default 'staged',
  row_count integer not null default 0,
  valid_count integer not null default 0,
  review_count integer not null default 0,
  imported_count integer not null default 0,
  skipped_count integer not null default 0,
  error_count integer not null default 0,
  created_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legacy_import_batch_status_ck check (status in ('staged','analyzed','ready','importing','completed','completed_with_review','failed','cancelled'))
);

create index if not exists idx_legacy_import_batches_scope
  on public.legacy_import_batches(diocese_id, parish_id, created_at desc);
create index if not exists idx_legacy_import_batches_status
  on public.legacy_import_batches(status, created_at desc);
create index if not exists idx_legacy_import_batches_hash
  on public.legacy_import_batches(sha256) where sha256 is not null;

create table if not exists public.legacy_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.legacy_import_batches(id) on delete cascade,
  row_number integer not null,
  source_key varchar(320),
  checksum varchar(128),
  target_entity varchar(80),
  original_data jsonb not null,
  normalized_data jsonb not null default '{}'::jsonb,
  status varchar(32) not null default 'staged',
  issue_codes text[] not null default '{}'::text[],
  issue_details jsonb not null default '{}'::jsonb,
  target_table varchar(100),
  target_id uuid,
  imported_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(batch_id, row_number),
  constraint legacy_import_row_status_ck check (status in ('staged','valid','review','duplicate','imported','skipped','error'))
);

create index if not exists idx_legacy_import_rows_batch_status
  on public.legacy_import_rows(batch_id, status, row_number);
create index if not exists idx_legacy_import_rows_target
  on public.legacy_import_rows(target_entity, target_id);
create index if not exists idx_legacy_import_rows_source_key
  on public.legacy_import_rows(source_key) where source_key is not null;

-- Vínculo idempotente: evita volver a crear la misma entidad legacy.
create table if not exists public.legacy_record_links (
  id uuid primary key default gen_random_uuid(),
  source_system varchar(120) not null,
  profile_key varchar(80) not null,
  source_key varchar(320) not null,
  checksum varchar(128),
  batch_id uuid references public.legacy_import_batches(id) on delete set null,
  row_id uuid references public.legacy_import_rows(id) on delete set null,
  target_table varchar(100) not null,
  target_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_system, profile_key, source_key)
);

-- --------------------------------------------------------------------------
-- 3. Directorios históricos/externos. No crean tenants ni usuarios.
-- --------------------------------------------------------------------------
create table if not exists public.directory_dioceses (
  id uuid primary key default gen_random_uuid(),
  legacy_code varchar(64),
  name varchar(300) not null,
  nit varchar(80),
  address text,
  phone varchar(180),
  fax varchar(180),
  email text,
  city varchar(260),
  bishop_1 varchar(300),
  bishop_2 varchar(300),
  country varchar(120),
  source_system varchar(120) not null default 'SACRAMENTA_PLUS',
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_directory_dioceses_legacy_code on public.directory_dioceses(legacy_code);
create index if not exists idx_directory_dioceses_name on public.directory_dioceses(lower(name));

create table if not exists public.directory_churches (
  id uuid primary key default gen_random_uuid(),
  legacy_code varchar(64),
  name varchar(300) not null,
  nit varchar(80),
  address text,
  city varchar(260),
  phone varchar(180),
  fax varchar(180),
  email text,
  priest_name varchar(300),
  diocese_legacy_code varchar(64),
  directory_diocese_id uuid references public.directory_dioceses(id) on delete set null,
  source_system varchar(120) not null default 'SACRAMENTA_PLUS',
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_directory_churches_legacy_code on public.directory_churches(legacy_code);
create index if not exists idx_directory_churches_diocese_code on public.directory_churches(diocese_legacy_code);
create index if not exists idx_directory_churches_name on public.directory_churches(lower(name));

create table if not exists public.location_dictionary (
  id uuid primary key default gen_random_uuid(),
  source varchar(80),
  value text not null,
  usage_count integer not null default 0,
  weight integer not null default 0,
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_user varchar(180),
  source_system varchar(120) not null default 'SACRAMENTA_PLUS',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_location_dictionary_source_value
  on public.location_dictionary(coalesce(source,''), lower(value));

-- --------------------------------------------------------------------------
-- 4. Motor documental: certificados, permisos, dispensas, solicitudes, etc.
-- --------------------------------------------------------------------------
create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  legacy_code varchar(64),
  code varchar(80) not null,
  name varchar(240) not null,
  category varchar(80) not null default 'certificate',
  template_text text not null,
  variables text[] not null default '{}'::text[],
  scope_type varchar(20) not null default 'system',
  diocese_id uuid references public.dioceses(id) on delete cascade,
  parish_id uuid references public.parishes(id) on delete cascade,
  version integer not null default 1,
  is_active boolean not null default true,
  is_legacy boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_templates_scope_ck check (scope_type in ('system','diocese','parish'))
);
create index if not exists idx_document_templates_lookup
  on public.document_templates(category, is_active, scope_type);
create unique index if not exists uq_document_templates_system_code
  on public.document_templates(code, version) where scope_type='system' and diocese_id is null and parish_id is null;

-- --------------------------------------------------------------------------
-- 5. Primera Comunión: registro pastoral formal y compatible con legado.
-- --------------------------------------------------------------------------
create table if not exists public.first_communions (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete restrict,
  parishioner_id uuid references public.parishioners(id) on delete set null,
  status varchar(32) not null default 'registered',
  celebration_date date,
  place varchar(300),
  names varchar(180),
  last_names varchar(180),
  birth_date date,
  age_text varchar(80),
  gender varchar(40),
  father_name varchar(300),
  mother_name varchar(300),
  address text,
  responsible_name varchar(300),
  minister varchar(300),
  baptism_church_code varchar(64),
  baptism_place varchar(300),
  baptism_book varchar(40),
  baptism_folio varchar(40),
  baptism_number varchar(40),
  baptism_id uuid references public.baptisms(id) on delete set null,
  legacy_entry_number varchar(80),
  observations text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_first_communions_parish_date
  on public.first_communions(parish_id, celebration_date desc);
create index if not exists idx_first_communions_person
  on public.first_communions(parish_id, lower(last_names), lower(names));

-- --------------------------------------------------------------------------
-- 6. Perfiles estructurales del sistema antiguo.
-- --------------------------------------------------------------------------
insert into public.legacy_import_profiles(profile_key,display_name,target_entity,import_mode,requires_parish,mapping,validation_rules)
values
('BAUTIZOS','Bautismos históricos','baptism','historical',true,
 '{"key":["libro","folio","numero"],"dateFields":["fecbau","fecnac","fecregis"]}'::jsonb,
 '{"required":["libro","folio","numero"],"quarantineFutureDates":true}'::jsonb),
('CONFIRMA','Confirmaciones históricas','confirmation','historical',true,
 '{"key":["libro","folio","numero"],"dateFields":["feccon","fecnac"]}'::jsonb,
 '{"required":["libro","folio","numero","feccon"],"quarantineFutureDates":true}'::jsonb),
('MATRIMON','Matrimonios históricos','marriage','historical',true,
 '{"key":["libro","folio","numero"],"dateFields":["fecmat","fecbau1","fecbau2","fecnac1","fecnac2"]}'::jsonb,
 '{"required":["folio","numero","fecmat"],"quarantineMissingBook":true,"quarantineFutureDates":true}'::jsonb),
('COMUNION','Primeras Comuniones históricas','first_communion','historical',true,
 '{"key":["numero"],"dateFields":["feccom","fecnac"]}'::jsonb,
 '{"required":["numero"]}'::jsonb),
('DIFUNTOS','Exequias históricas','funeral','historical',true,
 '{"key":["libro","folio","numero"]}'::jsonb,
 '{"required":["libro","folio","numero"]}'::jsonb),
('INSBAUTI','Inscripciones de Bautismo','pending_baptism','reconcile',true,
 '{"key":["numero"],"reportedField":"reported"}'::jsonb,
 '{"reportedRequiresReconciliation":true}'::jsonb),
('INSCONFI','Inscripciones de Confirmación','pending_confirmation','reconcile',true,
 '{"key":["numero"],"reportedField":"reported"}'::jsonb,
 '{"reportedRequiresReconciliation":true}'::jsonb),
('INSCOMUN','Inscripciones de Primera Comunión','pending_first_communion','reconcile',true,
 '{"key":["numero"],"reportedField":"reported"}'::jsonb,
 '{"reportedRequiresReconciliation":true}'::jsonb),
('INSMATRI','Inscripciones de Matrimonio','pending_marriage','reconcile',true,
 '{"key":["numero"],"reportedField":"reported"}'::jsonb,
 '{"reportedRequiresReconciliation":true}'::jsonb),
('ANULACION','Anulaciones / Correcciones históricas','decree_link','reconcile',true,
 '{"key":["libro","folio","numero","decreto"],"newKey":["newlib","newfol","newnum"]}'::jsonb,
 '{"requiresExistingOriginal":true}'::jsonb),
('CPTOANULA','Conceptos históricos de anulación/corrección','annulment_concept','catalog',false,
 '{"key":["codigo"]}'::jsonb,'{}'::jsonb),
('CERTIFICADOS','Plantillas documentales históricas','document_template','catalog',false,
 '{"key":["codigo"]}'::jsonb,'{}'::jsonb),
('CIUDADES','Diccionario histórico de lugares','location_dictionary','catalog',false,
 '{"key":["source","data"]}'::jsonb,'{}'::jsonb),
('DIOCESIS','Directorio histórico de diócesis','directory_diocese','catalog',false,
 '{"key":["codigo","nombre"]}'::jsonb,'{}'::jsonb),
('IGLESIAS','Directorio histórico de iglesias','directory_church','catalog',false,
 '{"key":["codigo","nombre"]}'::jsonb,'{}'::jsonb),
('MISDATOS','Configuración de instalación antigua','legacy_settings','reference',false,
 '{"key":["idcod"]}'::jsonb,'{}'::jsonb),
('DATOSHIJOS','Datos de hijos / auxiliares legacy','legacy_settings','reference',false,
 '{}'::jsonb,'{}'::jsonb),
('IMPRESAS','Histórico de impresiones legacy','legacy_settings','reference',false,
 '{}'::jsonb,'{}'::jsonb),
('NTBAU001','Notas marginales Bautismo - lote 1','legacy_marginal_note','reconcile',true,
 '{}'::jsonb,'{}'::jsonb),
('NTBAU002','Notas marginales Bautismo - lote 2','legacy_marginal_note','reconcile',true,
 '{}'::jsonb,'{}'::jsonb)
on conflict(profile_key) do update set
 display_name=excluded.display_name,
 target_entity=excluded.target_entity,
 import_mode=excluded.import_mode,
 requires_parish=excluded.requires_parish,
 mapping=excluded.mapping,
 validation_rules=excluded.validation_rules,
 updated_at=now();

comment on table public.legacy_import_batches is 'Lotes auditables de importación histórica. Conservan hash, archivo y ámbito de importación.';
comment on table public.legacy_import_rows is 'Staging fila-a-fila. original_data nunca se modifica; normalized_data contiene la transformación propuesta.';
comment on table public.legacy_record_links is 'Mapa idempotente entre una clave legacy y la entidad oficial creada.';
comment on table public.directory_dioceses is 'Directorio externo/histórico. No representa diócesis usuarias/tenants del sistema.';
comment on table public.directory_churches is 'Directorio externo/histórico. No representa parroquias usuarias/tenants del sistema.';
