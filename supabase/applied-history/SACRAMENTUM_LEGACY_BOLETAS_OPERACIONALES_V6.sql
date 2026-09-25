-- SACRAMENTUM · V6 · BOLETAS LEGACY OPERACIONALES
-- INSBAUTI/INSCONFI se comportan como inscripciones masivas históricas.
-- reported=false => pendiente real para sentar.
-- reported=true  => boleta reportada; se enlaza con partida existente si hay match único.
-- Importar no consume Nº Registro moderno ni consecutivos Libro/Folio/Número.
begin;

update public.legacy_import_profiles
set requires_parish=true, updated_at=now()
where active=true;

alter table public.legacy_pre_sacrament_registrations
  add column if not exists owner_parish_id uuid references public.parishes(id) on delete restrict;
alter table public.legacy_pre_sacrament_registrations
  add column if not exists pending_table text;
alter table public.legacy_pre_sacrament_registrations
  add column if not exists pending_record_id uuid;

alter table public.legacy_pre_sacrament_registrations
  drop constraint if exists legacy_pre_sacrament_registrations_reconciliation_status_check;
alter table public.legacy_pre_sacrament_registrations
  add constraint legacy_pre_sacrament_registrations_reconciliation_status_check
  check (reconciliation_status in ('unmatched','matched','ambiguous','review','not_seated'));

create unique index if not exists uq_pending_baptisms_legacy_pre
on public.pending_baptisms ((raw_data->>'legacy_pre_registration_id'))
where nullif(raw_data->>'legacy_pre_registration_id','') is not null;
create unique index if not exists uq_pending_confirmations_legacy_pre
on public.pending_confirmations ((raw_data->>'legacy_pre_registration_id'))
where nullif(raw_data->>'legacy_pre_registration_id','') is not null;

create or replace function public.sacramentum_legacy_pre_owner()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  select b.parish_id into new.owner_parish_id
  from public.legacy_import_batches b where b.id=new.batch_id;
  if new.owner_parish_id is null then
    raise exception 'Toda boleta histórica debe tener parroquia propietaria';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sacramentum_legacy_pre_owner on public.legacy_pre_sacrament_registrations;
create trigger trg_sacramentum_legacy_pre_owner
before insert or update of batch_id on public.legacy_pre_sacrament_registrations
for each row execute function public.sacramentum_legacy_pre_owner();

update public.legacy_pre_sacrament_registrations p
set owner_parish_id=b.parish_id
from public.legacy_import_batches b
where p.batch_id=b.id
  and p.owner_parish_id is null
  and b.parish_id is not null;
create or replace function public.sacramentum_sync_legacy_boleta(p_pre_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  r public.legacy_pre_sacrament_registrations%rowtype;
  d jsonb; v_raw jsonb; v_pending uuid; v_status text; v_reported boolean;
  v_da_fe text; v_da_fe_code text;
begin
  select * into r from public.legacy_pre_sacrament_registrations where id=p_pre_id;
  if not found then raise exception 'Boleta legacy no encontrada'; end if;
  if r.owner_parish_id is null then raise exception 'Boleta legacy sin parroquia propietaria'; end if;
  d:=coalesce(r.normalized_data,'{}'::jsonb);
  v_reported:=coalesce(r.reported,false);
  v_status:=case
    when not v_reported then 'pending'
    when r.reconciliation_status='matched' then 'seated'
    when r.reconciliation_status='ambiguous' then 'legacy_reported_ambiguous'
    when r.reconciliation_status='review' then 'legacy_reported_review'
    else 'legacy_reported_unmatched' end;

  v_da_fe_code:=nullif(coalesce(d->>'legacy_dafe_code',r.original_data->>'dafe'),'');
  if v_da_fe_code is not null then
    select case when count(distinct priest_name)=1 then max(priest_name) end into v_da_fe
    from public.legacy_priest_directory
    where legacy_code=v_da_fe_code;
  end if;

  v_raw:=jsonb_strip_nulls(jsonb_build_object(
    'id',null,'parishId',r.owner_parish_id,'parish_id',r.owner_parish_id,
    'numeroRegistro',r.legacy_entry_number,'numero_registro',r.legacy_entry_number,
    'status',v_status,'estado',v_status,'source','legacy_pre_registration',
    'legacyReported',v_reported,'legacy_reported',v_reported,
    'legacyEntryNumber',r.legacy_entry_number,
    'legacySourceParish',r.source_parish_name,
    'legacy_pre_registration_id',r.id,
    'legacy_batch_id',r.batch_id,'legacy_row_id',r.row_id,
    'legacy_sha256',r.source_sha256,'legacy_source_key',r.source_key,
    'legacy_matched_table',r.matched_table,
    'legacy_matched_record_id',r.matched_record_id,
    'legacy_reconciliation_status',r.reconciliation_status,
    'legacy_match_method',r.match_method,
    'legacy_normalized',d,'legacy_original',r.original_data,
    'legacy_dafe_code',v_da_fe_code,'legacy_dafe_resolved_name',v_da_fe
  ));

  if r.sacrament_type='baptism' then
    v_raw:=v_raw||jsonb_strip_nulls(jsonb_build_object(
      'fechaSacramento',d->>'celebration_date','celebration_date',d->>'celebration_date',
      'lugarBautismo',d->>'celebration_place','apellidos',d->>'last_names','nombres',d->>'names',
      'sexo',d->>'gender','fechaNacimiento',d->>'birth_date','lugarNacimiento',d->>'birth_place',
      'tipoUnionPadres',d->>'parent_union_type','nombrePadre',d->>'father_name','cedulaPadre',d->>'father_document',
      'nombreMadre',d->>'mother_name','cedulaMadre',d->>'mother_document',
      'abuelosPaternos',d->>'paternal_grandparents','abuelosMaternos',d->>'maternal_grandparents',
      'padrinos',d->>'godparents','ministro',d->>'minister','daFe',v_da_fe,
      'nuip',d->>'nuip','serialRegistro',d->>'civil_registry_number',
      'oficinaRegistro',d->>'civil_registry_office','fechaExpedicionRegistro',d->>'civil_registry_date'
    ));
    insert into public.pending_baptisms(id,parish_id,status,reportado,raw_data,created_at)
    values(gen_random_uuid(),r.owner_parish_id,v_status,v_reported,v_raw,
      coalesce(r.inscription_date::timestamptz,now()))
    on conflict ((raw_data->>'legacy_pre_registration_id'))
      where nullif(raw_data->>'legacy_pre_registration_id','') is not null
    do update set parish_id=excluded.parish_id,status=excluded.status,reportado=excluded.reportado,
      raw_data=excluded.raw_data
    returning id into v_pending;
    update public.pending_baptisms
    set raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object('id',v_pending)
    where id=v_pending;
    update public.legacy_pre_sacrament_registrations
    set pending_table='pending_baptisms',pending_record_id=v_pending,updated_at=now()
    where id=r.id;
  else
    v_raw:=v_raw||jsonb_strip_nulls(jsonb_build_object(
      'fechaSacramento',d->>'celebration_date','fechaConfirmacion',d->>'celebration_date',
      'celebration_date',d->>'celebration_date','lugarSacramento',d->>'celebration_place',
      'apellidos',d->>'last_names','nombres',d->>'names','sexo',d->>'gender',
      'fechaNacimiento',d->>'birth_date','edad',d->>'age_text',
      'lugarBautismo',d->>'baptism_place','libroBautismo',d->>'baptism_book',
      'folioBautismo',d->>'baptism_folio','numeroBautismo',d->>'baptism_number',
      'codigoBautizo',d->>'baptism_church_code','nombrePadre',d->>'father_name',
      'nombreMadre',d->>'mother_name','padrinos',d->>'sponsor',
      'ministro',d->>'minister','daFe',v_da_fe
    ));
    insert into public.pending_confirmations(id,parish_id,status,reportado,raw_data,created_at)
    values(gen_random_uuid(),r.owner_parish_id,v_status,v_reported,v_raw,
      coalesce(r.inscription_date::timestamptz,now()))
    on conflict ((raw_data->>'legacy_pre_registration_id'))
      where nullif(raw_data->>'legacy_pre_registration_id','') is not null
    do update set parish_id=excluded.parish_id,status=excluded.status,reportado=excluded.reportado,
      raw_data=excluded.raw_data
    returning id into v_pending;
    update public.pending_confirmations
    set raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object('id',v_pending)
    where id=v_pending;
    update public.legacy_pre_sacrament_registrations
    set pending_table='pending_confirmations',pending_record_id=v_pending,updated_at=now()
    where id=r.id;
  end if;

  update public.legacy_import_rows
  set target_table=case when r.sacrament_type='baptism' then 'pending_baptisms' else 'pending_confirmations' end,
      target_id=v_pending,updated_at=now()
  where id=r.row_id;

  update public.legacy_record_links
  set target_table=case when r.sacrament_type='baptism' then 'pending_baptisms' else 'pending_confirmations' end,
      target_id=v_pending,updated_at=now()
  where batch_id=r.batch_id and row_id=r.row_id;

  return v_pending;
end;
$$;
revoke all on function public.sacramentum_sync_legacy_boleta(uuid) from public,anon,authenticated;
grant execute on function public.sacramentum_sync_legacy_boleta(uuid) to service_role;

create or replace function public.sacramentum_sync_legacy_boleta_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform public.sacramentum_sync_legacy_boleta(new.id);
  return new;
end;
$$;

drop trigger if exists trg_sacramentum_sync_legacy_boleta on public.legacy_pre_sacrament_registrations;
create trigger trg_sacramentum_sync_legacy_boleta
after insert or update of reported,reconciliation_status,matched_table,matched_record_id,
  match_method,match_score,owner_parish_id,normalized_data
on public.legacy_pre_sacrament_registrations
for each row execute function public.sacramentum_sync_legacy_boleta_trigger();

create or replace function public.reconcile_legacy_pre_registrations(p_profile_key text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  r public.legacy_pre_sacrament_registrations%rowtype; d jsonb;
  v_count integer; v_target uuid; v_owner uuid;
  v_matched integer:=0; v_unmatched integer:=0; v_ambiguous integer:=0;
  v_review integer:=0; v_not_seated integer:=0;
begin
  for r in select * from public.legacy_pre_sacrament_registrations
    where p_profile_key is null or profile_key=upper(p_profile_key)
    order by created_at,id
  loop
    d:=coalesce(r.normalized_data,'{}'::jsonb);
    v_owner:=r.owner_parish_id; v_target:=null; v_count:=0;
    if v_owner is null then
      update public.legacy_pre_sacrament_registrations
      set reconciliation_status='review',matched_table=null,matched_record_id=null,
          match_method='missing_owner_parish',match_score=0,updated_at=now()
      where id=r.id;
      v_review:=v_review+1; continue;
    end if;

    if not coalesce(r.reported,false) then
      update public.legacy_pre_sacrament_registrations
      set reconciliation_status='not_seated',matched_table=null,matched_record_id=null,
          match_method='legacy_reported_false_not_seated',match_score=0,updated_at=now()
      where id=r.id;
      v_not_seated:=v_not_seated+1; continue;
    end if;

    if r.celebration_date is null
       or public.sacramentum_legacy_norm_text(r.names)=''
       or public.sacramentum_legacy_norm_text(r.last_names)='' then
      update public.legacy_pre_sacrament_registrations
      set reconciliation_status='review',matched_table=null,matched_record_id=null,
          match_method='insufficient_identity',match_score=0,updated_at=now()
      where id=r.id;
      v_review:=v_review+1; continue;
    end if;
    if r.sacrament_type='baptism' then
      select count(*),(array_agg(b.id order by b.id))[1]
      into v_count,v_target
      from public.baptisms b
      where b.parish_id=v_owner
        and public.sacramentum_legacy_norm_text(b.nombres)=public.sacramentum_legacy_norm_text(r.names)
        and public.sacramentum_legacy_norm_text(b.apellidos)=public.sacramentum_legacy_norm_text(r.last_names)
        and b.celebration_date=r.celebration_date
        and (r.birth_date is null or b.fecha_nacimiento is null or b.fecha_nacimiento=r.birth_date);

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
          serial_registro=coalesce(nullif(b.serial_registro,''),nullif(d->>'civil_registry_number','')),
          oficina_registro=coalesce(nullif(b.oficina_registro,''),nullif(d->>'civil_registry_office','')),
          fecha_expedicion_registro=coalesce(b.fecha_expedicion_registro,nullif(d->>'civil_registry_date','')::date),
          raw_data=coalesce(b.raw_data,'{}'::jsonb)||jsonb_build_object(
            'legacy_pre_registration',d,
            'legacy_pre_registration_source',jsonb_build_object(
              'profile',r.profile_key,'sha256',r.source_sha256,'source_key',r.source_key,
              'source_parish_name',r.source_parish_name,'owner_parish_id',v_owner)),
          updated_at=now()
        where b.id=v_target;
      end if;
    else
      select count(*),(array_agg(c.id order by c.id))[1]
      into v_count,v_target
      from public.confirmations c
      where c.parish_id=v_owner
        and public.sacramentum_legacy_norm_text(c.nombres)=public.sacramentum_legacy_norm_text(r.names)
        and public.sacramentum_legacy_norm_text(c.apellidos)=public.sacramentum_legacy_norm_text(r.last_names)
        and c.celebration_date=r.celebration_date
        and (r.birth_date is null or c.fecha_nacimiento is null or c.fecha_nacimiento=r.birth_date);

      if v_count=1 then
        update public.confirmations c set
          fecha_nacimiento=coalesce(c.fecha_nacimiento,r.birth_date),
          lugar_bautismo=coalesce(nullif(c.lugar_bautismo,''),nullif(d->>'baptism_place','')),
          nombre_padre=coalesce(nullif(c.nombre_padre,''),nullif(d->>'father_name','')),
          nombre_madre=coalesce(nullif(c.nombre_madre,''),nullif(d->>'mother_name','')),
          padrinos=coalesce(nullif(c.padrinos,''),nullif(d->>'sponsor','')),
          ministro=coalesce(nullif(c.ministro,''),nullif(d->>'minister','')),
          raw_data=jsonb_set(coalesce(c.raw_data,'{}'::jsonb),'{legacy_normalized}',
            coalesce(c.raw_data->'legacy_normalized','{}'::jsonb)||jsonb_strip_nulls(jsonb_build_object(
              'birth_date',r.birth_date,'baptism_church_code',nullif(d->>'baptism_church_code',''),
              'baptism_place',nullif(d->>'baptism_place',''),'baptism_book',nullif(d->>'baptism_book',''),
              'baptism_folio',nullif(d->>'baptism_folio',''),'baptism_number',nullif(d->>'baptism_number','')
            )),true)||jsonb_build_object(
              'legacy_pre_registration',d,
              'legacy_pre_registration_source',jsonb_build_object(
                'profile',r.profile_key,'sha256',r.source_sha256,'source_key',r.source_key,
                'source_parish_name',r.source_parish_name,'owner_parish_id',v_owner)),
          updated_at=now()
        where c.id=v_target;
      end if;
    end if;

    if v_count=1 then
      update public.legacy_pre_sacrament_registrations
      set reconciliation_status='matched',
          matched_table=case when r.sacrament_type='baptism' then 'baptisms' else 'confirmations' end,
          matched_record_id=v_target,match_method='owner+identity+celebration_date',match_score=100,updated_at=now()
      where id=r.id;
      v_matched:=v_matched+1;
    elsif v_count>1 then
      update public.legacy_pre_sacrament_registrations
      set reconciliation_status='ambiguous',matched_table=null,matched_record_id=null,
          match_method='multiple_owner_identity_date_matches',match_score=60,updated_at=now()
      where id=r.id;
      v_ambiguous:=v_ambiguous+1;
    else
      update public.legacy_pre_sacrament_registrations
      set reconciliation_status='unmatched',matched_table=null,matched_record_id=null,
          match_method='no_unique_match_in_owner_parish',match_score=0,updated_at=now()
      where id=r.id;
      v_unmatched:=v_unmatched+1;
    end if;
  end loop;

  perform public.refresh_legacy_directory_links();
  return jsonb_build_object(
    'matched',v_matched,'unmatched',v_unmatched,'ambiguous',v_ambiguous,
    'review',v_review,'not_seated',v_not_seated
  );
end;
$$;
revoke all on function public.reconcile_legacy_pre_registrations(text) from public,anon;
grant execute on function public.reconcile_legacy_pre_registrations(text) to service_role;

-- Retroalimentar importaciones ya existentes sin exigir volver a cargar JSON.
select public.reconcile_legacy_pre_registrations('INSBAUTI');
select public.reconcile_legacy_pre_registrations('INSCONFI');
create table if not exists public.legacy_import_ownership (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.legacy_import_batches(id) on delete cascade,
  row_id uuid references public.legacy_import_rows(id) on delete cascade,
  owner_parish_id uuid not null references public.parishes(id) on delete restrict,
  target_table text not null,target_id uuid not null,
  source_parish_name text,metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(batch_id,row_id)
);
alter table public.legacy_import_ownership enable row level security;
revoke all on public.legacy_import_ownership from anon,authenticated;
grant select,insert,update,delete on public.legacy_import_ownership to service_role;

drop policy if exists legacy_import_ownership_select on public.legacy_import_ownership;
create policy legacy_import_ownership_select on public.legacy_import_ownership
for select to authenticated using (public.can_access_parish(owner_parish_id));

create or replace function public.sacramentum_track_legacy_import_owner()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_parish uuid; v_source text;
begin
  if new.batch_id is null or new.row_id is null then return new; end if;
  select parish_id into v_parish from public.legacy_import_batches where id=new.batch_id;
  if v_parish is null then raise exception 'Importación legacy sin parroquia propietaria'; end if;
  select coalesce(normalized_data->>'celebration_place',original_data->>'lugbau',original_data->>'lugcon')
    into v_source from public.legacy_import_rows where id=new.row_id;
  insert into public.legacy_import_ownership(
    batch_id,row_id,owner_parish_id,target_table,target_id,source_parish_name,metadata
  ) values(
    new.batch_id,new.row_id,v_parish,new.target_table,new.target_id,nullif(v_source,''),
    jsonb_build_object('source_key',new.source_key,'profile_key',new.profile_key)
  ) on conflict(batch_id,row_id) do update set
    owner_parish_id=excluded.owner_parish_id,target_table=excluded.target_table,
    target_id=excluded.target_id,source_parish_name=excluded.source_parish_name,
    metadata=excluded.metadata,updated_at=now();
  return new;
end;
$$;

drop trigger if exists trg_sacramentum_track_legacy_import_owner on public.legacy_record_links;
create trigger trg_sacramentum_track_legacy_import_owner
after insert or update of batch_id,row_id,target_table,target_id on public.legacy_record_links
for each row execute function public.sacramentum_track_legacy_import_owner();

insert into public.legacy_import_ownership(
  batch_id,row_id,owner_parish_id,target_table,target_id,source_parish_name,metadata
)
select l.batch_id,l.row_id,b.parish_id,l.target_table,l.target_id,
  coalesce(r.normalized_data->>'celebration_place',r.original_data->>'lugbau',r.original_data->>'lugcon'),
  jsonb_build_object('source_key',l.source_key,'profile_key',l.profile_key,'backfilled',true)
from public.legacy_record_links l
join public.legacy_import_batches b on b.id=l.batch_id
left join public.legacy_import_rows r on r.id=l.row_id
where b.parish_id is not null and l.batch_id is not null and l.row_id is not null
on conflict(batch_id,row_id) do update set owner_parish_id=excluded.owner_parish_id,
  target_table=excluded.target_table,target_id=excluded.target_id,updated_at=now();
create or replace function public.create_legacy_import_batch(
  p_filename text,p_profile_key text,p_sha256 text default null,
  p_source_name text default null,p_parish_id uuid default null,
  p_diocese_id uuid default null,p_metadata jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_id uuid; v_profile public.legacy_import_profiles%rowtype;
  v_diocese uuid:=p_diocese_id;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if p_parish_id is null then
    raise exception 'Toda importación requiere seleccionar parroquia propietaria';
  end if;
  select * into v_profile from public.legacy_import_profiles
  where profile_key=upper(trim(p_profile_key)) and active=true;
  if not found then raise exception 'Perfil de importación no soportado: %',p_profile_key; end if;
  select diocese_id into v_diocese from public.parishes where id=p_parish_id;
  if v_diocese is null then raise exception 'Parroquia propietaria no encontrada'; end if;
  if not public.can_manage_legacy_import(p_parish_id,v_diocese) then
    raise exception 'No autorizado para importar en esta parroquia';
  end if;
  insert into public.legacy_import_batches(
    source_system,source_name,original_filename,profile_key,sha256,
    parish_id,diocese_id,status,created_by,metadata
  ) values(
    'SACRAMENTA_PLUS',nullif(trim(p_source_name),''),trim(p_filename),v_profile.profile_key,
    nullif(trim(p_sha256),''),p_parish_id,v_diocese,'staged',auth.uid(),
    coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object('owner_parish_id',p_parish_id)
  ) returning id into v_id;
  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values(
    auth.uid(),p_parish_id,v_diocese,'legacy_import_batch',v_id,'legacy_import_batch_created',
    jsonb_build_object('filename',p_filename,'profile_key',v_profile.profile_key,
      'sha256',p_sha256,'owner_parish_id',p_parish_id),coalesce(p_metadata,'{}'::jsonb)
  );
  return v_id;
end;
$$;
revoke all on function public.create_legacy_import_batch(text,text,text,text,uuid,uuid,jsonb) from public;
grant execute on function public.create_legacy_import_batch(text,text,text,text,uuid,uuid,jsonb) to authenticated;

comment on column public.legacy_pre_sacrament_registrations.owner_parish_id is
'Parroquia propietaria operativa en SACRAMENTUM; distinta de la parroquia histórica declarada en el JSON.';
comment on column public.legacy_pre_sacrament_registrations.pending_record_id is
'Boleta operativa correspondiente en pending_baptisms o pending_confirmations.';
comment on table public.legacy_import_ownership is
'Custodia parroquial obligatoria de cada fila materializada por el Centro de Migración.';

commit;
