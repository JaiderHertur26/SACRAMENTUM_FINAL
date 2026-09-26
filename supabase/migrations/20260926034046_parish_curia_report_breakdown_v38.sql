create or replace function public.get_parish_curia_report_breakdown(
  p_year_from integer,
  p_year_to integer,
  p_parish_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_diocese uuid;
  v_role text;
  v_parish_name text;
  v_pastor_name text;
  v_parent_unions jsonb;
  v_marriage_status jsonb;
begin
  select public.current_app_diocese_id(), public.current_app_role()
    into v_diocese, v_role;

  if auth.uid() is null or v_role not in ('diocese', 'admin_general') then
    raise exception 'Solo un usuario de Diócesis/Arquidiócesis puede generar este desglose';
  end if;

  if v_diocese is null then
    raise exception 'No se pudo determinar la diócesis del usuario';
  end if;
  if p_year_from is null or p_year_to is null
     or p_year_from < 1800 or p_year_to > 2200
     or p_year_from > p_year_to then
    raise exception 'Rango de años inválido';
  end if;

  select name into v_parish_name
  from public.parishes
  where id = p_parish_id and diocese_id = v_diocese;

  if v_parish_name is null then
    raise exception 'Parroquia fuera de la jurisdicción';
  end if;

  select trim(concat_ws(' ', nullif(nombre,''), nullif(apellido,'')))
    into v_pastor_name
  from public.parrocos
  where parish_id = p_parish_id
  order by
    case when estado = '1' then 0 else 1 end,
    fecha_ingreso desc nulls last,
    created_at desc
  limit 1;

  with base as (
    select upper(trim(coalesce(b.tipo_union_padres, b.raw_data->>'tipoUnionPadres', b.raw_data->>'tipo_union_padres', ''))) value
    from public.baptisms b
    where b.parish_id = p_parish_id
      and b.celebration_date is not null
      and extract(year from b.celebration_date)::integer between p_year_from and p_year_to
      and lower(coalesce(b.status, 'seated')) not in
        ('anulada','anulado','annulled','reverted','cancelled','deleted')
  )
  select jsonb_build_object(
    'matrimonio_catolico', count(*) filter (where value in ('MATRIMONIO CATÓLICO','MATRIMONIO CATOLICO')),
    'matrimonio_civil', count(*) filter (where value = 'MATRIMONIO CIVIL'),
    'union_libre', count(*) filter (where value in ('UNIÓN LIBRE','UNION LIBRE')),
    'madre_soltera', count(*) filter (where value = 'MADRE SOLTERA'),
    'padre_soltero', count(*) filter (where value = 'PADRE SOLTERO'),
    'otro', count(*) filter (
      where value <> ''
        and value not in (
          'MATRIMONIO CATÓLICO','MATRIMONIO CATOLICO',
          'MATRIMONIO CIVIL','UNIÓN LIBRE','UNION LIBRE',
          'MADRE SOLTERA','PADRE SOLTERO'
        )
    ),
    'sin_dato', count(*) filter (where value = '')
  )
  into v_parent_unions
  from base;

  with base as (
    select
      case when lower(coalesce(m.raw_data->>'novioBautizado','')) in ('true','1','si','sí','yes') then true
           when lower(coalesce(m.raw_data->>'novioBautizado','')) in ('false','0','no') then false
           else null end novio_bautizado,
      case when lower(coalesce(m.raw_data->>'noviaBautizado','')) in ('true','1','si','sí','yes') then true
           when lower(coalesce(m.raw_data->>'noviaBautizado','')) in ('false','0','no') then false
           else null end novia_bautizada
    from public.marriages m
    where m.parish_id = p_parish_id
      and m.celebration_date is not null
      and extract(year from m.celebration_date)::integer between p_year_from and p_year_to
      and lower(coalesce(m.status, 'seated')) not in ('reverted','cancelled','deleted')
  )
  select jsonb_build_object(
    'ambos_bautizados', count(*) filter (where novio_bautizado is true and novia_bautizada is true),
    'uno_bautizado', count(*) filter (
      where (novio_bautizado is true and novia_bautizada is false)
         or (novio_bautizado is false and novia_bautizada is true)
    ),
    'ninguno_bautizado', count(*) filter (where novio_bautizado is false and novia_bautizada is false),
    'informacion_incompleta', count(*) filter (where novio_bautizado is null or novia_bautizada is null)
  )
  into v_marriage_status
  from base;

  return jsonb_build_object(
    'parish_id', p_parish_id,
    'parish_name', v_parish_name,
    'pastor_name', nullif(v_pastor_name,''),
    'baptism_parent_unions', coalesce(v_parent_unions, '{}'::jsonb),
    'marriage_baptism_status', coalesce(v_marriage_status, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.get_parish_curia_report_breakdown(integer, integer, uuid) from public;
revoke all on function public.get_parish_curia_report_breakdown(integer, integer, uuid) from anon;
grant execute on function public.get_parish_curia_report_breakdown(integer, integer, uuid) to authenticated;
comment on function public.get_parish_curia_report_breakdown(integer, integer, uuid)
is 'Desglose parroquial para informe estadístico a la Curia.';
