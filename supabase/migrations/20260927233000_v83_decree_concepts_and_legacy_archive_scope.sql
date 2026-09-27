-- SACRAMENTUM V83
-- Conceptos de Decreto por sacramento + aislamiento de territorio legacy.

alter table public.parishes
  add column if not exists is_operational boolean;

update public.parishes
set is_operational = true
where is_operational is null;

alter table public.parishes
  alter column is_operational set default true,
  alter column is_operational set not null;

comment on column public.parishes.is_operational is
'TRUE: parroquia operativa. FALSE: contenedor histórico legacy usado sólo para preservar namespace y procedencia.';

create or replace function public.enforce_parish_hierarchy()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_vicaria_diocese uuid;
  v_decanato_diocese uuid;
  v_decanato_vicaria uuid;
  v_origin_ok boolean:=false;
begin
  if new.diocese_id is null then
    raise exception 'La parroquia debe pertenecer a una Diócesis/Arquidiócesis';
  end if;

  if coalesce(new.is_operational,true) = false then
    if new.vicary_id is not null or new.decanate_id is not null then
      raise exception 'Un contenedor histórico legacy no puede pertenecer a la estructura territorial operativa';
    end if;
    return new;
  end if;

  if coalesce(new.legacy_territory_pending,false) then
    if new.legacy_origin_id is null then
      raise exception 'Una parroquia con territorio legacy pendiente debe conservar su origen verificado';
    end if;

    select exists(
      select 1
      from public.legacy_source_origins o
      join public.legacy_source_installations s on s.id=o.source_installation_id
      where o.id=new.legacy_origin_id
        and o.origin_kind in ('parish_snapshot','parish_snapshot_family')
        and o.identity_status in ('verified_unmapped','verified')
        and s.owner_diocese_id=new.diocese_id
    ) into v_origin_ok;

    if not v_origin_ok then
      raise exception 'El origen legacy no justifica una excepción territorial en esta jurisdicción';
    end if;

    if (new.vicary_id is null) <> (new.decanate_id is null) then
      raise exception 'Vicaría y Decanato deben permanecer ambos pendientes o ambos informados';
    end if;
  elsif new.vicary_id is null or new.decanate_id is null then
    raise exception 'Toda Parroquia operativa debe pertenecer a una Vicaría y a un Decanato';
  end if;

  if new.decanate_id is not null then
    select diocese_id,vicaria_id
      into v_decanato_diocese,v_decanato_vicaria
    from public.decanatos
    where id=new.decanate_id;

    if v_decanato_diocese is null then
      raise exception 'El Decanato seleccionado no existe';
    end if;
    if v_decanato_diocese is distinct from new.diocese_id then
      raise exception 'La Parroquia y el Decanato deben pertenecer a la misma jurisdicción';
    end if;
    if new.vicary_id is null then
      new.vicary_id:=v_decanato_vicaria;
    elsif new.vicary_id is distinct from v_decanato_vicaria then
      raise exception 'El Decanato seleccionado no pertenece a la Vicaría indicada';
    end if;
  end if;

  if new.vicary_id is not null then
    select diocese_id into v_vicaria_diocese
    from public.vicarias
    where id=new.vicary_id;

    if v_vicaria_diocese is null then
      raise exception 'La Vicaría seleccionada no existe';
    end if;
    if v_vicaria_diocese is distinct from new.diocese_id then
      raise exception 'La Parroquia y la Vicaría deben pertenecer a la misma jurisdicción';
    end if;
  end if;

  return new;
end;
$$;

update public.parishes
set is_operational = false,
    vicary_id = null,
    decanate_id = null,
    deanery_id = null,
    legacy_territory_pending = false,
    updated_at = now()
where id in (
  '82c01f3c-e319-4c57-b83b-b2de4e8a2439'::uuid,
  '3a423687-928d-41ec-95bf-e0b3cabb326f'::uuid
);

delete from public.decanatos
where id = 'e2076a4e-18b7-4f6e-95fa-6e404eecfcbb'::uuid;

delete from public.vicarias
where id = 'cbbe398b-5518-4ee0-93bc-12bbb3afdbdd'::uuid;

revoke execute on function public.create_parish_from_legacy_installation_v56(uuid,uuid,uuid) from public, anon, authenticated;
revoke execute on function public.create_parish_from_legacy_origin_v66(uuid,uuid,uuid) from public, anon, authenticated;
revoke execute on function public.create_pending_territory_parish_from_legacy_origin_v69(uuid) from public, anon, authenticated;
revoke execute on function public.finalize_legacy_parish_territory_v69(uuid,uuid,uuid) from public, anon, authenticated;
revoke execute on function public.reconcile_legacy_installation_territory_v61(uuid,text,text,boolean,jsonb) from public, anon, authenticated;

grant execute on function public.create_parish_from_legacy_installation_v56(uuid,uuid,uuid) to service_role;
grant execute on function public.create_parish_from_legacy_origin_v66(uuid,uuid,uuid) to service_role;
grant execute on function public.create_pending_territory_parish_from_legacy_origin_v69(uuid) to service_role;
grant execute on function public.finalize_legacy_parish_territory_v69(uuid,uuid,uuid) to service_role;
grant execute on function public.reconcile_legacy_installation_territory_v61(uuid,text,text,boolean,jsonb) to service_role;

alter table public.conceptos_anulacion
  add column if not exists sacrament_type text,
  add column if not exists source_kind text,
  add column if not exists source_reference text;

update public.conceptos_anulacion
set sacrament_type = coalesce(nullif(lower(trim(sacrament_type)),''),'general'),
    source_kind = coalesce(nullif(trim(source_kind),''),'manual')
where sacrament_type is null
   or source_kind is null
   or trim(coalesce(sacrament_type,'')) = ''
   or trim(coalesce(source_kind,'')) = '';

alter table public.conceptos_anulacion
  alter column sacrament_type set default 'general',
  alter column sacrament_type set not null,
  alter column source_kind set default 'manual',
  alter column source_kind set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_conceptos_anulacion_sacrament_type_v83'
      and conrelid = 'public.conceptos_anulacion'::regclass
  ) then
    alter table public.conceptos_anulacion
      add constraint chk_conceptos_anulacion_sacrament_type_v83
      check (sacrament_type in ('general','bautismo','confirmacion','matrimonio','exequias'));
  end if;
end
$$;

create unique index if not exists uq_conceptos_anulacion_diocese_codigo_v83
  on public.conceptos_anulacion(diocese_id,codigo);

create index if not exists idx_conceptos_anulacion_scope_v83
  on public.conceptos_anulacion(diocese_id,sacrament_type,tipo,is_active,codigo);

comment on column public.conceptos_anulacion.sacrament_type is
'Alcance del concepto: general, bautismo, confirmacion, matrimonio o exequias.';
comment on column public.conceptos_anulacion.source_kind is
'Origen del concepto: manual, legacy_catalog u otra fuente institucional.';
comment on column public.conceptos_anulacion.source_reference is
'Referencia auditable al origen documental del concepto.';

insert into public.conceptos_anulacion(
  diocese_id,codigo,concepto,expide,tipo,seinscribe,gennota,gendocum,enlibro,
  sacrament_type,source_kind,source_reference,is_active
)
values
(
  '452d50bc-ff3e-448e-9b93-1e97f8d321e2'::uuid,
  '001','ERROR DE TRANSCRIPCION O REPETICION','',
  'porRepeticion',false,false,false,0,
  'general','legacy_catalog','CPTOANULA.DBF · shared_catalogs · fila 1',true
),
(
  '452d50bc-ff3e-448e-9b93-1e97f8d321e2'::uuid,
  '002','DECRETO DE CORRECCION DE BAUTISMO','OFICINA DE DOCUMENTOS DE CANCILLERIA',
  'porCorreccion',true,true,true,2,
  'bautismo','legacy_catalog','CPTOANULA.DBF · shared_catalogs · fila 2',true
),
(
  '452d50bc-ff3e-448e-9b93-1e97f8d321e2'::uuid,
  '003','DECRETO DE CORRECCION DE MATRIMONIO','OFICINA DE DOCUMENTOS DE CANCILLERIA',
  'porCorreccion',true,true,true,2,
  'matrimonio','legacy_catalog','CPTOANULA.DBF · shared_catalogs · fila 3',true
),
(
  '452d50bc-ff3e-448e-9b93-1e97f8d321e2'::uuid,
  '004','DECRETO DE CORRECCION DE CONFIRMACION','OFICINA DE DOCUMENTOS DE CANCILLERIA',
  'porCorreccion',true,true,true,1,
  'confirmacion','legacy_catalog','CPTOANULA.DBF · shared_catalogs · fila 4',true
)
on conflict (diocese_id,codigo) do update
set concepto = excluded.concepto,
    expide = excluded.expide,
    tipo = excluded.tipo,
    seinscribe = excluded.seinscribe,
    gennota = excluded.gennota,
    gendocum = excluded.gendocum,
    enlibro = excluded.enlibro,
    sacrament_type = excluded.sacrament_type,
    source_kind = excluded.source_kind,
    source_reference = excluded.source_reference,
    is_active = true,
    updated_at = now();

create schema if not exists private;

create or replace function private.normalize_decree_sacrament_scope_v83(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when lower(coalesce(p_value,'')) like '%confirm%' then 'confirmacion'
    when lower(coalesce(p_value,'')) like '%matrim%' then 'matrimonio'
    when lower(coalesce(p_value,'')) like '%exequ%' or lower(coalesce(p_value,'')) like '%funer%' then 'exequias'
    when lower(coalesce(p_value,'')) like '%baut%' or lower(coalesce(p_value,'')) like '%bapt%' then 'bautismo'
    else null
  end;
$$;

revoke all on function private.normalize_decree_sacrament_scope_v83(text) from public, anon, authenticated;

create or replace function private.validate_and_snapshot_decree_concept_v83()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_concept_id uuid;
  v_concept public.conceptos_anulacion%rowtype;
  v_diocese_id uuid;
  v_decree_scope text;
  v_concept_scope text;
  v_policy jsonb;
begin
  new.payload := coalesce(new.payload,'{}'::jsonb);

  if nullif(new.payload->>'conceptoAnulacionId','') is null then
    return new;
  end if;

  begin
    v_concept_id := (new.payload->>'conceptoAnulacionId')::uuid;
  exception when others then
    raise exception 'El identificador del Concepto de Decreto no es válido';
  end;

  v_diocese_id := new.diocese_id;
  if v_diocese_id is null and new.parish_id is not null then
    select p.diocese_id into v_diocese_id
    from public.parishes p
    where p.id = new.parish_id;
    new.diocese_id := v_diocese_id;
  end if;

  select c.* into v_concept
  from public.conceptos_anulacion c
  where c.id = v_concept_id
    and c.diocese_id = v_diocese_id
    and coalesce(c.is_active,true) = true;

  if not found then
    raise exception 'El Concepto de Decreto no pertenece a la jurisdicción o está inactivo';
  end if;

  v_decree_scope := private.normalize_decree_sacrament_scope_v83(
    coalesce(new.sacrament_type,new.payload->>'sacramentType',new.payload->>'sacramento')
  );
  v_concept_scope := lower(coalesce(v_concept.sacrament_type,'general'));

  if v_concept_scope <> 'general'
     and (v_decree_scope is null or v_concept_scope <> v_decree_scope) then
    raise exception 'El Concepto de Decreto (%) corresponde a %, no a %',
      v_concept.codigo, v_concept_scope, coalesce(v_decree_scope,'un sacramento no identificado');
  end if;

  v_policy := jsonb_build_object(
    'conceptId',v_concept.id,
    'code',coalesce(v_concept.codigo,''),
    'concept',coalesce(v_concept.concepto,''),
    'issuer',coalesce(v_concept.expide,''),
    'registersEffect',coalesce(v_concept.seinscribe,true),
    'generatesMarginalNote',coalesce(v_concept.gennota,true),
    'generatesDocument',coalesce(v_concept.gendocum,true),
    'bookMode',coalesce(v_concept.enlibro,0),
    'decreeType',coalesce(v_concept.tipo,''),
    'sacramentType',v_concept_scope,
    'sourceKind',coalesce(v_concept.source_kind,'manual'),
    'sourceReference',coalesce(v_concept.source_reference,'')
  );

  new.payload := new.payload
    || jsonb_build_object(
      'conceptoAnulacionId',v_concept.id,
      'conceptPolicy',v_policy
    );

  return new;
end;
$$;

revoke all on function private.validate_and_snapshot_decree_concept_v83() from public, anon, authenticated;

drop trigger if exists trg_decree_concept_snapshot_insert_v83 on public.decretos;
create trigger trg_decree_concept_snapshot_insert_v83
before insert on public.decretos
for each row execute function private.validate_and_snapshot_decree_concept_v83();

drop trigger if exists trg_decree_concept_snapshot_update_v83 on public.decretos;
create trigger trg_decree_concept_snapshot_update_v83
before update of payload,sacrament_type,diocese_id on public.decretos
for each row execute function private.validate_and_snapshot_decree_concept_v83();

update public.decretos d
set status = 'archived',
    payload = coalesce(d.payload,'{}'::jsonb)
      || jsonb_build_object(
        'legacyHistorical',true,
        'recordOrigin','legacy_import',
        'issuanceMode','historical_materialization',
        'conceptoAnulacionId',c.id
      ),
    updated_at = now()
from public.conceptos_anulacion c
where d.tipo ilike '%legacy%'
  and c.diocese_id = d.diocese_id
  and c.codigo = coalesce(
    d.payload->>'conceptCode',
    d.payload->>'concept_code',
    d.payload->'legacyRaw'->>'codiconcep'
  );

insert into public.registry_audit_log(
  actor_user_id,diocese_id,entity_type,entity_id,action,before_data,after_data,metadata
)
select
  null,
  p.diocese_id,
  'parish',
  p.id,
  'legacy_container_marked_non_operational_v83',
  jsonb_build_object('legacy_name',p.name),
  jsonb_build_object('is_operational',false),
  jsonb_build_object(
    'reason','La procedencia legacy no debe convertirse automáticamente en una parroquia operativa.',
    'preserves_registry_namespace',true,
    'migration','V83'
  )
from public.parishes p
where p.id in (
  '82c01f3c-e319-4c57-b83b-b2de4e8a2439'::uuid,
  '3a423687-928d-41ec-95bf-e0b3cabb326f'::uuid
)
and not exists (
  select 1
  from public.registry_audit_log a
  where a.entity_id = p.id
    and a.action = 'legacy_container_marked_non_operational_v83'
);

comment on function private.validate_and_snapshot_decree_concept_v83() is
'V83: valida jurisdicción y sacramento del concepto y guarda una copia inmutable de sus efectos dentro del decreto.';
