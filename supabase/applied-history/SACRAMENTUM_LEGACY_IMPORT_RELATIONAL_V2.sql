-- SACRAMENTUM · IMPORTACIÓN LEGACY RELACIONAL V2
-- Preinscripciones históricas se concilian; nunca crean pendientes vivos.
begin;

create table if not exists public.legacy_pre_sacrament_registrations (
  id uuid primary key default gen_random_uuid(),
  profile_key text not null,
  source_sha256 text not null,
  source_key text not null,
  batch_id uuid references public.legacy_import_batches(id) on delete set null,
  row_id uuid references public.legacy_import_rows(id) on delete set null,
  sacrament_type text not null check (sacrament_type in ('baptism','confirmation')),
  legacy_entry_number text,
  source_parish_name text,
  inscription_date date,
  celebration_date date,
  names text,
  last_names text,
  birth_date date,
  reported boolean not null default false,
  original_data jsonb not null default '{}'::jsonb,
  normalized_data jsonb not null default '{}'::jsonb,
  reconciliation_status text not null default 'unmatched'
    check (reconciliation_status in ('unmatched','matched','ambiguous','review')),
  matched_table text,
  matched_record_id uuid,
  match_method text,
  match_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_key,source_sha256,source_key)
);
create index if not exists idx_legacy_pre_sacrament_person
  on public.legacy_pre_sacrament_registrations(sacrament_type,upper(last_names),upper(names),celebration_date);
create index if not exists idx_legacy_pre_sacrament_status
  on public.legacy_pre_sacrament_registrations(reconciliation_status,sacrament_type);

create table if not exists public.legacy_reference_catalog (
  id uuid primary key default gen_random_uuid(),
  profile_key text not null,
  source_sha256 text not null,
  source_key text not null,
  original_data jsonb not null default '{}'::jsonb,
  normalized_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_key,source_sha256,source_key)
);
alter table public.legacy_pre_sacrament_registrations enable row level security;
alter table public.legacy_reference_catalog enable row level security;
revoke all on public.legacy_pre_sacrament_registrations from anon,authenticated;
revoke all on public.legacy_reference_catalog from anon,authenticated;
grant select,insert,update,delete on public.legacy_pre_sacrament_registrations to service_role;
grant select,insert,update,delete on public.legacy_reference_catalog to service_role;

drop policy if exists legacy_pre_sacrament_manage on public.legacy_pre_sacrament_registrations;
create policy legacy_pre_sacrament_manage on public.legacy_pre_sacrament_registrations
for select to authenticated using (
  exists(select 1 from public.legacy_import_batches b
    where b.id=batch_id and public.can_manage_legacy_import(b.parish_id,b.diocese_id))
);
drop policy if exists legacy_reference_manage on public.legacy_reference_catalog;
create policy legacy_reference_manage on public.legacy_reference_catalog
for select to authenticated using (public.current_app_role() in ('admin_general','diocese'));

insert into public.legacy_import_profiles(profile_key,display_name,target_entity,import_mode,requires_parish,mapping,validation_rules,active)
values
('PARROCOS','Directorio histórico de párrocos','legacy_priest_directory','catalog',false,'{"key":["codigo"]}'::jsonb,'{}'::jsonb,true),
('OBISPOS','Directorio histórico de obispos','legacy_reference_catalog','catalog',false,'{}'::jsonb,'{}'::jsonb,true)
on conflict(profile_key) do update set display_name=excluded.display_name,target_entity=excluded.target_entity,
 import_mode=excluded.import_mode,requires_parish=excluded.requires_parish,active=true,updated_at=now();
update public.legacy_import_profiles set requires_parish=false,import_mode='reconcile',updated_at=now()
where profile_key in ('INSBAUTI','INSCONFI');

drop index if exists public.uq_directory_dioceses_source_code;
create unique index if not exists uq_directory_dioceses_source_code_name
  on public.directory_dioceses(source_system,legacy_code,(lower(name))) where legacy_code is not null;
create unique index if not exists uq_directory_churches_source_code
  on public.directory_churches(source_system,legacy_code) where legacy_code is not null;

create or replace function public.sacramentum_legacy_norm_text(p_value text)
returns text language sql immutable as $$
  select regexp_replace(
    translate(upper(trim(coalesce(p_value,''))),'ÁÉÍÓÚÜÑ','AEIOUUN'),
    '[^A-Z0-9]+','','g'
  );
$$;
revoke all on function public.sacramentum_legacy_norm_text(text) from public;
grant execute on function public.sacramentum_legacy_norm_text(text) to authenticated,service_role;

create or replace function public.refresh_legacy_directory_links()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_linked integer:=0; v_enriched integer:=0;
begin
  update public.directory_churches c set directory_diocese_id=d.id,updated_at=now()
  from public.directory_dioceses d
  join (
    select source_system,legacy_code from public.directory_dioceses
    where legacy_code is not null group by source_system,legacy_code having count(*)=1
  ) u on u.source_system=d.source_system and u.legacy_code=d.legacy_code
  where c.directory_diocese_id is null and c.diocese_legacy_code is not null
    and d.source_system=c.source_system and d.legacy_code=c.diocese_legacy_code;
  get diagnostics v_linked=row_count;
  update public.confirmations c
  set lugar_bautismo=case
        when nullif(trim(coalesce(c.lugar_bautismo,'')),'') is null
          then concat_ws(' - ',dc.name,nullif(dc.city,''))
        else c.lugar_bautismo end,
      raw_data=coalesce(c.raw_data,'{}'::jsonb) || jsonb_build_object(
        'legacy_baptism_church_directory',jsonb_strip_nulls(jsonb_build_object(
          'code',dc.legacy_code,'name',dc.name,'city',dc.city,
          'diocese_code',dc.diocese_legacy_code,'diocese_name',dd.name,'priest_name',dc.priest_name
        ))),
      updated_at=now()
  from public.directory_churches dc
  left join public.directory_dioceses dd on dd.id=dc.directory_diocese_id
  where nullif(coalesce(c.raw_data->'legacy_normalized'->>'baptism_church_code',c.raw_data->>'codbau'),'')=dc.legacy_code;
  get diagnostics v_enriched=row_count;
  return jsonb_build_object('church_diocese_links',v_linked,'confirmations_enriched',v_enriched);
end;
$$;
revoke all on function public.refresh_legacy_directory_links() from public;
grant execute on function public.refresh_legacy_directory_links() to service_role;

create or replace function public.reconcile_legacy_pre_registrations(p_profile_key text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.legacy_pre_sacrament_registrations%rowtype; d jsonb;
  v_count integer; v_target uuid; v_mapped_parish uuid;
  v_matched integer:=0; v_unmatched integer:=0; v_ambiguous integer:=0;
begin
  for r in select * from public.legacy_pre_sacrament_registrations
           where (p_profile_key is null or profile_key=upper(p_profile_key))
             and reconciliation_status in ('unmatched','ambiguous','review')
  loop
    d:=r.normalized_data; v_target:=null; v_count:=0; v_mapped_parish:=null;
    select mapped_parish_id into v_mapped_parish
      from public.legacy_source_parishes
      where profile_key=r.profile_key and mapping_status='mapped'
        and public.sacramentum_legacy_norm_text(source_parish_name)=public.sacramentum_legacy_norm_text(r.source_parish_name)
      limit 1;
    if r.celebration_date is null or public.sacramentum_legacy_norm_text(r.names)='' or public.sacramentum_legacy_norm_text(r.last_names)='' then
      update public.legacy_pre_sacrament_registrations set reconciliation_status='review',match_method='insufficient_identity',match_score=0,updated_at=now() where id=r.id;
      continue;
    end if;

    if r.sacrament_type='baptism' then
      select count(*),min(b.id) into v_count,v_target from public.baptisms b
      where public.sacramentum_legacy_norm_text(b.nombres)=public.sacramentum_legacy_norm_text(r.names)
        and public.sacramentum_legacy_norm_text(b.apellidos)=public.sacramentum_legacy_norm_text(r.last_names)
        and b.celebration_date=r.celebration_date
        and (r.birth_date is null or b.fecha_nacimiento is null or b.fecha_nacimiento=r.birth_date)
        and (v_mapped_parish is null or b.parish_id=v_mapped_parish);
      if v_count=1 then
        update public.baptisms b set
          fecha_nacimiento=coalesce(b.fecha_nacimiento,r.birth_date),
          lugar_nacimiento=coalesce(nullif(b.lugar_nacimiento,''),nullif(d->>'birth_place','')),
          tipo_union_padres=coalesce(nullif(b.tipo_union_padres,''),nullif(d->>'parent_union_type','')),
          nombre_padre=coalesce(nullif(b.nombre_padre,''),nullif(d->>'father_name','')),
          cedula_padre=coalesce(nullif(b.cedula_padre,''),nullif(d->>'father_document','')),
          nombre_madre=coalesce(nullif(b.nombre_madre,''),nullif(d->>'mother_name','')),
          cedula_madre=coalesce(nullif(b.cedula_madre,''),nullif(d->>'mother_document','')),
          abuelos_paternos=coalesce(nullif(b.abuelos_paternos,''),nullif(d->>'paternal_grandparents','')),
          abuelos_maternos=coalesce(nullif(b.abuelos_maternos,''),nullif(d->>'maternal_grandparents','')),
          padrinos=coalesce(nullif(b.padrinos,''),nullif(d->>'godparents','')),
          ministro=coalesce(nullif(b.ministro,''),nullif(d->>'minister','')),
          nuip=coalesce(nullif(b.nuip,''),nullif(d->>'nuip','')),
          numero_registro=coalesce(nullif(b.numero_registro,''),nullif(d->>'civil_registry_number','')),
          oficina_registro=coalesce(nullif(b.oficina_registro,''),nullif(d->>'civil_registry_office','')),
          fecha_expedicion_registro=coalesce(b.fecha_expedicion_registro,nullif(d->>'civil_registry_date','')::date),
          raw_data=coalesce(b.raw_data,'{}'::jsonb)||jsonb_build_object('legacy_pre_registration',d,'legacy_pre_registration_source',jsonb_build_object('profile',r.profile_key,'sha256',r.source_sha256,'source_key',r.source_key)),
          updated_at=now()
        where b.id=v_target;
      end if;
    elsif r.sacrament_type='confirmation' then
      select count(*),min(c.id) into v_count,v_target from public.confirmations c
      where public.sacramentum_legacy_norm_text(c.nombres)=public.sacramentum_legacy_norm_text(r.names)
        and public.sacramentum_legacy_norm_text(c.apellidos)=public.sacramentum_legacy_norm_text(r.last_names)
        and c.celebration_date=r.celebration_date
        and (r.birth_date is null or c.fecha_nacimiento is null or c.fecha_nacimiento=r.birth_date)
        and (v_mapped_parish is null or c.parish_id=v_mapped_parish);
      if v_count=1 then
        update public.confirmations c set
          fecha_nacimiento=coalesce(c.fecha_nacimiento,r.birth_date),
          lugar_bautismo=coalesce(nullif(c.lugar_bautismo,''),nullif(d->>'baptism_place','')),
          nombre_padre=coalesce(nullif(c.nombre_padre,''),nullif(d->>'father_name','')),
          nombre_madre=coalesce(nullif(c.nombre_madre,''),nullif(d->>'mother_name','')),
          padrinos=coalesce(nullif(c.padrinos,''),nullif(d->>'sponsor','')),
          ministro=coalesce(nullif(c.ministro,''),nullif(d->>'minister','')),
          raw_data=jsonb_set(coalesce(c.raw_data,'{}'::jsonb),'{legacy_normalized}',
            coalesce(c.raw_data->'legacy_normalized','{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
              'birth_date',r.birth_date,'baptism_church_code',nullif(d->>'baptism_church_code',''),
              'baptism_place',nullif(d->>'baptism_place',''),'baptism_book',nullif(d->>'baptism_book',''),
              'baptism_folio',nullif(d->>'baptism_folio',''),'baptism_number',nullif(d->>'baptism_number','')
            )),true) || jsonb_build_object('legacy_pre_registration',d,'legacy_pre_registration_source',jsonb_build_object('profile',r.profile_key,'sha256',r.source_sha256,'source_key',r.source_key)),
          updated_at=now()
        where c.id=v_target;
      end if;
    end if;
    if v_count=1 then
      update public.legacy_pre_sacrament_registrations set reconciliation_status='matched',matched_table=case when r.sacrament_type='baptism' then 'baptisms' else 'confirmations' end,matched_record_id=v_target,match_method='identity+celebration_date',match_score=100,updated_at=now() where id=r.id;
      v_matched:=v_matched+1;
    elsif v_count>1 then
      update public.legacy_pre_sacrament_registrations set reconciliation_status='ambiguous',matched_table=null,matched_record_id=null,match_method='multiple_identity_date_matches',match_score=60,updated_at=now() where id=r.id;
      v_ambiguous:=v_ambiguous+1;
    else
      update public.legacy_pre_sacrament_registrations set reconciliation_status='unmatched',matched_table=null,matched_record_id=null,match_method='no_unique_match',match_score=0,updated_at=now() where id=r.id;
      v_unmatched:=v_unmatched+1;
    end if;
  end loop;
  perform public.refresh_legacy_directory_links();
  return jsonb_build_object('matched',v_matched,'unmatched',v_unmatched,'ambiguous',v_ambiguous);
end;
$$;
revoke all on function public.reconcile_legacy_pre_registrations(text) from public;
grant execute on function public.reconcile_legacy_pre_registrations(text) to service_role;

create or replace function public.apply_legacy_import_batch_v2(p_batch_id uuid,p_limit integer default 250)
returns table(imported integer,failed integer,remaining integer)
language plpgsql security definer set search_path=public as $$
declare v_batch public.legacy_import_batches%rowtype; r public.legacy_import_rows%rowtype; d jsonb;
  v_target uuid; v_imported integer:=0; v_failed integer:=0; v_result jsonb;
  v_old record; v_profile text; v_source_name text;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if p_limit<1 or p_limit>1000 then raise exception 'Límite inválido'; end if;
  select * into v_batch from public.legacy_import_batches where id=p_batch_id for update;
  if not found then raise exception 'Lote no encontrado'; end if;
  if not public.can_manage_legacy_import(v_batch.parish_id,v_batch.diocese_id) then raise exception 'No autorizado'; end if;
  v_profile:=v_batch.profile_key; v_source_name:=coalesce(nullif(v_batch.source_name,''),v_profile||'.json');

  if v_profile not in ('INSBAUTI','INSCONFI','PARROCOS','OBISPOS','DIOCESIS','IGLESIAS','CIUDADES') then
    select * into v_old from public.apply_legacy_import_batch(p_batch_id,p_limit);
    if v_profile in ('BAUTIZOS','CONFIRMA') then
      perform public.reconcile_legacy_pre_registrations(case when v_profile='BAUTIZOS' then 'INSBAUTI' else 'INSCONFI' end);
    end if;
    imported:=coalesce(v_old.imported,0); failed:=coalesce(v_old.failed,0); remaining:=coalesce(v_old.remaining,0);
    return next; return;
  end if;

  update public.legacy_import_batches set status='importing',updated_at=now() where id=p_batch_id;
  for r in select * from public.legacy_import_rows where batch_id=p_batch_id and status='valid' order by row_number limit p_limit for update skip locked
  loop
    begin
      d:=r.normalized_data; v_target:=null;
      if v_profile in ('INSBAUTI','INSCONFI') then
        insert into public.legacy_pre_sacrament_registrations(
          profile_key,source_sha256,source_key,batch_id,row_id,sacrament_type,legacy_entry_number,source_parish_name,
          inscription_date,celebration_date,names,last_names,birth_date,reported,original_data,normalized_data
        ) values (
          v_profile,coalesce(v_batch.sha256,'NOHASH'),coalesce(r.source_key,r.row_number::text),p_batch_id,r.id,
          case when v_profile='INSBAUTI' then 'baptism' else 'confirmation' end,
          nullif(d->>'legacy_entry_number',''),nullif(d->>'celebration_place',''),nullif(d->>'inscription_date','')::date,
          nullif(d->>'celebration_date','')::date,nullif(d->>'names',''),nullif(d->>'last_names',''),nullif(d->>'birth_date','')::date,
          coalesce((d->>'reported')::boolean,false),coalesce(r.original_data,'{}'::jsonb),d
        ) on conflict(profile_key,source_sha256,source_key) do update set
          batch_id=excluded.batch_id,row_id=excluded.row_id,original_data=excluded.original_data,normalized_data=excluded.normalized_data,
          source_parish_name=excluded.source_parish_name,inscription_date=excluded.inscription_date,celebration_date=excluded.celebration_date,
          names=excluded.names,last_names=excluded.last_names,birth_date=excluded.birth_date,reported=excluded.reported,updated_at=now()
        returning id into v_target;

      elsif v_profile='PARROCOS' then
        insert into public.legacy_priest_directory(source_system,source_name,source_sha256,legacy_code,priest_name,service_start,service_end,legacy_state,legacy_grade,mapping_status,original_data)
        values('legacy_json','PARROCOS.json',v_batch.sha256,nullif(d->>'legacy_code',''),coalesce(nullif(d->>'priest_name',''),'SIN NOMBRE'),
          nullif(d->>'service_start','')::date,nullif(d->>'service_end','')::date,nullif(d->>'legacy_state','')::integer,
          nullif(d->>'legacy_grade',''),'unmapped',coalesce(r.original_data,'{}'::jsonb))
        on conflict(source_system,source_name,legacy_code) do update set source_sha256=excluded.source_sha256,priest_name=excluded.priest_name,
          service_start=excluded.service_start,service_end=excluded.service_end,legacy_state=excluded.legacy_state,
          legacy_grade=excluded.legacy_grade,original_data=excluded.original_data,updated_at=now()
        returning id into v_target;
      elsif v_profile='DIOCESIS' then
        select id into v_target from public.directory_dioceses
        where source_system='SACRAMENTA_PLUS' and legacy_code=nullif(d->>'legacy_code','')
          and lower(name)=lower(coalesce(nullif(d->>'name',''),'SIN NOMBRE')) limit 1;
        if v_target is null then
          insert into public.directory_dioceses(legacy_code,name,nit,address,phone,fax,email,city,bishop_1,bishop_2,source_system,raw_data)
          values(nullif(d->>'legacy_code',''),coalesce(nullif(d->>'name',''),'SIN NOMBRE'),nullif(d->>'nit',''),nullif(d->>'address',''),
            nullif(d->>'phone',''),nullif(d->>'fax',''),nullif(d->>'email',''),nullif(d->>'city',''),nullif(d->>'bishop_1',''),nullif(d->>'bishop_2',''),
            'SACRAMENTA_PLUS',coalesce(r.original_data,'{}'::jsonb)) returning id into v_target;
        else
          update public.directory_dioceses set nit=nullif(d->>'nit',''),address=nullif(d->>'address',''),phone=nullif(d->>'phone',''),
            fax=nullif(d->>'fax',''),email=nullif(d->>'email',''),city=nullif(d->>'city',''),bishop_1=nullif(d->>'bishop_1',''),
            bishop_2=nullif(d->>'bishop_2',''),raw_data=coalesce(r.original_data,'{}'::jsonb),updated_at=now() where id=v_target;
        end if;

      elsif v_profile='IGLESIAS' then
        insert into public.directory_churches(legacy_code,name,nit,address,city,phone,fax,email,priest_name,diocese_legacy_code,source_system,raw_data)
        values(nullif(d->>'legacy_code',''),coalesce(nullif(d->>'name',''),'SIN NOMBRE'),nullif(d->>'nit',''),nullif(d->>'address',''),nullif(d->>'city',''),
          nullif(d->>'phone',''),nullif(d->>'fax',''),nullif(d->>'email',''),nullif(d->>'priest_name',''),nullif(d->>'diocese_legacy_code',''),
          'SACRAMENTA_PLUS',coalesce(r.original_data,'{}'::jsonb))
        on conflict(source_system,legacy_code) where legacy_code is not null do update set
          name=excluded.name,nit=excluded.nit,address=excluded.address,city=excluded.city,phone=excluded.phone,fax=excluded.fax,email=excluded.email,
          priest_name=excluded.priest_name,diocese_legacy_code=excluded.diocese_legacy_code,raw_data=excluded.raw_data,updated_at=now()
        returning id into v_target;
      elsif v_profile='CIUDADES' then
        insert into public.location_dictionary(source,value,usage_count,weight,source_created_at,source_updated_at,source_user,source_system,metadata)
        values(nullif(d->>'source',''),coalesce(nullif(d->>'value',''),'SIN DATO'),coalesce((d->>'usage_count')::integer,0),coalesce((d->>'weight')::integer,0),
          nullif(d->>'source_created_at','')::timestamptz,nullif(d->>'source_updated_at','')::timestamptz,nullif(d->>'source_user',''),
          'SACRAMENTA_PLUS',jsonb_build_object('legacy',coalesce(r.original_data,'{}'::jsonb),'sha256',v_batch.sha256))
        on conflict ((coalesce(source,'')),(lower(value))) do update set usage_count=greatest(public.location_dictionary.usage_count,excluded.usage_count),
          weight=greatest(public.location_dictionary.weight,excluded.weight),metadata=excluded.metadata,updated_at=now()
        returning id into v_target;

      elsif v_profile='OBISPOS' then
        insert into public.legacy_reference_catalog(profile_key,source_sha256,source_key,original_data,normalized_data)
        values(v_profile,coalesce(v_batch.sha256,'NOHASH'),coalesce(r.source_key,r.row_number::text),coalesce(r.original_data,'{}'::jsonb),d)
        on conflict(profile_key,source_sha256,source_key) do update set original_data=excluded.original_data,normalized_data=excluded.normalized_data,updated_at=now()
        returning id into v_target;
      end if;

      if v_target is null then raise exception 'No se pudo materializar la fila legacy'; end if;
      insert into public.legacy_record_links(source_system,profile_key,source_key,checksum,batch_id,row_id,target_table,target_id,metadata)
      values(v_batch.source_system,v_profile,coalesce(r.source_key,r.row_number::text),r.checksum,p_batch_id,r.id,r.target_entity,v_target,
        jsonb_build_object('filename',v_batch.original_filename,'sha256',v_batch.sha256,'scoped_source_key',true))
      on conflict(source_system,profile_key,source_key) do update set checksum=excluded.checksum,batch_id=excluded.batch_id,row_id=excluded.row_id,
        target_table=excluded.target_table,target_id=excluded.target_id,metadata=excluded.metadata,updated_at=now();
      update public.legacy_import_rows set status='imported',target_table=r.target_entity,target_id=v_target,imported_at=now(),updated_at=now() where id=r.id;
      v_imported:=v_imported+1;
    exception when others then
      update public.legacy_import_rows set status='error',issue_codes=array_append(coalesce(issue_codes,'{}'::text[]),'IMPORT_ERROR'),
        issue_details=coalesce(issue_details,'{}'::jsonb)||jsonb_build_object('import_error',sqlerrm),updated_at=now() where id=r.id;
      v_failed:=v_failed+1;
    end;
  end loop;

  if v_profile in ('INSBAUTI','INSCONFI') then
    v_result:=public.reconcile_legacy_pre_registrations(v_profile);
  elsif v_profile in ('DIOCESIS','IGLESIAS') then
    v_result:=public.refresh_legacy_directory_links();
  end if;

  update public.legacy_import_rows lr set issue_details=coalesce(lr.issue_details,'{}'::jsonb)||jsonb_build_object(
    'reconciliation_status',pr.reconciliation_status,'matched_table',pr.matched_table,'matched_record_id',pr.matched_record_id,
    'match_method',pr.match_method,'match_score',pr.match_score)
  from public.legacy_pre_sacrament_registrations pr
  where lr.id=pr.row_id and lr.batch_id=p_batch_id;

  update public.legacy_import_batches b set
    imported_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='imported'),
    valid_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='valid'),
    review_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='review'),
    error_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='error'),
    status=case when exists(select 1 from public.legacy_import_rows where batch_id=p_batch_id and status='valid') then 'ready'
      when exists(select 1 from public.legacy_import_rows where batch_id=p_batch_id and status in ('review','error')) then 'completed_with_review'
      else 'completed' end,
    metadata=coalesce(b.metadata,'{}'::jsonb)||case when v_profile in ('INSBAUTI','INSCONFI') then jsonb_build_object('reconciliation',(
      select jsonb_build_object(
        'matched',count(*) filter(where reconciliation_status='matched'),
        'unmatched',count(*) filter(where reconciliation_status='unmatched'),
        'ambiguous',count(*) filter(where reconciliation_status='ambiguous'),
        'review',count(*) filter(where reconciliation_status='review'))
      from public.legacy_pre_sacrament_registrations where batch_id=p_batch_id)) else '{}'::jsonb end,
    updated_at=now()
  where b.id=p_batch_id;

  insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
  values(auth.uid(),v_batch.parish_id,v_batch.diocese_id,'legacy_import_batch',p_batch_id,'legacy_import_batch_v2_applied',
    jsonb_build_object('imported_this_run',v_imported,'failed_this_run',v_failed,'postprocess',v_result),
    jsonb_build_object('profile_key',v_profile,'filename',v_batch.original_filename,'sha256',v_batch.sha256));

  imported:=v_imported; failed:=v_failed;
  remaining:=(select count(*)::integer from public.legacy_import_rows where batch_id=p_batch_id and status='valid');
  return next;
end;
$$;
revoke all on function public.apply_legacy_import_batch_v2(uuid,integer) from public;
grant execute on function public.apply_legacy_import_batch_v2(uuid,integer) to authenticated;

commit;
