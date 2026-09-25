-- SACRAMENTUM · V5 · PROPIEDAD PARROQUIAL OBLIGATORIA EN TODA IMPORTACIÓN
begin;

update public.legacy_import_profiles
set requires_parish=true, updated_at=now()
where active=true;

alter table public.legacy_pre_sacrament_registrations
  add column if not exists owner_parish_id uuid references public.parishes(id) on delete restrict;

create table if not exists public.legacy_import_ownership (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.legacy_import_batches(id) on delete cascade,
  row_id uuid references public.legacy_import_rows(id) on delete cascade,
  owner_parish_id uuid not null references public.parishes(id) on delete restrict,
  target_table text not null,
  target_id uuid not null,
  source_parish_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(batch_id,row_id)
);
alter table public.legacy_import_ownership enable row level security;
revoke all on public.legacy_import_ownership from anon,authenticated;
grant select,insert,update,delete on public.legacy_import_ownership to service_role;

create or replace function public.sacramentum_set_legacy_import_owner()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_parish uuid; v_source_parish text;
begin
  select b.parish_id into v_parish
  from public.legacy_import_batches b where b.id=new.batch_id;
  if v_parish is null then
    raise exception 'Toda importación histórica debe tener parroquia propietaria';
  end if;
  select coalesce(r.normalized_data->>'celebration_place',r.original_data->>'lugbau',r.original_data->>'lugcon')
    into v_source_parish from public.legacy_import_rows r where r.id=new.row_id;
  insert into public.legacy_import_ownership(batch_id,row_id,owner_parish_id,target_table,target_id,source_parish_name,metadata)
  values(new.batch_id,new.row_id,v_parish,new.target_table,new.target_id,nullif(v_source_parish,''),jsonb_build_object('source_key',new.source_key))
  on conflict(batch_id,row_id) do update set owner_parish_id=excluded.owner_parish_id,target_table=excluded.target_table,
    target_id=excluded.target_id,source_parish_name=excluded.source_parish_name,updated_at=now();
  return new;
end;
$$;
drop trigger if exists trg_sacramentum_set_legacy_import_owner on public.legacy_record_links;
create trigger trg_sacramentum_set_legacy_import_owner
after insert or update of batch_id,row_id,target_table,target_id on public.legacy_record_links
for each row execute function public.sacramentum_set_legacy_import_owner();

create or replace function public.sacramentum_pre_registration_owner_from_batch()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  select b.parish_id into new.owner_parish_id
  from public.legacy_import_batches b where b.id=new.batch_id;
  if new.owner_parish_id is null then
    raise exception 'Boleta histórica sin parroquia propietaria';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sacramentum_pre_registration_owner on public.legacy_pre_sacrament_registrations;
create trigger trg_sacramentum_pre_registration_owner
before insert or update of batch_id on public.legacy_pre_sacrament_registrations
for each row execute function public.sacramentum_pre_registration_owner_from_batch();

update public.legacy_pre_sacrament_registrations p
set owner_parish_id=b.parish_id
from public.legacy_import_batches b
where p.batch_id=b.id and p.owner_parish_id is null and b.parish_id is not null;
insert into public.legacy_import_ownership(batch_id,row_id,owner_parish_id,target_table,target_id,source_parish_name,metadata)
select l.batch_id,l.row_id,b.parish_id,l.target_table,l.target_id,
       coalesce(r.normalized_data->>'celebration_place',r.original_data->>'lugbau',r.original_data->>'lugcon'),
       jsonb_build_object('source_key',l.source_key,'backfilled',true)
from public.legacy_record_links l
join public.legacy_import_batches b on b.id=l.batch_id
left join public.legacy_import_rows r on r.id=l.row_id
where b.parish_id is not null and l.batch_id is not null and l.row_id is not null
on conflict(batch_id,row_id) do update set owner_parish_id=excluded.owner_parish_id,target_table=excluded.target_table,
  target_id=excluded.target_id,source_parish_name=excluded.source_parish_name,updated_at=now();

do $$
declare v_ddl text; v_old text; v_new text;
begin
  if to_regprocedure('public.reconcile_legacy_pre_registrations_v2_internal(text)') is null then
    raise exception 'No existe función interna de conciliación legacy';
  end if;
  select pg_get_functiondef('public.reconcile_legacy_pre_registrations_v2_internal(text)'::regprocedure) into v_ddl;
  v_old := E'select mapped_parish_id into v_mapped_parish\n      from public.legacy_source_parishes\n      where profile_key=r.profile_key and mapping_status=''mapped''\n        and public.sacramentum_legacy_norm_text(source_parish_name)=public.sacramentum_legacy_norm_text(r.source_parish_name)\n      limit 1;';
  v_new := E'v_mapped_parish:=r.owner_parish_id;\n    if v_mapped_parish is null then raise exception ''Boleta histórica sin parroquia propietaria''; end if;';
  if position(v_old in v_ddl)=0 then raise exception 'No se localizó bloque de ámbito parroquial en conciliación'; end if;
  execute replace(v_ddl,v_old,v_new);
end;
$$;
comment on table public.legacy_import_ownership is
'Vínculo obligatorio entre cada fila/materialización legacy y la parroquia propietaria dentro de SACRAMENTUM. La procedencia del JSON se conserva separada.';
comment on column public.legacy_pre_sacrament_registrations.owner_parish_id is
'Parroquia propietaria/custodia en SACRAMENTUM. No equivale a la parroquia histórica escrita en la fuente.';

commit;
