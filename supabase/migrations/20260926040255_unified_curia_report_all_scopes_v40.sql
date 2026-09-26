create or replace function public.get_curia_report_breakdown(
  p_year_from integer,
  p_year_to integer,
  p_scope_type text default 'general',
  p_scope_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_diocese uuid;
  v_role text;
  v_scope text := lower(trim(coalesce(p_scope_type, 'general')));
  v_scope_name text;
  v_parish_ids uuid[];
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

  if v_scope not in ('general','vicaria','decanato','parroquia') then
    raise exception 'Nivel territorial inválido';
  end if;

  if v_scope = 'general' then
    select name into v_scope_name
    from public.dioceses
    where id = v_diocese;

    select array_agg(id order by name)
      into v_parish_ids
    from public.parishes
    where diocese_id = v_diocese;
  elsif v_scope = 'vicaria' then
    if p_scope_id is null then raise exception 'Debe seleccionar la vicaría'; end if;

    select name into v_scope_name
    from public.vicarias
    where id = p_scope_id and diocese_id = v_diocese;
    if v_scope_name is null then raise exception 'Vicaría fuera de la jurisdicción'; end if;

    select array_agg(id order by name)
      into v_parish_ids
    from public.parishes
    where diocese_id = v_diocese and vicary_id = p_scope_id;

  elsif v_scope = 'decanato' then
    if p_scope_id is null then raise exception 'Debe seleccionar el decanato'; end if;

    select name into v_scope_name
    from public.decanatos
    where id = p_scope_id and diocese_id = v_diocese;
    if v_scope_name is null then raise exception 'Decanato fuera de la jurisdicción'; end if;
    select array_agg(id order by name)
      into v_parish_ids
    from public.parishes
    where diocese_id = v_diocese
      and (decanate_id = p_scope_id or deanery_id = p_scope_id);

  else
    if p_scope_id is null then raise exception 'Debe seleccionar la parroquia'; end if;

    select name into v_scope_name
    from public.parishes
    where id = p_scope_id and diocese_id = v_diocese;
    if v_scope_name is null then raise exception 'Parroquia fuera de la jurisdicción'; end if;

    v_parish_ids := array[p_scope_id];

    select trim(concat_ws(' ', nullif(nombre,''), nullif(apellido,'')))
      into v_pastor_name
    from public.parrocos
    where parish_id = p_scope_id
    order by
      case when estado = '1' then 0 else 1 end,
      fecha_ingreso desc nulls last,
      created_at desc
    limit 1;
  end if;

  v_parish_ids := coalesce(v_parish_ids, array[]::uuid[]);
  with base as (
    select upper(trim(coalesce(
      b.tipo_union_padres,
      b.raw_data->>'tipoUnionPadres',
      b.raw_data->>'tipo_union_padres',
      ''
    ))) value
    from public.baptisms b
    where b.parish_id = any(v_parish_ids)
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
    where m.parish_id = any(v_parish_ids)
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
    'scope_type', v_scope,
    'scope_id', p_scope_id,
    'scope_name', v_scope_name,
    'parish_count', cardinality(v_parish_ids),
    'pastor_name', nullif(v_pastor_name,''),
    'baptism_parent_unions', coalesce(v_parent_unions, '{}'::jsonb),
    'marriage_baptism_status', coalesce(v_marriage_status, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.get_curia_report_breakdown(integer, integer, text, uuid) from public;
revoke all on function public.get_curia_report_breakdown(integer, integer, text, uuid) from anon;
grant execute on function public.get_curia_report_breakdown(integer, integer, text, uuid) to authenticated;

comment on function public.get_curia_report_breakdown(integer, integer, text, uuid)
is 'Desglose uniforme para reporte estadístico a la Curia en cualquier nivel territorial.';

create or replace function public.attach_parish_curia_report_snapshot(
  p_report_id uuid,
  p_curia_breakdown jsonb default '{}'::jsonb,
  p_pastoral_supplement jsonb default '{}'::jsonb,
  p_age_ranges jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_diocese uuid;
  v_role text;
  v_report_number text;
begin
  select public.current_app_diocese_id(), public.current_app_role()
    into v_diocese, v_role;

  if auth.uid() is null or v_role not in ('diocese', 'admin_general') then
    raise exception 'No autorizado para adjuntar el detalle del informe';
  end if;

  if v_diocese is null then
    raise exception 'No se pudo determinar la diócesis del usuario';
  end if;

  select report_number into v_report_number
  from public.diocesan_report_runs
  where id = p_report_id
    and diocese_id = v_diocese;

  if v_report_number is null then
    raise exception 'Informe fuera de la jurisdicción';
  end if;

  update public.diocesan_report_runs
  set
    filters = coalesce(filters, '{}'::jsonb)
      || jsonb_build_object(
        'report_profile', 'curia_standard',
        'age_ranges', coalesce(p_age_ranges, '[]'::jsonb)
      ),
    summary = coalesce(summary, '{}'::jsonb)
      || jsonb_build_object(
        'curia_breakdown', coalesce(p_curia_breakdown, '{}'::jsonb),
        'pastoral_supplement', coalesce(p_pastoral_supplement, '{}'::jsonb)
      )
  where id = p_report_id
    and diocese_id = v_diocese;

  insert into public.registry_audit_log(
    actor_user_id, diocese_id, entity_type, entity_id, action, after_data, metadata
  )
  values (
    auth.uid(),
    v_diocese,
    'diocesan_report',
    p_report_id,
    'attach_curia_report_snapshot',
    jsonb_build_object(
      'curia_breakdown', coalesce(p_curia_breakdown, '{}'::jsonb),
      'pastoral_supplement', coalesce(p_pastoral_supplement, '{}'::jsonb)
    ),
    jsonb_build_object(
      'report_number', v_report_number,
      'age_ranges', coalesce(p_age_ranges, '[]'::jsonb)
    )
  );
end;
$$;
