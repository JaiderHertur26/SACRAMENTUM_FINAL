-- SACRAMENTUM V61 · Reconciliación territorial verificada para instalaciones legacy
-- Permite crear de forma auditada Vicaría + Decanato + Parroquia desde una instalación
-- SACRAMENTA preservada, sin forzar vínculos con parroquias distintas.

create or replace function public.reconcile_legacy_installation_territory_v61(
  p_source_installation_id uuid,
  p_vicary_name text,
  p_deanery_name text,
  p_create_missing_territory boolean default false,
  p_evidence jsonb default '{}'::jsonb
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
  v_vicary_name text := nullif(trim(p_vicary_name), '');
  v_deanery_name text := nullif(trim(p_deanery_name), '');
  v_vicary_id uuid;
  v_deanery_id uuid;
  v_parish_id uuid;
  v_existing_parish uuid;
  v_existing_vicary uuid;
  v_existing_deanery uuid;
  v_created_vicary boolean := false;
  v_created_deanery boolean := false;
  v_result jsonb;
  v_nit text;
  v_legacy_name text;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  v_role := public.current_app_role();
  v_diocese := public.current_app_diocese_id();

  if v_role <> 'diocese' then
    raise exception 'Sólo la Diócesis/Arquidiócesis puede reconciliar una instalación legacy';
  end if;
  if v_diocese is null then
    raise exception 'No se pudo determinar la diócesis activa';
  end if;
  if v_vicary_name is null or v_deanery_name is null then
    raise exception 'Indique la Vicaría y el Decanato verificados';
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
    return jsonb_build_object(
      'status','already_mapped',
      'installation_id',v_source.id,
      'parish_id',v_source.mapped_parish_id
    );
  end if;

  v_legacy_name := nullif(trim(coalesce(v_source.legacy_parish_name, v_source.metadata->>'nombre','')), '');
  v_nit := nullif(trim(coalesce(v_source.metadata->>'nronit','')), '');

  if v_legacy_name is null then
    raise exception 'La instalación no contiene identidad parroquial verificable';
  end if;
  select id
    into v_existing_vicary
  from public.vicarias
  where diocese_id = v_diocese
    and lower(trim(name)) = lower(v_vicary_name)
  limit 1;

  if v_existing_vicary is null then
    if not p_create_missing_territory then
      raise exception 'La Vicaría % no existe. Autorice crear la jerarquía faltante.', v_vicary_name;
    end if;

    insert into public.vicarias(name,diocese_id)
    values (v_vicary_name,v_diocese)
    returning id into v_existing_vicary;

    v_created_vicary := true;

    insert into public.registry_audit_log(
      actor_user_id,diocese_id,entity_type,entity_id,action,after_data,metadata
    ) values (
      auth.uid(),v_diocese,'vicaria',v_existing_vicary,
      'legacy_verified_vicary_created_v61',
      jsonb_build_object('name',v_vicary_name,'diocese_id',v_diocese),
      jsonb_build_object(
        'source_installation_id',v_source.id,
        'evidence',coalesce(p_evidence,'{}'::jsonb)
      )
    );
  end if;

  v_vicary_id := v_existing_vicary;

  select id
    into v_existing_deanery
  from public.decanatos
  where diocese_id = v_diocese
    and vicaria_id = v_vicary_id
    and lower(trim(name)) = lower(v_deanery_name)
  limit 1;

  if v_existing_deanery is null then
    if not p_create_missing_territory then
      raise exception 'El Decanato % no existe en la Vicaría %. Autorice crear la jerarquía faltante.',
        v_deanery_name,v_vicary_name;
    end if;

    insert into public.decanatos(name,diocese_id,vicaria_id)
    values (v_deanery_name,v_diocese,v_vicary_id)
    returning id into v_existing_deanery;

    v_created_deanery := true;

    insert into public.registry_audit_log(
      actor_user_id,diocese_id,entity_type,entity_id,action,after_data,metadata
    ) values (
      auth.uid(),v_diocese,'decanato',v_existing_deanery,
      'legacy_verified_deanery_created_v61',
      jsonb_build_object(
        'name',v_deanery_name,
        'diocese_id',v_diocese,
        'vicaria_id',v_vicary_id
      ),
      jsonb_build_object(
        'source_installation_id',v_source.id,
        'evidence',coalesce(p_evidence,'{}'::jsonb)
      )
    );
  end if;

  v_deanery_id := v_existing_deanery;
  select p.id
    into v_existing_parish
  from public.parishes p
  where p.diocese_id = v_diocese
    and (
      lower(trim(p.name)) = lower(v_legacy_name)
      or (
        v_nit is not null
        and nullif(trim(p.nit),'') is not null
        and regexp_replace(p.nit,'[^0-9A-Za-z]','','g')
            = regexp_replace(v_nit,'[^0-9A-Za-z]','','g')
      )
    )
  limit 1;

  if v_existing_parish is not null then
    if exists(
      select 1
      from public.parishes p
      where p.id = v_existing_parish
        and (
          (p.vicary_id is not null and p.vicary_id is distinct from v_vicary_id)
          or (p.decanate_id is not null and p.decanate_id is distinct from v_deanery_id)
        )
    ) then
      raise exception 'La parroquia moderna coincidente ya tiene una jerarquía territorial diferente. Revise antes de vincular.';
    end if;

    update public.parishes
    set vicary_id = coalesce(vicary_id,v_vicary_id),
        decanate_id = coalesce(decanate_id,v_deanery_id)
    where id = v_existing_parish;

    select public.map_legacy_source_installation_v45(
      p_source_installation_id,
      v_existing_parish
    ) into v_result;

    v_parish_id := v_existing_parish;
  else
    select public.create_parish_from_legacy_installation_v56(
      p_source_installation_id,
      v_vicary_id,
      v_deanery_id
    ) into v_result;

    v_parish_id := (v_result->>'parish_id')::uuid;
  end if;

  update public.legacy_source_installations
  set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
        'verified_territory_v61',true,
        'verified_territory_at',now(),
        'verified_vicary_id',v_vicary_id,
        'verified_vicary_name',v_vicary_name,
        'verified_deanery_id',v_deanery_id,
        'verified_deanery_name',v_deanery_name,
        'verified_territory_evidence',coalesce(p_evidence,'{}'::jsonb)
      ),
      updated_at = now()
  where id = p_source_installation_id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,
    entity_type,entity_id,action,after_data,metadata
  ) values (
    auth.uid(),v_parish_id,v_diocese,
    'legacy_source_installation',v_source.id,
    'reconcile_verified_territory_v61',
    jsonb_build_object(
      'parish_id',v_parish_id,
      'vicary_id',v_vicary_id,
      'deanery_id',v_deanery_id,
      'created_vicary',v_created_vicary,
      'created_deanery',v_created_deanery
    ),
    jsonb_build_object(
      'legacy_parish_name',v_legacy_name,
      'legacy_nit',v_nit,
      'evidence',coalesce(p_evidence,'{}'::jsonb)
    )
  );

  return jsonb_build_object(
    'status',case when v_existing_parish is null then 'created_parish' else 'mapped_existing_parish' end,
    'installation_id',v_source.id,
    'parish_id',v_parish_id,
    'parish_name',v_legacy_name,
    'vicary_id',v_vicary_id,
    'vicary_name',v_vicary_name,
    'deanery_id',v_deanery_id,
    'deanery_name',v_deanery_name,
    'created_vicary',v_created_vicary,
    'created_deanery',v_created_deanery,
    'mapping',v_result
  );
end;
$$;

revoke all on function public.reconcile_legacy_installation_territory_v61(uuid,text,text,boolean,jsonb) from public;
revoke all on function public.reconcile_legacy_installation_territory_v61(uuid,text,text,boolean,jsonb) from anon;
grant execute on function public.reconcile_legacy_installation_territory_v61(uuid,text,text,boolean,jsonb) to authenticated;

comment on function public.reconcile_legacy_installation_territory_v61(uuid,text,text,boolean,jsonb)
is 'Reconciliación auditada de instalación SACRAMENTA: crea jerarquía territorial faltante y vincula/crea la parroquia moderna sólo con autorización diocesana.';
