-- SACRAMENTUM V63 · Bóveda binaria inmutable de instalaciones SACRAMENTA.
-- Conserva físicamente archivos fuente DBF/FPT/DBC/DCX/FRX/FRT/JSON y cualquier otro original.

alter table public.legacy_source_files
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists content_type text,
  add column if not exists binary_preserved_at timestamptz;

create unique index if not exists uq_legacy_source_files_storage_object
on public.legacy_source_files(storage_bucket,storage_path)
where storage_path is not null;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('legacy-source-vault','legacy-source-vault',false,null,null)
on conflict(id) do update
set public=false,
    file_size_limit=null,
    allowed_mime_types=null;
create or replace function public.can_access_legacy_storage_path_v63(
  p_name text,
  p_write boolean default false
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_installation_id uuid;
  v_source public.legacy_source_installations%rowtype;
  v_role text;
  v_diocese uuid;
begin
  if auth.uid() is null then return false; end if;

  begin
    v_installation_id := split_part(coalesce(p_name,''),'/',1)::uuid;
  exception when others then
    return false;
  end;

  select * into v_source
  from public.legacy_source_installations
  where id=v_installation_id;
  if not found then return false; end if;

  v_role:=public.current_app_role();
  v_diocese:=public.current_app_diocese_id();

  if v_role='admin_general' then return true; end if;

  if v_role='diocese'
     and v_source.owner_diocese_id is not null
     and v_source.owner_diocese_id=v_diocese then
    return true;
  end if;

  if not p_write
     and v_source.mapped_parish_id is not null
     and public.can_access_parish(v_source.mapped_parish_id) then
    return true;
  end if;

  return false;
end;
$$;
revoke all on function public.can_access_legacy_storage_path_v63(text,boolean)
from public,anon;
grant execute on function public.can_access_legacy_storage_path_v63(text,boolean)
to authenticated;

drop policy if exists legacy_source_vault_select_v63 on storage.objects;
create policy legacy_source_vault_select_v63
on storage.objects
for select to authenticated
using (
  bucket_id='legacy-source-vault'
  and public.can_access_legacy_storage_path_v63(name,false)
);

drop policy if exists legacy_source_vault_insert_v63 on storage.objects;
create policy legacy_source_vault_insert_v63
on storage.objects
for insert to authenticated
with check (
  bucket_id='legacy-source-vault'
  and public.can_access_legacy_storage_path_v63(name,true)
);
create or replace function public.attach_legacy_source_blob_v63(
  p_source_file_id uuid,
  p_storage_path text,
  p_content_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_file public.legacy_source_files%rowtype;
  v_source public.legacy_source_installations%rowtype;
  v_role text;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if p_source_file_id is null then raise exception 'Archivo fuente requerido'; end if;
  if nullif(trim(coalesce(p_storage_path,'')),'') is null then
    raise exception 'Ruta de bóveda requerida';
  end if;

  select * into v_file
  from public.legacy_source_files
  where id=p_source_file_id;
  if not found then raise exception 'Archivo fuente legacy no encontrado'; end if;
  select * into v_source
  from public.legacy_source_installations
  where id=v_file.source_installation_id;

  v_role:=public.current_app_role();
  if v_role='admin_general' then
    null;
  elsif v_role='diocese'
    and v_source.owner_diocese_id is not null
    and v_source.owner_diocese_id=public.current_app_diocese_id() then
    null;
  else
    raise exception 'No autorizado para adjuntar binarios a esta instalación';
  end if;

  if split_part(p_storage_path,'/',1) <> v_file.source_installation_id::text then
    raise exception 'La ruta de bóveda no pertenece a la instalación';
  end if;

  if not exists(
    select 1 from storage.objects o
    where o.bucket_id='legacy-source-vault'
      and o.name=p_storage_path
  ) then
    raise exception 'El objeto binario aún no existe en la bóveda';
  end if;
  update public.legacy_source_files
  set storage_bucket='legacy-source-vault',
      storage_path=p_storage_path,
      content_type=nullif(trim(coalesce(p_content_type,'')),''),
      binary_preserved_at=coalesce(binary_preserved_at,now()),
      metadata=coalesce(metadata,'{}'::jsonb)
        || jsonb_build_object('binary_preserved',true),
      updated_at=now()
  where id=p_source_file_id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,
    action,after_data,metadata
  ) values (
    auth.uid(),v_source.mapped_parish_id,v_source.owner_diocese_id,
    'legacy_source_file',p_source_file_id,'legacy_binary_preserved_v63',
    jsonb_build_object(
      'storage_bucket','legacy-source-vault',
      'storage_path',p_storage_path,
      'sha256',v_file.sha256,
      'source_size',v_file.source_size
    ),
    jsonb_build_object(
      'source_installation_id',v_file.source_installation_id,
      'filename',v_file.filename,
      'relative_path',v_file.relative_path
    )
  );

  return jsonb_build_object(
    'source_file_id',p_source_file_id,
    'storage_bucket','legacy-source-vault',
    'storage_path',p_storage_path,
    'sha256',v_file.sha256,
    'preserved',true
  );
end;
$$;

revoke all on function public.attach_legacy_source_blob_v63(uuid,text,text)
from public,anon;
grant execute on function public.attach_legacy_source_blob_v63(uuid,text,text)
to authenticated;
comment on column public.legacy_source_files.storage_path is
'Ruta privada del archivo binario original en Storage. La bóveda conserva el original exacto; la normalización se realiza en derivados auditables.';

comment on function public.attach_legacy_source_blob_v63(uuid,text,text) is
'Vincula un archivo fuente inventariado con su copia binaria privada, validando instalación, rol y existencia física del objeto.';
