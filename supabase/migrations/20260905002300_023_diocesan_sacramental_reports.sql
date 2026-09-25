-- ============================================================================
-- SACRAMENTUM · Informes pastorales y sacramentales diocesanos
-- 2026-09-05
-- Fase 3 · Migración 023
--
-- Permite a Diócesis/Arquidiócesis generar informes agregados por:
--   * jurisdicción completa
--   * vicaría
--   * decanato
--   * parroquia
--   * rango de años
--   * rango opcional de edades
--
-- La tabla principal cuenta ACTOS/REGISTROS sacramentales.
-- La distribución de edad cuenta PERSONAS: matrimonio puede aportar 2 personas.
-- ============================================================================

create table if not exists public.diocesan_report_runs (
  id uuid primary key default gen_random_uuid(),
  diocese_id uuid not null references public.dioceses(id) on delete restrict,
  report_number varchar(80) not null,
  generated_by uuid not null,
  filters jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now()
);

create index if not exists idx_diocesan_report_runs_diocese_date
  on public.diocesan_report_runs(diocese_id, generated_at desc);
create unique index if not exists uq_diocesan_report_runs_number
  on public.diocesan_report_runs(diocese_id, report_number);

alter table public.diocesan_report_runs enable row level security;
drop policy if exists diocesan_report_runs_select_scope on public.diocesan_report_runs;
create policy diocesan_report_runs_select_scope on public.diocesan_report_runs
for select to authenticated
using (
  public.is_app_admin()
  or (public.current_app_role() in ('diocese','chancery') and diocese_id = public.current_app_diocese_id())
);

-- Conversión tolerante de textos legacy/JSON a fecha.
create or replace function public.sacramentum_safe_date(p_value text)
returns date
language plpgsql
immutable
as $$
begin
  if nullif(trim(coalesce(p_value,'')), '') is null then return null; end if;
  return trim(p_value)::date;
exception when others then
  return null;
end;
$$;

-- Edad cumplida al día del evento. Fechas futuras/anómalas se excluyen.
create or replace function public.sacramentum_age_years(p_birth date, p_event date)
returns integer
language sql
immutable
as $$
  select case
    when p_birth is null or p_event is null or p_birth > p_event then null
    else extract(year from age(p_event, p_birth))::integer
  end;
$$;

create or replace function public.generate_diocesan_sacramental_report(
  p_year_from integer,
  p_year_to integer,
  p_scope_type text default 'general',
  p_scope_id uuid default null,
  p_age_min integer default null,
  p_age_max integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_diocese uuid;
  v_role text;
  v_scope text := lower(trim(coalesce(p_scope_type,'general')));
  v_diocese_name text;
  v_city text;
  v_bishop text;
  v_scope_name text;
  v_report_number text;
  v_report_id uuid;
  v_counts jsonb;
  v_ages jsonb;
  v_totals jsonb;
  v_parish_ids uuid[];
begin
  select public.current_app_diocese_id(), public.current_app_role()
    into v_diocese, v_role;

  if auth.uid() is null or v_role not in ('diocese','admin_general') then
    raise exception 'Solo un usuario de Diócesis/Arquidiócesis puede generar este informe';
  end if;

  if v_role='admin_general' and v_diocese is null then
    raise exception 'El administrador general debe operar con una jurisdicción diocesana explícita';
  end if;

  if v_diocese is null then
    raise exception 'No se pudo determinar la diócesis del usuario';
  end if;

  if p_year_from is null or p_year_to is null or p_year_from < 1800 or p_year_to > 2200 or p_year_from > p_year_to then
    raise exception 'Rango de años inválido';
  end if;

  if p_year_to - p_year_from > 100 then
    raise exception 'El rango máximo permitido es de 100 años';
  end if;

  if p_age_min is not null and p_age_min < 0 then raise exception 'Edad mínima inválida'; end if;
  if p_age_max is not null and p_age_max < 0 then raise exception 'Edad máxima inválida'; end if;
  if p_age_min is not null and p_age_max is not null and p_age_min > p_age_max then
    raise exception 'La edad mínima no puede superar la máxima';
  end if;

  if v_scope not in ('general','vicaria','decanato','parroquia') then
    raise exception 'Nivel territorial inválido';
  end if;

  if v_scope <> 'general' and p_scope_id is null then
    raise exception 'Debe seleccionar la entidad territorial del informe';
  end if;

  select name, city, coalesce(nullif(bishop_name,''), nullif(bishop,''), '')
    into v_diocese_name, v_city, v_bishop
  from public.dioceses where id=v_diocese;

  if v_scope='general' then
    v_scope_name := coalesce(v_diocese_name,'Jurisdicción diocesana');
    select array_agg(id) into v_parish_ids from public.parishes where diocese_id=v_diocese;
  elsif v_scope='vicaria' then
    select name into v_scope_name from public.vicarias where id=p_scope_id and diocese_id=v_diocese;
    if v_scope_name is null then raise exception 'Vicaría fuera de la jurisdicción'; end if;
    select array_agg(id) into v_parish_ids from public.parishes where diocese_id=v_diocese and vicary_id=p_scope_id;
  elsif v_scope='decanato' then
    select name into v_scope_name from public.decanatos where id=p_scope_id and diocese_id=v_diocese;
    if v_scope_name is null then raise exception 'Decanato fuera de la jurisdicción'; end if;
    select array_agg(id) into v_parish_ids from public.parishes
      where diocese_id=v_diocese and (decanate_id=p_scope_id or deanery_id=p_scope_id);
  else
    select name into v_scope_name from public.parishes where id=p_scope_id and diocese_id=v_diocese;
    if v_scope_name is null then raise exception 'Parroquia fuera de la jurisdicción'; end if;
    v_parish_ids := array[p_scope_id];
  end if;

  -- Un ámbito sin parroquias es válido y produce ceros.
  v_parish_ids := coalesce(v_parish_ids, array[]::uuid[]);

  with sacramental_events as (
    select 'bautismo'::text sacrament_type, b.id event_id, b.parish_id,
           b.celebration_date event_date,
           public.sacramentum_age_years(b.fecha_nacimiento,b.celebration_date) age1,
           null::integer age2
    from public.baptisms b
    where b.parish_id=any(v_parish_ids)
      and b.celebration_date is not null
      and lower(coalesce(b.status,'seated')) not in ('anulada','anulado','annulled','reverted','cancelled','deleted')

    union all
    select 'confirmacion', c.id, c.parish_id, c.celebration_date,
           public.sacramentum_age_years(c.fecha_nacimiento,c.celebration_date), null::integer
    from public.confirmations c
    where c.parish_id=any(v_parish_ids)
      and c.celebration_date is not null
      and lower(coalesce(c.status,'seated')) not in ('anulada','anulado','annulled','reverted','cancelled','deleted')

    union all
    select 'matrimonio', m.id, m.parish_id, m.celebration_date,
           public.sacramentum_age_years(
             coalesce(ph.birth_date,
               public.sacramentum_safe_date(coalesce(m.raw_data->>'fecnac1',m.raw_data->>'birth_date_1',m.raw_data->>'husbandBirthDate',m.raw_data->>'fechaNacimientoNovio'))),
             m.celebration_date),
           public.sacramentum_age_years(
             coalesce(pw.birth_date,
               public.sacramentum_safe_date(coalesce(m.raw_data->>'fecnac2',m.raw_data->>'birth_date_2',m.raw_data->>'wifeBirthDate',m.raw_data->>'fechaNacimientoNovia'))),
             m.celebration_date)
    from public.marriages m
    left join public.parishioners ph on ph.id=m.husband_id
    left join public.parishioners pw on pw.id=m.wife_id
    where m.parish_id=any(v_parish_ids)
      and m.celebration_date is not null
      and lower(coalesce(m.status,'seated')) not in ('reverted','cancelled','deleted')

    union all
    select 'exequias', f.id, f.parish_id, coalesce(f.fecha_exequias,f.fecha_defuncion),
           public.sacramentum_age_years(f.fecha_nacimiento,f.fecha_defuncion), null::integer
    from public.funerals f
    where f.parish_id=any(v_parish_ids)
      and coalesce(f.fecha_exequias,f.fecha_defuncion) is not null
      and lower(coalesce(f.status,'seated')) not in ('anulada','anulado','annulled','reverted','cancelled','deleted')
  ),
  filtered as (
    select e.*
    from sacramental_events e
    where extract(year from e.event_date)::int between p_year_from and p_year_to
      and (
        (p_age_min is null and p_age_max is null)
        or (
          e.sacrament_type <> 'matrimonio'
          and e.age1 is not null
          and (p_age_min is null or e.age1 >= p_age_min)
          and (p_age_max is null or e.age1 <= p_age_max)
        )
        or (
          e.sacrament_type='matrimonio'
          and (
            (e.age1 is not null and (p_age_min is null or e.age1>=p_age_min) and (p_age_max is null or e.age1<=p_age_max))
            or
            (e.age2 is not null and (p_age_min is null or e.age2>=p_age_min) and (p_age_max is null or e.age2<=p_age_max))
          )
        )
      )
  ), years as (
    select generate_series(p_year_from,p_year_to) y
  ), sacrament_types as (
    select unnest(array['bautismo','confirmacion','matrimonio','exequias']) s
  ), annual as (
    select
  y.y as "year",
  s.s as sacrament_type,
  count(f.event_id)::int as total
    from years y cross join sacrament_types s
    left join filtered f on extract(year from f.event_date)::int=y.y and f.sacrament_type=s.s
    group by y.y,s.s order by y.y,s.s
  ), persons as (
    select sacrament_type, event_date, age1 age_years from filtered where age1 is not null
    union all
    select sacrament_type, event_date, age2 from filtered where sacrament_type='matrimonio' and age2 is not null
  ), age_bands as (
    select * from (values
      (1,'0–6 años',0,6),
      (2,'7–12 años',7,12),
      (3,'13–17 años',13,17),
      (4,'18–29 años',18,29),
      (5,'30–44 años',30,44),
      (6,'45–59 años',45,59),
      (7,'60 años o más',60,200)
    ) x(ord,label,min_age,max_age)
  ), ages as (
    select extract(year from p.event_date)::int as "year", p.sacrament_type, ab.ord, ab.label,
           count(*)::int persons
    from persons p join age_bands ab on p.age_years between ab.min_age and ab.max_age
    group by extract(year from p.event_date)::int,p.sacrament_type,ab.ord,ab.label
    order by "year",sacrament_type,ab.ord
  )
  select
    coalesce(
  (
    select jsonb_agg(
      to_jsonb(a)
      order by a."year", a.sacrament_type
    )
    from annual a
  ),
  '[]'::jsonb
),

coalesce(
  (
    select jsonb_agg(
      jsonb_build_object(
        'year', x."year",
        'sacrament_type', x.sacrament_type,
        'band', x.label,
        'persons', x.persons
      )
      order by x."year", x.sacrament_type, x.ord
    )
    from ages x
  ),
  '[]'::jsonb
), order by x.year,x.sacrament_type,x.ord) from ages x),'[]'::jsonb),
    jsonb_build_object(
      'bautismo', (select count(*) from filtered where sacrament_type='bautismo'),
      'confirmacion', (select count(*) from filtered where sacrament_type='confirmacion'),
      'matrimonio', (select count(*) from filtered where sacrament_type='matrimonio'),
      'exequias', (select count(*) from filtered where sacrament_type='exequias'),
      'total', (select count(*) from filtered)
    )
  into v_counts,v_ages,v_totals;

  select document_number into v_report_number
  from public.next_document_sequence(v_diocese,'diocesan_sacramental_report','INF') limit 1;

  insert into public.diocesan_report_runs(diocese_id,report_number,generated_by,filters,summary)
  values (
    v_diocese,v_report_number,auth.uid(),
    jsonb_build_object(
      'year_from',p_year_from,'year_to',p_year_to,'scope_type',v_scope,'scope_id',p_scope_id,
      'scope_name',v_scope_name,'age_min',p_age_min,'age_max',p_age_max
    ),v_totals
  ) returning id into v_report_id;

  insert into public.registry_audit_log(
    actor_user_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values (
    auth.uid(),v_diocese,'diocesan_report',v_report_id,'generate_diocesan_sacramental_report',
    v_totals,
    jsonb_build_object('report_number',v_report_number,'scope_type',v_scope,'scope_name',v_scope_name,'year_from',p_year_from,'year_to',p_year_to)
  );

  return jsonb_build_object(
    'report_id',v_report_id,
    'report_number',v_report_number,
    'generated_at',now(),
    'diocese',jsonb_build_object('id',v_diocese,'name',v_diocese_name,'city',v_city,'bishop',v_bishop),
    'scope',jsonb_build_object('type',v_scope,'id',p_scope_id,'name',v_scope_name,'parish_count',cardinality(v_parish_ids)),
    'filters',jsonb_build_object('year_from',p_year_from,'year_to',p_year_to,'age_min',p_age_min,'age_max',p_age_max),
    'totals',v_totals,
    'annual_counts',v_counts,
    'age_distribution',v_ages
  );
end;
$$;

revoke all on function public.generate_diocesan_sacramental_report(integer,integer,text,uuid,integer,integer) from public;
grant execute on function public.generate_diocesan_sacramental_report(integer,integer,text,uuid,integer,integer) to authenticated;

comment on table public.diocesan_report_runs is 'Historial auditable de informes estadísticos sacramentales generados por Diócesis/Arquidiócesis.';
comment on function public.generate_diocesan_sacramental_report(integer,integer,text,uuid,integer,integer) is 'Genera acta estadística sacramental agregada por año, territorio y rango opcional de edades.';
