-- SACRAMENTUM V70 · archivo físico canónico completo de SACRAMENTA.
-- Preserva cada DBF/FPT y cada fila física; deduplica sólo la capa lógica.

create table if not exists public.legacy_physical_source_artifacts (
  id uuid primary key default gen_random_uuid(),
  source_installation_id uuid not null
    references public.legacy_source_installations(id) on delete cascade,
  source_origin_id uuid not null
    references public.legacy_source_origins(id) on delete cascade,
  relative_path text not null,
  filename text not null,
  profile_key text,
  source_sha256 text not null,
  memo_filename text,
  memo_sha256 text,
  row_count integer not null default 0,
  active_rows integer not null default 0,
  deleted_rows integer not null default 0,
  field_schema jsonb not null default '[]'::jsonb,
  status text not null default 'archived',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legacy_physical_source_artifacts_status_ck
    check (status in ('preserved','archiving','archived','review','error'))
);

create unique index if not exists uq_legacy_physical_artifact_identity
on public.legacy_physical_source_artifacts(
  source_installation_id, source_origin_id, relative_path, source_sha256
);

create index if not exists idx_legacy_physical_artifact_origin
on public.legacy_physical_source_artifacts(source_origin_id, profile_key, status);

create index if not exists idx_legacy_physical_artifact_hash
on public.legacy_physical_source_artifacts(source_sha256);

create table if not exists public.legacy_physical_source_rows (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null
    references public.legacy_physical_source_artifacts(id) on delete cascade,
  row_number integer not null,
  is_deleted boolean not null default false,
  record_sha256 text not null,
  original_data jsonb not null default '{}'::jsonb,
  archive_record_id uuid
    references public.legacy_archive_records(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legacy_physical_source_rows_row_number_ck check (row_number > 0)
);

create unique index if not exists uq_legacy_physical_row_identity
on public.legacy_physical_source_rows(artifact_id,row_number);

create index if not exists idx_legacy_physical_row_hash
on public.legacy_physical_source_rows(record_sha256);

create index if not exists idx_legacy_physical_row_archive
on public.legacy_physical_source_rows(archive_record_id)
where archive_record_id is not null;

alter table public.legacy_physical_source_artifacts enable row level security;
alter table public.legacy_physical_source_rows enable row level security;
drop policy if exists legacy_physical_artifacts_select_v70
on public.legacy_physical_source_artifacts;

create policy legacy_physical_artifacts_select_v70
on public.legacy_physical_source_artifacts
for select to authenticated
using (
  public.current_app_role()='admin_general'
  or exists (
    select 1
    from public.legacy_source_installations s
    where s.id=source_installation_id
      and public.current_app_role() in ('diocese','chancery')
      and s.owner_diocese_id=public.current_app_diocese_id()
  )
  or exists (
    select 1
    from public.legacy_source_origins o
    where o.id=source_origin_id
      and o.mapped_parish_id is not null
      and public.can_access_parish(o.mapped_parish_id)
  )
);

drop policy if exists legacy_physical_rows_select_v70
on public.legacy_physical_source_rows;

create policy legacy_physical_rows_select_v70
on public.legacy_physical_source_rows
for select to authenticated
using (
  exists (
    select 1
    from public.legacy_physical_source_artifacts a
    join public.legacy_source_installations s on s.id=a.source_installation_id
    left join public.legacy_source_origins o on o.id=a.source_origin_id
    where a.id=artifact_id
      and (
        public.current_app_role()='admin_general'
        or (
          public.current_app_role() in ('diocese','chancery')
          and s.owner_diocese_id=public.current_app_diocese_id()
        )
        or (
          o.mapped_parish_id is not null
          and public.can_access_parish(o.mapped_parish_id)
        )
      )
  )
);

revoke all on public.legacy_physical_source_artifacts from anon;
revoke all on public.legacy_physical_source_rows from anon;
revoke insert,update,delete on public.legacy_physical_source_artifacts from authenticated;
revoke insert,update,delete on public.legacy_physical_source_rows from authenticated;
grant select on public.legacy_physical_source_artifacts to authenticated;
grant select on public.legacy_physical_source_rows to authenticated;
create or replace function public.ingest_legacy_physical_artifact_v70(
  p_source_installation_id uuid,
  p_source_origin_id uuid,
  p_artifact jsonb,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_diocese uuid;
  v_owner_diocese uuid;
  v_origin public.legacy_source_origins%rowtype;
  v_logical_origin_id uuid;
  v_artifact_id uuid;
  v_profile text;
  v_source_sha text;
  v_relative_path text;
  v_filename text;
  v_row jsonb;
  v_row_number integer;
  v_deleted boolean;
  v_record_sha text;
  v_archive_id uuid;
  v_parish uuid;
  v_inserted integer := 0;
  v_linked integer := 0;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  v_role:=public.current_app_role();
  v_diocese:=public.current_app_diocese_id();

  if v_role not in ('admin_general','diocese') then
    raise exception 'No autorizado para archivar fuentes físicas legacy';
  end if;

  select owner_diocese_id into v_owner_diocese
  from public.legacy_source_installations
  where id=p_source_installation_id;

  if v_owner_diocese is null then
    raise exception 'Instalación legacy no encontrada o sin jurisdicción propietaria';
  end if;

  if v_role='diocese' and v_owner_diocese is distinct from v_diocese then
    raise exception 'La instalación legacy pertenece a otra jurisdicción';
  end if;

  select * into v_origin
  from public.legacy_source_origins
  where id=p_source_origin_id
    and source_installation_id=p_source_installation_id;

  if v_origin.id is null then
    raise exception 'Origen físico legacy no pertenece a la instalación';
  end if;

  if p_artifact is null or jsonb_typeof(p_artifact)<>'object' then
    raise exception 'Metadatos de artefacto inválidos';
  end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' then
    raise exception 'Las filas físicas deben enviarse como arreglo JSON';
  end if;

  v_profile:=upper(trim(coalesce(p_artifact->>'profileKey','LEGACY_ARCHIVE')));
  v_source_sha:=lower(trim(coalesce(p_artifact->>'sourceSha256','')));
  v_relative_path:=trim(coalesce(p_artifact->>'relativePath',''));
  v_filename:=trim(coalesce(p_artifact->>'sourceFilename',''));

  if v_source_sha='' or v_relative_path='' or v_filename='' then
    raise exception 'Ruta, archivo y SHA-256 son obligatorios';
  end if;

  insert into public.legacy_physical_source_artifacts(
    source_installation_id,source_origin_id,relative_path,filename,profile_key,
    source_sha256,memo_filename,memo_sha256,row_count,active_rows,deleted_rows,
    field_schema,status,metadata,created_by
  ) values (
    p_source_installation_id,p_source_origin_id,v_relative_path,v_filename,v_profile,
    v_source_sha,nullif(p_artifact->>'memoFilename',''),
    nullif(lower(p_artifact->>'memoSha256'),''),
    greatest(coalesce((p_artifact->>'headerRecordCount')::integer,0),0),
    greatest(coalesce((p_artifact->>'activeRows')::integer,0),0),
    greatest(coalesce((p_artifact->>'deletedRows')::integer,0),0),
    coalesce(p_artifact->'fields','[]'::jsonb),'archived',
    jsonb_build_object(
      'schema_version',p_artifact->>'schemaVersion',
      'source_archive',p_artifact->>'sourceArchive',
      'origin_key',p_artifact->>'originKey',
      'header_length',p_artifact->'headerLength',
      'record_length',p_artifact->'recordLength',
      'canonical_full_source_v70',true
    ),
    auth.uid()
  )
  on conflict (source_installation_id,source_origin_id,relative_path,source_sha256)
  do update set
    memo_filename=excluded.memo_filename,
    memo_sha256=excluded.memo_sha256,
    row_count=excluded.row_count,
    active_rows=excluded.active_rows,
    deleted_rows=excluded.deleted_rows,
    field_schema=excluded.field_schema,
    status='archived',
    metadata=public.legacy_physical_source_artifacts.metadata||excluded.metadata,
    updated_at=now()
  returning id into v_artifact_id;

  v_logical_origin_id:=v_origin.id;
  if nullif(v_origin.metadata->>'duplicate_family','') is not null then
    select id into v_logical_origin_id
    from public.legacy_source_origins
    where source_installation_id=p_source_installation_id
      and origin_key=v_origin.metadata->>'duplicate_family'
    limit 1;
    v_logical_origin_id:=coalesce(v_logical_origin_id,v_origin.id);
  end if;

  select mapped_parish_id into v_parish
  from public.legacy_source_origins
  where id=v_logical_origin_id;
  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_row_number:=coalesce((v_row->>'_row_number')::integer,0);
    v_deleted:=coalesce((v_row->>'_deleted')::boolean,false);
    v_record_sha:=lower(trim(coalesce(v_row->>'_record_sha256','')));

    if v_row_number<1 or v_record_sha='' then
      raise exception 'Fila física inválida en %',v_relative_path;
    end if;

    insert into public.legacy_archive_records(
      source_system,profile_key,source_sha256,source_key,
      parish_id,diocese_id,target_entity,original_data,normalized_data,
      row_status,reconciliation_status,metadata,
      source_installation_id,source_origin_id
    ) values (
      'SACRAMENTA_CANONICAL_V70',v_profile,v_source_sha,
      concat(v_profile,'|',v_source_sha,'|ROW:',lpad(v_row_number::text,8,'0'),'|',v_record_sha),
      v_parish,v_owner_diocese,'legacy_archive',
      v_row,'{}'::jsonb,
      case when v_deleted then 'deleted' else 'archived' end,
      'archived',
      jsonb_build_object(
        'canonical_full_source_v70',true,
        'record_sha256',v_record_sha,
        'logical_origin_id',v_logical_origin_id,
        'first_physical_artifact_id',v_artifact_id
      ),
      p_source_installation_id,v_logical_origin_id
    )
    on conflict (source_system,profile_key,source_sha256,source_key)
    do update set
      metadata=public.legacy_archive_records.metadata||jsonb_build_object(
        'physical_duplicate_seen',true,
        'last_physical_artifact_id',v_artifact_id,
        'last_seen_at',now()
      ),
      updated_at=now()
    returning id into v_archive_id;

    insert into public.legacy_physical_source_rows(
      artifact_id,row_number,is_deleted,record_sha256,original_data,
      archive_record_id,metadata
    ) values (
      v_artifact_id,v_row_number,v_deleted,v_record_sha,v_row,v_archive_id,
      jsonb_build_object(
        'canonical_full_source_v70',true,
        'origin_key',v_origin.origin_key,
        'logical_origin_id',v_logical_origin_id
      )
    )
    on conflict (artifact_id,row_number)
    do update set
      is_deleted=excluded.is_deleted,
      record_sha256=excluded.record_sha256,
      original_data=excluded.original_data,
      archive_record_id=excluded.archive_record_id,
      metadata=public.legacy_physical_source_rows.metadata||excluded.metadata,
      updated_at=now();

    v_inserted:=v_inserted+1;
    if v_archive_id is not null then v_linked:=v_linked+1; end if;
  end loop;

  return jsonb_build_object(
    'artifact_id',v_artifact_id,
    'physical_rows',v_inserted,
    'logical_links',v_linked,
    'profile_key',v_profile,
    'origin_key',v_origin.origin_key,
    'logical_origin_id',v_logical_origin_id
  );
end;
$$;

revoke all on function public.ingest_legacy_physical_artifact_v70(uuid,uuid,jsonb,jsonb)
from public,anon;
grant execute on function public.ingest_legacy_physical_artifact_v70(uuid,uuid,jsonb,jsonb)
to authenticated;
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
          'deleted_rows',coalesce(sum(a.deleted_rows),0)
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

comment on table public.legacy_physical_source_artifacts is
'V70: inventario inmutable de cada DBF/FPT físico de SACRAMENTA.';
comment on table public.legacy_physical_source_rows is
'V70: copia exacta de cada fila física DBF, incluso eliminada, enlazada a su registro lógico canónico.';
comment on function public.ingest_legacy_physical_artifact_v70(uuid,uuid,jsonb,jsonb) is
'V70: ingesta idempotente de artefactos físicos y filas canónicas, con deduplicación lógica por hash.';
