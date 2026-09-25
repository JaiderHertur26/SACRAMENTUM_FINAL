begin;

create or replace function public.sacramentum_priest_at_date(
  p_parish_id uuid,
  p_date date default current_date
) returns jsonb
language plpgsql stable security definer set search_path=public
as $$
declare
  r public.parrocos%rowtype;
  v_date date:=coalesce(p_date,current_date);
begin
  select * into r
  from public.parrocos p
  where p.parish_id=p_parish_id
    and p.fecha_ingreso is not null
    and p.fecha_ingreso<=v_date
    and (p.fecha_salida is null or p.fecha_salida>=v_date)
  order by p.fecha_ingreso desc,p.created_at desc
  limit 1;

  if r.id is null then
    select * into r
    from public.parrocos p
    where p.parish_id=p_parish_id
      and (p.fecha_ingreso is null or p.fecha_ingreso<=v_date)
    order by p.fecha_ingreso desc nulls last,p.created_at desc
    limit 1;
  end if;

  if r.id is null then return null; end if;

  return jsonb_build_object(
    'id',r.id,
    'nombre',r.nombre,
    'apellido',r.apellido,
    'nombreCompleto',upper(trim(coalesce(r.nombre,'')||' '||coalesce(r.apellido,''))),
    'fechaIngreso',r.fecha_ingreso,
    'fechaSalida',r.fecha_salida,
    'estado',r.estado,
    'payload',coalesce(r.payload,'{}'::jsonb)
  );
end;
$$;

create or replace function public.sacramentum_recalculate_current_priest(p_parish_id uuid)
returns void
language plpgsql security definer set search_path=public
as $$
declare v_current uuid;
begin
  select p.id into v_current
  from public.parrocos p
  where p.parish_id=p_parish_id
  order by p.fecha_ingreso desc nulls last,p.created_at desc
  limit 1;

  update public.parrocos
  set estado=case when id=v_current then 'ACTIVO' else 'HISTORICO' end
  where parish_id=p_parish_id;
end;
$$;

select public.sacramentum_recalculate_current_priest('ada2c810-c6eb-4b75-8e3c-4941e3022687');

commit;