-- SACRAMENTUM V66 · corrección de compatibilidad territorial.
-- decanate_id (decanatos) y deanery_id (deaneries legado) no comparten UUID.
-- La creación por origen usa la jerarquía moderna y no inventa un deanery_id.

create or replace function public.create_parish_from_legacy_origin_v66(
  p_origin_id uuid,
  p_vicary_id uuid,
  p_deanery_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origin public.legacy_source_origins%rowtype;
  v_source public.legacy_source_installations%rowtype;
  v_role text;
  v_diocese uuid;
  v_name text;
  v_city text;
  v_address text;
  v_phone text;
  v_nit text;
  v_vicary_name text;
  v_deanery_name text;
  v_existing uuid;
  v_parish_id uuid;
  v_mapping jsonb;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  v_role := public.current_app_role();
  v_diocese := public.current_app_diocese_id();
  if v_role <> 'diocese' or v_diocese is null then
    raise exception 'Sólo la Diócesis/Arquidiócesis puede crear una parroquia desde un origen legacy';
  end if;
  if p_origin_id is null or p_vicary_id is null or p_deanery_id is null then
    raise exception 'Origen, Vicaría y Decanato son obligatorios';
  end if;
  select * into v_origin
  from public.legacy_source_origins
  where id = p_origin_id
  for update;
  if v_origin.id is null then raise exception 'Origen legacy no encontrado'; end if;

  select * into v_source
  from public.legacy_source_installations
  where id = v_origin.source_installation_id;
  if v_source.id is null or v_source.owner_diocese_id is distinct from v_diocese then
    raise exception 'El origen legacy pertenece a otra jurisdicción';
  end if;

  if v_origin.origin_kind not in ('parish_snapshot','parish_snapshot_family')
     or v_origin.identity_status in ('global','mixed','structural')
     or nullif(trim(v_origin.legacy_parish_name),'') is null then
    raise exception 'Este origen no representa una parroquia histórica materializable';
  end if;
  if v_origin.mapped_parish_id is not null then
    raise exception 'Este origen ya está vinculado a una parroquia moderna';
  end if;

  select name into v_vicary_name
  from public.vicarias
  where id = p_vicary_id and diocese_id = v_diocese;
  if v_vicary_name is null then
    raise exception 'La Vicaría seleccionada no pertenece a esta Diócesis/Arquidiócesis';
  end if;

  select name into v_deanery_name
  from public.decanatos
  where id = p_deanery_id
    and diocese_id = v_diocese
    and vicaria_id = p_vicary_id;
  if v_deanery_name is null then
    raise exception 'El Decanato seleccionado no pertenece a la Vicaría indicada';
  end if;
  v_name := upper(trim(v_origin.legacy_parish_name));
  v_city := upper(trim(coalesce(
    v_origin.metadata->>'ciudad',
    v_source.metadata->>'ciudad',
    v_source.legacy_city,
    ''
  )));
  v_address := nullif(trim(coalesce(v_origin.metadata->>'direccion','')), '');
  v_phone := nullif(trim(coalesce(v_origin.metadata->>'telefono','')), '');
  v_nit := nullif(trim(coalesce(v_origin.metadata->>'nronit','')), '');

  select p.id into v_existing
  from public.parishes p
  where p.diocese_id = v_diocese
    and translate(upper(trim(p.name)),'ÁÉÍÓÚÑ','AEIOUN')
        = translate(upper(trim(v_name)),'ÁÉÍÓÚÑ','AEIOUN')
  limit 1;
  if v_existing is not null then
    raise exception 'Ya existe una parroquia con este nombre. Vincule el origen a esa parroquia en lugar de crear otra.';
  end if;

  insert into public.parishes(
    name, city, nit, phone, address,
    diocese_id, vicary_id, decanate_id
  ) values (
    v_name, v_city, v_nit, v_phone, v_address,
    v_diocese, p_vicary_id, p_deanery_id
  )
  returning id into v_parish_id;

  select public.map_legacy_source_origin_v66(p_origin_id, v_parish_id)
  into v_mapping;
  insert into public.registry_audit_log(
    actor_user_id, parish_id, diocese_id,
    entity_type, entity_id, action, after_data, metadata
  ) values (
    auth.uid(), v_parish_id, v_diocese,
    'parish', v_parish_id, 'parish_created_from_legacy_origin_v66',
    jsonb_build_object(
      'name', v_name,
      'city', v_city,
      'vicary_id', p_vicary_id,
      'vicary_name', v_vicary_name,
      'deanery_id', p_deanery_id,
      'deanery_name', v_deanery_name,
      'legacy_deanery_compatibility_id', null
    ),
    jsonb_build_object(
      'source_origin_id', p_origin_id,
      'source_origin_key', v_origin.origin_key,
      'source_installation_id', v_origin.source_installation_id,
      'legacy_parish_name', v_origin.legacy_parish_name,
      'territory_model', 'vicarias_decanatos',
      'deanery_id_compatibility', 'left_null_without_explicit_mapping'
    )
  );

  return jsonb_build_object(
    'parish_id', v_parish_id,
    'name', v_name,
    'city', v_city,
    'vicary_id', p_vicary_id,
    'vicary_name', v_vicary_name,
    'deanery_id', p_deanery_id,
    'deanery_name', v_deanery_name,
    'legacy_deanery_compatibility_id', null,
    'origin_mapping', v_mapping
  );
end;
$$;

revoke all on function public.create_parish_from_legacy_origin_v66(uuid,uuid,uuid) from public,anon;
grant execute on function public.create_parish_from_legacy_origin_v66(uuid,uuid,uuid) to authenticated;
