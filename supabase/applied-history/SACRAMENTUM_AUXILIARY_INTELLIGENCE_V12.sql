-- SACRAMENTUM · V12 · DATOS AUXILIARES INTELIGENTES
begin;

alter table public.obispos
  add column if not exists fecha_salida date,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb;

create table if not exists public.bishop_tenures (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete cascade,
  bishop_id uuid references public.obispos(id) on delete set null,
  bishop_name text not null,
  start_date date not null,
  end_date date,
  notes text,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_bishop_tenure_dates check (end_date is null or end_date >= start_date)
);

create index if not exists idx_bishop_tenures_parish_dates
  on public.bishop_tenures(parish_id,start_date desc,end_date);

create unique index if not exists uq_parrocos_legacy_code_per_parish
  on public.parrocos(parish_id,(payload->>'legacy_code'))
  where nullif(payload->>'legacy_code','') is not null;

create unique index if not exists uq_iglesias_codigo_per_parish
  on public.iglesias(parish_id,codigo)
  where nullif(codigo,'') is not null;

create unique index if not exists uq_ciudades_nombre_per_context
  on public.ciudades(context_id,(lower(nombre)));

create unique index if not exists uq_obispos_name_per_parish
  on public.obispos(parish_id,(lower(trim(coalesce(nombre,'')||' '||coalesce(apellido,'')))));

alter table public.bishop_tenures enable row level security;

drop policy if exists bishop_tenures_parish_select on public.bishop_tenures;
create policy bishop_tenures_parish_select on public.bishop_tenures
for select to authenticated using (
  exists(select 1 from public.user_profiles up
    where up.auth_user_id=auth.uid() and coalesce(up.is_active,true)=true
      and (lower(up.role) in ('admin_general','diocese','archdiocese')
        or up.parish_id=bishop_tenures.parish_id))
);

drop policy if exists bishop_tenures_parish_write on public.bishop_tenures;
create policy bishop_tenures_parish_write on public.bishop_tenures
for all to authenticated using (
  exists(select 1 from public.user_profiles up
    where up.auth_user_id=auth.uid() and coalesce(up.is_active,true)=true
      and (lower(up.role) in ('admin_general','diocese','archdiocese')
        or up.parish_id=bishop_tenures.parish_id))
) with check (
  exists(select 1 from public.user_profiles up
    where up.auth_user_id=auth.uid() and coalesce(up.is_active,true)=true
      and (lower(up.role) in ('admin_general','diocese','archdiocese')
        or up.parish_id=bishop_tenures.parish_id))
);

grant select,insert,update,delete on public.bishop_tenures to authenticated;

create or replace function public.sacramentum_priest_at_date(
  p_parish_id uuid,
  p_date date default current_date
) returns jsonb
language plpgsql stable security definer set search_path=public
as $$
declare r public.parrocos%rowtype;
begin

  select * into r from public.parrocos p
  where p.parish_id=p_parish_id
    and p.fecha_ingreso is not null
    and p.fecha_ingreso<=coalesce(p_date,current_date)
    and (p.fecha_salida is null or p.fecha_salida>=coalesce(p_date,current_date))
  order by p.fecha_ingreso desc,p.created_at desc limit 1;

  if not found then
    select * into r from public.parrocos p
    where p.parish_id=p_parish_id
      and (p.fecha_ingreso is null or p.fecha_ingreso<=coalesce(p_date,current_date))
    order by p.fecha_ingreso desc nulls last,p.created_at desc limit 1;
  end if;

  if r.id is null then return null; end if;
  return jsonb_build_object(
    'id',r.id,'nombre',r.nombre,'apellido',r.apellido,
    'nombreCompleto',upper(trim(coalesce(r.nombre,'')||' '||coalesce(r.apellido,''))),
    'fechaIngreso',r.fecha_ingreso,'fechaSalida',r.fecha_salida,
    'estado',r.estado,'payload',coalesce(r.payload,'{}'::jsonb)
  );
end;
$$;
grant execute on function public.sacramentum_priest_at_date(uuid,date) to authenticated,service_role;

create or replace function public.sacramentum_bishop_at_date(
  p_parish_id uuid,
  p_date date default current_date
) returns jsonb
language plpgsql stable security definer set search_path=public
as $$
declare r public.bishop_tenures%rowtype;
begin
  select * into r from public.bishop_tenures bt
  where bt.parish_id=p_parish_id
    and bt.start_date<=coalesce(p_date,current_date)
    and (bt.end_date is null or bt.end_date>=coalesce(p_date,current_date))
  order by bt.start_date desc,bt.created_at desc limit 1;

  if not found then
    select * into r from public.bishop_tenures bt
    where bt.parish_id=p_parish_id
      and bt.start_date<=coalesce(p_date,current_date)
    order by bt.start_date desc,bt.created_at desc limit 1;
  end if;

  if r.id is null then return null; end if;
  return jsonb_build_object(
    'id',r.id,'bishopId',r.bishop_id,'nombreCompleto',r.bishop_name,
    'fechaInicio',r.start_date,'fechaFin',r.end_date
  );
end;
$$;
grant execute on function public.sacramentum_bishop_at_date(uuid,date) to authenticated,service_role;

create or replace function public.sacramentum_recalculate_current_priest(p_parish_id uuid)
returns void
language plpgsql security definer set search_path=public
as $$
declare v_current uuid;
begin
  select p.id into v_current from public.parrocos p
  where p.parish_id=p_parish_id
    and p.fecha_ingreso is not null
    and p.fecha_ingreso<=current_date
    and (p.fecha_salida is null or p.fecha_salida>=current_date)
  order by p.fecha_ingreso desc,p.created_at desc limit 1;

  if v_current is null then
    select p.id into v_current from public.parrocos p
    where p.parish_id=p_parish_id
    order by p.fecha_ingreso desc nulls last,p.created_at desc limit 1;
  end if;

  update public.parrocos
  set estado=case when id=v_current then 'ACTIVO' else 'HISTORICO' end
  where parish_id=p_parish_id;
end;
$$;
grant execute on function public.sacramentum_recalculate_current_priest(uuid) to authenticated,service_role;

create or replace function public.materialize_auxiliary_catalog_batch(p_batch_id uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  b public.legacy_import_batches%rowtype;
  r public.legacy_import_rows%rowtype;
  d jsonb;
  v_count integer:=0;
  v_name text;
begin
  select * into b from public.legacy_import_batches where id=p_batch_id;
  if not found then raise exception 'Lote no encontrado'; end if;
  if b.parish_id is null then raise exception 'La parroquia propietaria es obligatoria'; end if;
  if auth.uid() is not null and not public.can_manage_legacy_import(b.parish_id,b.diocese_id) then
    raise exception 'No autorizado para materializar este lote';
  end if;

  if b.profile_key not in ('PARROCOS','IGLESIAS','CIUDADES','OBISPOS') then
    return jsonb_build_object('profile',b.profile_key,'materialized',0,'skipped',true);
  end if;

  for r in select * from public.legacy_import_rows
    where batch_id=p_batch_id and status='imported'
    order by row_number
  loop
    d:=coalesce(r.normalized_data,'{}'::jsonb);

    if b.profile_key='PARROCOS' then
      v_name:=upper(trim(coalesce(d->>'priest_name','')));
      if v_name<>'' then
        insert into public.parrocos(
          parish_id,nombre,apellido,fecha_ingreso,fecha_salida,estado,payload,created_at
        ) values(
          b.parish_id,v_name,'',
          nullif(d->>'service_start','')::date,
          nullif(d->>'service_end','')::date,
          'HISTORICO',
          jsonb_build_object(
            'legacy_code',d->>'legacy_code',
            'legacy_grade',d->>'legacy_grade',
            'legacy_state',d->>'legacy_state',
            'source','legacy_migration',
            'batch_id',p_batch_id,
            'source_sha256',b.sha256
          ),
          now()
        )
        on conflict (parish_id,(payload->>'legacy_code'))
        where nullif(payload->>'legacy_code','') is not null
        do update set
          nombre=excluded.nombre,
          fecha_ingreso=excluded.fecha_ingreso,
          fecha_salida=excluded.fecha_salida,
          payload=public.parrocos.payload||excluded.payload;
        v_count:=v_count+1;
      end if;

    elsif b.profile_key='IGLESIAS' then
      if nullif(d->>'name','') is not null then
        insert into public.iglesias(
          parish_id,codigo,nombre,nit,direccion,ciudad,telefono,fax,email,parroco,diocesis,created_at
        ) values(
          b.parish_id,nullif(d->>'legacy_code',''),upper(d->>'name'),
          nullif(d->>'nit',''),nullif(d->>'address',''),upper(coalesce(d->>'city','')),
          nullif(d->>'phone',''),nullif(d->>'fax',''),nullif(d->>'email',''),
          upper(coalesce(d->>'priest_name','')),nullif(d->>'diocese_legacy_code',''),now()
        )
        on conflict(parish_id,codigo) where nullif(codigo,'') is not null
        do update set
          nombre=excluded.nombre,nit=excluded.nit,direccion=excluded.direccion,
          ciudad=excluded.ciudad,telefono=excluded.telefono,fax=excluded.fax,
          email=excluded.email,parroco=excluded.parroco,diocesis=excluded.diocesis,
          updated_at=now();
        v_count:=v_count+1;
      end if;

    elsif b.profile_key='CIUDADES' then
      if nullif(d->>'value','') is not null then
        insert into public.ciudades(
          context_id,nombre,source,count,weight,usuario,created_at
        ) values(
          b.parish_id,upper(d->>'value'),coalesce(nullif(d->>'source',''),'legacy_migration'),
          coalesce(nullif(d->>'usage_count','')::integer,0),
          coalesce(nullif(d->>'weight','')::integer,0),
          nullif(d->>'source_user',''),now()
        )
        on conflict(context_id,(lower(nombre)))
        do update set count=greatest(public.ciudades.count,excluded.count),
          weight=greatest(public.ciudades.weight,excluded.weight),updated_at=now();
        v_count:=v_count+1;
      end if;

    elsif b.profile_key='OBISPOS' then
      v_name:=upper(trim(coalesce(d->>'nombre',d->>'name','')));
      if v_name<>'' then
        insert into public.obispos(
          parish_id,nombre,apellido,diocesis,fecha_nombramiento,fecha_salida,email,source_metadata,created_at
        ) values(
          b.parish_id,v_name,upper(trim(coalesce(d->>'apellido',d->>'last_name',''))),
          upper(trim(coalesce(d->>'diocesis',d->>'diocese',''))),
          nullif(coalesce(d->>'fechaNombramiento',d->>'fecha_nombramiento',d->>'fecing'),'')::date,
          nullif(coalesce(d->>'fechaSalida',d->>'fecha_salida',d->>'fecsal'),'')::date,
          nullif(d->>'email',''),
          jsonb_build_object('source','legacy_migration','batch_id',p_batch_id,'source_sha256',b.sha256),
          now()
        )
        on conflict(parish_id,(lower(trim(coalesce(nombre,'')||' '||coalesce(apellido,'')))))
        do update set diocesis=excluded.diocesis,
          fecha_nombramiento=coalesce(excluded.fecha_nombramiento,public.obispos.fecha_nombramiento),
          fecha_salida=coalesce(excluded.fecha_salida,public.obispos.fecha_salida),
          email=coalesce(excluded.email,public.obispos.email),
          source_metadata=public.obispos.source_metadata||excluded.source_metadata,
          updated_at=now();
        v_count:=v_count+1;
      end if;
    end if;
  end loop;

  if b.profile_key='PARROCOS' then
    perform public.sacramentum_recalculate_current_priest(b.parish_id);
  end if;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values(
    auth.uid(),b.parish_id,b.diocese_id,'legacy_import_batch',p_batch_id,
    'auxiliary_catalog_materialized',
    jsonb_build_object('profile_key',b.profile_key,'materialized',v_count),
    jsonb_build_object('filename',b.original_filename,'sha256',b.sha256)
  );

  return jsonb_build_object('profile',b.profile_key,'materialized',v_count,'parish_id',b.parish_id);
end;
$$;

revoke all on function public.materialize_auxiliary_catalog_batch(uuid) from public,anon;
grant execute on function public.materialize_auxiliary_catalog_batch(uuid) to authenticated,service_role;

commit;
