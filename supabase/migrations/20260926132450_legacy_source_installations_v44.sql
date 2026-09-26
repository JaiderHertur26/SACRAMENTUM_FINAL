-- SACRAMENTUM V44 · Identidad de instalaciones SACRAMENTA legacy
-- Preserva una instalación antigua completa antes de vincularla a una parroquia moderna.

create table if not exists public.legacy_source_installations (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'SACRAMENTA_PLUS',
  identity_key text not null,
  installation_code text,
  serial text,
  source_path text,
  legacy_parish_name text not null,
  legacy_diocese_name text,
  legacy_city text,
  legacy_nit text,
  legacy_address text,
  legacy_phone text,
  legacy_email text,
  legacy_bishop text,
  legacy_chancellor text,
  mapped_parish_id uuid references public.parishes(id) on delete set null,
  mapped_diocese_id uuid references public.dioceses(id) on delete set null,
  mapping_status text not null default 'unmapped',
  raw_metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legacy_source_installations_status_ck
    check (mapping_status in ('unmapped','mapped','review'))
);
create unique index if not exists uq_legacy_source_installation_identity
  on public.legacy_source_installations(source_system,identity_key);

create index if not exists idx_legacy_source_installations_mapping
  on public.legacy_source_installations(mapped_diocese_id,mapped_parish_id,mapping_status);

alter table public.legacy_import_batches
  add column if not exists source_installation_id uuid
  references public.legacy_source_installations(id) on delete set null;

alter table public.legacy_archive_records
  add column if not exists source_installation_id uuid
  references public.legacy_source_installations(id) on delete set null;

create index if not exists idx_legacy_batches_source_installation
  on public.legacy_import_batches(source_installation_id,created_at desc);

create index if not exists idx_legacy_archive_source_installation
  on public.legacy_archive_records(source_installation_id,profile_key);

alter table public.legacy_source_installations enable row level security;

drop policy if exists legacy_source_installations_select_scoped
  on public.legacy_source_installations;
create policy legacy_source_installations_select_scoped
on public.legacy_source_installations
for select to authenticated
using (
  public.current_app_role()='admin_general'
  or (
    public.current_app_role() in ('diocese','chancery')
    and mapped_diocese_id=public.current_app_diocese_id()
  )
);

revoke insert,update,delete on public.legacy_source_installations from authenticated;

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
create or replace function public.register_legacy_source_from_misdatos_v44(
  p_batch_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_batch public.legacy_import_batches%rowtype;
  v_row public.legacy_import_rows%rowtype;
  d jsonb;
  v_identity text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select * into v_batch
  from public.legacy_import_batches
  where id=p_batch_id;
  if not found then raise exception 'Lote legacy no encontrado'; end if;

  if upper(coalesce(v_batch.profile_key,'')) <> 'MISDATOS' then
    raise exception 'El lote no corresponde a MISDATOS';
  end if;

  if public.current_app_role() not in ('admin_general','diocese') then
    raise exception 'Rol no autorizado';
  end if;

  select * into v_row
  from public.legacy_import_rows
  where batch_id=p_batch_id
  order by row_number
  limit 1;
  if not found then raise exception 'MISDATOS no contiene filas'; end if;
  d:=coalesce(v_row.original_data,'{}'::jsonb);

  v_identity:=lower(concat_ws('|',
    coalesce(nullif(trim(d->>'serial'),''),'NO-SERIAL'),
    coalesce(nullif(trim(d->>'idcod'),''),'NO-CODE'),
    coalesce(nullif(trim(d->>'nombre'),''),'SIN-NOMBRE')
  ));

  insert into public.legacy_source_installations(
    source_system,identity_key,installation_code,serial,source_path,
    legacy_parish_name,legacy_diocese_name,legacy_city,legacy_nit,
    legacy_address,legacy_phone,legacy_email,legacy_bishop,legacy_chancellor,
    mapped_parish_id,mapped_diocese_id,mapping_status,raw_metadata,created_by
  ) values (
    coalesce(v_batch.source_system,'SACRAMENTA_PLUS'),
    v_identity,
    nullif(trim(d->>'idcod'),''),
    nullif(trim(d->>'serial'),''),
    nullif(trim(d->>'ruta'),''),
    coalesce(nullif(trim(d->>'nombre'),''),'INSTALACIÓN LEGACY SIN NOMBRE'),
    nullif(trim(d->>'diocesis'),''),
    nullif(trim(d->>'ciudad'),''),
    nullif(trim(d->>'nronit'),''),
    nullif(trim(d->>'direccion'),''),
    nullif(trim(d->>'telefono'),''),
    nullif(trim(d->>'email'),''),
    nullif(trim(d->>'obispo'),''),
    nullif(trim(d->>'canciller'),''),
    v_batch.parish_id,
    v_batch.diocese_id,
    case when v_batch.parish_id is null then 'unmapped' else 'mapped' end,
    d,
    auth.uid()
  )
  on conflict (source_system,identity_key) do update set
    installation_code=excluded.installation_code,
    serial=excluded.serial,
    source_path=excluded.source_path,
    legacy_parish_name=excluded.legacy_parish_name,
    legacy_diocese_name=excluded.legacy_diocese_name,
    legacy_city=excluded.legacy_city,
    legacy_nit=excluded.legacy_nit,
    legacy_address=excluded.legacy_address,
    legacy_phone=excluded.legacy_phone,
    legacy_email=excluded.legacy_email,
    legacy_bishop=excluded.legacy_bishop,
    legacy_chancellor=excluded.legacy_chancellor,
    raw_metadata=excluded.raw_metadata,
    updated_at=now()
  returning id into v_id;

  update public.legacy_import_batches
  set source_installation_id=v_id,
      metadata=coalesce(metadata,'{}'::jsonb)
        || jsonb_build_object('source_installation_id',v_id)
  where id=p_batch_id;

  update public.legacy_archive_records
  set source_installation_id=v_id
  where batch_id=p_batch_id;

  return v_id;
end;
$$;

revoke all on function public.register_legacy_source_from_misdatos_v44(uuid)
  from public,anon;
grant execute on function public.register_legacy_source_from_misdatos_v44(uuid)
  to authenticated;
create or replace function public.map_legacy_source_installation_v44(
  p_installation_id uuid,
  p_parish_id uuid
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_diocese uuid;
  v_role text;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if p_installation_id is null or p_parish_id is null then
    raise exception 'Instalación y parroquia son obligatorias';
  end if;

  select diocese_id into v_diocese
  from public.parishes
  where id=p_parish_id;
  if v_diocese is null then raise exception 'Parroquia destino no encontrada'; end if;

  v_role:=public.current_app_role();
  if v_role='admin_general' then
    null;
  elsif v_role='diocese' and v_diocese=public.current_app_diocese_id() then
    null;
  else
    raise exception 'No autorizado para vincular esta instalación';
  end if;

  update public.legacy_source_installations
  set mapped_parish_id=p_parish_id,
      mapped_diocese_id=v_diocese,
      mapping_status='mapped',
      updated_at=now()
  where id=p_installation_id;

  if not found then raise exception 'Instalación legacy no encontrada'; end if;
  update public.legacy_import_batches
  set parish_id=p_parish_id,
      diocese_id=v_diocese,
      metadata=coalesce(metadata,'{}'::jsonb)
        || jsonb_build_object(
          'owner_parish_id',p_parish_id,
          'archive_only_until_mapped',false
        )
  where source_installation_id=p_installation_id
    and parish_id is null;

  update public.legacy_archive_records
  set parish_id=p_parish_id,
      diocese_id=v_diocese
  where source_installation_id=p_installation_id
    and parish_id is null;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,
    action,after_data,metadata
  ) values (
    auth.uid(),p_parish_id,v_diocese,
    'legacy_source_installation',p_installation_id,
    'legacy_source_installation_mapped',
    jsonb_build_object(
      'mapped_parish_id',p_parish_id,
      'mapped_diocese_id',v_diocese
    ),
    '{}'::jsonb
  );
end;
$$;

revoke all on function public.map_legacy_source_installation_v44(uuid,uuid)
  from public,anon;
grant execute on function public.map_legacy_source_installation_v44(uuid,uuid)
  to authenticated;
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
set search_path='public'
as $$
declare
  v_id uuid;
  v_profile public.legacy_import_profiles%rowtype;
  v_diocese uuid:=p_diocese_id;
  v_parish uuid:=p_parish_id;
  v_installation uuid;
  v_installation_row public.legacy_source_installations%rowtype;
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
    v_installation:=nullif(p_metadata->>'source_installation_id','')::uuid;
  exception when others then
    raise exception 'Identificador de instalación legacy inválido';
  end;

  if v_installation is not null then
    select * into v_installation_row
    from public.legacy_source_installations
    where id=v_installation;
    if not found then raise exception 'Instalación legacy no encontrada'; end if;

    v_parish:=coalesce(v_parish,v_installation_row.mapped_parish_id);
    v_diocese:=coalesce(v_diocese,v_installation_row.mapped_diocese_id);
  end if;
  if v_parish is not null then
    select diocese_id into v_diocese
    from public.parishes
    where id=v_parish;
    if v_diocese is null then raise exception 'Parroquia propietaria no encontrada'; end if;

    if not public.can_manage_legacy_import(v_parish,v_diocese) then
      raise exception 'No autorizado para importar en esta parroquia';
    end if;
  else
    v_role:=public.current_app_role();

    if v_profile.requires_parish
       and v_installation is null
       and upper(v_profile.profile_key)<>'MISDATOS' then
      raise exception 'Seleccione parroquia propietaria o instalación legacy';
    end if;

    if v_role='admin_general' then
      null;
    elsif v_role='diocese'
       and v_diocese is not null
       and v_diocese=public.current_app_diocese_id() then
      null;
    else
      raise exception 'Sólo Administrador General puede preservar una instalación todavía no vinculada';
    end if;
  end if;

  insert into public.legacy_import_batches(
    source_system,source_name,original_filename,profile_key,sha256,
    parish_id,diocese_id,status,created_by,metadata,source_installation_id
  ) values(
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
        'archive_only_until_mapped',v_profile.requires_parish and v_parish is null
      ),
    v_installation
  ) returning id into v_id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,
    action,after_data,metadata
  ) values(
    auth.uid(),v_parish,v_diocese,
    'legacy_import_batch',v_id,
    'legacy_import_batch_created',
    jsonb_build_object(
      'filename',p_filename,
      'profile_key',v_profile.profile_key,
      'sha256',p_sha256,
      'owner_parish_id',v_parish,
      'source_installation_id',v_installation
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
    parish_id,diocese_id,target_entity,original_data,normalized_data,
    row_status,metadata,source_installation_id
  )
  select
    coalesce(v_batch.source_system,'SACRAMENTA_PLUS'),
    v_batch.profile_key,
    coalesce(v_batch.sha256,'NO-HASH'),
    coalesce(r.source_key,r.row_number::text),
    v_batch.id,
    r.id,
    v_batch.parish_id,
    v_batch.diocese_id,
    r.target_entity,
    r.original_data,
    r.normalized_data,
    r.status,
    jsonb_build_object(
      'filename',v_batch.original_filename,
      'issue_codes',r.issue_codes,
      'issue_details',r.issue_details
    ),
    v_batch.source_installation_id
  from public.legacy_import_rows r
  where r.batch_id=v_batch.id
  on conflict(source_system,profile_key,source_sha256,source_key)
  do update set
    batch_id=excluded.batch_id,
    row_id=excluded.row_id,
    parish_id=excluded.parish_id,
    diocese_id=excluded.diocese_id,
    target_entity=excluded.target_entity,
    original_data=excluded.original_data,
    normalized_data=excluded.normalized_data,
    row_status=excluded.row_status,
    metadata=excluded.metadata,
    source_installation_id=excluded.source_installation_id,
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

comment on table public.legacy_source_installations
is 'Identidad persistente de cada instalación SACRAMENTA antigua. Permite preservar todos sus datos antes de decidir su parroquia moderna.';
