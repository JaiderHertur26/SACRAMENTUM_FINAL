-- SACRAMENTUM V19 · REGLA CANÓNICA DEL PÁRROCO ACTUAL
-- El registro con fecha_ingreso más reciente es SIEMPRE el Párroco Actual.
-- Los periodos anteriores se conservan. El último ingreso se interpreta abierto
-- desde su fecha_ingreso en adelante, aunque el legado tenga fecha_salida.
begin;

create or replace function public.sacramentum_priest_at_date(
  p_parish_id uuid,
  p_date date default current_date
) returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  r public.parrocos%rowtype;
  v_latest_id uuid;
  v_target date:=coalesce(p_date,current_date);
begin
  select p.id into v_latest_id
  from public.parrocos p
  where p.parish_id=p_parish_id
  order by p.fecha_ingreso desc nulls last,p.created_at desc,p.id desc
  limit 1;

  select * into r
  from public.parrocos p
  where p.parish_id=p_parish_id
    and p.fecha_ingreso is not null
    and p.fecha_ingreso<=v_target
    and (
      p.id=v_latest_id
      or p.fecha_salida is null
      or p.fecha_salida>=v_target
    )
  order by p.fecha_ingreso desc,p.created_at desc,p.id desc
  limit 1;

  if r.id is null then return null; end if;

  return jsonb_build_object(
    'id',r.id,
    'nombre',r.nombre,
    'apellido',r.apellido,
    'nombreCompleto',upper(trim(coalesce(r.nombre,'')||' '||coalesce(r.apellido,''))),
    'fechaIngreso',r.fecha_ingreso,
    'fechaSalida',r.fecha_salida,
    'estado',case when r.id=v_latest_id then 'ACTIVO' else coalesce(r.estado,'HISTORICO') end,
    'payload',coalesce(r.payload,'{}'::jsonb)
  );
end;
$$;

create or replace function public.sacramentum_current_priest(
  p_parish_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  r public.parrocos%rowtype;
begin
  select * into r
  from public.parrocos p
  where p.parish_id=p_parish_id
  order by p.fecha_ingreso desc nulls last,p.created_at desc,p.id desc
  limit 1;

  if r.id is null then return null; end if;

  return jsonb_build_object(
    'id',r.id,
    'nombre',r.nombre,
    'apellido',r.apellido,
    'nombreCompleto',upper(trim(coalesce(r.nombre,'')||' '||coalesce(r.apellido,''))),
    'fechaIngreso',r.fecha_ingreso,
    'fechaSalida',r.fecha_salida,
    'estado','ACTIVO',
    'payload',coalesce(r.payload,'{}'::jsonb)
  );
end;
$$;

create or replace function public.sacramentum_recalculate_current_priest(
  p_parish_id uuid
) returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_current uuid;
begin
  select p.id into v_current
  from public.parrocos p
  where p.parish_id=p_parish_id
  order by p.fecha_ingreso desc nulls last,p.created_at desc,p.id desc
  limit 1;

  update public.parrocos
  set estado=case when id=v_current then 'ACTIVO' else 'HISTORICO' end
  where parish_id=p_parish_id;
end;
$$;

revoke all on function public.sacramentum_priest_at_date(uuid,date) from public,anon;
grant execute on function public.sacramentum_priest_at_date(uuid,date) to authenticated,service_role;

revoke all on function public.sacramentum_current_priest(uuid) from public,anon;
grant execute on function public.sacramentum_current_priest(uuid) to authenticated,service_role;
grant execute on function public.sacramentum_recalculate_current_priest(uuid) to authenticated,service_role;

-- Aplicar la regla a todas las parroquias ya existentes.
do $$
declare r record;
begin
  for r in select id from public.parishes loop
    perform public.sacramentum_recalculate_current_priest(r.id);
  end loop;
end $$;

commit;