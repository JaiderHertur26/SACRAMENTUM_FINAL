-- SACRAMENTUM V75 · materialización de datos auxiliares legacy todavía no explotados.
create table if not exists public.legacy_print_events (
  id uuid primary key default gen_random_uuid(),
  legacy_archive_record_id uuid not null unique references public.legacy_archive_records(id) on delete restrict,
  parish_id uuid not null references public.parishes(id) on delete restrict,
  sacrament_type text not null,
  sacrament_id uuid null,
  legacy_type text null,
  book_number text null,
  folio text null,
  number text null,
  printed_on date null,
  legacy_user text null,
  source_origin_id uuid null references public.legacy_source_origins(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_legacy_print_events_parish_date
  on public.legacy_print_events(parish_id,printed_on desc);
create index if not exists idx_legacy_print_events_sacrament
  on public.legacy_print_events(sacrament_type,sacrament_id);
create table if not exists public.legacy_marriage_children (
  id uuid primary key default gen_random_uuid(),
  legacy_archive_record_id uuid not null unique references public.legacy_archive_records(id) on delete restrict,
  parish_id uuid not null references public.parishes(id) on delete restrict,
  legacy_entry_number text not null,
  marriage_id uuid null references public.marriages(id) on delete set null,
  marriage_dossier_id uuid null references public.marriage_dossiers(id) on delete set null,
  child_name text null,
  birth_date date null,
  baptism_place text null,
  source_origin_id uuid null references public.legacy_source_origins(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_legacy_marriage_children_entry
  on public.legacy_marriage_children(parish_id,legacy_entry_number);
create index if not exists idx_legacy_marriage_children_marriage
  on public.legacy_marriage_children(marriage_id);
create table if not exists public.legacy_parameter_snapshots (
  id uuid primary key default gen_random_uuid(),
  legacy_archive_record_id uuid not null unique references public.legacy_archive_records(id) on delete restrict,
  parish_id uuid not null references public.parishes(id) on delete restrict,
  legacy_key integer null,
  source_origin_id uuid null references public.legacy_source_origins(id) on delete set null,
  settings jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_legacy_parameter_snapshots_parish
  on public.legacy_parameter_snapshots(parish_id,legacy_key);

alter table public.legacy_print_events enable row level security;
alter table public.legacy_marriage_children enable row level security;
alter table public.legacy_parameter_snapshots enable row level security;
drop policy if exists legacy_print_events_read on public.legacy_print_events;
create policy legacy_print_events_read on public.legacy_print_events
for select to authenticated using (
  public.current_app_role()='admin_general'
  or parish_id=public.current_app_parish_id()
  or exists(select 1 from public.parishes p where p.id=parish_id and p.diocese_id=public.current_app_diocese_id())
);

drop policy if exists legacy_marriage_children_read on public.legacy_marriage_children;
create policy legacy_marriage_children_read on public.legacy_marriage_children
for select to authenticated using (
  public.current_app_role()='admin_general'
  or parish_id=public.current_app_parish_id()
  or exists(select 1 from public.parishes p where p.id=parish_id and p.diocese_id=public.current_app_diocese_id())
);
drop policy if exists legacy_parameter_snapshots_read on public.legacy_parameter_snapshots;
create policy legacy_parameter_snapshots_read on public.legacy_parameter_snapshots
for select to authenticated using (
  public.current_app_role()='admin_general'
  or parish_id=public.current_app_parish_id()
  or exists(select 1 from public.parishes p where p.id=parish_id and p.diocese_id=public.current_app_diocese_id())
);

revoke all on public.legacy_print_events from anon;
revoke all on public.legacy_marriage_children from anon;
revoke all on public.legacy_parameter_snapshots from anon;
grant select on public.legacy_print_events to authenticated;
grant select on public.legacy_marriage_children to authenticated;
grant select on public.legacy_parameter_snapshots to authenticated;
create or replace function public.materialize_legacy_supporting_data_v75(p_parish_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_role text;
  v_diocese uuid;
  v_prints integer:=0;
  v_children integer:=0;
  v_params integer:=0;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  v_role:=public.current_app_role();
  v_diocese:=public.current_app_diocese_id();
  if v_role not in ('diocese','admin_general') then
    raise exception 'No autorizado para materializar datos auxiliares legacy';
  end if;
  if p_parish_id is not null and v_role='diocese' and not exists(
    select 1 from public.parishes p where p.id=p_parish_id and p.diocese_id=v_diocese
  ) then raise exception 'Parroquia fuera de la jurisdicción'; end if;
  insert into public.legacy_print_events(
    legacy_archive_record_id,parish_id,sacrament_type,sacrament_id,legacy_type,
    book_number,folio,number,printed_on,legacy_user,source_origin_id,metadata
  )
  select a.id,a.parish_id,
    case a.original_data->>'tipo'
      when '1' then 'bautismo' when '2' then 'confirmacion'
      when '3' then 'primera_comunion_legacy' when '4' then 'matrimonio'
      when '5' then 'exequias' else 'desconocido' end,
    case a.original_data->>'tipo'
      when '1' then b.id when '2' then c.id when '4' then m.id when '5' then f.id else null end,
    a.original_data->>'tipo',
    trim(a.original_data->>'libro'),trim(a.original_data->>'folio'),trim(a.original_data->>'numero'),
    nullif(a.original_data->>'fecha','')::date,a.original_data->>'usuario',a.source_origin_id,
    jsonb_build_object('source_key',a.source_key,'source_sha256',a.source_sha256,'preserved_original',true)
  from public.legacy_archive_records a
  left join public.baptisms b on a.original_data->>'tipo'='1' and b.parish_id=a.parish_id
    and trim(b.book_number)=trim(a.original_data->>'libro') and trim(b.folio)=trim(a.original_data->>'folio') and trim(b.number)=trim(a.original_data->>'numero')
  left join public.confirmations c on a.original_data->>'tipo'='2' and c.parish_id=a.parish_id
    and trim(c.book_number)=trim(a.original_data->>'libro') and trim(c.folio)=trim(a.original_data->>'folio') and trim(c.number)=trim(a.original_data->>'numero')
  left join public.marriages m on a.original_data->>'tipo'='4' and m.parish_id=a.parish_id
    and trim(m.book_number)=trim(a.original_data->>'libro') and trim(m.folio)=trim(a.original_data->>'folio') and trim(m.number)=trim(a.original_data->>'numero')
  left join public.funerals f on a.original_data->>'tipo'='5' and f.parish_id=a.parish_id
    and trim(f.book_number)=trim(a.original_data->>'libro') and trim(f.folio)=trim(a.original_data->>'folio') and trim(f.number)=trim(a.original_data->>'numero')
  where a.profile_key='IMPRESAS' and a.parish_id is not null
    and (p_parish_id is null or a.parish_id=p_parish_id)
  on conflict(legacy_archive_record_id) do update set
    sacrament_id=excluded.sacrament_id,metadata=public.legacy_print_events.metadata||excluded.metadata;
  get diagnostics v_prints=row_count;

  insert into public.legacy_marriage_children(
    legacy_archive_record_id,parish_id,legacy_entry_number,marriage_id,
    child_name,birth_date,baptism_place,source_origin_id,metadata
  )
  select a.id,a.parish_id,trim(a.original_data->>'numinsc'),m.id,
    nullif(trim(a.original_data->>'nombre'),''),
    nullif(a.original_data->>'fecnac','')::date,
    nullif(trim(a.original_data->>'lugbau'),''),
    a.source_origin_id,
    jsonb_build_object('source_key',a.source_key,'source_sha256',a.source_sha256,'preserved_original',true)
  from public.legacy_archive_records a
  left join lateral (
    select x.id from public.marriages x
    where x.parish_id=a.parish_id
      and ltrim(coalesce(x.raw_data->>'numinsc',''),'0')=ltrim(coalesce(a.original_data->>'numinsc',''),'0')
    order by x.created_at desc limit 1
  ) m on true
  where a.profile_key='DATOSHIJOS' and a.parish_id is not null
    and nullif(trim(a.original_data->>'numinsc'),'') is not null
    and (p_parish_id is null or a.parish_id=p_parish_id)
  on conflict(legacy_archive_record_id) do update set
    marriage_id=excluded.marriage_id,metadata=public.legacy_marriage_children.metadata||excluded.metadata;
  get diagnostics v_children=row_count;

  insert into public.legacy_parameter_snapshots(
    legacy_archive_record_id,parish_id,legacy_key,source_origin_id,settings,metadata
  )
  select a.id,a.parish_id,nullif(a.original_data->>'clave','')::integer,a.source_origin_id,
    a.original_data-'_record_sha256'-'_row_number'-'_deleted',
    jsonb_build_object('source_key',a.source_key,'source_sha256',a.source_sha256,'preserved_original',true)
  from public.legacy_archive_records a
  where a.profile_key='PARAMETROS' and a.parish_id is not null
    and (p_parish_id is null or a.parish_id=p_parish_id)
  on conflict(legacy_archive_record_id) do update set
    settings=excluded.settings,metadata=public.legacy_parameter_snapshots.metadata||excluded.metadata;
  get diagnostics v_params=row_count;
  update public.legacy_archive_records a
  set normalized_data=case a.profile_key
      when 'IMPRESAS' then jsonb_build_object(
        'legacy_type',a.original_data->>'tipo','book',a.original_data->>'libro',
        'folio',a.original_data->>'folio','number',a.original_data->>'numero',
        'printed_on',a.original_data->>'fecha','legacy_user',a.original_data->>'usuario')
      when 'DATOSHIJOS' then jsonb_build_object(
        'legacy_entry_number',a.original_data->>'numinsc','child_name',a.original_data->>'nombre',
        'birth_date',a.original_data->>'fecnac','baptism_place',a.original_data->>'lugbau')
      when 'PARAMETROS' then a.original_data-'_record_sha256'-'_row_number'-'_deleted'
      else a.normalized_data end,
    reconciliation_status='materialized_supporting_data',
    metadata=coalesce(a.metadata,'{}'::jsonb)||jsonb_build_object('supporting_data_materialized_v75',true,'materialized_at',now()),
    updated_at=now()
  where a.profile_key in ('IMPRESAS','DATOSHIJOS','PARAMETROS')
    and a.parish_id is not null and (p_parish_id is null or a.parish_id=p_parish_id);

  return jsonb_build_object('print_events',v_prints,'marriage_children',v_children,'parameter_snapshots',v_params);
end;
$$;
revoke all on function public.materialize_legacy_supporting_data_v75(uuid) from public,anon;
grant execute on function public.materialize_legacy_supporting_data_v75(uuid) to authenticated;
comment on function public.materialize_legacy_supporting_data_v75(uuid) is
'Convierte IMPRESAS, DATOSHIJOS y PARAMETROS preservados en capas funcionales modernas sin alterar el original legacy.';

-- Materialización inicial idempotente de lo ya preservado.
insert into public.legacy_parameter_snapshots(
  legacy_archive_record_id,parish_id,legacy_key,source_origin_id,settings,metadata
)
select a.id,a.parish_id,nullif(a.original_data->>'clave','')::integer,a.source_origin_id,
  a.original_data-'_record_sha256'-'_row_number'-'_deleted',
  jsonb_build_object('source_key',a.source_key,'source_sha256',a.source_sha256,'preserved_original',true)
from public.legacy_archive_records a
where a.profile_key='PARAMETROS' and a.parish_id is not null
on conflict(legacy_archive_record_id) do nothing;
insert into public.legacy_marriage_children(
  legacy_archive_record_id,parish_id,legacy_entry_number,marriage_id,
  child_name,birth_date,baptism_place,source_origin_id,metadata
)
select a.id,a.parish_id,trim(a.original_data->>'numinsc'),m.id,
  nullif(trim(a.original_data->>'nombre'),''),nullif(a.original_data->>'fecnac','')::date,
  nullif(trim(a.original_data->>'lugbau'),''),a.source_origin_id,
  jsonb_build_object('source_key',a.source_key,'source_sha256',a.source_sha256,'preserved_original',true)
from public.legacy_archive_records a
left join lateral (
  select x.id from public.marriages x where x.parish_id=a.parish_id
    and ltrim(coalesce(x.raw_data->>'numinsc',''),'0')=ltrim(coalesce(a.original_data->>'numinsc',''),'0')
  order by x.created_at desc limit 1
) m on true
where a.profile_key='DATOSHIJOS' and a.parish_id is not null
  and nullif(trim(a.original_data->>'numinsc'),'') is not null
on conflict(legacy_archive_record_id) do nothing;
insert into public.legacy_print_events(
  legacy_archive_record_id,parish_id,sacrament_type,sacrament_id,legacy_type,
  book_number,folio,number,printed_on,legacy_user,source_origin_id,metadata
)
select a.id,a.parish_id,'bautismo',b.id,a.original_data->>'tipo',
  trim(a.original_data->>'libro'),trim(a.original_data->>'folio'),trim(a.original_data->>'numero'),
  nullif(a.original_data->>'fecha','')::date,a.original_data->>'usuario',a.source_origin_id,
  jsonb_build_object('source_key',a.source_key,'source_sha256',a.source_sha256,'preserved_original',true)
from public.legacy_archive_records a
left join public.baptisms b on b.parish_id=a.parish_id
  and trim(b.book_number)=trim(a.original_data->>'libro')
  and trim(b.folio)=trim(a.original_data->>'folio')
  and trim(b.number)=trim(a.original_data->>'numero')
where a.profile_key='IMPRESAS' and a.parish_id is not null and a.original_data->>'tipo'='1'
on conflict(legacy_archive_record_id) do nothing;

update public.legacy_archive_records
set reconciliation_status='materialized_supporting_data',
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('supporting_data_materialized_v75',true,'materialized_at',now()),
    updated_at=now()
where profile_key in ('IMPRESAS','DATOSHIJOS','PARAMETROS') and parish_id is not null;
