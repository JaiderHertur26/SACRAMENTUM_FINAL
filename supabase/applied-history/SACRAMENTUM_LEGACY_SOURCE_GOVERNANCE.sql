-- SACRAMENTUM · GOBIERNO DE FUENTES HISTÓRICAS
-- Conserva procedencia sin convertir parroquias históricas en parroquias operativas.

create table if not exists public.legacy_source_parishes (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'legacy_json',
  source_name text not null,
  profile_key text not null,
  source_parish_name text not null,
  source_sha256 text,
  mapped_parish_id uuid references public.parishes(id) on delete restrict,
  mapping_status text not null default 'unmapped'
    check (mapping_status in ('unmapped','mapped','review')),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_system,source_name,profile_key,source_parish_name)
);

create table if not exists public.legacy_priest_directory (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'legacy_json',
  source_name text not null,
  source_sha256 text,
  legacy_code text not null,
  priest_name text not null,
  service_start date,
  service_end date,
  legacy_state integer,
  legacy_grade text,
  mapped_parish_id uuid references public.parishes(id) on delete restrict,
  mapping_status text not null default 'unmapped'
    check (mapping_status in ('unmapped','mapped','review')),
  original_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_system,source_name,legacy_code)
);

comment on table public.legacy_source_parishes is
'Procedencia parroquial declarada por una fuente histórica. mapped_parish_id sólo se llena con evidencia suficiente.';
comment on table public.legacy_priest_directory is
'Catálogo histórico de códigos de párrocos. No autoriza inferir Da Fe en partidas sin procedencia/mapeo confirmado.';

alter table public.legacy_source_parishes enable row level security;
alter table public.legacy_priest_directory enable row level security;

do $$
declare p record;
begin
  for p in select policyname,tablename from pg_policies
           where schemaname='public' and tablename in ('legacy_source_parishes','legacy_priest_directory')
  loop
    execute format('drop policy if exists %I on public.%I',p.policyname,p.tablename);
  end loop;
end $$;
revoke all on public.legacy_source_parishes from anon,authenticated;
revoke all on public.legacy_priest_directory from anon,authenticated;
grant select,insert,update,delete on public.legacy_source_parishes to service_role;
grant select,insert,update,delete on public.legacy_priest_directory to service_role;

insert into public.legacy_source_parishes(
  source_system,source_name,profile_key,source_parish_name,source_sha256,
  mapped_parish_id,mapping_status,evidence
) values
('legacy_json','BAUTIZOS.json','BAUTIZOS','PARROQUIA MARÍA AUXILIO DE LOS CRISTIANOS',
 '0a6a9db4a0a78ec7f6361051ddf806fb3946cfbe6ea38b91737ea39dd6d8f416',
 'ada2c810-c6eb-4b75-8e3c-4941e3022687'::uuid,'mapped',
 jsonb_build_object('row_count',46,'basis','lugbau uniforme en archivo fuente')),
('legacy_json','CONFIRMA.json','CONFIRMA','PARROQUIA SANTA TERESITA DEL NIÑO JESUS',
 '6d9a2f5e48137d989805da91398d6cf251058a8f1763383f6b4452b9847fca1e',
 null,'unmapped',jsonb_build_object('row_count',173,'basis','lugcon uniforme en archivo fuente')),
('legacy_json','INSBAUTI.json','INSBAUTI','PARROQUIA PADRE MISERICORDIOSO',
 'a9143e4b3249bc2f3ae2e504405c3d7251f623eb9c9de3f8033b63d0299a8e1e',
 null,'unmapped',jsonb_build_object('row_count',17,'reported_rows',17)),
('legacy_json','INSCONFI.json','INSCONFI','PARROQUIA SANTA TERESITA DEL NIÑO JESUS',
 '51bb914fa682241f0179ad609df3aa4fe3abf7fb98a2f2dd4b47602fd027ed07',
 null,'unmapped',jsonb_build_object('row_count',116,'reported_rows',116))
on conflict(source_system,source_name,profile_key,source_parish_name)
do update set source_sha256=excluded.source_sha256,mapped_parish_id=excluded.mapped_parish_id,
              mapping_status=excluded.mapping_status,evidence=excluded.evidence,updated_at=now();

insert into public.legacy_priest_directory(
  source_system,source_name,legacy_code,priest_name,service_start,service_end,
  legacy_state,legacy_grade,mapping_status,original_data
) values
('legacy_json','PARROCOS.json','0001','PBRO. ROBERTO PADILLA MARTÍNEZ','2000-08-15','2005-12-20',1,null,'unmapped',
 jsonb_build_object('codigo','0001','nombre','PBRO. ROBERTO PADILLA MARTÍNEZ','fecing','2000-08-15','fecsal','2005-12-20','estado',1)),
('legacy_json','PARROCOS.json','0002','PBRO. SANTIAGO MARTÍNEZ FUENTES','2005-12-21','2012-01-29',1,null,'unmapped',
 jsonb_build_object('codigo','0002','nombre','PBRO. SANTIAGO MARTÍNEZ FUENTES','fecing','2005-12-21','fecsal','2012-01-29','estado',1)),
('legacy_json','PARROCOS.json','0003','PBRO. TEODORO GARCÍA GARCÍA','2012-01-30','2021-01-10',1,null,'unmapped',
 jsonb_build_object('codigo','0003','nombre','PBRO. TEODORO GARCÍA GARCÍA','fecing','2012-01-30','fecsal','2021-01-10','estado',1)),
('legacy_json','PARROCOS.json','0004','PBRO. JAIDER HERRERA TURIZO','2021-01-11','2025-06-15',2,null,'unmapped',
 jsonb_build_object('codigo','0004','nombre','PBRO. JAIDER HERRERA TURIZO','fecing','2021-01-11','fecsal','2025-06-15','estado',2))
on conflict(source_system,source_name,legacy_code)
do update set priest_name=excluded.priest_name,service_start=excluded.service_start,
              service_end=excluded.service_end,legacy_state=excluded.legacy_state,
              legacy_grade=excluded.legacy_grade,original_data=excluded.original_data,updated_at=now();

select jsonb_build_object(
  'source_parishes', (select count(*) from public.legacy_source_parishes),
  'legacy_priests', (select count(*) from public.legacy_priest_directory),
  'unmapped_sources', (select count(*) from public.legacy_source_parishes where mapping_status='unmapped')
) as legacy_source_governance_postcheck;
