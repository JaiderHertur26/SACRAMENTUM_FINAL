-- SACRAMENTUM V69 · creación segura de parroquias legacy verificadas
-- cuando la identidad parroquial es clara pero Vicaría/Decanato aún no lo son.
-- Nunca inventa jerarquía territorial.

create or replace function public.create_pending_territory_parish_from_legacy_origin_v69(
  p_origin_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origin public.legacy_source_origins%rowtype;
  v_source public.legacy_source_installations%rowtype;
  v_catalog jsonb := '{}'::jsonb;
  v_role text;
  v_diocese uuid;
  v_name text;
  v_name_core text;
  v_city text;
  v_address text;
  v_phone text;
  v_nit text;
  v_parroco text;
  v_existing uuid;
  v_parish_id uuid;
  v_mapping jsonb;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  v_role:=public.current_app_role();
  v_diocese:=public.current_app_diocese_id();

  if v_role<>'diocese' or v_diocese is null then
    raise exception 'Sólo la Diócesis/Arquidiócesis puede crear una parroquia desde un origen legacy';
  end if;
  if p_origin_id is null then
    raise exception 'El origen legacy es obligatorio';
  end if;

  select * into v_origin
  from public.legacy_source_origins
  where id=p_origin_id
  for update;

  if v_origin.id is null then raise exception 'Origen legacy no encontrado'; end if;

  select * into v_source
  from public.legacy_source_installations
  where id=v_origin.source_installation_id;

  if v_source.id is null or v_source.owner_diocese_id is distinct from v_diocese then
    raise exception 'El origen legacy pertenece a otra jurisdicción';
  end if;

  if v_origin.origin_kind not in ('parish_snapshot','parish_snapshot_family')
     or v_origin.identity_status not in ('verified_unmapped','verified')
     or nullif(trim(v_origin.legacy_parish_name),'') is null then
    raise exception 'El origen no representa una identidad parroquial legacy verificada';
  end if;

  if v_origin.mapped_parish_id is not null then
    select p.id into v_existing
    from public.parishes p
    where p.id=v_origin.mapped_parish_id and p.diocese_id=v_diocese;

    if v_existing is not null then
      return jsonb_build_object(
        'parish_id',v_existing,
        'created',false,
        'already_mapped',true,
        'territory_status',coalesce(v_origin.metadata->>'territory_status','unknown')
      );
    end if;
  end if;

  v_name:=upper(trim(v_origin.legacy_parish_name));
  v_name_core:=regexp_replace(
    translate(v_name,'ÁÉÍÓÚÑ','AEIOUN'),
    '^(PARROQUIA|UNIDAD PASTORAL)[[:space:]]+',
    '',
    'i'
  );

  select lar.original_data into v_catalog
  from public.legacy_archive_records lar
  where lar.profile_key='IGLESIAS'
    and lar.source_installation_id=v_origin.source_installation_id
    and regexp_replace(
          translate(upper(trim(coalesce(lar.original_data->>'nombre',''))),'ÁÉÍÓÚÑ','AEIOUN'),
          '^(PARROQUIA|UNIDAD PASTORAL)[[:space:]]+',
          '',
          'i'
        )=v_name_core
    and coalesce((lar.original_data->>'_deleted')::boolean,false)=false
  order by lar.created_at desc
  limit 1;

  v_city:=upper(trim(coalesce(
    v_catalog->>'ciudad',
    v_origin.metadata->>'ciudad',
    v_source.metadata->>'ciudad',
    v_source.legacy_city,
    ''
  )));
  v_address:=nullif(upper(trim(coalesce(
    v_catalog->>'direccion',
    v_origin.metadata->>'direccion',
    ''
  ))),'');
  v_phone:=nullif(trim(coalesce(
    v_catalog->>'telefono',
    v_origin.metadata->>'telefono',
    ''
  )),'');
  v_nit:=nullif(trim(coalesce(
    v_catalog->>'nronit',
    v_origin.metadata->>'nronit',
    ''
  )),'');
  v_parroco:=nullif(upper(trim(coalesce(
    v_catalog->>'parroco',
    v_origin.metadata->>'parroco',
    ''
  ))),'');

  select p.id into v_existing
  from public.parishes p
  where p.diocese_id=v_diocese
    and regexp_replace(
          translate(upper(trim(p.name)),'ÁÉÍÓÚÑ','AEIOUN'),
          '^(PARROQUIA|UNIDAD PASTORAL)[[:space:]]+',
          '',
          'i'
        )=v_name_core
  limit 1;

  if v_existing is not null then
    select public.map_legacy_source_origin_v66(p_origin_id,v_existing)
      into v_mapping;

    update public.legacy_source_origins
    set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
          'territory_status','pending_review',
          'territory_pending_reason','La identidad parroquial fue verificada pero el origen legacy no aporta Vicaría/Decanato confiables.',
          'identity_evidence_v69',v_catalog,
          'pending_territory_v69',true
        ),
        updated_at=now()
    where id=p_origin_id;

    return jsonb_build_object(
      'parish_id',v_existing,
      'created',false,
      'mapped_existing',true,
      'territory_status','pending_review',
      'origin_mapping',v_mapping
    );
  end if;

  insert into public.parishes(
    name,city,nit,phone,address,diocese_id,
    vicary_id,decanate_id,deanery_id,parroco,
    legacy_territory_pending,legacy_origin_id
  ) values (
    v_name,v_city,v_nit,v_phone,v_address,v_diocese,
    null,null,null,v_parroco,
    true,p_origin_id
  )
  returning id into v_parish_id;

  select public.map_legacy_source_origin_v66(p_origin_id,v_parish_id)
    into v_mapping;

  update public.legacy_source_origins
  set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
        'territory_status','pending_review',
        'territory_pending_reason','La identidad parroquial fue verificada pero el origen legacy no aporta Vicaría/Decanato confiables.',
        'pending_territory_v69',true,
        'identity_evidence_v69',v_catalog,
        'legacy_address',v_address,
        'legacy_phone',v_phone,
        'legacy_nit',v_nit,
        'legacy_parish_priest',v_parroco
      ),
      updated_at=now()
  where id=p_origin_id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,
    entity_type,entity_id,action,after_data,metadata
  ) values (
    auth.uid(),v_parish_id,v_diocese,
    'parish',v_parish_id,'parish_created_from_verified_legacy_origin_v69',
    jsonb_build_object(
      'name',v_name,
      'city',v_city,
      'nit',v_nit,
      'phone',v_phone,
      'address',v_address,
      'parroco',v_parroco,
      'vicary_id',null,
      'deanery_id',null,
      'territory_status','pending_review'
    ),
    jsonb_build_object(
      'source_origin_id',p_origin_id,
      'source_origin_key',v_origin.origin_key,
      'source_installation_id',v_origin.source_installation_id,
      'legacy_parish_name',v_origin.legacy_parish_name,
      'identity_evidence',v_catalog,
      'territory_not_invented',true
    )
  );

  return jsonb_build_object(
    'parish_id',v_parish_id,
    'name',v_name,
    'city',v_city,
    'nit',v_nit,
    'phone',v_phone,
    'address',v_address,
    'parroco',v_parroco,
    'created',true,
    'territory_status','pending_review',
    'origin_mapping',v_mapping
  );
end;
$$;

revoke all on function public.create_pending_territory_parish_from_legacy_origin_v69(uuid)
from public,anon;
grant execute on function public.create_pending_territory_parish_from_legacy_origin_v69(uuid)
to authenticated;

comment on function public.create_pending_territory_parish_from_legacy_origin_v69(uuid) is
'Crea o vincula una parroquia desde un origen legacy verificado sin inventar Vicaría/Decanato; deja la conciliación territorial explícitamente pendiente.';
create or replace function public.complete_archive_only_legacy_batches_v69(
  p_origin_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_diocese uuid;
  v_origin public.legacy_source_origins%rowtype;
  v_completed integer:=0;
  v_rows integer:=0;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  v_role:=public.current_app_role();
  v_diocese:=public.current_app_diocese_id();
  if v_role<>'diocese' or v_diocese is null then
    raise exception 'Sólo la Diócesis/Arquidiócesis puede cerrar lotes legacy de archivo';
  end if;

  select * into v_origin
  from public.legacy_source_origins
  where id=p_origin_id;

  if v_origin.id is null or v_origin.mapped_parish_id is null then
    raise exception 'El origen debe estar verificado y vinculado antes de cerrar sus lotes de archivo';
  end if;

  if not exists(
    select 1 from public.parishes p
    where p.id=v_origin.mapped_parish_id and p.diocese_id=v_diocese
  ) then
    raise exception 'El origen pertenece a otra jurisdicción';
  end if;

  with targets as (
    select b.id,b.row_count
    from public.legacy_import_batches b
    join public.legacy_import_profiles p on p.profile_key=b.profile_key
    where b.source_origin_id=p_origin_id
      and p.import_mode='archive'
      and b.status in ('ready','analyzed','staged')
  ),
  changed as (
    update public.legacy_import_batches b
    set status='completed',
        skipped_count=greatest(coalesce(b.skipped_count,0),coalesce(b.row_count,0)),
        imported_count=0,
        metadata=coalesce(b.metadata,'{}'::jsonb)||jsonb_build_object(
          'archive_only_completed_v69',true,
          'archive_only_completed_at',now(),
          'materialization_policy','preserved_not_applied'
        ),
        updated_at=now()
    from targets t
    where b.id=t.id
    returning b.id,b.row_count
  )
  select count(*),coalesce(sum(row_count),0)
    into v_completed,v_rows
  from changed;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,
    entity_type,entity_id,action,after_data,metadata
  ) values (
    auth.uid(),v_origin.mapped_parish_id,v_diocese,
    'legacy_source_origin',p_origin_id,
    'complete_archive_only_batches_v69',
    jsonb_build_object('batches_completed',v_completed,'rows_preserved',v_rows),
    jsonb_build_object('materialization_policy','preserved_not_applied')
  );

  return jsonb_build_object(
    'batches_completed',v_completed,
    'rows_preserved_not_applied',v_rows
  );
end;
$$;

revoke all on function public.complete_archive_only_legacy_batches_v69(uuid)
from public,anon;
grant execute on function public.complete_archive_only_legacy_batches_v69(uuid)
to authenticated;
