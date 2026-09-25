begin;

create or replace function public.sacramentum_priest_at_date(
  p_parish_id uuid,
  p_date date default current_date
) returns jsonb
language plpgsql stable security definer set search_path=public
as $$
declare r public.parrocos%rowtype;
begin
  select * into r
  from public.parrocos p
  where p.parish_id=p_parish_id
    and p.fecha_ingreso is not null
    and p.fecha_ingreso<=coalesce(p_date,current_date)
    and (p.fecha_salida is null or p.fecha_salida>=coalesce(p_date,current_date))
  order by p.fecha_ingreso desc,p.created_at desc
  limit 1;

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

create or replace function public.sacramentum_bishop_at_date(
  p_parish_id uuid,
  p_date date default current_date
) returns jsonb
language plpgsql stable security definer set search_path=public
as $$
declare r public.bishop_tenures%rowtype;
begin
  select * into r
  from public.bishop_tenures bt
  where bt.parish_id=p_parish_id
    and bt.start_date<=coalesce(p_date,current_date)
    and (bt.end_date is null or bt.end_date>=coalesce(p_date,current_date))
  order by bt.start_date desc,bt.created_at desc
  limit 1;

  if r.id is null then return null; end if;

  return jsonb_build_object(
    'id',r.id,
    'bishopId',r.bishop_id,
    'nombreCompleto',upper(trim(r.bishop_name)),
    'fechaInicio',r.start_date,
    'fechaFin',r.end_date
  );
end;
$$;

create or replace function public.sacramentum_validate_bishop_tenure()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if exists(
    select 1
    from public.bishop_tenures bt
    where bt.parish_id=new.parish_id
      and bt.id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid)
      and daterange(bt.start_date,coalesce(bt.end_date,'infinity'::date),'[]')
          && daterange(new.start_date,coalesce(new.end_date,'infinity'::date),'[]')
  ) then
    raise exception 'Ya existe un Obispo titular cuyo período se superpone con las fechas indicadas';
  end if;
  new.updated_at=now();
  return new;
end;
$$;

drop trigger if exists trg_validate_bishop_tenure on public.bishop_tenures;
create trigger trg_validate_bishop_tenure
before insert or update on public.bishop_tenures
for each row execute function public.sacramentum_validate_bishop_tenure();

grant execute on function public.sacramentum_priest_at_date(uuid,date) to authenticated,service_role;
grant execute on function public.sacramentum_bishop_at_date(uuid,date) to authenticated,service_role;

commit;
