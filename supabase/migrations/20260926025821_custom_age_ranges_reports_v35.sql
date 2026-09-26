create or replace function public.get_diocesan_custom_age_distribution(
  p_year_from integer,
  p_year_to integer,
  p_scope_type text default 'general',
  p_scope_id uuid default null,
  p_age_ranges jsonb default '[]'::jsonb
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
  v_result jsonb;
begin
  select public.current_app_diocese_id(), public.current_app_role()
    into v_diocese, v_role;

  if auth.uid() is null or v_role not in ('diocese', 'admin_general') then
    raise exception 'Solo un usuario de Diócesis/Arquidiócesis puede generar esta estadística';
  end if;
  if v_role = 'admin_general' and v_diocese is null then
    raise exception 'El administrador general debe operar con una jurisdicción diocesana explícita';
  end if;

  if v_diocese is null then
    raise exception 'No se pudo determinar la diócesis del usuario';
  end if;

  if p_year_from is null or p_year_to is null
     or p_year_from < 1800 or p_year_to > 2200
     or p_year_from > p_year_to then
    raise exception 'Rango de años inválido';
  end if;

  if p_year_to - p_year_from > 100 then
    raise exception 'El rango máximo permitido es de 100 años';
  end if;

  if jsonb_typeof(p_age_ranges) <> 'array'
     or jsonb_array_length(p_age_ranges) < 1
     or jsonb_array_length(p_age_ranges) > 20 then
    raise exception 'Debe enviar entre 1 y 20 rangos de edad';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_age_ranges) r
    where jsonb_typeof(r->'min') <> 'number'
       or (
         r ? 'max'
         and r->'max' <> 'null'::jsonb
         and jsonb_typeof(r->'max') <> 'number'
       )
  ) then
    raise exception 'Los límites de edad deben ser numéricos';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_age_ranges) r
    where (r->>'min')::integer < 0
       or (r->>'min')::integer > 200
       or (
         r->>'max' is not null
         and (
           (r->>'max')::integer < (r->>'min')::integer
           or (r->>'max')::integer > 200
         )
       )
  ) then
    raise exception 'Uno o más rangos de edad son inválidos';
  end if;

  if exists (
    with ranges as (
      select
        ordinality::integer ord,
        (r->>'min')::integer min_age,
        coalesce((r->>'max')::integer, 200) max_age
      from jsonb_array_elements(p_age_ranges) with ordinality t(r, ordinality)
    )
    select 1
    from ranges a
    join ranges b on a.ord < b.ord
    where a.min_age <= b.max_age
      and b.min_age <= a.max_age
  ) then
    raise exception 'Los rangos de edad no pueden superponerse';
  end if;

  if v_scope not in ('general', 'vicaria', 'decanato', 'parroquia') then
    raise exception 'Nivel territorial inválido';
  end if;

  if v_scope <> 'general' and p_scope_id is null then
    raise exception 'Debe seleccionar la entidad territorial del informe';
  end if;
  if v_scope = 'general' then
    select array_agg(id)
      into v_parish_ids
    from public.parishes
    where diocese_id = v_diocese;
  elsif v_scope = 'vicaria' then
    select name into v_scope_name
    from public.vicarias
    where id = p_scope_id and diocese_id = v_diocese;

    if v_scope_name is null then
      raise exception 'Vicaría fuera de la jurisdicción';
    end if;

    select array_agg(id)
      into v_parish_ids
    from public.parishes
    where diocese_id = v_diocese and vicary_id = p_scope_id;
  elsif v_scope = 'decanato' then
    select name into v_scope_name
    from public.decanatos
    where id = p_scope_id and diocese_id = v_diocese;

    if v_scope_name is null then
      raise exception 'Decanato fuera de la jurisdicción';
    end if;

    select array_agg(id)
      into v_parish_ids
    from public.parishes
    where diocese_id = v_diocese
      and (decanate_id = p_scope_id or deanery_id = p_scope_id);
  else
    select name into v_scope_name
    from public.parishes
    where id = p_scope_id and diocese_id = v_diocese;
    if v_scope_name is null then
      raise exception 'Parroquia fuera de la jurisdicción';
    end if;

    v_parish_ids := array[p_scope_id];
  end if;

  v_parish_ids := coalesce(v_parish_ids, array[]::uuid[]);

  with requested_ranges as (
    select
      ordinality::integer ord,
      (r->>'min')::integer min_age,
      case when r->>'max' is null then null else (r->>'max')::integer end max_age,
      case
        when r->>'max' is null then ((r->>'min')::integer)::text || ' años o más'
        else ((r->>'min')::integer)::text || '–' || ((r->>'max')::integer)::text || ' años'
      end label
    from jsonb_array_elements(p_age_ranges) with ordinality t(r, ordinality)
  ),
  sacramental_events as (
    select
      'bautismo'::text sacrament_type,
      b.celebration_date event_date,
      public.sacramentum_age_years(b.fecha_nacimiento, b.celebration_date) age1,
      null::integer age2
    from public.baptisms b
    where b.parish_id = any(v_parish_ids)
      and b.celebration_date is not null
      and lower(coalesce(b.status, 'seated')) not in
        ('anulada', 'anulado', 'annulled', 'reverted', 'cancelled', 'deleted')

    union all
    select
      'confirmacion',
      c.celebration_date,
      public.sacramentum_age_years(c.fecha_nacimiento, c.celebration_date),
      null::integer
    from public.confirmations c
    where c.parish_id = any(v_parish_ids)
      and c.celebration_date is not null
      and lower(coalesce(c.status, 'seated')) not in
        ('anulada', 'anulado', 'annulled', 'reverted', 'cancelled', 'deleted')

    union all

    select
      'matrimonio',
      m.celebration_date,
      public.sacramentum_age_years(
        coalesce(
          ph.birth_date,
          public.sacramentum_safe_date(
            coalesce(
              m.raw_data->>'fecnac1',
              m.raw_data->>'birth_date_1',
              m.raw_data->>'husbandBirthDate',
              m.raw_data->>'fechaNacimientoNovio'
            )
          )
        ),
        m.celebration_date
      ),
      public.sacramentum_age_years(
        coalesce(
          pw.birth_date,
          public.sacramentum_safe_date(
            coalesce(
              m.raw_data->>'fecnac2',
              m.raw_data->>'birth_date_2',
              m.raw_data->>'wifeBirthDate',
              m.raw_data->>'fechaNacimientoNovia'
            )
          )
        ),
        m.celebration_date
      )
    from public.marriages m
    left join public.parishioners ph on ph.id = m.husband_id
    left join public.parishioners pw on pw.id = m.wife_id
    where m.parish_id = any(v_parish_ids)
      and m.celebration_date is not null
      and lower(coalesce(m.status, 'seated')) not in
        ('reverted', 'cancelled', 'deleted')

    union all

    select
      'exequias',
      coalesce(f.fecha_exequias, f.fecha_defuncion),
      public.sacramentum_age_years(f.fecha_nacimiento, f.fecha_defuncion),
      null::integer
    from public.funerals f
    where f.parish_id = any(v_parish_ids)
      and coalesce(f.fecha_exequias, f.fecha_defuncion) is not null
      and lower(coalesce(f.status, 'seated')) not in
        ('anulada', 'anulado', 'annulled', 'reverted', 'cancelled', 'deleted')
  ),
  persons as (
    select sacrament_type, event_date, age1 age_years
    from sacramental_events
    where age1 is not null

    union all

    select sacrament_type, event_date, age2
    from sacramental_events
    where sacrament_type = 'matrimonio' and age2 is not null
  ),
  years as (
    select generate_series(p_year_from, p_year_to) y
  ),
  sacrament_types as (
    select unnest(array['bautismo', 'confirmacion', 'matrimonio', 'exequias']) s
  ),
  distribution as (
    select
      y.y as year,
      st.s as sacrament_type,
      rr.ord,
      rr.label band,
      rr.min_age,
      rr.max_age,
      count(p.age_years)::integer persons
    from years y
    cross join sacrament_types st
    cross join requested_ranges rr
    left join persons p
      on extract(year from p.event_date)::integer = y.y
     and p.sacrament_type = st.s
     and p.age_years >= rr.min_age
     and (rr.max_age is null or p.age_years <= rr.max_age)
    group by y.y, st.s, rr.ord, rr.label, rr.min_age, rr.max_age
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'year', d.year,
        'sacrament_type', d.sacrament_type,
        'band', d.band,
        'min_age', d.min_age,
        'max_age', d.max_age,
        'persons', d.persons
      )
      order by d.year, d.ord, d.sacrament_type
    ),
    '[]'::jsonb
  )
  into v_result
  from distribution d;

  return v_result;
end;
$$;
revoke all on function public.get_diocesan_custom_age_distribution(
  integer, integer, text, uuid, jsonb
) from public;

revoke all on function public.get_diocesan_custom_age_distribution(
  integer, integer, text, uuid, jsonb
) from anon;

grant execute on function public.get_diocesan_custom_age_distribution(
  integer, integer, text, uuid, jsonb
) to authenticated;

comment on function public.get_diocesan_custom_age_distribution(
  integer, integer, text, uuid, jsonb
) is 'Calcula distribución etaria sacramental para varios rangos personalizados dentro de un único informe.';
