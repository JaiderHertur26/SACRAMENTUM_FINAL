-- SACRAMENTUM · V12 · MOTOR INTELIGENTE DE DATOS AUXILIARES
begin;

alter table public.parrocos add column if not exists source_system text;
alter table public.parrocos add column if not exists source_sha256 text;
alter table public.parrocos add column if not exists legacy_source_key text;

alter table public.iglesias add column if not exists source_system text;
alter table public.iglesias add column if not exists source_sha256 text;
alter table public.iglesias add column if not exists legacy_source_key text;

alter table public.ciudades add column if not exists source_system text;
alter table public.ciudades add column if not exists source_sha256 text;
alter table public.ciudades add column if not exists legacy_source_key text;

alter table public.obispos add column if not exists source_system text;
alter table public.obispos add column if not exists source_sha256 text;
alter table public.obispos add column if not exists legacy_source_key text;

alter table public.diocesis add column if not exists source_system text;
alter table public.diocesis add column if not exists source_sha256 text;
alter table public.diocesis add column if not exists legacy_source_key text;
create unique index if not exists uq_parrocos_legacy_source
on public.parrocos(parish_id,legacy_source_key)
where legacy_source_key is not null;

create unique index if not exists uq_iglesias_legacy_source
on public.iglesias(parish_id,legacy_source_key)
where legacy_source_key is not null;

create unique index if not exists uq_ciudades_legacy_source
on public.ciudades(context_id,legacy_source_key)
where legacy_source_key is not null;

create unique index if not exists uq_obispos_legacy_source
on public.obispos(parish_id,legacy_source_key)
where legacy_source_key is not null;

create unique index if not exists uq_diocesis_legacy_source
on public.diocesis(parish_id,legacy_source_key)
where legacy_source_key is not null;

create table if not exists public.bishop_terms(
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete cascade,
  bishop_id uuid null references public.obispos(id) on delete set null,
  display_name text not null,
  start_date date not null,
  end_date date null,
  notes text null,
  source text not null default 'MANUAL',
  legacy_source_key text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_bishop_terms_dates check(end_date is null or end_date>=start_date)
);

create index if not exists idx_bishop_terms_parish_dates
on public.bishop_terms(parish_id,start_date desc,end_date);

create unique index if not exists uq_bishop_terms_legacy
on public.bishop_terms(parish_id,legacy_source_key)
where legacy_source_key is not null;

alter table public.bishop_terms enable row level security;

drop policy if exists bishop_terms_parish_access on public.bishop_terms;
create policy bishop_terms_parish_access on public.bishop_terms
for all to authenticated
using (
  exists(
    select 1 from public.user_profiles up
    where up.auth_user_id=auth.uid()
      and coalesce(up.is_active,true)=true
      and (
        up.parish_id=bishop_terms.parish_id
        or lower(coalesce(up.role,''))='admin_general'
        or (
          lower(coalesce(up.role,'')) in ('diocese','archdiocese','diocese_admin','archdiocese_admin')
          and up.diocese_id=(select p.diocese_id from public.parishes p where p.id=bishop_terms.parish_id)
        )
      )
  )
)
with check (
  exists(
    select 1 from public.user_profiles up
    where up.auth_user_id=auth.uid()
      and coalesce(up.is_active,true)=true
      and (
        up.parish_id=bishop_terms.parish_id
        or lower(coalesce(up.role,''))='admin_general'
        or (
          lower(coalesce(up.role,'')) in ('diocese','archdiocese','diocese_admin','archdiocese_admin')
          and up.diocese_id=(select p.diocese_id from public.parishes p where p.id=bishop_terms.parish_id)
        )
      )
  )
);
create or replace function public.refresh_current_parish_priest(p_parish_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_id uuid;
begin
  select p.id into v_id
  from public.parrocos p
  where p.parish_id=p_parish_id
    and p.fecha_ingreso is not null
  order by p.fecha_ingreso desc,p.created_at desc,p.id
  limit 1;

  update public.parrocos
  set estado=case when id=v_id then '1' else '2' end,
      payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object(
        'estado',case when id=v_id then '1' else '2' end,
        'isCurrent',id=v_id
      )
  where parish_id=p_parish_id;

  return v_id;
end;
$$;
create or replace function public.get_current_parish_priest(p_parish_id uuid)
returns table(id uuid,display_name text,fecha_ingreso date,fecha_salida date)
language sql
stable
security definer
set search_path=public
as $$
  select p.id,
         trim(concat_ws(' ',nullif(p.nombre,''),nullif(p.apellido,''))) as display_name,
         p.fecha_ingreso,p.fecha_salida
  from public.parrocos p
  where p.parish_id=p_parish_id
    and p.fecha_ingreso is not null
  order by p.fecha_ingreso desc,p.created_at desc,p.id
  limit 1
$$;

create or replace function public.get_parish_priest_at_date(p_parish_id uuid,p_date date)
returns table(id uuid,display_name text,fecha_ingreso date,fecha_salida date)
language sql
stable
security definer
set search_path=public
as $$
  select p.id,
         trim(concat_ws(' ',nullif(p.nombre,''),nullif(p.apellido,''))) as display_name,
         p.fecha_ingreso,p.fecha_salida
  from public.parrocos p
  where p.parish_id=p_parish_id
    and p.fecha_ingreso is not null
    and p.fecha_ingreso<=p_date
    and (p.fecha_salida is null or p.fecha_salida>=p_date)
  order by p.fecha_ingreso desc,p.created_at desc,p.id
  limit 1
$$;

create or replace function public.get_titular_bishop_at_date(p_parish_id uuid,p_date date)
returns table(id uuid,bishop_id uuid,display_name text,start_date date,end_date date)
language sql
stable
security definer
set search_path=public
as $$
  select bt.id,bt.bishop_id,bt.display_name,bt.start_date,bt.end_date
  from public.bishop_terms bt
  where bt.parish_id=p_parish_id
    and bt.start_date<=p_date
    and (bt.end_date is null or bt.end_date>=p_date)
  order by bt.start_date desc,bt.created_at desc,bt.id
  limit 1
$$;
grant execute on function public.get_current_parish_priest(uuid) to authenticated;
grant execute on function public.get_parish_priest_at_date(uuid,date) to authenticated;
grant execute on function public.get_titular_bishop_at_date(uuid,date) to authenticated;

create or replace function public.sync_legacy_catalog_row(p_row_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  r public.legacy_import_rows%rowtype;
  b public.legacy_import_batches%rowtype;
  d jsonb;
  v_name text;
begin
  select * into r from public.legacy_import_rows where id=p_row_id;
  if not found or r.status<>'imported' then return; end if;

  select * into b from public.legacy_import_batches where id=r.batch_id;
  if not found or b.parish_id is null then return; end if;
  d:=coalesce(r.normalized_data,'{}'::jsonb);

  if b.profile_key='CIUDADES' then
    insert into public.ciudades(
      context_id,nombre,source,count,weight,usuario,
      source_system,source_sha256,legacy_source_key
    ) values(
      b.parish_id,upper(coalesce(nullif(d->>'value',''),'SIN DATO')),
      'LEGACY_MIGRATION',coalesce(nullif(d->>'usage_count','')::int,0),
      coalesce(nullif(d->>'weight','')::int,0),nullif(d->>'source_user',''),
      'LEGACY_MIGRATION',b.sha256,coalesce(r.source_key,r.row_number::text)
    )
    on conflict(context_id,legacy_source_key)
      where legacy_source_key is not null
    do update set nombre=excluded.nombre,count=excluded.count,weight=excluded.weight,
      usuario=excluded.usuario,source_sha256=excluded.source_sha256,updated_at=now();

  elsif b.profile_key='IGLESIAS' then
    insert into public.iglesias(
      parish_id,codigo,nombre,nit,direccion,ciudad,telefono,fax,email,parroco,diocesis,
      source_system,source_sha256,legacy_source_key
    ) values(
      b.parish_id,nullif(d->>'legacy_code',''),upper(coalesce(nullif(d->>'name',''),'SIN NOMBRE')),
      nullif(d->>'nit',''),nullif(d->>'address',''),upper(coalesce(nullif(d->>'city',''),'')),
      nullif(d->>'phone',''),nullif(d->>'fax',''),nullif(d->>'email',''),
      nullif(d->>'priest_name',''),nullif(d->>'diocese_legacy_code',''),
      'LEGACY_MIGRATION',b.sha256,coalesce(r.source_key,r.row_number::text)
    )
    on conflict(parish_id,legacy_source_key)
      where legacy_source_key is not null
    do update set codigo=excluded.codigo,nombre=excluded.nombre,nit=excluded.nit,
      direccion=excluded.direccion,ciudad=excluded.ciudad,telefono=excluded.telefono,
      fax=excluded.fax,email=excluded.email,parroco=excluded.parroco,
      diocesis=excluded.diocesis,source_sha256=excluded.source_sha256,updated_at=now();

  elsif b.profile_key='PARROCOS' then
    v_name:=upper(coalesce(nullif(d->>'priest_name',''),'SIN NOMBRE'));
    insert into public.parrocos(
      parish_id,nombre,apellido,fecha_ingreso,fecha_salida,estado,payload,
      source_system,source_sha256,legacy_source_key
    ) values(
      b.parish_id,v_name,null,nullif(d->>'service_start','')::date,
      nullif(d->>'service_end','')::date,'2',
      jsonb_build_object(
        'nombre',v_name,'nombreCompleto',v_name,
        'fechaIngreso',d->>'service_start','fechaSalida',d->>'service_end',
        'legacyCode',d->>'legacy_code','source','LEGACY_MIGRATION'
      ),
      'LEGACY_MIGRATION',b.sha256,coalesce(r.source_key,r.row_number::text)
    )
    on conflict(parish_id,legacy_source_key)
      where legacy_source_key is not null
    do update set nombre=excluded.nombre,fecha_ingreso=excluded.fecha_ingreso,
      fecha_salida=excluded.fecha_salida,payload=excluded.payload,
      source_sha256=excluded.source_sha256;
    perform public.refresh_current_parish_priest(b.parish_id);

  elsif b.profile_key='OBISPOS' then
    v_name:=upper(coalesce(
      nullif(d->>'nombre',''),nullif(d->>'Nombre',''),
      nullif(d->>'name',''),nullif(d->>'obispo',''),'SIN NOMBRE'
    ));
    insert into public.obispos(
      parish_id,nombre,apellido,diocesis,fecha_nombramiento,email,
      source_system,source_sha256,legacy_source_key
    ) values(
      b.parish_id,v_name,
      upper(coalesce(nullif(d->>'apellido',''),nullif(d->>'Apellido',''),'')),
      coalesce(nullif(d->>'diocesis',''),nullif(d->>'Diocesis','')),
      nullif(coalesce(d->>'fechaNombramiento',d->>'fecha_nombramiento'),'')::date,
      coalesce(nullif(d->>'email',''),nullif(d->>'Email','')),
      'LEGACY_MIGRATION',b.sha256,coalesce(r.source_key,r.row_number::text)
    )
    on conflict(parish_id,legacy_source_key)
      where legacy_source_key is not null
    do update set nombre=excluded.nombre,apellido=excluded.apellido,
      diocesis=excluded.diocesis,fecha_nombramiento=excluded.fecha_nombramiento,
      email=excluded.email,source_sha256=excluded.source_sha256,updated_at=now();

  elsif b.profile_key='DIOCESIS' then
    insert into public.diocesis(
      parish_id,nombre,codigo,region,descripcion,
      source_system,source_sha256,legacy_source_key
    ) values(
      b.parish_id,upper(coalesce(nullif(d->>'name',''),'SIN NOMBRE')),
      nullif(d->>'legacy_code',''),nullif(d->>'city',''),
      concat_ws(' · ',nullif(d->>'address',''),nullif(d->>'phone','')),
      'LEGACY_MIGRATION',b.sha256,coalesce(r.source_key,r.row_number::text)
    )
    on conflict(parish_id,legacy_source_key)
      where legacy_source_key is not null
    do update set nombre=excluded.nombre,codigo=excluded.codigo,region=excluded.region,
      descripcion=excluded.descripcion,source_sha256=excluded.source_sha256,updated_at=now();
  end if;
end;
$$;
create or replace function public.trg_sync_legacy_catalog_row()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.status='imported'
     and (old.status is distinct from new.status or old.normalized_data is distinct from new.normalized_data) then
    perform public.sync_legacy_catalog_row(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_legacy_catalog_row on public.legacy_import_rows;
create trigger trg_sync_legacy_catalog_row
after update of status,normalized_data on public.legacy_import_rows
for each row execute function public.trg_sync_legacy_catalog_row();

do $$
declare x record;
begin
  for x in
    select lr.id
    from public.legacy_import_rows lr
    join public.legacy_import_batches b on b.id=lr.batch_id
    where lr.status='imported'
      and b.profile_key in ('CIUDADES','IGLESIAS','PARROCOS','OBISPOS','DIOCESIS')
  loop
    perform public.sync_legacy_catalog_row(x.id);
  end loop;
end;
$$;

do $$
declare p record;
begin
  for p in select distinct parish_id from public.parrocos where parish_id is not null
  loop
    perform public.refresh_current_parish_priest(p.parish_id);
  end loop;
end;
$$;

commit;

select
  to_regclass('public.bishop_terms') is not null as bishop_terms_ok,
  to_regprocedure('public.get_current_parish_priest(uuid)') is not null as current_priest_fn_ok,
  to_regprocedure('public.get_parish_priest_at_date(uuid,date)') is not null as priest_at_date_fn_ok,
  to_regprocedure('public.get_titular_bishop_at_date(uuid,date)') is not null as bishop_at_date_fn_ok,
  exists(select 1 from pg_trigger where tgname='trg_sync_legacy_catalog_row' and not tgisinternal) as legacy_sync_trigger_ok;
