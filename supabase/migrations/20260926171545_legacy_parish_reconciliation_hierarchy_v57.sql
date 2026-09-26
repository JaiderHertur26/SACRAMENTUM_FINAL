-- SACRAMENTUM V57 · Reconciliación legacy con jerarquía territorial obligatoria
-- Corrige V56 respetando la integridad Diócesis/Arquidiócesis > Vicaría > Decanato > Parroquia.
create or replace function public.create_parish_from_legacy_installation_v56(
  p_source_installation_id uuid,
  p_vicary_id uuid default null,
  p_deanery_id uuid default null
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
  v_name text;
  v_city text;
  v_address text;
  v_phone text;
  v_nit text;
  v_parish_id uuid;
  v_existing uuid;
  v_map jsonb;
  v_vicary_name text;
  v_deanery_name text;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  v_role := public.current_app_role();
  v_diocese := public.current_app_diocese_id();

  if v_role <> 'diocese' then
    raise exception 'Sólo la Diócesis/Arquidiócesis puede crear una parroquia desde una instalación legacy';
  end if;
  if v_diocese is null then
    raise exception 'No se pudo determinar la diócesis activa';
  end if;

  select *
    into v_source
  from public.legacy_source_installations
  where id = p_source_installation_id
  for update;

  if v_source.id is null then
    raise exception 'Instalación legacy no encontrada';
  end if;
  if v_source.owner_diocese_id is distinct from v_diocese then
    raise exception 'La instalación legacy pertenece a otra jurisdicción';
  end if;
  if v_source.mapped_parish_id is not null then
    raise exception 'La instalación ya está vinculada a una parroquia moderna';
  end if;

  v_name := nullif(trim(coalesce(v_source.legacy_parish_name, v_source.metadata->>'nombre', '')), '');
  v_city := nullif(trim(coalesce(v_source.legacy_city, v_source.metadata->>'ciudad', '')), '');
  v_address := nullif(trim(coalesce(v_source.metadata->>'direccion', '')), '');
  v_phone := nullif(trim(coalesce(v_source.metadata->>'telefono', '')), '');
  v_nit := nullif(trim(coalesce(v_source.metadata->>'nronit', '')), '');

  if v_name is null then
    raise exception 'La instalación legacy no contiene un nombre parroquial verificable';
  end if;

  if p_vicary_id is null or p_deanery_id is null then
    raise exception 'Seleccione la Vicaría y el Decanato correctos antes de crear la parroquia moderna';
  end if;

  if p_vicary_id is not null then
    select name
      into v_vicary_name
    from public.vicarias
    where id = p_vicary_id
      and diocese_id = v_diocese;
    if v_vicary_name is null then
      raise exception 'La vicaría seleccionada no pertenece a esta diócesis';
    end if;
  end if;

  if p_deanery_id is not null then
    select name
      into v_deanery_name
    from public.decanatos
    where id = p_deanery_id
      and diocese_id = v_diocese
      and (p_vicary_id is null or vicaria_id = p_vicary_id);
    if v_deanery_name is null then
      raise exception 'El decanato seleccionado no pertenece a la vicaría/diócesis indicada';
    end if;
  end if;

  select p.id
    into v_existing
  from public.parishes p
  where p.diocese_id = v_diocese
    and (
      lower(trim(p.name)) = lower(v_name)
      or (
        v_nit is not null
        and nullif(trim(p.nit), '') is not null
        and regexp_replace(p.nit, '[^0-9A-Za-z]', '', 'g')
            = regexp_replace(v_nit, '[^0-9A-Za-z]', '', 'g')
      )
    )
  limit 1;

  if v_existing is not null then
    raise exception 'Ya existe una parroquia con el mismo nombre o NIT. Vincule la instalación a esa parroquia en lugar de crear otra.';
  end if;

  insert into public.parishes(
    name, city, nit, phone, address,
    diocese_id, vicary_id, decanate_id, deanery_id
  )
  values(
    upper(v_name),
    upper(coalesce(v_city, '')),
    v_nit,
    v_phone,
    v_address,
    v_diocese,
    p_vicary_id,
    p_deanery_id,
    p_deanery_id
  )
  returning id into v_parish_id;

  select public.map_legacy_source_installation_v45(
    p_source_installation_id,
    v_parish_id
  )
  into v_map;

  update public.legacy_source_installations
  set metadata = coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object(
          'modern_parish_created_from_legacy', true,
          'modern_parish_created_at', now(),
          'modern_parish_id', v_parish_id,
          'hierarchy_pending', false,
          'selected_vicary_id', p_vicary_id,
          'selected_vicary_name', v_vicary_name,
          'selected_deanery_id', p_deanery_id,
          'selected_deanery_name', v_deanery_name
        ),
      updated_at = now()
  where id = p_source_installation_id;

  insert into public.registry_audit_log(
    actor_user_id, parish_id, diocese_id,
    entity_type, entity_id, action, after_data, metadata
  )
  values(
    auth.uid(), v_parish_id, v_diocese,
    'parish', v_parish_id,
    'parish_created_from_legacy_installation_v56',
    jsonb_build_object(
      'name', upper(v_name),
      'city', upper(coalesce(v_city, '')),
      'nit', v_nit,
      'phone', v_phone,
      'address', v_address,
      'vicary_id', p_vicary_id,
      'deanery_id', p_deanery_id
    ),
    jsonb_build_object(
      'source_installation_id', p_source_installation_id,
      'legacy_source_key', v_source.source_key,
      'legacy_serial', v_source.legacy_serial,
      'legacy_code', v_source.legacy_code,
      'hierarchy_pending', false
    )
  );

  return jsonb_build_object(
    'parish_id', v_parish_id,
    'name', upper(v_name),
    'city', upper(coalesce(v_city, '')),
    'nit', v_nit,
    'phone', v_phone,
    'address', v_address,
    'vicary_id', p_vicary_id,
    'vicary_name', v_vicary_name,
    'deanery_id', p_deanery_id,
    'deanery_name', v_deanery_name,
    'hierarchy_pending', false,
    'mapping', v_map
  );
end;
$$;

revoke all on function public.create_parish_from_legacy_installation_v56(uuid,uuid,uuid) from public;
revoke all on function public.create_parish_from_legacy_installation_v56(uuid,uuid,uuid) from anon;
grant execute on function public.create_parish_from_legacy_installation_v56(uuid,uuid,uuid) to authenticated;

comment on function public.create_parish_from_legacy_installation_v56(uuid,uuid,uuid)
is 'Crea una parroquia moderna desde una identidad legacy verificada, exige Vicaría y Decanato válidos y vincula de forma atómica toda la instalación preservada. Sólo rol Diócesis.';
