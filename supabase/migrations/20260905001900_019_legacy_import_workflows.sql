-- ============================================================================
-- SACRAMENTUM · Fase 3.19 · Flujos seguros de importación histórica
-- Los archivos se cargan en staging, se validan y sólo luego se aplican.
-- ============================================================================

-- --------------------------------------------------------------------------
-- Helpers de autorización.
-- --------------------------------------------------------------------------
create or replace function public.can_manage_legacy_import(
  p_parish_id uuid default null,
  p_diocese_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_role text;
  v_diocese uuid;
begin
  if auth.uid() is null then return false; end if;
  v_role := public.current_app_role();
  v_diocese := public.current_app_diocese_id();
  if v_role='admin_general' then return true; end if;
  if v_role='diocese' then
    if p_diocese_id is not null and p_diocese_id is distinct from v_diocese then return false; end if;
    if p_parish_id is not null and not exists(select 1 from public.parishes p where p.id=p_parish_id and p.diocese_id=v_diocese) then return false; end if;
    return true;
  end if;
  return false;
end;
$$;
revoke all on function public.can_manage_legacy_import(uuid,uuid) from public;
grant execute on function public.can_manage_legacy_import(uuid,uuid) to authenticated;

-- --------------------------------------------------------------------------
-- Crear lote. El hash evita cargas accidentales repetidas, sin prohibirlas.
-- --------------------------------------------------------------------------
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
set search_path=public
as $$
declare
  v_id uuid;
  v_profile public.legacy_import_profiles%rowtype;
  v_diocese uuid := p_diocese_id;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  select * into v_profile from public.legacy_import_profiles where profile_key=upper(trim(p_profile_key)) and active=true;
  if not found then raise exception 'Perfil de importación no soportado: %',p_profile_key; end if;

  if p_parish_id is not null and v_diocese is null then
    select diocese_id into v_diocese from public.parishes where id=p_parish_id;
  end if;
  if not public.can_manage_legacy_import(p_parish_id,v_diocese) then raise exception 'No autorizado para importar en este ámbito'; end if;
  if v_profile.requires_parish and p_parish_id is null then
    raise exception 'El perfil % requiere seleccionar parroquia destino',v_profile.profile_key;
  end if;

  insert into public.legacy_import_batches(
    source_system,source_name,original_filename,profile_key,sha256,parish_id,diocese_id,status,created_by,metadata
  ) values (
    'SACRAMENTA_PLUS',nullif(trim(p_source_name),''),trim(p_filename),v_profile.profile_key,nullif(trim(p_sha256),''),
    p_parish_id,v_diocese,'staged',auth.uid(),coalesce(p_metadata,'{}'::jsonb)
  ) returning id into v_id;

  insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
  values(auth.uid(),p_parish_id,v_diocese,'legacy_import_batch',v_id,'legacy_import_batch_created',
         jsonb_build_object('filename',p_filename,'profile_key',v_profile.profile_key,'sha256',p_sha256),coalesce(p_metadata,'{}'::jsonb));
  return v_id;
end;
$$;
revoke all on function public.create_legacy_import_batch(text,text,text,text,uuid,uuid,jsonb) from public;
grant execute on function public.create_legacy_import_batch(text,text,text,text,uuid,uuid,jsonb) to authenticated;

-- --------------------------------------------------------------------------
-- Staging por bloques. p_rows = [{row_number,source_key,checksum,original_data,
-- normalized_data,status,issue_codes,issue_details,target_entity}, ...]
-- --------------------------------------------------------------------------
create or replace function public.stage_legacy_import_rows(
  p_batch_id uuid,
  p_rows jsonb
)
returns table(staged_count integer, review_count integer, valid_count integer)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_batch public.legacy_import_batches%rowtype;
  r jsonb;
  v_status text;
  c_staged integer:=0; c_review integer:=0; c_valid integer:=0;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  select * into v_batch from public.legacy_import_batches where id=p_batch_id for update;
  if not found then raise exception 'Lote no encontrado'; end if;
  if not public.can_manage_legacy_import(v_batch.parish_id,v_batch.diocese_id) then raise exception 'No autorizado'; end if;
  if jsonb_typeof(p_rows)<>'array' then raise exception 'p_rows debe ser un arreglo JSON'; end if;
  if jsonb_array_length(p_rows)>500 then raise exception 'Máximo 500 filas por bloque'; end if;

  for r in select value from jsonb_array_elements(p_rows)
  loop
    v_status:=lower(coalesce(r->>'status','staged'));
    if v_status not in ('staged','valid','review','duplicate','skipped','error') then v_status:='staged'; end if;
    insert into public.legacy_import_rows(
      batch_id,row_number,source_key,checksum,target_entity,original_data,normalized_data,status,issue_codes,issue_details
    ) values (
      p_batch_id,(r->>'row_number')::integer,nullif(r->>'source_key',''),nullif(r->>'checksum',''),
      coalesce(nullif(r->>'target_entity',''),(select target_entity from public.legacy_import_profiles where profile_key=v_batch.profile_key)),
      coalesce(r->'original_data','{}'::jsonb),coalesce(r->'normalized_data','{}'::jsonb),v_status,
      coalesce(array(select jsonb_array_elements_text(coalesce(r->'issue_codes','[]'::jsonb))),'{}'::text[]),
      coalesce(r->'issue_details','{}'::jsonb)
    ) on conflict(batch_id,row_number) do update set
      source_key=excluded.source_key,checksum=excluded.checksum,target_entity=excluded.target_entity,
      original_data=excluded.original_data,normalized_data=excluded.normalized_data,status=excluded.status,
      issue_codes=excluded.issue_codes,issue_details=excluded.issue_details,updated_at=now();
    c_staged:=c_staged+1;
    if v_status='review' then c_review:=c_review+1; end if;
    if v_status='valid' then c_valid:=c_valid+1; end if;
  end loop;

  update public.legacy_import_batches b set
    row_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id),
    valid_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='valid'),
    review_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='review'),
    skipped_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status in ('skipped','duplicate')),
    error_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='error'),
    status='analyzed',updated_at=now()
  where id=p_batch_id;

  return query select c_staged,c_review,c_valid;
end;
$$;
revoke all on function public.stage_legacy_import_rows(uuid,jsonb) from public;
grant execute on function public.stage_legacy_import_rows(uuid,jsonb) to authenticated;

-- Revisar/corregir una fila sin alterar original_data.
create or replace function public.review_legacy_import_row(
  p_row_id uuid,
  p_normalized_data jsonb,
  p_status text,
  p_issue_codes text[] default '{}'::text[],
  p_issue_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare v_batch public.legacy_import_batches%rowtype;
begin
  select b.* into v_batch from public.legacy_import_rows r join public.legacy_import_batches b on b.id=r.batch_id where r.id=p_row_id;
  if not found then raise exception 'Fila no encontrada'; end if;
  if not public.can_manage_legacy_import(v_batch.parish_id,v_batch.diocese_id) then raise exception 'No autorizado'; end if;
  if lower(p_status) not in ('valid','review','skipped') then raise exception 'Estado de revisión inválido'; end if;
  update public.legacy_import_rows set normalized_data=coalesce(p_normalized_data,'{}'::jsonb),status=lower(p_status),
    issue_codes=coalesce(p_issue_codes,'{}'::text[]),issue_details=coalesce(p_issue_details,'{}'::jsonb),
    reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=p_row_id;
  update public.legacy_import_batches b set
    valid_count=(select count(*) from public.legacy_import_rows where batch_id=b.id and status='valid'),
    review_count=(select count(*) from public.legacy_import_rows where batch_id=b.id and status='review'),
    skipped_count=(select count(*) from public.legacy_import_rows where batch_id=b.id and status in ('skipped','duplicate')),
    updated_at=now() where b.id=v_batch.id;
end;
$$;
revoke all on function public.review_legacy_import_row(uuid,jsonb,text,text[],jsonb) from public;
grant execute on function public.review_legacy_import_row(uuid,jsonb,text,text[],jsonb) to authenticated;

-- --------------------------------------------------------------------------
-- Importador por bloques. Sólo procesa filas status=valid.
-- --------------------------------------------------------------------------
create or replace function public.apply_legacy_import_batch(
  p_batch_id uuid,
  p_limit integer default 250
)
returns table(imported integer, failed integer, remaining integer)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_batch public.legacy_import_batches%rowtype;
  v_profile public.legacy_import_profiles%rowtype;
  r public.legacy_import_rows%rowtype;
  d jsonb;
  v_target uuid;
  v_existing uuid;
  v_diocese uuid;
  v_imported integer:=0; v_failed integer:=0;
  v_book text; v_folio text; v_number text;
  v_date date; v_birth date; v_date2 date;
  v_source_key text;
  v_doc_code text;
  v_vars text[];
  v_sacrament text;
  v_original uuid; v_new uuid; v_decree uuid;
  v_concept text;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if p_limit<1 or p_limit>1000 then raise exception 'Límite inválido'; end if;
  select * into v_batch from public.legacy_import_batches where id=p_batch_id for update;
  if not found then raise exception 'Lote no encontrado'; end if;
  if not public.can_manage_legacy_import(v_batch.parish_id,v_batch.diocese_id) then raise exception 'No autorizado'; end if;
  select * into v_profile from public.legacy_import_profiles where profile_key=v_batch.profile_key;
  v_diocese:=v_batch.diocese_id;
  update public.legacy_import_batches set status='importing',updated_at=now() where id=p_batch_id;

  for r in
    select * from public.legacy_import_rows
    where batch_id=p_batch_id and status='valid'
    order by row_number
    limit p_limit
    for update skip locked
  loop
    begin
      d:=r.normalized_data;
      v_target:=null; v_existing:=null;
      v_source_key:=coalesce(r.source_key,r.row_number::text);

      -- Idempotencia entre lotes.
      select l.target_id into v_existing from public.legacy_record_links l
       where l.source_system=v_batch.source_system and l.profile_key=v_batch.profile_key and l.source_key=v_source_key;
      if v_existing is not null then
        update public.legacy_import_rows set status='duplicate',target_id=v_existing,imported_at=now(),updated_at=now() where id=r.id;
        continue;
      end if;

      if r.target_entity='baptism' then
        if v_batch.parish_id is null then raise exception 'Parroquia destino requerida'; end if;
        v_book:=public.sacramentum_registry_ref(d->>'book_number'); v_folio:=public.sacramentum_registry_ref(d->>'folio'); v_number:=public.sacramentum_registry_ref(d->>'number');
        if v_book is null or v_folio is null or v_number is null then raise exception 'Libro/Folio/Número incompletos'; end if;
        if exists(select 1 from public.baptisms b where b.parish_id=v_batch.parish_id and public.sacramentum_registry_ref(b.book_number)=v_book and public.sacramentum_registry_ref(b.folio)=v_folio and public.sacramentum_registry_ref(b.number)=v_number) then
          select id into v_target from public.baptisms b where b.parish_id=v_batch.parish_id and public.sacramentum_registry_ref(b.book_number)=v_book and public.sacramentum_registry_ref(b.folio)=v_folio and public.sacramentum_registry_ref(b.number)=v_number limit 1;
        else
          begin v_date:=nullif(d->>'celebration_date','')::date; exception when others then raise exception 'Fecha de Bautismo inválida'; end;
          begin v_birth:=nullif(d->>'birth_date','')::date; exception when others then raise exception 'Fecha de nacimiento inválida'; end;
          begin v_date2:=nullif(d->>'civil_registry_date','')::date; exception when others then raise exception 'Fecha de Registro Civil inválida'; end;
          insert into public.baptisms(parish_id,book_number,folio,number,status,celebration_date,lugar_bautismo,apellidos,nombres,sexo,fecha_nacimiento,lugar_nacimiento,tipo_union_padres,nombre_padre,cedula_padre,nombre_madre,cedula_madre,abuelos_paternos,abuelos_maternos,padrinos,ministro,da_fe,nuip,numero_registro,oficina_registro,fecha_expedicion_registro,direccion,observations,nota_marginal,raw_data)
          values(v_batch.parish_id,v_book,v_folio,v_number,case when coalesce((d->>'annulled')::boolean,false) then 'anulada' else 'seated' end,v_date,nullif(d->>'celebration_place',''),nullif(d->>'last_names',''),nullif(d->>'names',''),nullif(d->>'gender',''),v_birth,nullif(d->>'birth_place',''),nullif(d->>'parent_union_type',''),nullif(d->>'father_name',''),nullif(d->>'father_document',''),nullif(d->>'mother_name',''),nullif(d->>'mother_document',''),nullif(d->>'paternal_grandparents',''),nullif(d->>'maternal_grandparents',''),nullif(d->>'godparents',''),nullif(d->>'minister',''),nullif(d->>'legacy_dafe_code',''),nullif(d->>'nuip',''),nullif(d->>'civil_registry_number',''),nullif(d->>'civil_registry_office',''),v_date2,nullif(d->>'address',''),nullif(d->>'observations',''),nullif(d->>'legacy_marginal_note',''),coalesce(r.original_data,'{}'::jsonb)||jsonb_build_object('legacy_normalized',d,'source','legacy_import')) returning id into v_target;
        end if;

      elsif r.target_entity='confirmation' then
        if v_batch.parish_id is null then raise exception 'Parroquia destino requerida'; end if;
        v_book:=public.sacramentum_registry_ref(d->>'book_number'); v_folio:=public.sacramentum_registry_ref(d->>'folio'); v_number:=public.sacramentum_registry_ref(d->>'number');
        if v_book is null or v_folio is null or v_number is null then raise exception 'Libro/Folio/Número incompletos'; end if;
        if exists(select 1 from public.confirmations c where c.parish_id=v_batch.parish_id and public.sacramentum_registry_ref(c.book_number)=v_book and public.sacramentum_registry_ref(c.folio)=v_folio and public.sacramentum_registry_ref(c.number)=v_number) then
          select id into v_target from public.confirmations c where c.parish_id=v_batch.parish_id and public.sacramentum_registry_ref(c.book_number)=v_book and public.sacramentum_registry_ref(c.folio)=v_folio and public.sacramentum_registry_ref(c.number)=v_number limit 1;
        else
          begin v_date:=nullif(d->>'celebration_date','')::date; exception when others then raise exception 'Fecha de Confirmación inválida'; end;
          if v_date is null then raise exception 'Fecha de Confirmación obligatoria'; end if;
          begin v_birth:=nullif(d->>'birth_date','')::date; exception when others then raise exception 'Fecha de nacimiento inválida'; end;
          begin v_date2:=nullif(d->>'baptism_date','')::date; exception when others then raise exception 'Fecha de Bautismo inválida'; end;
          insert into public.confirmations(parish_id,book_number,folio,number,status,celebration_date,fecha_nacimiento,fecha_bautismo,lugar_bautismo,lugar_nacimiento,apellidos,nombres,sexo,nombre_padre,nombre_madre,padrinos,ministro,da_fe,observations,raw_data)
          values(v_batch.parish_id,v_book,v_folio,v_number,case when coalesce((d->>'annulled')::boolean,false) then 'anulada' else 'seated' end,v_date,v_birth,v_date2,nullif(d->>'baptism_place',''),nullif(d->>'birth_place',''),nullif(d->>'last_names',''),nullif(d->>'names',''),nullif(d->>'gender',''),nullif(d->>'father_name',''),nullif(d->>'mother_name',''),nullif(d->>'sponsor',''),nullif(d->>'minister',''),nullif(d->>'legacy_dafe_code',''),nullif(d->>'observations',''),coalesce(r.original_data,'{}'::jsonb)||jsonb_build_object('legacy_normalized',d,'source','legacy_import')) returning id into v_target;
        end if;

      elsif r.target_entity='marriage' then
        if v_batch.parish_id is null then raise exception 'Parroquia destino requerida'; end if;
        v_book:=public.sacramentum_registry_ref(d->>'book_number'); v_folio:=public.sacramentum_registry_ref(d->>'folio'); v_number:=public.sacramentum_registry_ref(d->>'number');
        if v_book is null or v_folio is null or v_number is null then raise exception 'Libro/Folio/Número incompletos'; end if;
        if exists(select 1 from public.marriages m where m.parish_id=v_batch.parish_id and public.sacramentum_registry_ref(m.book_number)=v_book and public.sacramentum_registry_ref(m.folio)=v_folio and public.sacramentum_registry_ref(m.number)=v_number) then
          select id into v_target from public.marriages m where m.parish_id=v_batch.parish_id and public.sacramentum_registry_ref(m.book_number)=v_book and public.sacramentum_registry_ref(m.folio)=v_folio and public.sacramentum_registry_ref(m.number)=v_number limit 1;
        else
          begin v_date:=nullif(d->>'celebration_date','')::date; exception when others then raise exception 'Fecha de Matrimonio inválida'; end;
          if v_date is null then raise exception 'Fecha de Matrimonio obligatoria'; end if;
          insert into public.marriages(parish_id,celebration_date,book_number,folio,number,observations,status,raw_data)
          values(v_batch.parish_id,v_date,v_book,v_folio,v_number,nullif(d->>'observations',''),case when coalesce((d->>'annulled')::boolean,false) then 'annulled' else 'seated' end,coalesce(r.original_data,'{}'::jsonb)||jsonb_build_object('legacy_normalized',d,'source','legacy_import')) returning id into v_target;
        end if;

      elsif r.target_entity='funeral' then
        if v_batch.parish_id is null then raise exception 'Parroquia destino requerida'; end if;
        v_book:=public.sacramentum_registry_ref(d->>'book_number'); v_folio:=public.sacramentum_registry_ref(d->>'folio'); v_number:=public.sacramentum_registry_ref(d->>'number');
        begin v_date:=nullif(d->>'death_date','')::date; exception when others then raise exception 'Fecha de defunción inválida'; end;
        if v_book is null or v_folio is null or v_number is null or v_date is null then raise exception 'Exequias incompletas'; end if;
        if exists(select 1 from public.funerals f where f.parish_id=v_batch.parish_id and public.sacramentum_registry_ref(f.book_number)=v_book and public.sacramentum_registry_ref(f.folio)=v_folio and public.sacramentum_registry_ref(f.number)=v_number) then
          select id into v_target from public.funerals f where f.parish_id=v_batch.parish_id and public.sacramentum_registry_ref(f.book_number)=v_book and public.sacramentum_registry_ref(f.folio)=v_folio and public.sacramentum_registry_ref(f.number)=v_number limit 1;
        else
          insert into public.funerals(parish_id,book_number,folio,number,status,nombres,apellidos,fecha_defuncion,lugar_defuncion,fecha_exequias,lugar_exequias,cementerio,ministro,da_fe,observations,raw_data)
          values(v_batch.parish_id,v_book,v_folio,v_number,'seated',nullif(d->>'names',''),nullif(d->>'last_names',''),v_date,nullif(d->>'death_place',''),nullif(d->>'funeral_date','')::date,nullif(d->>'funeral_place',''),nullif(d->>'cemetery',''),nullif(d->>'minister',''),nullif(d->>'legacy_dafe_code',''),nullif(d->>'observations',''),coalesce(r.original_data,'{}'::jsonb)||jsonb_build_object('legacy_normalized',d,'source','legacy_import')) returning id into v_target;
        end if;

      elsif r.target_entity='first_communion' then
        if v_batch.parish_id is null then raise exception 'Parroquia destino requerida'; end if;
        begin v_date:=nullif(d->>'celebration_date','')::date; exception when others then raise exception 'Fecha de Primera Comunión inválida'; end;
        begin v_birth:=nullif(d->>'birth_date','')::date; exception when others then raise exception 'Fecha de nacimiento inválida'; end;
        insert into public.first_communions(parish_id,status,celebration_date,place,names,last_names,birth_date,age_text,gender,father_name,mother_name,address,responsible_name,minister,baptism_church_code,baptism_place,baptism_book,baptism_folio,baptism_number,legacy_entry_number,observations,raw_data)
        values(v_batch.parish_id,'registered',v_date,nullif(d->>'celebration_place',''),nullif(d->>'names',''),nullif(d->>'last_names',''),v_birth,nullif(d->>'age_text',''),nullif(d->>'gender',''),nullif(d->>'father_name',''),nullif(d->>'mother_name',''),nullif(d->>'address',''),nullif(d->>'responsible_name',''),nullif(d->>'minister',''),nullif(d->>'baptism_church_code',''),nullif(d->>'baptism_place',''),nullif(d->>'baptism_book',''),nullif(d->>'baptism_folio',''),nullif(d->>'baptism_number',''),nullif(d->>'legacy_entry_number',''),nullif(d->>'observations',''),coalesce(r.original_data,'{}'::jsonb)||jsonb_build_object('legacy_normalized',d,'source','legacy_import')) returning id into v_target;

      elsif r.target_entity='directory_diocese' then
        insert into public.directory_dioceses(legacy_code,name,nit,address,phone,fax,email,city,bishop_1,bishop_2,raw_data)
        values(nullif(d->>'legacy_code',''),coalesce(nullif(d->>'name',''),'SIN NOMBRE'),nullif(d->>'nit',''),nullif(d->>'address',''),nullif(d->>'phone',''),nullif(d->>'fax',''),nullif(d->>'email',''),nullif(d->>'city',''),nullif(d->>'bishop_1',''),nullif(d->>'bishop_2',''),r.original_data) returning id into v_target;

      elsif r.target_entity='directory_church' then
        insert into public.directory_churches(legacy_code,name,nit,address,city,phone,fax,email,priest_name,diocese_legacy_code,raw_data)
        values(nullif(d->>'legacy_code',''),coalesce(nullif(d->>'name',''),'SIN NOMBRE'),nullif(d->>'nit',''),nullif(d->>'address',''),nullif(d->>'city',''),nullif(d->>'phone',''),nullif(d->>'fax',''),nullif(d->>'email',''),nullif(d->>'priest_name',''),nullif(d->>'diocese_legacy_code',''),r.original_data) returning id into v_target;

      elsif r.target_entity='location_dictionary' then
        insert into public.location_dictionary(source,value,usage_count,weight,source_created_at,source_updated_at,source_user,metadata)
        values(nullif(d->>'source',''),coalesce(nullif(d->>'value',''),'SIN DATO'),coalesce((d->>'usage_count')::integer,0),coalesce((d->>'weight')::integer,0),nullif(d->>'source_created_at','')::timestamptz,nullif(d->>'source_updated_at','')::timestamptz,nullif(d->>'source_user',''),jsonb_build_object('legacy',r.original_data))
        on conflict ((coalesce(source,'')), (lower(value))) do update set usage_count=greatest(public.location_dictionary.usage_count,excluded.usage_count),weight=greatest(public.location_dictionary.weight,excluded.weight),updated_at=now()
        returning id into v_target;

      elsif r.target_entity='document_template' then
        v_doc_code:=coalesce(nullif(d->>'code',''),r.source_key,'LEGACY-'||r.row_number);
        v_vars:=array(select distinct m[1] from regexp_matches(coalesce(d->>'template_text',''),'<([^>]+)>','g') m);
        insert into public.document_templates(legacy_code,code,name,category,template_text,variables,scope_type,diocese_id,version,is_active,is_legacy,metadata,created_by)
        values(nullif(d->>'legacy_code',''),v_doc_code,coalesce(nullif(d->>'name',''),'Plantilla histórica'),coalesce(nullif(d->>'category',''),'legacy'),coalesce(d->>'template_text',''),coalesce(v_vars,'{}'::text[]),case when v_batch.diocese_id is null then 'system' else 'diocese' end,v_batch.diocese_id,1,true,true,jsonb_build_object('legacy',r.original_data),auth.uid()) returning id into v_target;

      elsif r.target_entity='annulment_concept' then
        if v_batch.diocese_id is null then raise exception 'Los conceptos requieren seleccionar diócesis destino'; end if;
        insert into public.conceptos_anulacion(diocese_id,seinscribe,gennota,gendocum,enlibro,expide,tipo,concepto,codigo)
        values(v_batch.diocese_id,coalesce((d->>'registers')::boolean,false),coalesce((d->>'generates_note')::boolean,false),coalesce((d->>'generates_document')::boolean,false),coalesce((d->>'book_mode')::integer,0),nullif(d->>'issuer',''),coalesce(nullif(d->>'type',''),'legacy'),coalesce(nullif(d->>'concept',''),'CONCEPTO LEGACY'),coalesce(nullif(d->>'code',''),r.source_key))
        on conflict do nothing returning id into v_target;
        if v_target is null then select id into v_target from public.conceptos_anulacion where diocese_id=v_batch.diocese_id and codigo=coalesce(nullif(d->>'code',''),r.source_key) limit 1; end if;

      elsif r.target_entity='decree_link' then
        if v_batch.parish_id is null then raise exception 'Parroquia destino requerida'; end if;
        v_sacrament:=lower(coalesce(d->>'sacrament_type','bautismo'));
        v_book:=public.sacramentum_registry_ref(d->>'original_book'); v_folio:=public.sacramentum_registry_ref(d->>'original_folio'); v_number:=public.sacramentum_registry_ref(d->>'original_number');
        if v_sacrament in ('bautismo','baptism') then
          select id into v_original from public.baptisms where parish_id=v_batch.parish_id and public.sacramentum_registry_ref(book_number)=v_book and public.sacramentum_registry_ref(folio)=v_folio and public.sacramentum_registry_ref(number)=v_number limit 1;
          select id into v_new from public.baptisms where parish_id=v_batch.parish_id and public.sacramentum_registry_ref(book_number)=public.sacramentum_registry_ref(d->>'new_book') and public.sacramentum_registry_ref(folio)=public.sacramentum_registry_ref(d->>'new_folio') and public.sacramentum_registry_ref(number)=public.sacramentum_registry_ref(d->>'new_number') limit 1;
        elsif v_sacrament in ('confirmacion','confirmation') then
          select id into v_original from public.confirmations where parish_id=v_batch.parish_id and public.sacramentum_registry_ref(book_number)=v_book and public.sacramentum_registry_ref(folio)=v_folio and public.sacramentum_registry_ref(number)=v_number limit 1;
          select id into v_new from public.confirmations where parish_id=v_batch.parish_id and public.sacramentum_registry_ref(book_number)=public.sacramentum_registry_ref(d->>'new_book') and public.sacramentum_registry_ref(folio)=public.sacramentum_registry_ref(d->>'new_folio') and public.sacramentum_registry_ref(number)=public.sacramentum_registry_ref(d->>'new_number') limit 1;
        elsif v_sacrament in ('matrimonio','marriage') then
          select id into v_original from public.marriages where parish_id=v_batch.parish_id and public.sacramentum_registry_ref(book_number)=v_book and public.sacramentum_registry_ref(folio)=v_folio and public.sacramentum_registry_ref(number)=v_number limit 1;
          select id into v_new from public.marriages where parish_id=v_batch.parish_id and public.sacramentum_registry_ref(book_number)=public.sacramentum_registry_ref(d->>'new_book') and public.sacramentum_registry_ref(folio)=public.sacramentum_registry_ref(d->>'new_folio') and public.sacramentum_registry_ref(number)=public.sacramentum_registry_ref(d->>'new_number') limit 1;
        end if;
        if v_original is null then raise exception 'No se encontró la partida original para reconstruir el decreto'; end if;
        begin v_date:=nullif(d->>'decree_date','')::date; exception when others then v_date:=null; end;
        v_concept:=nullif(d->>'concept_code','');
        insert into public.decretos(parish_id,diocese_id,tipo,sacrament_type,decree_number,decree_date,original_record_id,replacement_record_id,status,payload,created_at)
        values(v_batch.parish_id,v_batch.diocese_id,'correction',v_sacrament,nullif(d->>'decree_number',''),v_date,v_original,v_new,'historical',coalesce(r.original_data,'{}'::jsonb)||jsonb_build_object('legacy_normalized',d,'concept_code',v_concept),coalesce(nullif(d->>'legacy_created_at','')::timestamptz,now())) returning id into v_decree;
        v_target:=v_decree;
        insert into public.marginal_notes(sacrament_type,note_type,decree_number,content,parish_id,sacrament_id,note_date,source_type,source_id,decree_id,created_by,status,print_policy,print_default,is_locked,legacy_source)
        values(v_sacrament,'legacy_correction',nullif(d->>'decree_number',''),coalesce(nullif(d->>'original_note',''),'PARTIDA AFECTADA POR DECRETO HISTÓRICO NO. '||coalesce(d->>'decree_number','S/N')||'.'),v_batch.parish_id,v_original,coalesce(v_date,current_date),'decree',v_decree,v_decree,auth.uid(),'active','required',true,true,jsonb_build_object('batch_id',p_batch_id,'row_id',r.id));
        if v_new is not null then
          insert into public.marginal_notes(sacrament_type,note_type,decree_number,content,parish_id,sacrament_id,note_date,source_type,source_id,decree_id,created_by,status,print_policy,print_default,is_locked,legacy_source)
          values(v_sacrament,'legacy_correction_replacement',nullif(d->>'decree_number',''),coalesce(nullif(d->>'replacement_note',''),'PARTIDA CREADA / VINCULADA POR DECRETO HISTÓRICO NO. '||coalesce(d->>'decree_number','S/N')||'.'),v_batch.parish_id,v_new,coalesce(v_date,current_date),'decree',v_decree,v_decree,auth.uid(),'active','required',true,true,jsonb_build_object('batch_id',p_batch_id,'row_id',r.id));
        end if;

      elsif r.target_entity in ('pending_baptism','pending_confirmation','pending_first_communion','pending_marriage','legacy_marginal_note','legacy_settings') then
        -- Estos perfiles requieren reconciliación humana o sólo preservan referencia.
        raise exception 'Perfil % requiere reconciliación y no se importa automáticamente',r.target_entity;
      else
        raise exception 'Entidad de importación no soportada: %',r.target_entity;
      end if;

      if v_target is not null then
        insert into public.legacy_record_links(source_system,profile_key,source_key,checksum,batch_id,row_id,target_table,target_id,metadata)
        values(v_batch.source_system,v_batch.profile_key,v_source_key,r.checksum,p_batch_id,r.id,r.target_entity,v_target,jsonb_build_object('filename',v_batch.original_filename))
        on conflict(source_system,profile_key,source_key) do update set checksum=excluded.checksum,batch_id=excluded.batch_id,row_id=excluded.row_id,target_table=excluded.target_table,target_id=excluded.target_id,updated_at=now();
      end if;
      update public.legacy_import_rows set status='imported',target_table=r.target_entity,target_id=v_target,imported_at=now(),updated_at=now() where id=r.id;
      v_imported:=v_imported+1;
    exception when others then
      update public.legacy_import_rows set status='error',issue_codes=array_append(coalesce(issue_codes,'{}'::text[]),'IMPORT_ERROR'),issue_details=coalesce(issue_details,'{}'::jsonb)||jsonb_build_object('import_error',sqlerrm),updated_at=now() where id=r.id;
      v_failed:=v_failed+1;
    end;
  end loop;

  update public.legacy_import_batches b set
    imported_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='imported'),
    valid_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='valid'),
    review_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='review'),
    skipped_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status in ('skipped','duplicate')),
    error_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='error'),
    status=case
      when exists(select 1 from public.legacy_import_rows where batch_id=p_batch_id and status='valid') then 'ready'
      when exists(select 1 from public.legacy_import_rows where batch_id=p_batch_id and status in ('review','error')) then 'completed_with_review'
      else 'completed' end,
    updated_at=now()
  where id=p_batch_id;

  insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
  values(auth.uid(),v_batch.parish_id,v_batch.diocese_id,'legacy_import_batch',p_batch_id,'legacy_import_batch_applied',
         jsonb_build_object('imported_this_run',v_imported,'failed_this_run',v_failed),jsonb_build_object('profile_key',v_batch.profile_key,'filename',v_batch.original_filename));

  return query select v_imported,v_failed,(select count(*)::integer from public.legacy_import_rows where batch_id=p_batch_id and status='valid');
end;
$$;
revoke all on function public.apply_legacy_import_batch(uuid,integer) from public;
grant execute on function public.apply_legacy_import_batch(uuid,integer) to authenticated;

-- --------------------------------------------------------------------------
-- RLS: staging sólo es visible al administrador o a la diócesis propietaria.
-- Escritura directa se revoca; las mutaciones se hacen por RPC.
-- --------------------------------------------------------------------------
do $$
declare t text; p record;
begin
  foreach t in array array['legacy_import_profiles','legacy_import_batches','legacy_import_rows','legacy_record_links','directory_dioceses','directory_churches','location_dictionary','document_templates','first_communions','marginal_note_templates','marginal_note_template_clauses']
  loop
    execute format('alter table public.%I enable row level security',t);
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy if exists %I on public.%I',p.policyname,t);
    end loop;
  end loop;
end $$;

create policy "legacy_profiles_read" on public.legacy_import_profiles
for select to authenticated using (public.current_app_role() in ('admin_general','diocese','chancery'));

create policy "legacy_batches_read" on public.legacy_import_batches
for select to authenticated using (
  public.is_app_admin() or (public.current_app_role() in ('diocese','chancery') and diocese_id=public.current_app_diocese_id())
);
create policy "legacy_rows_read" on public.legacy_import_rows
for select to authenticated using (exists(
  select 1 from public.legacy_import_batches b where b.id=batch_id and (public.is_app_admin() or (public.current_app_role() in ('diocese','chancery') and b.diocese_id=public.current_app_diocese_id()))
));
create policy "legacy_links_read" on public.legacy_record_links
for select to authenticated using (public.current_app_role() in ('admin_general','diocese','chancery'));

-- Directorios: lectura para usuarios autenticados; escritura sólo por RPC/admin SQL.
create policy "directory_dioceses_read" on public.directory_dioceses for select to authenticated using (true);
create policy "directory_churches_read" on public.directory_churches for select to authenticated using (true);
create policy "location_dictionary_read" on public.location_dictionary for select to authenticated using (true);

create policy "document_templates_read" on public.document_templates
for select to authenticated using (
  is_active and (
    scope_type='system'
    or (scope_type='diocese' and diocese_id=public.current_app_diocese_id())
    or (scope_type='parish' and parish_id=public.current_app_parish_id())
    or public.is_app_admin()
  )
);

create policy "first_communions_read" on public.first_communions
for select to authenticated using (public.can_access_parish(parish_id));

create policy "marginal_templates_read" on public.marginal_note_templates
for select to authenticated using (
  is_active and (
    scope_type='system'
    or (scope_type='diocese' and diocese_id=public.current_app_diocese_id())
    or (scope_type='parish' and parish_id=public.current_app_parish_id())
    or public.is_app_admin()
  )
);
create policy "marginal_clauses_read" on public.marginal_note_template_clauses
for select to authenticated using (exists(select 1 from public.marginal_note_templates t where t.id=template_id and t.is_active));

revoke insert,update,delete on public.legacy_import_batches from authenticated;
revoke insert,update,delete on public.legacy_import_rows from authenticated;
revoke insert,update,delete on public.legacy_record_links from authenticated;
revoke insert,update,delete on public.directory_dioceses from authenticated;
revoke insert,update,delete on public.directory_churches from authenticated;
revoke insert,update,delete on public.location_dictionary from authenticated;
revoke insert,update,delete on public.first_communions from authenticated;

-- Las notas ya no admiten INSERT directo: toda nueva nota manual pasa por RPC.
drop policy if exists "marginal_notes_insert_owner" on public.marginal_notes;
revoke insert,update,delete on public.marginal_notes from authenticated;

comment on function public.apply_legacy_import_batch(uuid,integer) is 'Aplica únicamente filas validadas de staging. Idempotente por source_system/profile/source_key y auditable.';
