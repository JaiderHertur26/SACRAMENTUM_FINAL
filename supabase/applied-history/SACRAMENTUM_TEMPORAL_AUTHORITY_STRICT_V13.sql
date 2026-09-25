-- SACRAMENTUM · V13 · AUTORIDAD TEMPORAL ESTRICTA
-- No propone Párroco/Obispo fuera de una vigencia documentada.
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
    'id',r.id,'nombre',r.nombre,'apellido',r.apellido,
    'nombreCompleto',upper(trim(coalesce(r.nombre,'')||' '||coalesce(r.apellido,''))),
    'fechaIngreso',r.fecha_ingreso,'fechaSalida',r.fecha_salida,
    'estado',r.estado,'payload',coalesce(r.payload,'{}'::jsonb)
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
    'id',r.id,'bishopId',r.bishop_id,'nombreCompleto',r.bishop_name,
    'fechaInicio',r.start_date,'fechaFin',r.end_date
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
    and p.fecha_ingreso is not null
    and p.fecha_ingreso<=current_date
    and (p.fecha_salida is null or p.fecha_salida>=current_date)
  order by p.fecha_ingreso desc,p.created_at desc
  limit 1;
  update public.parrocos
  set estado=case when id=v_current then 'ACTIVO' else 'HISTORICO' end
  where parish_id=p_parish_id;
end;
$$;

grant execute on function public.sacramentum_priest_at_date(uuid,date) to authenticated,service_role;
grant execute on function public.sacramentum_bishop_at_date(uuid,date) to authenticated,service_role;
grant execute on function public.sacramentum_recalculate_current_priest(uuid) to authenticated,service_role;

-- Recalcular la parroquia operativa principal sin fabricar un titular actual.
select public.sacramentum_recalculate_current_priest('ada2c810-c6eb-4b75-8e3c-4941e3022687');

commit;
