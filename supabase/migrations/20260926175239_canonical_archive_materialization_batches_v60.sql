-- SACRAMENTUM V60 · Puente canónico Archivo Maestro -> lotes materializables
-- Reconstituye lotes auditables desde legacy_archive_records sin perder procedencia.

create unique index if not exists uq_legacy_canonical_batch_v60
on public.legacy_import_batches(source_installation_id, profile_key, sha256)
where metadata->>'canonical_archive_v60' = 'true';

create or replace function public.prepare_canonical_legacy_batches_v60(
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
  v_profile record;
  v_batch_id uuid;
  v_signature text;
  v_hashes text;
  v_created integer := 0;
  v_reused integer := 0;
  v_rows integer := 0;
  v_active integer := 0;
  v_deleted integer := 0;
  v_batches jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select * into v_source
  from public.legacy_source_installations
  where id = p_source_installation_id
  for update;

  if v_source.id is null then
    raise exception 'Instalación legacy no encontrada';
  end if;
  if v_source.mapped_parish_id is null then
    raise exception 'La instalación debe estar vinculada a una parroquia moderna antes de preparar la materialización';
  end if;

  v_role := public.current_app_role();
  v_diocese := public.current_app_diocese_id();

  if v_role = 'admin_general' then
    null;
  elsif v_role = 'diocese'
    and v_source.owner_diocese_id is not null
    and v_source.owner_diocese_id = v_diocese then
    null;
  else
    raise exception 'Sólo la Diócesis/Arquidiócesis propietaria puede preparar lotes canónicos';
  end if;

  for v_profile in
    select
      upper(a.profile_key) as profile_key,
      min(a.target_entity) as target_entity,
      count(*)::integer as total_rows,
      count(*) filter(where lower(coalesce(a.row_status,'archived')) <> 'deleted')::integer as active_rows,
      count(*) filter(where lower(coalesce(a.row_status,'archived')) = 'deleted')::integer as deleted_rows
    from public.legacy_archive_records a
    where a.source_installation_id = p_source_installation_id
    group by upper(a.profile_key)
    order by upper(a.profile_key)
  loop
    if not exists(
      select 1
      from public.legacy_import_profiles p
      where p.profile_key = v_profile.profile_key
        and p.active = true
    ) then
      raise exception 'El perfil canónico % no existe o está inactivo', v_profile.profile_key;
    end if;

    select string_agg(x.sha, ',' order by x.sha)
      into v_hashes
    from (
      select distinct coalesce(a.source_sha256,'') as sha
      from public.legacy_archive_records a
      where a.source_installation_id = p_source_installation_id
        and upper(a.profile_key) = v_profile.profile_key
    ) x;

    v_signature := md5(
      v_source.id::text || '|' ||
      v_profile.profile_key || '|' ||
      v_profile.total_rows::text || '|' ||
      coalesce(v_hashes,'')
    );

    select b.id into v_batch_id
    from public.legacy_import_batches b
    where b.source_installation_id = p_source_installation_id
      and b.profile_key = v_profile.profile_key
      and b.sha256 = v_signature
      and b.metadata->>'canonical_archive_v60' = 'true'
    limit 1;

    if v_batch_id is null then
      insert into public.legacy_import_batches(
        source_system, source_name, original_filename, profile_key, sha256,
        parish_id, diocese_id, status,
        row_count, valid_count, review_count, imported_count, skipped_count, error_count,
        created_by, metadata, source_installation_id
      ) values (
        'SACRAMENTA_PLUS',
        coalesce(v_source.source_name, v_source.legacy_parish_name, 'Archivo Maestro SACRAMENTA'),
        'CANONICAL_ARCHIVE_' || v_profile.profile_key || '.json',
        v_profile.profile_key,
        v_signature,
        v_source.mapped_parish_id,
        v_source.owner_diocese_id,
        'ready',
        v_profile.total_rows,
        v_profile.active_rows,
        0,
        0,
        v_profile.deleted_rows,
        0,
        auth.uid(),
        jsonb_build_object(
          'canonical_archive_v60', true,
          'canonical_archive_signature', v_signature,
          'source_installation_id', v_source.id,
          'source_hashes', string_to_array(coalesce(v_hashes,''), ','),
          'target_entity', v_profile.target_entity,
          'preserved_deleted_rows', v_profile.deleted_rows,
          'prepared_at', now()
        ),
        v_source.id
      )
      returning id into v_batch_id;

      insert into public.legacy_import_rows(
        batch_id, row_number, source_key, checksum, target_entity,
        original_data, normalized_data, status, issue_codes, issue_details
      )
      select
        v_batch_id,
        row_number() over(order by a.source_key, a.id)::integer,
        a.source_key,
        md5(coalesce(a.original_data,'{}'::jsonb)::text),
        a.target_entity,
        a.original_data,
        a.normalized_data,
        case
          when lower(coalesce(a.row_status,'archived')) = 'deleted' then 'skipped'
          else 'valid'
        end,
        case
          when lower(coalesce(a.row_status,'archived')) = 'deleted'
            then array['CANONICAL_ARCHIVE_V60','LEGACY_DELETED_PRESERVED']::text[]
          else array['CANONICAL_ARCHIVE_V60']::text[]
        end,
        jsonb_build_object(
          'archive_record_id', a.id,
          'source_sha256', a.source_sha256,
          'archive_row_status', a.row_status,
          'archive_reconciliation_status', a.reconciliation_status,
          'archive_metadata', a.metadata
        )
      from public.legacy_archive_records a
      where a.source_installation_id = p_source_installation_id
        and upper(a.profile_key) = v_profile.profile_key
      order by a.source_key, a.id;

      v_created := v_created + 1;
    else
      v_reused := v_reused + 1;
    end if;

    v_rows := v_rows + v_profile.total_rows;
    v_active := v_active + v_profile.active_rows;
    v_deleted := v_deleted + v_profile.deleted_rows;

    v_batches := v_batches || jsonb_build_array(jsonb_build_object(
      'profile_key', v_profile.profile_key,
      'batch_id', v_batch_id,
      'rows', v_profile.total_rows,
      'active_rows', v_profile.active_rows,
      'deleted_rows', v_profile.deleted_rows,
      'signature', v_signature
    ));
  end loop;

  update public.legacy_source_installations
  set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
        'canonical_batches_v60_prepared', true,
        'canonical_batches_v60_prepared_at', now(),
        'canonical_batches_v60_rows', v_rows,
        'canonical_batches_v60_active_rows', v_active,
        'canonical_batches_v60_deleted_rows', v_deleted
      ),
      updated_at = now()
  where id = p_source_installation_id;

  insert into public.registry_audit_log(
    actor_user_id, parish_id, diocese_id,
    entity_type, entity_id, action, after_data, metadata
  ) values (
    auth.uid(), v_source.mapped_parish_id, v_source.owner_diocese_id,
    'legacy_source_installation', v_source.id,
    'prepare_canonical_legacy_batches_v60',
    jsonb_build_object(
      'created_batches', v_created,
      'reused_batches', v_reused,
      'rows', v_rows,
      'active_rows', v_active,
      'deleted_rows_preserved', v_deleted
    ),
    jsonb_build_object('source_name', v_source.source_name)
  );

  return jsonb_build_object(
    'installation_id', v_source.id,
    'parish_id', v_source.mapped_parish_id,
    'created_batches', v_created,
    'reused_batches', v_reused,
    'rows', v_rows,
    'active_rows', v_active,
    'deleted_rows_preserved', v_deleted,
    'batches', v_batches
  );
end;
$$;

revoke all on function public.prepare_canonical_legacy_batches_v60(uuid) from public;
revoke all on function public.prepare_canonical_legacy_batches_v60(uuid) from anon;
grant execute on function public.prepare_canonical_legacy_batches_v60(uuid) to authenticated;

comment on function public.prepare_canonical_legacy_batches_v60(uuid)
is 'Crea lotes idempotentes desde el Archivo Histórico Maestro para reutilizar los importadores auditados; preserva eliminados sin materializarlos.';
