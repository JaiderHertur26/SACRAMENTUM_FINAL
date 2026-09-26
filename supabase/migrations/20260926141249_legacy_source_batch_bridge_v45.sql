-- SACRAMENTUM V45 · Puente entre instalación legacy y Centro de Migración
-- Separación estricta: preservar siempre; materializar sólo con parroquia verificada.

alter table public.legacy_import_batches
  add column if not exists source_installation_id uuid
  references public.legacy_source_installations(id) on delete set null;

create index if not exists idx_legacy_import_batches_source_installation
  on public.legacy_import_batches(source_installation_id,created_at desc);

insert into public.legacy_import_profiles(
  profile_key,display_name,target_entity,import_mode,
  requires_parish,mapping,validation_rules,active
) values
('NTCON001','Notas marginales históricas de Confirmación','legacy_marginal_note','review',true,'{}','{}',true),
('NTDEF001','Notas marginales históricas de Exequias','legacy_marginal_note','review',true,'{}','{}',true),
('NTCOM001','Notas históricas de Primera Comunión · sólo archivo','legacy_archive','archive',true,'{}','{}',true),
('INSCOMUN','Inscripciones históricas de Primera Comunión · sólo archivo','legacy_archive','archive',true,'{}','{}',true),
('COMUNION','Primera Comunión histórica · sólo archivo','legacy_archive','archive',true,'{}','{}',true),
('PARAMETROS','Parámetros de instalación antigua · preservar','legacy_settings','archive',true,'{}','{}',true),
('PARTIDAS','Tabla PARTIDAS legacy · preservar','legacy_archive','archive',true,'{}','{}',true)
on conflict(profile_key) do update set
  display_name=excluded.display_name,
  target_entity=excluded.target_entity,
  import_mode=excluded.import_mode,
  requires_parish=excluded.requires_parish,
  active=true,
  updated_at=now();
create or replace function public.create_legacy_import_batch(
  p_filename text,
  p_profile_key text,
  p_sha256 text default null,
  p_source_name text default null,
  p_parish_id uuid default null,
  p_diocese_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
  v_profile public.legacy_import_profiles%rowtype;
  v_source public.legacy_source_installations%rowtype;
  v_source_id uuid;
  v_parish uuid:=p_parish_id;
  v_diocese uuid:=p_diocese_id;
  v_role text;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select * into v_profile
  from public.legacy_import_profiles
  where profile_key=upper(trim(p_profile_key))
    and active=true;
  if not found then
    raise exception 'Perfil de importación no soportado: %',p_profile_key;
  end if;

  begin
    v_source_id:=nullif(p_metadata->>'source_installation_id','')::uuid;
  exception when others then
    raise exception 'Identificador de instalación legacy inválido';
  end;

  if v_source_id is not null then
    select * into v_source
    from public.legacy_source_installations
    where id=v_source_id;
    if not found then raise exception 'Instalación legacy no encontrada'; end if;

    v_parish:=coalesce(v_parish,v_source.mapped_parish_id);
    v_diocese:=coalesce(v_diocese,v_source.owner_diocese_id);
  end if;
  v_role:=public.current_app_role();

  if v_parish is not null then
    select diocese_id into v_diocese
    from public.parishes
    where id=v_parish;
    if v_diocese is null then raise exception 'Parroquia propietaria no encontrada'; end if;

    if not public.can_manage_legacy_import(v_parish,v_diocese) then
      raise exception 'No autorizado para importar en esta parroquia';
    end if;
  else
    if v_profile.requires_parish and v_source_id is null then
      raise exception 'Este perfil requiere seleccionar parroquia o instalación legacy';
    end if;

    if v_role='admin_general' then
      null;
    elsif v_role='diocese'
      and v_diocese is not null
      and v_diocese=public.current_app_diocese_id() then
      null;
    else
      raise exception 'No autorizado para preservar esta fuente sin parroquia vinculada';
    end if;
  end if;

  insert into public.legacy_import_batches(
    source_system,source_name,original_filename,profile_key,sha256,
    parish_id,diocese_id,status,created_by,metadata,source_installation_id
  ) values (
    'SACRAMENTA_PLUS',
    nullif(trim(p_source_name),''),
    trim(p_filename),
    v_profile.profile_key,
    nullif(trim(p_sha256),''),
    v_parish,
    v_diocese,
    'staged',
    auth.uid(),
    coalesce(p_metadata,'{}'::jsonb)
      || jsonb_build_object(
        'owner_parish_id',v_parish,
        'source_installation_id',v_source_id,
        'archive_only_until_mapped',v_profile.requires_parish and v_parish is null
      ),
    v_source_id
  )
  returning id into v_id;
  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,
    action,after_data,metadata
  ) values (
    auth.uid(),v_parish,v_diocese,
    'legacy_import_batch',v_id,'legacy_import_batch_created',
    jsonb_build_object(
      'filename',p_filename,
      'profile_key',v_profile.profile_key,
      'sha256',p_sha256,
      'owner_parish_id',v_parish,
      'source_installation_id',v_source_id,
      'archive_only_until_mapped',v_profile.requires_parish and v_parish is null
    ),
    coalesce(p_metadata,'{}'::jsonb)
  );

  return v_id;
end;
$$;

revoke all on function public.create_legacy_import_batch(
  text,text,text,text,uuid,uuid,jsonb
) from public,anon;
grant execute on function public.create_legacy_import_batch(
  text,text,text,text,uuid,uuid,jsonb
) to authenticated;

create or replace function public.archive_legacy_batch_snapshot_v43(
  p_batch_id uuid
)
returns jsonb
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
      raise exception 'No autorizado para archivar este lote';
    end if;
  end if;

  insert into public.legacy_archive_records(
    source_system,profile_key,source_sha256,source_key,batch_id,row_id,
    source_installation_id,parish_id,diocese_id,target_entity,
    original_data,normalized_data,row_status,reconciliation_status,metadata
  )
  select
    coalesce(v_batch.source_system,'SACRAMENTA_PLUS'),
    v_batch.profile_key,
    coalesce(v_batch.sha256,'NO-HASH'),
    coalesce(r.source_key,r.row_number::text),
    v_batch.id,
    r.id,
    v_batch.source_installation_id,
    v_batch.parish_id,
    v_batch.diocese_id,
    r.target_entity,
    r.original_data,
    r.normalized_data,
    r.status,
    case when v_batch.parish_id is null then 'source_unmapped' else 'archived' end,
    jsonb_build_object(
      'filename',v_batch.original_filename,
      'issue_codes',r.issue_codes,
      'issue_details',r.issue_details,
      'source_installation_id',v_batch.source_installation_id
    )
  from public.legacy_import_rows r
  where r.batch_id=v_batch.id
  on conflict(source_system,profile_key,source_sha256,source_key)
  do update set
    batch_id=excluded.batch_id,
    row_id=excluded.row_id,
    source_installation_id=excluded.source_installation_id,
    parish_id=coalesce(excluded.parish_id,public.legacy_archive_records.parish_id),
    diocese_id=coalesce(excluded.diocese_id,public.legacy_archive_records.diocese_id),
    target_entity=excluded.target_entity,
    original_data=excluded.original_data,
    normalized_data=excluded.normalized_data,
    row_status=excluded.row_status,
    reconciliation_status=case
      when excluded.parish_id is null then public.legacy_archive_records.reconciliation_status
      else excluded.reconciliation_status
    end,
    metadata=public.legacy_archive_records.metadata||excluded.metadata,
    updated_at=now();

  get diagnostics v_count=row_count;

  return jsonb_build_object(
    'archived',v_count,
    'batch_id',p_batch_id,
    'source_installation_id',v_batch.source_installation_id,
    'archive_only_until_mapped',v_batch.parish_id is null
  );
end;
$$;

revoke all on function public.archive_legacy_batch_snapshot_v43(uuid)
  from public,anon;
grant execute on function public.archive_legacy_batch_snapshot_v43(uuid)
  to authenticated;

create or replace function public.map_legacy_source_installation_v45(
  p_source_installation_id uuid,
  p_parish_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_source public.legacy_source_installations%rowtype;
  v_diocese uuid;
  v_role text;
  v_batches integer:=0;
  v_rows integer:=0;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select * into v_source
  from public.legacy_source_installations
  where id=p_source_installation_id
  for update;
  if not found then raise exception 'Instalación legacy no encontrada'; end if;

  select diocese_id into v_diocese
  from public.parishes
  where id=p_parish_id;
  if v_diocese is null then raise exception 'Parroquia destino no encontrada'; end if;

  v_role:=public.current_app_role();
  if v_role='admin_general' then
    null;
  elsif v_role='diocese'
    and v_diocese=public.current_app_diocese_id()
    and (
      v_source.owner_diocese_id is null
      or v_source.owner_diocese_id=public.current_app_diocese_id()
    ) then
    null;
  else
    raise exception 'No autorizado para vincular esta instalación';
  end if;

  update public.legacy_source_installations
  set mapped_parish_id=p_parish_id,
      owner_diocese_id=v_diocese,
      mapping_status='mapped',
      updated_at=now()
  where id=p_source_installation_id;

  update public.legacy_import_batches
  set parish_id=p_parish_id,
      diocese_id=v_diocese,
      metadata=coalesce(metadata,'{}'::jsonb)
        || jsonb_build_object(
          'owner_parish_id',p_parish_id,
          'archive_only_until_mapped',false
        ),
      updated_at=now()
  where source_installation_id=p_source_installation_id
    and parish_id is null;
  get diagnostics v_batches=row_count;

  update public.legacy_archive_records
  set parish_id=p_parish_id,
      diocese_id=v_diocese,
      reconciliation_status=case
        when reconciliation_status='source_unmapped' then 'archived'
        else reconciliation_status
      end,
      updated_at=now()
  where source_installation_id=p_source_installation_id;
  get diagnostics v_rows=row_count;
  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,
    action,after_data,metadata
  ) values (
    auth.uid(),p_parish_id,v_diocese,
    'legacy_source_installation',p_source_installation_id,
    'legacy_source_installation_mapped_v45',
    jsonb_build_object(
      'mapped_parish_id',p_parish_id,
      'batches_updated',v_batches,
      'archive_rows_updated',v_rows
    ),
    jsonb_build_object(
      'legacy_parish_name',v_source.legacy_parish_name,
      'source_key',v_source.source_key
    )
  );

  return jsonb_build_object(
    'source_installation_id',p_source_installation_id,
    'mapped_parish_id',p_parish_id,
    'batches_updated',v_batches,
    'archive_rows_updated',v_rows
  );
end;
$$;

revoke all on function public.map_legacy_source_installation_v45(uuid,uuid)
  from public,anon;
grant execute on function public.map_legacy_source_installation_v45(uuid,uuid)
  to authenticated;
