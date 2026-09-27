alter table public.legacy_physical_source_artifacts
  add column if not exists parse_status text not null default 'parsed',
  add column if not exists parse_reason text,
  add column if not exists declared_record_count bigint,
  add column if not exists version_byte integer;

alter table public.legacy_physical_source_artifacts
  drop constraint if exists legacy_physical_source_artifacts_parse_status_ck;

alter table public.legacy_physical_source_artifacts
  add constraint legacy_physical_source_artifacts_parse_status_ck
  check (parse_status in ('parsed','binary_unparsed'));

create index if not exists idx_legacy_physical_artifact_parse_status
on public.legacy_physical_source_artifacts(parse_status);

create or replace function public.annotate_legacy_physical_artifact_v71(
  p_source_installation_id uuid,
  p_source_origin_id uuid,
  p_relative_path text,
  p_source_sha256 text,
  p_parse_status text,
  p_parse_reason text default null,
  p_declared_record_count bigint default null,
  p_version_byte integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_diocese uuid;
  v_owner uuid;
  v_artifact_id uuid;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  v_role:=public.current_app_role();
  v_diocese:=public.current_app_diocese_id();

  if v_role not in ('admin_general','diocese') then
    raise exception 'No autorizado para anotar artefactos físicos legacy';
  end if;

  select owner_diocese_id into v_owner
  from public.legacy_source_installations
  where id=p_source_installation_id;

  if v_owner is null then
    raise exception 'Instalación legacy no encontrada';
  end if;

  if v_role='diocese' and v_owner is distinct from v_diocese then
    raise exception 'La instalación legacy pertenece a otra jurisdicción';
  end if;

  if not exists (
    select 1
    from public.legacy_source_origins o
    where o.id=p_source_origin_id
      and o.source_installation_id=p_source_installation_id
  ) then
    raise exception 'Origen físico legacy no pertenece a la instalación';
  end if;

  if coalesce(p_parse_status,'') not in ('parsed','binary_unparsed') then
    raise exception 'Estado de parseo inválido';
  end if;

  update public.legacy_physical_source_artifacts
  set
    parse_status=p_parse_status,
    parse_reason=nullif(trim(coalesce(p_parse_reason,'')),''),
    declared_record_count=p_declared_record_count,
    version_byte=p_version_byte,
    metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'parse_status',p_parse_status,
      'parse_reason',nullif(trim(coalesce(p_parse_reason,'')),''),
      'declared_record_count',p_declared_record_count,
      'version_byte',p_version_byte,
      'parse_annotation_v71',true
    ),
    updated_at=now()
  where source_installation_id=p_source_installation_id
    and source_origin_id=p_source_origin_id
    and relative_path=p_relative_path
    and source_sha256=lower(trim(p_source_sha256))
  returning id into v_artifact_id;

  if v_artifact_id is null then
    raise exception 'Artefacto físico no encontrado para anotar';
  end if;

  return jsonb_build_object(
    'artifact_id',v_artifact_id,
    'parse_status',p_parse_status,
    'parse_reason',p_parse_reason,
    'declared_record_count',p_declared_record_count,
    'version_byte',p_version_byte
  );
end;
$$;

revoke all on function public.annotate_legacy_physical_artifact_v71(
  uuid,uuid,text,text,text,text,bigint,integer
) from public,anon;

grant execute on function public.annotate_legacy_physical_artifact_v71(
  uuid,uuid,text,text,text,text,bigint,integer
) to authenticated;

comment on function public.annotate_legacy_physical_artifact_v71(
  uuid,uuid,text,text,text,text,bigint,integer
) is 'V71: conserva el resultado de validación estructural de cada DBF físico sin forzar archivos binarios inválidos como tablas.';

create or replace function public.legacy_physical_archive_summary_v70(
  p_source_installation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_diocese uuid;
  v_owner uuid;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  v_role:=public.current_app_role();
  v_diocese:=public.current_app_diocese_id();

  select owner_diocese_id into v_owner
  from public.legacy_source_installations
  where id=p_source_installation_id;

  if v_owner is null then raise exception 'Instalación legacy no encontrada'; end if;
  if v_role<>'admin_general'
     and not (v_role in ('diocese','chancery') and v_owner=v_diocese) then
    raise exception 'No autorizado para consultar esta instalación';
  end if;

  select jsonb_build_object(
    'artifacts',count(*),
    'unique_dbf_hashes',count(distinct source_sha256),
    'artifacts_with_memo',count(*) filter (where memo_sha256 is not null),
    'parsed_artifacts',count(*) filter (where parse_status='parsed'),
    'binary_unparsed_artifacts',count(*) filter (where parse_status='binary_unparsed'),
    'physical_rows',coalesce(sum(row_count),0),
    'active_rows',coalesce(sum(active_rows),0),
    'deleted_rows',coalesce(sum(deleted_rows),0),
    'duplicate_artifacts',count(*)-count(distinct source_sha256),
    'linked_rows',(
      select count(*)
      from public.legacy_physical_source_rows r
      join public.legacy_physical_source_artifacts a on a.id=r.artifact_id
      where a.source_installation_id=p_source_installation_id
        and r.archive_record_id is not null
    ),
    'origins',(
      select coalesce(jsonb_agg(x order by x->>'origin_key'),'[]'::jsonb)
      from (
        select jsonb_build_object(
          'origin_key',o.origin_key,
          'display_name',o.display_name,
          'artifacts',count(a.id),
          'rows',coalesce(sum(a.row_count),0),
          'deleted_rows',coalesce(sum(a.deleted_rows),0),
          'binary_unparsed',count(a.id) filter (where a.parse_status='binary_unparsed')
        ) x
        from public.legacy_source_origins o
        left join public.legacy_physical_source_artifacts a
          on a.source_origin_id=o.id
        where o.source_installation_id=p_source_installation_id
        group by o.id,o.origin_key,o.display_name
      ) q
    )
  ) into v_result
  from public.legacy_physical_source_artifacts
  where source_installation_id=p_source_installation_id;

  return coalesce(v_result,'{}'::jsonb);
end;
$$;

revoke all on function public.legacy_physical_archive_summary_v70(uuid)
from public,anon;
grant execute on function public.legacy_physical_archive_summary_v70(uuid)
to authenticated;
