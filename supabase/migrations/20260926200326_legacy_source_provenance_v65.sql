-- SACRAMENTUM V65 · Proveniencia verificable de fuentes legacy.
-- Separa paquete, snapshot, parroquia de origen y destino moderno sin perder filas.

create table if not exists public.legacy_source_origins (
  id uuid primary key default gen_random_uuid(),
  source_installation_id uuid not null references public.legacy_source_installations(id) on delete cascade,
  origin_key text not null,
  origin_kind text not null,
  display_name text not null,
  physical_path text,
  legacy_parish_name text,
  mapped_parish_id uuid references public.parishes(id) on delete set null,
  identity_status text not null default 'pending',
  parent_origin_id uuid references public.legacy_source_origins(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_installation_id,origin_key)
);

create table if not exists public.legacy_source_origin_hashes (
  id uuid primary key default gen_random_uuid(),
  origin_id uuid not null references public.legacy_source_origins(id) on delete cascade,
  sha256 text not null,
  profile_key text,
  source_filename text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(origin_id,sha256)
);
alter table public.legacy_source_files
  add column if not exists source_origin_id uuid references public.legacy_source_origins(id) on delete set null;

alter table public.legacy_archive_records
  add column if not exists source_origin_id uuid references public.legacy_source_origins(id) on delete set null;

alter table public.legacy_import_batches
  add column if not exists source_origin_id uuid references public.legacy_source_origins(id) on delete set null;

create index if not exists idx_legacy_source_origins_installation
  on public.legacy_source_origins(source_installation_id,origin_kind,identity_status);
create index if not exists idx_legacy_origin_hashes_sha256
  on public.legacy_source_origin_hashes(sha256);
create index if not exists idx_legacy_source_files_origin
  on public.legacy_source_files(source_origin_id);
create index if not exists idx_legacy_archive_origin
  on public.legacy_archive_records(source_origin_id,profile_key);
create index if not exists idx_legacy_batches_origin
  on public.legacy_import_batches(source_origin_id,profile_key);

alter table public.legacy_source_origins enable row level security;
alter table public.legacy_source_origin_hashes enable row level security;
drop policy if exists legacy_source_origins_select_v65 on public.legacy_source_origins;
create policy legacy_source_origins_select_v65
on public.legacy_source_origins
for select to authenticated
using (
  public.current_app_role()='admin_general'
  or exists (
    select 1
    from public.legacy_source_installations s
    where s.id=source_installation_id
      and (
        (public.current_app_role()='diocese' and s.owner_diocese_id=public.current_app_diocese_id())
        or (mapped_parish_id is not null and public.can_access_parish(mapped_parish_id))
      )
  )
);

drop policy if exists legacy_origin_hashes_select_v65 on public.legacy_source_origin_hashes;
create policy legacy_origin_hashes_select_v65
on public.legacy_source_origin_hashes
for select to authenticated
using (
  exists (
    select 1 from public.legacy_source_origins o
    where o.id=origin_id
      and (
        public.current_app_role()='admin_general'
        or (public.current_app_role()='diocese'
            and exists (
              select 1 from public.legacy_source_installations s
              where s.id=o.source_installation_id
                and s.owner_diocese_id=public.current_app_diocese_id()
            ))
        or (o.mapped_parish_id is not null and public.can_access_parish(o.mapped_parish_id))
      )
  )
);
revoke all on public.legacy_source_origins from anon;
revoke all on public.legacy_source_origin_hashes from anon;
grant select on public.legacy_source_origins to authenticated;
grant select on public.legacy_source_origin_hashes to authenticated;

do $$
declare
  v_source uuid;
  v_maria uuid;
  v_santa uuid;
  v_global uuid;
  v_current uuid;
  v_p1 uuid;
  v_padre uuid;
  v_p4 uuid;
  v_shared uuid;
  v_mixed uuid;
begin
  select id into v_source
  from public.legacy_source_installations
  where source_key='SACRAMENTA_PLUS:4652-6019-8426-7223'
  order by created_at
  limit 1;

  if v_source is null then
    return;
  end if;

  select id into v_maria
  from public.parishes
  where diocese_id=(select owner_diocese_id from public.legacy_source_installations where id=v_source)
    and translate(upper(name),'ÁÉÍÓÚÑ','AEIOUN')='PARROQUIA MARIA AUXILIO DE LOS CRISTIANOS'
  limit 1;
  select id into v_santa
  from public.parishes
  where diocese_id=(select owner_diocese_id from public.legacy_source_installations where id=v_source)
    and translate(upper(name),'ÁÉÍÓÚÑ','AEIOUN')='PARROQUIA SANTA TERESITA DEL NINO JESUS'
  limit 1;

  insert into public.legacy_source_origins(
    source_installation_id,origin_key,origin_kind,display_name,physical_path,
    identity_status,metadata
  ) values (
    v_source,'distribution_global','distribution_package','SACRAMENTA · recursos globales',
    'D:\SACRAMENTA.zip','global',
    jsonb_build_object(
      'archive','D:\SACRAMENTA.zip',
      'purpose','Programa, reportes FRX/FRT, catálogos y recursos compartidos',
      'verified_v65',true
    )
  )
  on conflict(source_installation_id,origin_key) do update
  set display_name=excluded.display_name,
      physical_path=excluded.physical_path,
      identity_status=excluded.identity_status,
      metadata=legacy_source_origins.metadata||excluded.metadata,
      updated_at=now()
  returning id into v_global;

  insert into public.legacy_source_origins(
    source_installation_id,origin_key,origin_kind,display_name,physical_path,
    identity_status,metadata
  ) values (
    v_source,'current_empty_structure','current_installation',
    'Instalación operativa vacía','D:\SACRAMENTAPQUIA001','structural',
    jsonb_build_object('active_sacramental_rows',0,'verified_v65',true)
  )
  on conflict(source_installation_id,origin_key) do update
  set metadata=legacy_source_origins.metadata||excluded.metadata,updated_at=now()
  returning id into v_current;

  insert into public.legacy_source_origins(
    source_installation_id,origin_key,origin_kind,display_name,physical_path,
    legacy_parish_name,mapped_parish_id,identity_status,parent_origin_id,metadata
  ) values (
    v_source,'pquia001','parish_snapshot','PQUIA001 · María Auxilio de los Cristianos',
    'D:\SACRAMENTA.zip::SACRAMENTA/PQUIA001',
    'PARROQUIA MARÍA AUXILIO DE LOS CRISTIANOS',v_maria,'verified',v_global,
    jsonb_build_object(
      'identity_basis','Contenido sacramental: LUGBAU/LUGCON',
      'verified_v65',true
    )
  )
  on conflict(source_installation_id,origin_key) do update
  set mapped_parish_id=excluded.mapped_parish_id,
      legacy_parish_name=excluded.legacy_parish_name,
      identity_status='verified',
      metadata=legacy_source_origins.metadata||excluded.metadata,
      updated_at=now()
  returning id into v_p1;

  insert into public.legacy_source_origins(
    source_installation_id,origin_key,origin_kind,display_name,physical_path,
    legacy_parish_name,identity_status,parent_origin_id,metadata
  ) values (
    v_source,'pquia002_003','parish_snapshot_family',
    'PQUIA002 / PQUIA003 · Padre Misericordioso',
    'D:\SACRAMENTA.zip::SACRAMENTA/PQUIA002|PQUIA003',
    'PARROQUIA PADRE MISERICORDIOSO','verified_unmapped',v_global,
    jsonb_build_object(
      'duplicate_snapshot_family',true,
      'identity_basis','Contenido BAUTIZOS/INSBAUTI',
      'mapping_required_before_materialization',true,
      'verified_v65',true
    )
  )
  on conflict(source_installation_id,origin_key) do update
  set legacy_parish_name=excluded.legacy_parish_name,
      identity_status='verified_unmapped',
      metadata=legacy_source_origins.metadata||excluded.metadata,
      updated_at=now()
  returning id into v_padre;

  insert into public.legacy_source_origins(
    source_installation_id,origin_key,origin_kind,display_name,physical_path,
    legacy_parish_name,mapped_parish_id,identity_status,parent_origin_id,metadata
  ) values (
    v_source,'pquia004','parish_snapshot',
    'PQUIA004 · Santa Teresita del Niño Jesús',
    'D:\SACRAMENTA.zip::SACRAMENTA/PQUIA004',
    'PARROQUIA SANTA TERESITA DEL NIÑO JESUS',v_santa,'verified',v_global,
    jsonb_build_object(
      'identity_basis','MISDATOS.DBF + contenido sacramental',
      'verified_v65',true
    )
  )
  on conflict(source_installation_id,origin_key) do update
  set mapped_parish_id=excluded.mapped_parish_id,
      legacy_parish_name=excluded.legacy_parish_name,
      identity_status='verified',
      metadata=legacy_source_origins.metadata||excluded.metadata,
      updated_at=now()
  returning id into v_p4;

  insert into public.legacy_source_origins(
    source_installation_id,origin_key,origin_kind,display_name,physical_path,
    identity_status,parent_origin_id,metadata
  ) values (
    v_source,'shared_catalogs','shared_catalog',
    'Catálogos compartidos SACRAMENTA',
    'D:\SACRAMENTA.zip','global',v_global,
    jsonb_build_object('scope','shared','verified_v65',true)
  )
  on conflict(source_installation_id,origin_key) do update
  set metadata=legacy_source_origins.metadata||excluded.metadata,updated_at=now()
  returning id into v_shared;

  insert into public.legacy_source_origins(
    source_installation_id,origin_key,origin_kind,display_name,physical_path,
    identity_status,parent_origin_id,metadata
  ) values (
    v_source,'mixed_conversion','mixed_conversion',
    'Snapshot compuesto de conversión',
    'D:\dbf_convert\dbf','mixed',v_global,
    jsonb_build_object(
      'mixed_from',jsonb_build_array('PQUIA001','PQUIA002','PQUIA003','PQUIA004','GLOBAL'),
      'do_not_use_as_parish_identity',true,
      'verified_by_sha256_v65',true
    )
  )
  on conflict(source_installation_id,origin_key) do update
  set identity_status='mixed',
      metadata=legacy_source_origins.metadata||excluded.metadata,
      updated_at=now()
  returning id into v_mixed;

  update public.legacy_source_files
  set source_origin_id=v_current,
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
        'provenance_v65','current_empty_structure'
      )
  where source_installation_id=v_source
    and relative_path like 'current_snapshot/%';
end $$;
do $$
declare
  v_source uuid;
begin
  select id into v_source
  from public.legacy_source_installations
  where source_key='SACRAMENTA_PLUS:4652-6019-8426-7223'
  order by created_at limit 1;
  if v_source is null then return; end if;

  insert into public.legacy_source_origin_hashes(origin_id,sha256,profile_key,source_filename,metadata)
  select o.id,m.sha256,m.profile_key,m.filename,
         jsonb_build_object('verified_by','SHA-256 comparison with D:\SACRAMENTA.zip','v65',true)
  from public.legacy_source_origins o
  join (
    values
      ('pquia001','04a529c5c81e08d5f8211012ad20e87f18f80f3b9493322cd1ca0df56c24a1c4','ANULACION','ANULACION.DBF'),
      ('pquia001','43437561b6f7743668e0a0ca7cc2acc9a20bc6ab7b4acbe4bb6cac22d15fd1de','BAUTIZOS','BAUTIZOS.DBF'),
      ('shared_catalogs','47df1f3b3dbcbd87c3817e1077f7a2dd326788eb35a6b05d7aea94a0d65b7ef8','CERTIFICADOS','CERTIFICADOS.DBF'),
      ('distribution_global','724787356edb2d417556ad04edc8e560efa03d8bf2c0384d4cf495c6f7ebc715','CIUDADES','CIUDADES.DBF'),
      ('pquia004','782147e2c3a7b2f2d38e9afe99c39aea670d83e027b84385fc9bb04ff912d5f7','CONFIRMA','CONFIRMA.DBF'),
      ('shared_catalogs','607b9378748f195d500192640885cfa33f055d83a86d5a75eefb2d5ca6b4532e','CPTOANULA','CPTOANULA.DBF'),
      ('shared_catalogs','6f4714f6af7d570cab100a512432ef60fe272c81ccdbf09d5cac07c5027fa15c','DIOCESIS','DIOCESIS.DBF'),
      ('shared_catalogs','d206cd89c6b473a9f0b0d225615f6b26958a0ab1b113d2490354194eff19e6dd','IGLESIAS','IGLESIAS.DBF'),
      ('pquia002_003','9889cfe77f9a6c1277a3e746f0c7a3833f47b46ee95621949eb1cadb826d8ba0','INSBAUTI','INSBAUTI.DBF')
  ) as m(origin_key,sha256,profile_key,filename)
    on o.source_installation_id=v_source and o.origin_key=m.origin_key
  on conflict(origin_id,sha256) do update
  set profile_key=excluded.profile_key,
      source_filename=excluded.source_filename,
      metadata=legacy_source_origin_hashes.metadata||excluded.metadata;
end $$;
do $$
declare
  v_source uuid;
begin
  select id into v_source
  from public.legacy_source_installations
  where source_key='SACRAMENTA_PLUS:4652-6019-8426-7223'
  order by created_at limit 1;
  if v_source is null then return; end if;

  insert into public.legacy_source_origin_hashes(origin_id,sha256,profile_key,source_filename,metadata)
  select o.id,m.sha256,m.profile_key,m.filename,
         jsonb_build_object('verified_by','SHA-256 comparison with D:\SACRAMENTA.zip','v65',true)
  from public.legacy_source_origins o
  join (
    values
      ('pquia004','e673a8e8cd60fe60424a698fca0d55f0e14a86dbd22f4dd28f61d57460944646','INSCOMUN','INSCOMUN.DBF'),
      ('pquia004','f0abb2deb65bb36e7e795bf4350e5c98f848d31bb0e4bf8b5e53c67ce857268b','INSCONFI','INSCONFI.DBF'),
      ('pquia004','633aa64cf68816098e749575150d442ad6356b454b8fc2b6548571be495441b3','MATRIMON','MATRIMON.DBF'),
      ('pquia004','06d2792915b46346c997a906ab13a421d8d608ed0eb918e689318b44eeeadde4','MISDATOS','MISDATOS.DBF'),
      ('pquia004','80cf25738880bfe7f5be853819ec9a2a257edd60074feb2defdff03b31679893','NTCON001','NTCON001.DBF'),
      ('pquia004','be7b853ae3de14719d4cc7bf2dd7efa4e3bc1d62a881ae6c61ac8364a719680c','NTMAT002','NTMAT002.DBF'),
      ('pquia002_003','e002f7de60f3450754786bbbdbe94c9fda4ce00d725a52ddf9d3ba6e3176297e','PARAMETROS','PARAMETROS.DBF'),
      ('pquia002_003','691af336e220541f54853ab6ce6dbff060ce74aab66cbe79659f1bb61629e26e','PARROCOS','PARROCOS.DBF')
  ) as m(origin_key,sha256,profile_key,filename)
    on o.source_installation_id=v_source and o.origin_key=m.origin_key
  on conflict(origin_id,sha256) do update
  set profile_key=excluded.profile_key,
      source_filename=excluded.source_filename,
      metadata=legacy_source_origin_hashes.metadata||excluded.metadata;
end $$;
create or replace function public.reconcile_legacy_provenance_v65(
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
  v_files integer:=0;
  v_archive integer:=0;
  v_batches integer:=0;
  v_blocked integer:=0;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  select * into v_source
  from public.legacy_source_installations
  where id=p_source_installation_id;
  if not found then raise exception 'Instalación legacy no encontrada'; end if;

  v_role:=public.current_app_role();
  if v_role='admin_general' then null;
  elsif v_role='diocese' and v_source.owner_diocese_id=public.current_app_diocese_id() then null;
  else raise exception 'No autorizado'; end if;

  update public.legacy_source_files f
  set source_origin_id=h.origin_id,
      metadata=coalesce(f.metadata,'{}'::jsonb)||jsonb_build_object(
        'provenance_v65',o.origin_key,
        'provenance_verified_by_sha256',true
      ),
      updated_at=now()
  from public.legacy_source_origin_hashes h
  join public.legacy_source_origins o on o.id=h.origin_id
  where f.source_installation_id=p_source_installation_id
    and f.sha256=h.sha256
    and o.source_installation_id=p_source_installation_id
    and f.relative_path like 'historical_snapshot/%';
  get diagnostics v_files=row_count;
  update public.legacy_archive_records a
  set source_origin_id=h.origin_id,
      parish_id=case
        when o.mapped_parish_id is not null then o.mapped_parish_id
        when o.identity_status in ('global','structural','mixed') then a.parish_id
        else null
      end,
      metadata=coalesce(a.metadata,'{}'::jsonb)||jsonb_build_object(
        'source_origin_key',o.origin_key,
        'source_origin_kind',o.origin_kind,
        'provenance_verified_v65',true
      ),
      updated_at=now()
  from public.legacy_source_origin_hashes h
  join public.legacy_source_origins o on o.id=h.origin_id
  where a.source_installation_id=p_source_installation_id
    and a.source_sha256=h.sha256
    and o.source_installation_id=p_source_installation_id;
  get diagnostics v_archive=row_count;

  with resolved as (
    select b.id batch_id,o.id origin_id,o.origin_key,o.identity_status,o.mapped_parish_id
    from public.legacy_import_batches b
    join lateral (
      select h.origin_id
      from public.legacy_source_origin_hashes h
      where exists (
        select 1
        from jsonb_array_elements_text(coalesce(b.metadata->'source_hashes','[]'::jsonb)) x(value)
        where x.value=h.sha256
      )
      limit 1
    ) x on true
    join public.legacy_source_origins o on o.id=x.origin_id
    where (
      b.source_installation_id=p_source_installation_id
      or b.metadata->>'source_installation_id'=p_source_installation_id::text
    )
  )
  update public.legacy_import_batches b
  set source_origin_id=r.origin_id,
      parish_id=case
        when r.mapped_parish_id is not null then r.mapped_parish_id
        when b.profile_key in (
          'BAUTIZOS','CONFIRMA','MATRIMON','DIFUNTOS',
          'INSBAUTI','INSCONFI','INSMATRI',
          'PARAMETROS','PARROCOS',
          'NTBAU001','NTBAU002','NTCON001','NTDEF001','NTMAT001','NTMAT002','ANULACION'
        ) then null
        else b.parish_id
      end,
      metadata=coalesce(b.metadata,'{}'::jsonb)||jsonb_build_object(
        'source_origin_key',r.origin_key,
        'source_identity_status',r.identity_status,
        'provenance_verified_v65',true,
        'provenance_blocked',
          (
            b.profile_key in (
              'BAUTIZOS','CONFIRMA','MATRIMON','DIFUNTOS',
              'INSBAUTI','INSCONFI','INSMATRI',
              'PARAMETROS','PARROCOS',
              'NTBAU001','NTBAU002','NTCON001','NTDEF001','NTMAT001','NTMAT002','ANULACION'
            )
            and r.mapped_parish_id is null
          )
      ),
      updated_at=now()
  from resolved r
  where b.id=r.batch_id;
  get diagnostics v_batches=row_count;

  select count(*) into v_blocked
  from public.legacy_import_batches b
  where (
    b.source_installation_id=p_source_installation_id
    or b.metadata->>'source_installation_id'=p_source_installation_id::text
  )
  and coalesce((b.metadata->>'provenance_blocked')::boolean,false);

  update public.legacy_source_installations
  set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
    'mixed_provenance_detected_v65',true,
    'provenance_reconciled_v65',true,
    'provenance_reconciled_at',now(),
    'provenance_blocked_batches',v_blocked,
    'canonical_snapshot_identity','mixed_conversion'
  ),
  updated_at=now()
  where id=p_source_installation_id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values (
    auth.uid(),v_source.mapped_parish_id,v_source.owner_diocese_id,
    'legacy_source_installation',v_source.id,'legacy_provenance_reconciled_v65',
    jsonb_build_object(
      'source_files',v_files,'archive_rows',v_archive,
      'batches',v_batches,'blocked_batches',v_blocked
    ),
    jsonb_build_object('source_installation_id',v_source.id)
  );

  return jsonb_build_object(
    'source_files_reconciled',v_files,
    'archive_rows_reconciled',v_archive,
    'batches_reconciled',v_batches,
    'blocked_batches',v_blocked
  );
end;
$$;
create or replace function public.assert_legacy_batch_provenance_v65(
  p_batch_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_batch public.legacy_import_batches%rowtype;
  v_origin public.legacy_source_origins%rowtype;
  v_role text;
  v_parish_required boolean;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  select * into v_batch from public.legacy_import_batches where id=p_batch_id;
  if not found then raise exception 'Lote legacy no encontrado'; end if;

  v_role:=public.current_app_role();
  if v_role='admin_general' then null;
  elsif v_role='diocese' and v_batch.diocese_id=public.current_app_diocese_id() then null;
  elsif v_batch.parish_id is not null and public.can_access_parish(v_batch.parish_id) then null;
  else raise exception 'No autorizado para este lote'; end if;

  v_parish_required:=v_batch.profile_key in (
    'BAUTIZOS','CONFIRMA','MATRIMON','DIFUNTOS',
    'INSBAUTI','INSCONFI','INSMATRI',
    'PARAMETROS','PARROCOS',
    'NTBAU001','NTBAU002','NTCON001','NTDEF001','NTMAT001','NTMAT002','ANULACION'
  );

  if v_batch.source_origin_id is null then
    if coalesce((v_batch.metadata->>'canonical_archive_v60')::boolean,false) then
      raise exception 'El lote canónico no tiene proveniencia V65 resuelta';
    end if;
    return jsonb_build_object('allowed',true,'legacy_unscoped',true);
  end if;

  select * into v_origin from public.legacy_source_origins where id=v_batch.source_origin_id;

  if v_parish_required and v_origin.mapped_parish_id is null then
    raise exception 'El origen % (%) aún no está vinculado a una parroquia moderna',
      v_origin.display_name,v_origin.identity_status;
  end if;
  if v_parish_required and v_batch.parish_id is distinct from v_origin.mapped_parish_id then
    raise exception 'El lote apunta a una parroquia distinta de su origen verificado';
  end if;
  if v_parish_required and v_origin.identity_status in ('mixed','pending','structural') then
    raise exception 'El origen % no es materializable como archivo parroquial',v_origin.display_name;
  end if;

  return jsonb_build_object(
    'allowed',true,
    'origin_id',v_origin.id,
    'origin_key',v_origin.origin_key,
    'origin_name',v_origin.display_name,
    'mapped_parish_id',v_origin.mapped_parish_id,
    'identity_status',v_origin.identity_status
  );
end;
$$;

revoke all on function public.reconcile_legacy_provenance_v65(uuid) from public,anon;
grant execute on function public.reconcile_legacy_provenance_v65(uuid) to authenticated;
revoke all on function public.assert_legacy_batch_provenance_v65(uuid) from public,anon;
grant execute on function public.assert_legacy_batch_provenance_v65(uuid) to authenticated;

comment on function public.assert_legacy_batch_provenance_v65(uuid) is
'Bloquea materialización cuando el lote parroquial no coincide con la identidad de origen verificada.';
create or replace function public.reconcile_maria_auxilio_baptisms_v65()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_role text;
  v_diocese uuid;
  v_maria uuid;
  v_santa uuid;
  v_batch uuid;
  v_relinked integer:=0;
  v_reverted integer:=0;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  v_role:=public.current_app_role();
  v_diocese:=public.current_app_diocese_id();
  if v_role not in ('diocese','admin_general') then raise exception 'No autorizado'; end if;

  if v_role='admin_general' then
    select diocese_id into v_diocese
    from public.parishes
    where translate(upper(name),'ÁÉÍÓÚÑ','AEIOUN')='PARROQUIA MARIA AUXILIO DE LOS CRISTIANOS'
    limit 1;
  end if;

  select id into v_maria from public.parishes
  where diocese_id=v_diocese
    and translate(upper(name),'ÁÉÍÓÚÑ','AEIOUN')='PARROQUIA MARIA AUXILIO DE LOS CRISTIANOS'
  limit 1;
  select id into v_santa from public.parishes
  where diocese_id=v_diocese
    and translate(upper(name),'ÁÉÍÓÚÑ','AEIOUN')='PARROQUIA SANTA TERESITA DEL NINO JESUS'
  limit 1;

  if v_maria is null or v_santa is null then
    raise exception 'No se pudieron resolver las parroquias de reconciliación';
  end if;

  select b.id into v_batch
  from public.legacy_import_batches b
  where b.profile_key='BAUTIZOS'
    and exists (
      select 1
      from jsonb_array_elements_text(coalesce(b.metadata->'source_hashes','[]'::jsonb)) x(value)
      where x.value='43437561b6f7743668e0a0ca7cc2acc9a20bc6ab7b4acbe4bb6cac22d15fd1de'
    )
  order by b.created_at desc
  limit 1;

  if v_batch is null then
    raise exception 'No se encontró el lote BAUTIZOS de PQUIA001';
  end if;
  create temporary table if not exists tmp_v65_baptism_pairs(
    import_row_id uuid primary key,
    bad_id uuid not null,
    good_id uuid not null
  ) on commit drop;
  truncate tmp_v65_baptism_pairs;

  insert into tmp_v65_baptism_pairs(import_row_id,bad_id,good_id)
  select r.id,bad.id,good.id
  from public.legacy_import_rows r
  join public.baptisms bad on bad.id=r.target_id and bad.parish_id=v_santa
  join public.baptisms good
    on good.parish_id=v_maria
   and good.id<>bad.id
   and coalesce(good.book_number,'')=coalesce(bad.book_number,'')
   and coalesce(good.folio,'')=coalesce(bad.folio,'')
   and coalesce(good.number,'')=coalesce(bad.number,'')
   and upper(trim(coalesce(good.nombres,'')))=upper(trim(coalesce(bad.nombres,'')))
   and upper(trim(coalesce(good.apellidos,'')))=upper(trim(coalesce(bad.apellidos,'')))
   and good.celebration_date is not distinct from bad.celebration_date
  where r.batch_id=v_batch
    and r.target_id is not null;

  update public.legacy_import_rows r
  set target_id=p.good_id,
      target_table='baptism',
      issue_details=coalesce(r.issue_details,'{}'::jsonb)||jsonb_build_object(
        'provenance_reconciled_v65',true,
        'previous_misassigned_target_id',p.bad_id,
        'correct_target_id',p.good_id,
        'correct_parish_id',v_maria
      ),
      updated_at=now()
  from tmp_v65_baptism_pairs p
  where r.id=p.import_row_id;
  get diagnostics v_relinked=row_count;

  update public.baptisms bad
  set status='reverted',
      raw_data=coalesce(bad.raw_data,'{}'::jsonb)||jsonb_build_object(
        'legacy_misassignment_reconciliation_v65',jsonb_build_object(
          'reconciled_at',now(),
          'reason','PQUIA001 identificado como María Auxilio de los Cristianos',
          'correct_parish_id',v_maria,
          'correct_baptism_id',p.good_id,
          'reversible',true
        )
      ),
      updated_at=now()
  from tmp_v65_baptism_pairs p
  where bad.id=p.bad_id
    and bad.parish_id=v_santa
    and lower(coalesce(bad.status,'seated'))='seated';
  get diagnostics v_reverted=row_count;
  update public.baptisms good
  set raw_data=coalesce(good.raw_data,'{}'::jsonb)||jsonb_build_object(
        'legacy_provenance_match_v65',jsonb_build_object(
          'source_hash','43437561b6f7743668e0a0ca7cc2acc9a20bc6ab7b4acbe4bb6cac22d15fd1de',
          'origin_key','pquia001',
          'matched_import_row_id',p.import_row_id,
          'verified_at',now()
        )
      ),
      updated_at=now()
  from tmp_v65_baptism_pairs p
  where good.id=p.good_id;

  update public.legacy_import_batches
  set parish_id=v_maria,
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
        'misassignment_reconciled_v65',true,
        'misassignment_reconciled_rows',v_relinked,
        'correct_parish_id',v_maria,
        'previous_parish_id',v_santa
      ),
      updated_at=now()
  where id=v_batch;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values (
    auth.uid(),v_maria,v_diocese,'legacy_import_batch',v_batch,
    'legacy_misassignment_reconciled_v65',
    jsonb_build_object('rows_relinked',v_relinked,'technical_duplicates_reverted',v_reverted),
    jsonb_build_object(
      'source_origin','pquia001',
      'previous_parish_id',v_santa,
      'correct_parish_id',v_maria,
      'reversible',true
    )
  );

  return jsonb_build_object(
    'rows_relinked',v_relinked,
    'technical_duplicates_reverted',v_reverted,
    'batch_id',v_batch,
    'correct_parish_id',v_maria
  );
end;
$$;

revoke all on function public.reconcile_maria_auxilio_baptisms_v65() from public,anon;
grant execute on function public.reconcile_maria_auxilio_baptisms_v65() to authenticated;
comment on table public.legacy_source_origins is
'Identidad de procedencia de cada snapshot o recurso legacy. Separa el paquete físico de la parroquia moderna destino.';
comment on table public.legacy_source_origin_hashes is
'Asocia SHA-256 verificados con su origen exacto para reconstruir procedencia sin reinterpretar filas.';
comment on function public.reconcile_maria_auxilio_baptisms_v65() is
'Reenlaza de forma reversible las 46 filas PQUIA001 a las partidas idénticas existentes en María Auxilio y desactiva las copias técnicas mal asignadas.';

do $$
declare
  v_source uuid;
begin
  select id into v_source
  from public.legacy_source_installations
  where source_key='SACRAMENTA_PLUS:4652-6019-8426-7223'
  order by created_at limit 1;
  if v_source is not null then
    update public.legacy_source_installations
    set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
      'source_identity_model','multi_origin_v65',
      'canonical_snapshot_warning','D:\dbf_convert\dbf es un snapshot compuesto; no usar como identidad parroquial única',
      'source_package','D:\SACRAMENTA.zip'
    ),
    updated_at=now()
    where id=v_source;
  end if;
end $$;
