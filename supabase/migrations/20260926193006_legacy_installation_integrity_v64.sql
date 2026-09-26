-- SACRAMENTUM V64 · Diagnóstico integral de cada instalación SACRAMENTA legacy.

create or replace function public.legacy_installation_integrity_v64(
  p_source_installation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_source public.legacy_source_installations%rowtype;
  v_role text;
  v_diocese uuid;
  v_files integer := 0;
  v_binary integer := 0;
  v_json integer := 0;
  v_source_rows bigint := 0;
  v_archive_rows bigint := 0;
  v_profiles integer := 0;
  v_batches integer := 0;
  v_batch_rows bigint := 0;
  v_valid bigint := 0;
  v_review bigint := 0;
  v_errors bigint := 0;
  v_imported bigint := 0;
  v_materialized_rows bigint := 0;
  v_readiness integer := 0;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  select * into v_source from public.legacy_source_installations where id=p_source_installation_id;
  if not found then raise exception 'Instalación legacy no encontrada'; end if;

  v_role:=public.current_app_role();
  v_diocese:=public.current_app_diocese_id();
  if v_role='admin_general' then
    null;
  elsif v_role='diocese' and v_source.owner_diocese_id=v_diocese then
    null;
  elsif v_source.mapped_parish_id is not null and public.can_access_parish(v_source.mapped_parish_id) then
    null;
  else
    raise exception 'No autorizado para consultar esta instalación';
  end if;

  select
    count(*),
    count(*) filter(where storage_path is not null),
    count(*) filter(where lower(filename) like '%.json'),
    coalesce(sum(row_count),0)
  into v_files,v_binary,v_json,v_source_rows
  from public.legacy_source_files
  where source_installation_id=p_source_installation_id;

  select
    count(*),
    count(distinct profile_key)
  into v_archive_rows,v_profiles
  from public.legacy_archive_records
  where source_installation_id=p_source_installation_id;

  select
    count(*),
    coalesce(sum(row_count),0),
    coalesce(sum(valid_count),0),
    coalesce(sum(review_count),0),
    coalesce(sum(error_count),0),
    coalesce(sum(imported_count),0)
  into v_batches,v_batch_rows,v_valid,v_review,v_errors,v_imported
  from public.legacy_import_batches
  where source_installation_id=p_source_installation_id
     or metadata->>'source_installation_id'=p_source_installation_id::text;
  select count(*)
  into v_materialized_rows
  from public.legacy_import_rows r
  join public.legacy_import_batches b on b.id=r.batch_id
  where (
    b.source_installation_id=p_source_installation_id
    or b.metadata->>'source_installation_id'=p_source_installation_id::text
  )
  and r.target_id is not null;

  -- El índice no pretende sustituir la auditoría humana. Resume cobertura técnica.
  v_readiness :=
      (case when v_source.mapping_status='mapped' then 20 else 0 end)
    + (case when coalesce((v_source.metadata->>'verified_territory_v61')::boolean,false) then 15 else 0 end)
    + (case when v_archive_rows>0 then 20 else 0 end)
    + (case when v_profiles>0 then 10 else 0 end)
    + (case when v_batches>0 then 15 else 0 end)
    + (case when v_files>0 and v_binary=v_files then 20
            when v_files>0 and v_binary>0 then 10
            else 0 end);

  return jsonb_build_object(
    'installation_id',v_source.id,
    'source_name',coalesce(v_source.legacy_parish_name,v_source.source_name),
    'mapping_status',v_source.mapping_status,
    'mapped_parish_id',v_source.mapped_parish_id,
    'territory_verified',coalesce((v_source.metadata->>'verified_territory_v61')::boolean,false),
    'files',jsonb_build_object(
      'inventoried',v_files,
      'binary_preserved',v_binary,
      'binary_pending',greatest(v_files-v_binary,0),
      'json_files',v_json,
      'source_rows_declared',v_source_rows
    ),
    'archive',jsonb_build_object(
      'rows',v_archive_rows,
      'profiles',v_profiles,
      'canonical_rows',coalesce((v_source.metadata->>'canonical_rows')::bigint,0),
      'canonical_active_rows',coalesce((v_source.metadata->>'canonical_active_rows')::bigint,0),
      'canonical_deleted_rows',coalesce((v_source.metadata->>'canonical_deleted_rows')::bigint,0)
    ),
    'batches',jsonb_build_object(
      'count',v_batches,
      'rows',v_batch_rows,
      'valid',v_valid,
      'review',v_review,
      'errors',v_errors,
      'imported',v_imported,
      'target_rows',v_materialized_rows
    ),
    'readiness_percent',least(v_readiness,100),
    'ready_for_materialization',
      v_source.mapping_status='mapped'
      and coalesce((v_source.metadata->>'verified_territory_v61')::boolean,false)
      and v_archive_rows>0
      and v_batches>0,
    'binary_vault_complete',v_files>0 and v_binary=v_files,
    'needs_attention',jsonb_build_array(
      case when v_source.mapping_status<>'mapped' then 'Vincular instalación a parroquia moderna' end,
      case when not coalesce((v_source.metadata->>'verified_territory_v61')::boolean,false) then 'Verificar Vicaría y Decanato' end,
      case when v_archive_rows=0 then 'Construir Archivo Histórico Maestro' end,
      case when v_batches=0 then 'Preparar lotes canónicos' end,
      case when v_files>v_binary then format('Preservar %s archivo(s) fuente en bóveda binaria',v_files-v_binary) end,
      case when v_review>0 then format('Revisar %s fila(s) marcadas para revisión',v_review) end,
      case when v_errors>0 then format('Resolver %s error(es) de migración',v_errors) end
    )
  );
end;
$$;
revoke all on function public.legacy_installation_integrity_v64(uuid)
from public,anon;
grant execute on function public.legacy_installation_integrity_v64(uuid)
to authenticated;

comment on function public.legacy_installation_integrity_v64(uuid) is
'Diagnóstico técnico de cobertura legacy: identidad, territorio, archivo maestro, lotes, materialización y bóveda binaria.';
