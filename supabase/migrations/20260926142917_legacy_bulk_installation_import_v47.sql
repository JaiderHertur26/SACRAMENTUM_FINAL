-- SACRAMENTUM V47 · Importación masiva de instalación legacy
-- Registra cada archivo fuente y permite cerrar un lote como preservado
-- sin obligar a materializarlo en una parroquia moderna.

create table if not exists public.legacy_source_files (
  id uuid primary key default gen_random_uuid(),
  source_installation_id uuid not null
    references public.legacy_source_installations(id) on delete cascade,
  batch_id uuid references public.legacy_import_batches(id) on delete set null,
  filename text not null,
  relative_path text,
  sha256 text,
  profile_key text,
  row_count integer not null default 0,
  source_size bigint,
  source_last_modified bigint,
  status text not null default 'preserved',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legacy_source_files_status_ck check (
    status in ('preserved','empty','staged','materialized','review','error')
  )
);

create unique index if not exists uq_legacy_source_files_installation_file
on public.legacy_source_files(source_installation_id, filename, coalesce(sha256,''));

create index if not exists idx_legacy_source_files_installation
on public.legacy_source_files(source_installation_id, profile_key, status, created_at desc);

alter table public.legacy_source_files enable row level security;
drop policy if exists legacy_source_files_select_scoped
on public.legacy_source_files;

create policy legacy_source_files_select_scoped
on public.legacy_source_files
for select to authenticated
using (
  public.current_app_role() = 'admin_general'
  or exists (
    select 1
    from public.legacy_source_installations s
    where s.id = source_installation_id
      and (
        s.owner_diocese_id = public.current_app_diocese_id()
        or (
          s.mapped_parish_id is not null
          and public.can_access_parish(s.mapped_parish_id)
        )
      )
  )
);

revoke insert, update, delete on public.legacy_source_files from authenticated;

create or replace function public.register_legacy_source_file_v47(
  p_source_installation_id uuid,
  p_batch_id uuid,
  p_filename text,
  p_relative_path text default null,
  p_sha256 text default null,
  p_profile_key text default null,
  p_row_count integer default 0,
  p_source_size bigint default null,
  p_source_last_modified bigint default null,
  p_status text default 'preserved',
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_source public.legacy_source_installations%rowtype;
  v_role text;
  v_id uuid;
  v_status text := lower(trim(coalesce(p_status,'preserved')));
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if p_source_installation_id is null then raise exception 'Instalación legacy requerida'; end if;
  if nullif(trim(coalesce(p_filename,'')),'') is null then raise exception 'Nombre de archivo requerido'; end if;
  if v_status not in ('preserved','empty','staged','materialized','review','error') then
    raise exception 'Estado de archivo legacy inválido';
  end if;

  select * into v_source
  from public.legacy_source_installations
  where id=p_source_installation_id;
  if not found then raise exception 'Instalación legacy no encontrada'; end if;

  v_role := public.current_app_role();
  if v_role='admin_general' then
    null;
  elsif v_role='diocese'
    and v_source.owner_diocese_id is not null
    and v_source.owner_diocese_id=public.current_app_diocese_id() then
    null;
  else
    raise exception 'No autorizado para registrar archivos de esta instalación';
  end if;

  if p_batch_id is not null and not exists(
    select 1 from public.legacy_import_batches b
    where b.id=p_batch_id
      and b.source_installation_id=p_source_installation_id
  ) then
    raise exception 'El lote no pertenece a la instalación legacy';
  end if;

  insert into public.legacy_source_files(
    source_installation_id,batch_id,filename,relative_path,sha256,profile_key,
    row_count,source_size,source_last_modified,status,metadata,created_by
  ) values (
    p_source_installation_id,p_batch_id,trim(p_filename),nullif(trim(coalesce(p_relative_path,'')),''),
    nullif(trim(coalesce(p_sha256,'')),''),upper(nullif(trim(coalesce(p_profile_key,'')),'')),
    greatest(coalesce(p_row_count,0),0),p_source_size,p_source_last_modified,v_status,
    coalesce(p_metadata,'{}'::jsonb),auth.uid()
  )
  on conflict(source_installation_id,filename,coalesce(sha256,''))
  do update set
    batch_id=coalesce(excluded.batch_id,public.legacy_source_files.batch_id),
    relative_path=coalesce(excluded.relative_path,public.legacy_source_files.relative_path),
    profile_key=coalesce(excluded.profile_key,public.legacy_source_files.profile_key),
    row_count=excluded.row_count,
    source_size=coalesce(excluded.source_size,public.legacy_source_files.source_size),
    source_last_modified=coalesce(excluded.source_last_modified,public.legacy_source_files.source_last_modified),
    status=excluded.status,
    metadata=public.legacy_source_files.metadata||excluded.metadata,
    updated_at=now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.register_legacy_source_file_v47(
  uuid,uuid,text,text,text,text,integer,bigint,bigint,text,jsonb
) from public,anon;
grant execute on function public.register_legacy_source_file_v47(
  uuid,uuid,text,text,text,text,integer,bigint,bigint,text,jsonb
) to authenticated;
create or replace function public.finalize_legacy_batch_preserved_v47(
  p_batch_id uuid,
  p_file_status text default 'preserved'
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_batch public.legacy_import_batches%rowtype;
  v_role text;
  v_status text := lower(trim(coalesce(p_file_status,'preserved')));
  v_total integer;
  v_review integer;
  v_error integer;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select * into v_batch
  from public.legacy_import_batches
  where id=p_batch_id
  for update;
  if not found then raise exception 'Lote legacy no encontrado'; end if;

  v_role := public.current_app_role();
  if v_role='admin_general' then
    null;
  elsif v_role='diocese'
    and v_batch.diocese_id is not null
    and v_batch.diocese_id=public.current_app_diocese_id() then
    null;
  else
    raise exception 'No autorizado para cerrar este lote';
  end if;

  select
    count(*),
    count(*) filter(where status='review'),
    count(*) filter(where status='error')
  into v_total,v_review,v_error
  from public.legacy_import_rows
  where batch_id=p_batch_id;

  update public.legacy_import_batches
  set status=case when v_review>0 or v_error>0 then 'completed_with_review' else 'completed' end,
      imported_count=0,
      valid_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='valid'),
      review_count=v_review,
      error_count=v_error,
      metadata=coalesce(metadata,'{}'::jsonb)
        || jsonb_build_object(
          'materialization_state','preserved_only',
          'preserved_at',now(),
          'archive_row_count',v_total
        ),
      updated_at=now()
  where id=p_batch_id;

  update public.legacy_source_files
  set status=case
        when row_count=0 then 'empty'
        when v_status in ('preserved','staged','review','error') then v_status
        else 'preserved'
      end,
      updated_at=now()
  where batch_id=p_batch_id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,
    action,after_data,metadata
  ) values (
    auth.uid(),v_batch.parish_id,v_batch.diocese_id,
    'legacy_import_batch',p_batch_id,'legacy_batch_preserved_v47',
    jsonb_build_object(
      'rows',v_total,
      'review',v_review,
      'errors',v_error,
      'materialization_state','preserved_only'
    ),
    jsonb_build_object(
      'profile_key',v_batch.profile_key,
      'source_installation_id',v_batch.source_installation_id
    )
  );

  return jsonb_build_object(
    'batch_id',p_batch_id,
    'rows',v_total,
    'review',v_review,
    'errors',v_error,
    'status',case when v_review>0 or v_error>0 then 'completed_with_review' else 'completed' end,
    'materialization_state','preserved_only'
  );
end;
$$;

revoke all on function public.finalize_legacy_batch_preserved_v47(uuid,text)
from public,anon;
grant execute on function public.finalize_legacy_batch_preserved_v47(uuid,text)
to authenticated;
create or replace function public.mark_legacy_source_file_materialized_v47(
  p_batch_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  v_batch public.legacy_import_batches%rowtype;
  v_count integer:=0;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select * into v_batch
  from public.legacy_import_batches
  where id=p_batch_id;
  if not found then raise exception 'Lote legacy no encontrado'; end if;

  if public.current_app_role()<>'admin_general' then
    if public.current_app_role()<>'diocese'
       or v_batch.diocese_id is distinct from public.current_app_diocese_id() then
      raise exception 'No autorizado para actualizar este archivo';
    end if;
  end if;

  update public.legacy_source_files
  set status='materialized',
      metadata=metadata||coalesce(p_metadata,'{}'::jsonb),
      updated_at=now()
  where batch_id=p_batch_id;
  get diagnostics v_count=row_count;

  update public.legacy_import_batches
  set metadata=coalesce(metadata,'{}'::jsonb)
    || jsonb_build_object('materialization_state','materialized'),
    updated_at=now()
  where id=p_batch_id;

  return v_count;
end;
$$;

revoke all on function public.mark_legacy_source_file_materialized_v47(uuid,jsonb)
from public,anon;
grant execute on function public.mark_legacy_source_file_materialized_v47(uuid,jsonb)
to authenticated;

comment on table public.legacy_source_files is
'Inventario íntegro de archivos pertenecientes a cada instalación SACRAMENTA legacy, incluyendo tablas vacías y archivos todavía sin mapeo.';
