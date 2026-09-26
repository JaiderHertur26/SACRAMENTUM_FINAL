-- SACRAMENTUM V59 · Comparación de snapshots legacy por instalación
-- Permite auditar pérdidas, vaciados y cambios entre copias históricas y actuales.

create or replace function public.compare_legacy_source_snapshots_v59(
  p_source_installation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.legacy_source_installations%rowtype;
  v_role text;
  v_diocese uuid;
  v_parish uuid;
  v_rows jsonb;
  v_summary jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select *
    into v_source
  from public.legacy_source_installations
  where id = p_source_installation_id;

  if v_source.id is null then
    raise exception 'Instalación legacy no encontrada';
  end if;

  v_role := public.current_app_role();
  v_diocese := public.current_app_diocese_id();
  v_parish := public.current_app_parish_id();

  if v_role = 'admin_general' then
    null;
  elsif v_role = 'diocese'
    and v_source.owner_diocese_id is not null
    and v_source.owner_diocese_id = v_diocese then
    null;
  elsif v_role = 'parish'
    and v_source.mapped_parish_id is not null
    and v_source.mapped_parish_id = v_parish then
    null;
  else
    raise exception 'No autorizado para comparar snapshots de esta instalación';
  end if;

  with grouped as (
    select
      upper(coalesce(profile_key, regexp_replace(filename, '\.[^.]+$', ''))) as profile_key,
      lower(coalesce(metadata->>'snapshot', 'unknown')) as snapshot,
      count(*)::integer as file_count,
      sum(coalesce(row_count,0))::integer as row_count,
      jsonb_agg(
        jsonb_build_object(
          'file_id', id,
          'filename', filename,
          'sha256', sha256,
          'row_count', row_count,
          'status', status,
          'source_path', metadata->>'source_path',
          'created_at', created_at
        )
        order by created_at
      ) as files
    from public.legacy_source_files
    where source_installation_id = p_source_installation_id
    group by 1,2
  ),
  profiles as (
    select distinct profile_key
    from grouped
  ),
  compared as (
    select
      p.profile_key,
      coalesce(h.file_count,0) historical_file_count,
      coalesce(c.file_count,0) current_file_count,
      coalesce(h.row_count,0) historical_rows,
      coalesce(c.row_count,0) current_rows,
      coalesce(c.row_count,0) - coalesce(h.row_count,0) row_delta,
      coalesce(h.files,'[]'::jsonb) historical_files,
      coalesce(c.files,'[]'::jsonb) current_files,
      case
        when coalesce(h.file_count,0)=0 and coalesce(c.file_count,0)>0 then 'current_only'
        when coalesce(c.file_count,0)=0 and coalesce(h.file_count,0)>0 then 'historical_only'
        when coalesce(h.row_count,0)=0 and coalesce(c.row_count,0)=0 then 'empty_both'
        when coalesce(h.row_count,0)=coalesce(c.row_count,0)
          and coalesce(h.files,'[]'::jsonb)::text = coalesce(c.files,'[]'::jsonb)::text then 'identical_manifest'
        when coalesce(h.row_count,0)=coalesce(c.row_count,0) then 'same_count_changed_file'
        when coalesce(c.row_count,0)<coalesce(h.row_count,0) then 'current_has_fewer_rows'
        when coalesce(c.row_count,0)>coalesce(h.row_count,0) then 'current_has_more_rows'
        else 'changed'
      end comparison_status
    from profiles p
    left join grouped h on h.profile_key=p.profile_key and h.snapshot='historical'
    left join grouped c on c.profile_key=p.profile_key and c.snapshot='current'
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'profile_key', profile_key,
        'historical_file_count', historical_file_count,
        'current_file_count', current_file_count,
        'historical_rows', historical_rows,
        'current_rows', current_rows,
        'row_delta', row_delta,
        'comparison_status', comparison_status,
        'historical_files', historical_files,
        'current_files', current_files
      )
      order by profile_key
    ), '[]'::jsonb)
  into v_rows
  from compared;

  with items as (
    select *
    from jsonb_to_recordset(v_rows) as x(
      profile_key text,
      historical_file_count integer,
      current_file_count integer,
      historical_rows integer,
      current_rows integer,
      row_delta integer,
      comparison_status text,
      historical_files jsonb,
      current_files jsonb
    )
  )
  select jsonb_build_object(
    'profiles', count(*),
    'historical_rows', coalesce(sum(historical_rows),0),
    'current_rows', coalesce(sum(current_rows),0),
    'profiles_with_loss', count(*) filter (
      where comparison_status in ('current_has_fewer_rows','historical_only')
    ),
    'profiles_with_growth', count(*) filter (
      where comparison_status in ('current_has_more_rows','current_only')
    ),
    'profiles_same_count_changed_file', count(*) filter (
      where comparison_status='same_count_changed_file'
    ),
    'profiles_empty_both', count(*) filter (
      where comparison_status='empty_both'
    )
  )
  into v_summary
  from items;

  return jsonb_build_object(
    'installation_id', v_source.id,
    'source_name', v_source.source_name,
    'legacy_parish_name', v_source.legacy_parish_name,
    'legacy_diocese_name', v_source.legacy_diocese_name,
    'mapping_status', v_source.mapping_status,
    'mapped_parish_id', v_source.mapped_parish_id,
    'summary', coalesce(v_summary,'{}'::jsonb),
    'profiles', v_rows
  );
end;
$$;

revoke all on function public.compare_legacy_source_snapshots_v59(uuid) from public;
revoke all on function public.compare_legacy_source_snapshots_v59(uuid) from anon;
grant execute on function public.compare_legacy_source_snapshots_v59(uuid) to authenticated;

comment on function public.compare_legacy_source_snapshots_v59(uuid)
is 'Compara manifiestos históricos y actuales de una instalación SACRAMENTA para detectar pérdidas, vaciados, crecimiento o cambios preservados por hash.';
