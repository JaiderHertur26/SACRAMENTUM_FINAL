-- SACRAMENTUM V43 · Archivo Legacy Maestro + Expediente Matrimonial + Avisos de Confirmación
-- Migración aditiva: preserva toda fuente antigua y añade capacidades modernas sin alterar partidas existentes.

create table if not exists public.legacy_report_definitions (
  id uuid primary key default gen_random_uuid(),
  report_key text not null,
  variant text not null default 'default',
  frx_filename text not null,
  frt_filename text,
  category text,
  title text,
  audit_status text,
  priority text,
  current_equivalent text,
  gap text,
  static_text text,
  legacy_fields text[] not null default '{}'::text[],
  expressions jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  source_sha256 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(report_key, frx_filename)
);

create index if not exists idx_legacy_report_definitions_category
  on public.legacy_report_definitions(category, priority, report_key);
create table if not exists public.legacy_archive_records (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'SACRAMENTA_PLUS',
  profile_key text not null,
  source_sha256 text not null,
  source_key text not null,
  batch_id uuid references public.legacy_import_batches(id) on delete set null,
  row_id uuid references public.legacy_import_rows(id) on delete set null,
  parish_id uuid references public.parishes(id) on delete set null,
  diocese_id uuid references public.dioceses(id) on delete set null,
  target_entity text,
  original_data jsonb not null default '{}'::jsonb,
  normalized_data jsonb not null default '{}'::jsonb,
  row_status text,
  reconciliation_status text not null default 'archived',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_system, profile_key, source_sha256, source_key)
);

create index if not exists idx_legacy_archive_records_scope
  on public.legacy_archive_records(diocese_id, parish_id, profile_key);
create index if not exists idx_legacy_archive_records_batch
  on public.legacy_archive_records(batch_id, row_id);
create table if not exists public.marriage_dossiers (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete restrict,
  pending_marriage_id uuid references public.pending_marriages(id) on delete set null,
  marriage_id uuid references public.marriages(id) on delete set null,
  legacy_pre_registration_id uuid references public.legacy_pre_sacrament_registrations(id) on delete set null,
  dossier_number text,
  dossier_date date,
  planned_marriage_date date,
  ceremony_place text,
  status text not null default 'draft',
  dossier_data jsonb not null default '{}'::jsonb,
  legacy_source jsonb not null default '{}'::jsonb,
  is_legacy boolean not null default false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marriage_dossiers_status_ck
    check (status in ('draft','ready','celebrated','historical','archived'))
);

create unique index if not exists uq_marriage_dossiers_pending
  on public.marriage_dossiers(pending_marriage_id)
  where pending_marriage_id is not null;
create unique index if not exists uq_marriage_dossiers_marriage
  on public.marriage_dossiers(marriage_id)
  where marriage_id is not null;
create unique index if not exists uq_marriage_dossiers_legacy_pre
  on public.marriage_dossiers(legacy_pre_registration_id)
  where legacy_pre_registration_id is not null;
create index if not exists idx_marriage_dossiers_parish
  on public.marriage_dossiers(parish_id, planned_marriage_date desc, created_at desc);
alter table public.legacy_report_definitions enable row level security;
alter table public.legacy_archive_records enable row level security;
alter table public.marriage_dossiers enable row level security;

drop policy if exists legacy_report_definitions_select_authenticated on public.legacy_report_definitions;
create policy legacy_report_definitions_select_authenticated
on public.legacy_report_definitions
for select to authenticated
using (true);

drop policy if exists legacy_archive_records_select_scoped on public.legacy_archive_records;
create policy legacy_archive_records_select_scoped
on public.legacy_archive_records
for select to authenticated
using (
  public.current_app_role() = 'admin_general'
  or (parish_id is not null and public.can_access_parish(parish_id))
  or (diocese_id is not null and diocese_id = public.current_app_diocese_id())
);

drop policy if exists marriage_dossiers_select_scoped on public.marriage_dossiers;
create policy marriage_dossiers_select_scoped
on public.marriage_dossiers
for select to authenticated
using (public.can_access_parish(parish_id));

revoke insert, update, delete on public.legacy_report_definitions from authenticated;
revoke insert, update, delete on public.legacy_archive_records from authenticated;
revoke insert, update, delete on public.marriage_dossiers from authenticated;
create or replace function public.archive_legacy_batch_snapshot_v43(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.legacy_import_batches%rowtype;
  v_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select * into v_batch
  from public.legacy_import_batches
  where id = p_batch_id;

  if not found then raise exception 'Lote legacy no encontrado'; end if;

  if public.current_app_role() <> 'admin_general' then
    if public.current_app_role() <> 'diocese'
       or v_batch.diocese_id is distinct from public.current_app_diocese_id() then
      raise exception 'No autorizado para archivar este lote';
    end if;
  end if;

  insert into public.legacy_archive_records(
    source_system,profile_key,source_sha256,source_key,batch_id,row_id,
    parish_id,diocese_id,target_entity,original_data,normalized_data,row_status,metadata
  )
  select
    coalesce(v_batch.source_system,'SACRAMENTA_PLUS'),
    v_batch.profile_key,
    coalesce(v_batch.sha256,'NO-HASH'),
    coalesce(r.source_key,r.row_number::text),
    v_batch.id,r.id,v_batch.parish_id,v_batch.diocese_id,r.target_entity,
    r.original_data,r.normalized_data,r.status,
    jsonb_build_object('filename',v_batch.original_filename,'issue_codes',r.issue_codes,'issue_details',r.issue_details)
  from public.legacy_import_rows r
  where r.batch_id=v_batch.id
  on conflict(source_system,profile_key,source_sha256,source_key)
  do update set
    batch_id=excluded.batch_id,row_id=excluded.row_id,parish_id=excluded.parish_id,
    diocese_id=excluded.diocese_id,target_entity=excluded.target_entity,
    original_data=excluded.original_data,normalized_data=excluded.normalized_data,
    row_status=excluded.row_status,metadata=excluded.metadata,updated_at=now();

  get diagnostics v_count = row_count;
  return jsonb_build_object('archived',v_count,'batch_id',p_batch_id);
end;
$$;

revoke all on function public.archive_legacy_batch_snapshot_v43(uuid) from public, anon;
grant execute on function public.archive_legacy_batch_snapshot_v43(uuid) to authenticated;
create or replace function public.upsert_marriage_dossier_v43(
  p_dossier_id uuid,
  p_parish_id uuid,
  p_pending_marriage_id uuid default null,
  p_marriage_id uuid default null,
  p_dossier_number text default null,
  p_dossier_date date default null,
  p_planned_marriage_date date default null,
  p_ceremony_place text default null,
  p_status text default 'draft',
  p_dossier_data jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_id uuid;
  v_status text := lower(trim(coalesce(p_status,'draft')));
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if p_parish_id is null then raise exception 'Parroquia requerida'; end if;
  if v_status not in ('draft','ready','celebrated','historical','archived') then
    raise exception 'Estado de expediente inválido';
  end if;

  v_role := public.current_app_role();
  if v_role <> 'parish' or public.current_app_parish_id() is distinct from p_parish_id then
    raise exception 'Sólo la parroquia propietaria puede modificar el expediente matrimonial';
  end if;

  if p_pending_marriage_id is not null and not exists(
    select 1 from public.pending_marriages
    where id=p_pending_marriage_id and parish_id=p_parish_id
  ) then raise exception 'El matrimonio por celebrar no pertenece a esta parroquia'; end if;

  if p_marriage_id is not null and not exists(
    select 1 from public.marriages
    where id=p_marriage_id and parish_id=p_parish_id
  ) then raise exception 'La partida matrimonial no pertenece a esta parroquia'; end if;
  if p_dossier_id is null then
    insert into public.marriage_dossiers(
      parish_id,pending_marriage_id,marriage_id,dossier_number,dossier_date,
      planned_marriage_date,ceremony_place,status,dossier_data,created_by,updated_by
    ) values (
      p_parish_id,p_pending_marriage_id,p_marriage_id,nullif(trim(p_dossier_number),''),
      p_dossier_date,p_planned_marriage_date,nullif(trim(p_ceremony_place),''),
      v_status,coalesce(p_dossier_data,'{}'::jsonb),auth.uid(),auth.uid()
    )
    on conflict (pending_marriage_id) where pending_marriage_id is not null
    do update set
      marriage_id=coalesce(excluded.marriage_id,public.marriage_dossiers.marriage_id),
      dossier_number=excluded.dossier_number,dossier_date=excluded.dossier_date,
      planned_marriage_date=excluded.planned_marriage_date,
      ceremony_place=excluded.ceremony_place,status=excluded.status,
      dossier_data=excluded.dossier_data,updated_by=auth.uid(),updated_at=now()
    returning id into v_id;
  else
    update public.marriage_dossiers
    set pending_marriage_id=coalesce(p_pending_marriage_id,pending_marriage_id),
        marriage_id=coalesce(p_marriage_id,marriage_id),
        dossier_number=nullif(trim(p_dossier_number),''),
        dossier_date=p_dossier_date,
        planned_marriage_date=p_planned_marriage_date,
        ceremony_place=nullif(trim(p_ceremony_place),''),
        status=v_status,dossier_data=coalesce(p_dossier_data,'{}'::jsonb),
        updated_by=auth.uid(),updated_at=now()
    where id=p_dossier_id and parish_id=p_parish_id
    returning id into v_id;
    if v_id is null then raise exception 'Expediente matrimonial no encontrado'; end if;
  end if;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values (
    auth.uid(),p_parish_id,(select diocese_id from public.parishes where id=p_parish_id),
    'marriage_dossier',v_id,'save',
    jsonb_build_object('status',v_status,'dossier_number',p_dossier_number,'planned_marriage_date',p_planned_marriage_date),
    jsonb_build_object('pending_marriage_id',p_pending_marriage_id,'marriage_id',p_marriage_id)
  );

  return v_id;
end;
$$;

revoke all on function public.upsert_marriage_dossier_v43(uuid,uuid,uuid,uuid,text,date,date,text,text,jsonb) from public, anon;
grant execute on function public.upsert_marriage_dossier_v43(uuid,uuid,uuid,uuid,text,date,date,text,text,jsonb) to authenticated;
create or replace function public.sync_marriage_dossier_after_seat_v43()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pending uuid;
begin
  begin
    v_pending := nullif(new.raw_data->>'id','')::uuid;
  exception when others then
    v_pending := null;
  end;

  if v_pending is not null then
    update public.marriage_dossiers
    set marriage_id=new.id,status='celebrated',updated_at=now()
    where pending_marriage_id=v_pending and parish_id=new.parish_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_marriage_dossier_after_seat_v43 on public.marriages;
create trigger trg_sync_marriage_dossier_after_seat_v43
after insert on public.marriages
for each row execute function public.sync_marriage_dossier_after_seat_v43();

revoke all on function public.sync_marriage_dossier_after_seat_v43() from public, anon, authenticated;
create or replace function public.materialize_legacy_marriage_dossiers_v43(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.legacy_import_batches%rowtype;
  r record;
  v_pre uuid;
  v_dossier uuid;
  v_count integer := 0;
  v_reported boolean;
  v_date date;
  v_inscription_date date;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select * into v_batch from public.legacy_import_batches where id=p_batch_id;
  if not found then raise exception 'Lote no encontrado'; end if;
  if upper(coalesce(v_batch.profile_key,'')) <> 'INSMATRI' then
    return jsonb_build_object('materialized',0,'reason','profile_not_insmatri');
  end if;
  if v_batch.parish_id is null then raise exception 'INSMATRI requiere parroquia propietaria'; end if;

  if public.current_app_role() <> 'admin_general' then
    if public.current_app_role() <> 'diocese'
       or v_batch.diocese_id is distinct from public.current_app_diocese_id() then
      raise exception 'No autorizado para materializar este lote';
    end if;
  end if;

  for r in
    select * from public.legacy_import_rows
    where batch_id=p_batch_id and target_entity='pending_marriage'
    order by row_number
  loop
    v_reported := coalesce((r.normalized_data->>'reported')::boolean,false);
    begin
      v_date := nullif(coalesce(r.normalized_data->>'celebration_date',r.original_data->>'fecmat'),'')::date;
    exception when others then v_date := null; end;
    begin
      v_inscription_date := nullif(coalesce(r.normalized_data->>'inscription_date',r.original_data->>'fecins'),'')::date;
    exception when others then v_inscription_date := null; end;

    insert into public.legacy_pre_sacrament_registrations(
      profile_key,source_sha256,source_key,batch_id,row_id,sacrament_type,
      legacy_entry_number,owner_parish_id,inscription_date,celebration_date,
      names,last_names,reported,original_data,normalized_data,reconciliation_status
    ) values (
      'INSMATRI',coalesce(v_batch.sha256,'NO-HASH'),coalesce(r.source_key,r.row_number::text),
      p_batch_id,r.id,'matrimonio',nullif(r.normalized_data->>'legacy_entry_number',''),
      v_batch.parish_id,
      v_inscription_date,
      v_date,
      nullif(trim(concat_ws(' / ',r.original_data->>'nombr1',r.original_data->>'nombr2')),''),
      nullif(trim(concat_ws(' / ',r.original_data->>'apell1',r.original_data->>'apell2')),''),
      v_reported,r.original_data,r.normalized_data,
      case when v_reported then 'pending_match' else 'not_seated' end
    )
    on conflict(profile_key,source_sha256,source_key)
    do update set batch_id=excluded.batch_id,row_id=excluded.row_id,
      owner_parish_id=excluded.owner_parish_id,original_data=excluded.original_data,
      normalized_data=excluded.normalized_data,reported=excluded.reported,
      reconciliation_status=excluded.reconciliation_status,updated_at=now()
    returning id into v_pre;

    insert into public.marriage_dossiers(
      parish_id,legacy_pre_registration_id,dossier_number,dossier_date,
      planned_marriage_date,ceremony_place,status,dossier_data,legacy_source,is_legacy
    ) values (
      v_batch.parish_id,v_pre,
      nullif(coalesce(r.normalized_data->>'legacy_entry_number',r.original_data->>'numero'),''),
      v_inscription_date,
      v_date,nullif(r.original_data->>'lugmat',''),'historical',
      r.normalized_data,r.original_data,true
    )
    on conflict (legacy_pre_registration_id) where legacy_pre_registration_id is not null
    do update set
      dossier_number=excluded.dossier_number,
      dossier_date=excluded.dossier_date,
      planned_marriage_date=excluded.planned_marriage_date,
      ceremony_place=excluded.ceremony_place,
      dossier_data=excluded.dossier_data,
      legacy_source=excluded.legacy_source,
      is_legacy=true,
      updated_at=now()
    returning id into v_dossier;

    if v_dossier is not null then v_count := v_count + 1; end if;

    update public.legacy_import_rows
    set status='imported',target_table='marriage_dossier',target_id=v_dossier,
        imported_at=coalesce(imported_at,now()),updated_at=now()
    where id=r.id;
  end loop;

  update public.legacy_import_batches
  set imported_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='imported'),
      valid_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='valid'),
      review_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='review'),
      error_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='error'),
      status=case
        when exists(select 1 from public.legacy_import_rows where batch_id=p_batch_id and status in ('review','error')) then 'completed_with_review'
        else 'completed'
      end,
      updated_at=now()
  where id=p_batch_id;

  return jsonb_build_object('materialized',v_count,'batch_id',p_batch_id);
end;
$$;

revoke all on function public.materialize_legacy_marriage_dossiers_v43(uuid) from public, anon;
grant execute on function public.materialize_legacy_marriage_dossiers_v43(uuid) to authenticated;
create or replace function public.issue_confirmation_notification_v43(
  p_confirmation_id uuid,
  p_receiver_parish_id uuid,
  p_target_baptism_id uuid default null,
  p_manual_locator jsonb default '{}'::jsonb,
  p_note text default null,
  p_payload jsonb default '{}'::jsonb
)
returns table(notification_id uuid, recipient_id uuid, document_number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sender uuid;
  v_diocese uuid;
  v_conf public.confirmations%rowtype;
  v_receiver_name text;
  v_document text;
  v_sequence bigint;
  v_notification uuid;
  v_recipient uuid;
  v_person text;
  v_note text;
  v_target_baptism uuid := p_target_baptism_id;
  v_matches integer := 0;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if public.current_app_role() <> 'parish' then
    raise exception 'Sólo una parroquia puede emitir una notificación de Confirmación';
  end if;

  v_sender := public.current_app_parish_id();
  if v_sender is null then raise exception 'No se pudo determinar la parroquia emisora'; end if;

  select * into v_conf
  from public.confirmations
  where id=p_confirmation_id and parish_id=v_sender
    and lower(coalesce(status,'seated')) not in ('anulada','annulled','deleted','reverted','cancelled');
  if not found then raise exception 'Confirmación no encontrada o no vigente en esta parroquia'; end if;

  select diocese_id into v_diocese from public.parishes where id=v_sender;

  select name into v_receiver_name
  from public.parishes
  where id=p_receiver_parish_id and diocese_id=v_diocese;
  if v_receiver_name is null then
    raise exception 'La parroquia destinataria no pertenece a la misma jurisdicción';
  end if;

  if v_target_baptism is not null and not exists(
    select 1 from public.baptisms
    where id=v_target_baptism and parish_id=p_receiver_parish_id
      and lower(coalesce(status,'seated')) not in ('anulada','annulled','deleted','reverted','cancelled')
  ) then raise exception 'La partida bautismal destinataria no pertenece a la parroquia seleccionada'; end if;

  if v_target_baptism is null then
    if (
      nullif(trim(coalesce(p_manual_locator->>'book','')),'') is null
      or nullif(trim(coalesce(p_manual_locator->>'folio','')),'') is null
      or nullif(trim(coalesce(p_manual_locator->>'number','')),'') is null
    ) then raise exception 'Sin partida digital debe indicar Libro, Folio y Número del Bautismo'; end if;

    select count(*), min(id)
      into v_matches, v_target_baptism
    from public.baptisms
    where parish_id=p_receiver_parish_id
      and public.sacramentum_registry_ref(book_number)=public.sacramentum_registry_ref(p_manual_locator->>'book')
      and public.sacramentum_registry_ref(folio)=public.sacramentum_registry_ref(p_manual_locator->>'folio')
      and public.sacramentum_registry_ref(number)=public.sacramentum_registry_ref(p_manual_locator->>'number')
      and lower(coalesce(status,'seated')) not in ('anulada','annulled','deleted','reverted','cancelled');

    if v_matches <> 1 then
      v_target_baptism := null;
    end if;
  end if;

  if exists(
    select 1
    from public.matrimonial_notifications n
    join public.matrimonial_notification_recipients r on r.notification_id=n.id
    where n.sender_parish_id=v_sender
      and n.notification_type='confirmacion'
      and n.payload->>'confirmationId'=p_confirmation_id::text
      and r.receiver_parish_id=p_receiver_parish_id
      and lower(coalesce(r.status,'pending')) <> 'cancelled'
  ) then
    raise exception 'Ya existe una notificación activa de esta Confirmación para la parroquia seleccionada';
  end if;

  v_person := trim(concat_ws(' ',v_conf.nombres,v_conf.apellidos));
  if v_person='' then raise exception 'La Confirmación no tiene identidad suficiente'; end if;

  v_note := nullif(trim(coalesce(p_note,'')),'');
  if v_note is null then
    v_note := 'RECIBIÓ EL SACRAMENTO DE LA CONFIRMACIÓN EL '
      || coalesce(to_char(v_conf.celebration_date,'DD/MM/YYYY'),'S/F')
      || ' EN ESTA PARROQUIA. LIBRO '||coalesce(v_conf.book_number,'—')
      || ', FOLIO '||coalesce(v_conf.folio,'—')
      || ', NÚMERO '||coalesce(v_conf.number,'—')||'.';
  end if;

  select sequence_value, document_number
    into v_sequence, v_document
  from public.next_document_sequence(v_sender,'confirmation_notification','NCF');

  insert into public.matrimonial_notifications(
    sender_parish_id,diocese_id,source_baptism_id,spouse_baptism_id,marriage_id,
    consecutive,document_number,person_name,spouse_name,status,payload,created_by,notification_type
  ) values (
    v_sender,v_diocese,null,null,null,
    v_sequence,v_document,v_person,null,'sent',
    coalesce(p_payload,'{}'::jsonb) || jsonb_build_object(
      'notificationType','confirmacion','confirmationId',v_conf.id,
      'confirmationBook',v_conf.book_number,'confirmationFolio',v_conf.folio,
      'confirmationNumber',v_conf.number,'confirmationDate',v_conf.celebration_date,
      'receiverParishId',p_receiver_parish_id,'receiverParishName',v_receiver_name
    ),
    auth.uid(),'confirmacion'
  ) returning id into v_notification;

  insert into public.matrimonial_notification_recipients(
    notification_id,receiver_parish_id,target_baptism_id,status,note_applied,payload
  ) values (
    v_notification,p_receiver_parish_id,v_target_baptism,'pending',false,
    jsonb_build_object(
      'partyRole','confirmando','receiverParishName',v_receiver_name,
      'marginalNote',v_note,
      'manualLocator',case when v_target_baptism is null then coalesce(p_manual_locator,'{}'::jsonb) else null end,
      'referenceResolution',case when p_target_baptism_id is not null then 'explicit'
                                 when v_target_baptism is not null then 'book_folio_number'
                                 else 'manual_pending' end
    )
  ) returning id into v_recipient;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values (
    auth.uid(),v_sender,v_diocese,'sacramental_notification',v_notification,
    'issue_confirmation_notification',
    jsonb_build_object('document_number',v_document,'person_name',v_person,'receiver_parish_id',p_receiver_parish_id),
    jsonb_build_object('confirmation_id',v_conf.id,'target_baptism_id',v_target_baptism,'manual_locator',p_manual_locator)
  );

  return query select v_notification,v_recipient,v_document;
end;
$$;

revoke all on function public.issue_confirmation_notification_v43(uuid,uuid,uuid,jsonb,text,jsonb) from public, anon;
grant execute on function public.issue_confirmation_notification_v43(uuid,uuid,uuid,jsonb,text,jsonb) to authenticated;
insert into public.legacy_import_profiles(
  profile_key,display_name,target_entity,import_mode,requires_parish,mapping,validation_rules,active
) values
('REPORTES_FRX','Catálogo de reportes Visual FoxPro','legacy_report_definition','archive',false,
 '{"key":["report_key","frx_filename"]}'::jsonb,'{}'::jsonb,true)
on conflict(profile_key) do update set
 display_name=excluded.display_name,target_entity=excluded.target_entity,
 import_mode=excluded.import_mode,requires_parish=excluded.requires_parish,
 mapping=excluded.mapping,validation_rules=excluded.validation_rules,active=true,updated_at=now();

comment on table public.legacy_report_definitions
is 'Archivo técnico de diseños FRX/FRT del programa SACRAMENTA anterior; sirve como trazabilidad y referencia funcional, no como motor de impresión.';
comment on table public.legacy_archive_records
is 'Bóveda inmutable de filas legacy normalizadas y originales para preservar tablas aunque todavía no tengan destino funcional.';
comment on table public.marriage_dossiers
is 'Expediente matrimonial digital estructurado: entrevistas de ambos contrayentes, testigos, acta y legado INSMATRI.';


-- --------------------------------------------------------------------------
-- V43B · Perfil universal y materialización del catálogo técnico FRX/FRT.
-- --------------------------------------------------------------------------
insert into public.legacy_import_profiles(
  profile_key,display_name,target_entity,import_mode,requires_parish,mapping,validation_rules,active
) values
('LEGACY_ARCHIVE','Archivo universal · tabla antigua sin mapeo','legacy_archive','archive',true,
 '{"key":["source_key"]}'::jsonb,'{}'::jsonb,true)
on conflict(profile_key) do update set
 display_name=excluded.display_name,target_entity=excluded.target_entity,
 import_mode=excluded.import_mode,requires_parish=excluded.requires_parish,
 mapping=excluded.mapping,validation_rules=excluded.validation_rules,active=true,updated_at=now();

create or replace function public.materialize_legacy_report_definitions_v43(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.legacy_import_batches%rowtype;
  r record;
  d jsonb;
  v_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select * into v_batch
  from public.legacy_import_batches
  where id=p_batch_id;
  if not found then raise exception 'Lote no encontrado'; end if;

  if upper(coalesce(v_batch.profile_key,'')) <> 'REPORTES_FRX' then
    return jsonb_build_object('materialized',0,'reason','profile_not_reportes_frx');
  end if;

  if public.current_app_role() not in ('admin_general','diocese') then
    raise exception 'Rol no autorizado para archivar diseños FRX/FRT';
  end if;
  if public.current_app_role()='diocese'
     and v_batch.diocese_id is distinct from public.current_app_diocese_id() then
    raise exception 'El lote no pertenece a esta jurisdicción';
  end if;

  for r in
    select * from public.legacy_import_rows
    where batch_id=p_batch_id and status in ('valid','review','staged')
    order by row_number
  loop
    d:=coalesce(r.normalized_data,'{}'::jsonb);

    insert into public.legacy_report_definitions(
      report_key,variant,frx_filename,frt_filename,category,title,audit_status,
      priority,current_equivalent,gap,static_text,legacy_fields,expressions,
      metadata,source_sha256,updated_at
    ) values (
      coalesce(nullif(d->>'report_key',''),r.source_key,'REPORT-'||r.row_number),
      coalesce(nullif(d->>'variant',''),'default'),
      coalesce(nullif(d->>'frx_filename',''),coalesce(nullif(d->>'report_key',''),r.source_key)||'.frx'),
      nullif(d->>'frt_filename',''),
      nullif(d->>'category',''),
      nullif(d->>'title',''),
      nullif(d->>'audit_status',''),
      nullif(d->>'priority',''),
      nullif(d->>'current_equivalent',''),
      nullif(d->>'gap',''),
      nullif(d->>'static_text',''),
      coalesce(array(select jsonb_array_elements_text(coalesce(d->'legacy_fields','[]'::jsonb))),'{}'::text[]),
      coalesce(d->'expressions','[]'::jsonb),
      coalesce(d->'metadata','{}'::jsonb) || jsonb_build_object(
        'batch_id',p_batch_id,'row_id',r.id,'original_data',r.original_data
      ),
      nullif(coalesce(d->>'source_sha256',v_batch.sha256),''),
      now()
    )
    on conflict(report_key,frx_filename)
    do update set
      variant=excluded.variant,frt_filename=excluded.frt_filename,
      category=excluded.category,title=excluded.title,audit_status=excluded.audit_status,
      priority=excluded.priority,current_equivalent=excluded.current_equivalent,
      gap=excluded.gap,static_text=excluded.static_text,legacy_fields=excluded.legacy_fields,
      expressions=excluded.expressions,metadata=excluded.metadata,
      source_sha256=excluded.source_sha256,updated_at=now();

    update public.legacy_import_rows
    set status='imported',target_table='legacy_report_definition',imported_at=coalesce(imported_at,now()),updated_at=now()
    where id=r.id;
    v_count:=v_count+1;
  end loop;

  update public.legacy_import_batches
  set imported_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='imported'),
      valid_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='valid'),
      review_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='review'),
      error_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='error'),
      status='completed',
      updated_at=now()
  where id=p_batch_id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values (
    auth.uid(),v_batch.parish_id,v_batch.diocese_id,'legacy_import_batch',p_batch_id,
    'materialize_legacy_report_definitions',
    jsonb_build_object('materialized',v_count),
    jsonb_build_object('profile_key',v_batch.profile_key,'filename',v_batch.original_filename)
  );

  return jsonb_build_object('materialized',v_count,'batch_id',p_batch_id);
end;
$$;

revoke all on function public.materialize_legacy_report_definitions_v43(uuid) from public, anon;
grant execute on function public.materialize_legacy_report_definitions_v43(uuid) to authenticated;


create or replace function public.legacy_archive_summary_v43()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_diocese uuid;
  v_total bigint;
  v_by_profile jsonb;
  v_by_status jsonb;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  v_role:=public.current_app_role();
  v_diocese:=public.current_app_diocese_id();

  if v_role not in ('admin_general','diocese','chancery') then
    raise exception 'Rol no autorizado para consultar el archivo histórico';
  end if;

  select count(*)
  into v_total
  from public.legacy_archive_records r
  where v_role='admin_general' or r.diocese_id=v_diocese;

  select coalesce(jsonb_object_agg(profile_key,cnt),'{}'::jsonb)
  into v_by_profile
  from (
    select coalesce(profile_key,'SIN_PERFIL') profile_key,count(*) cnt
    from public.legacy_archive_records r
    where v_role='admin_general' or r.diocese_id=v_diocese
    group by coalesce(profile_key,'SIN_PERFIL')
    order by count(*) desc
  ) s;

  select coalesce(jsonb_object_agg(status_key,cnt),'{}'::jsonb)
  into v_by_status
  from (
    select coalesce(reconciliation_status,'archived') status_key,count(*) cnt
    from public.legacy_archive_records r
    where v_role='admin_general' or r.diocese_id=v_diocese
    group by coalesce(reconciliation_status,'archived')
  ) s;

  return jsonb_build_object(
    'total',v_total,
    'byProfile',coalesce(v_by_profile,'{}'::jsonb),
    'byStatus',coalesce(v_by_status,'{}'::jsonb)
  );
end;
$$;

revoke all on function public.legacy_archive_summary_v43() from public, anon;
grant execute on function public.legacy_archive_summary_v43() to authenticated;


create or replace function public.materialize_legacy_sacramental_notes_v43(
  p_batch_id uuid,
  p_limit integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.legacy_import_batches%rowtype;
  r public.legacy_import_rows%rowtype;
  d jsonb;
  v_sacrament text;
  v_target uuid;
  v_matches integer;
  v_note uuid;
  v_imported integer:=0;
  v_pending integer:=0;
  v_failed integer:=0;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if p_limit<1 or p_limit>2000 then raise exception 'Límite inválido'; end if;

  select * into v_batch
  from public.legacy_import_batches
  where id=p_batch_id
  for update;

  if not found then raise exception 'Lote no encontrado'; end if;
  if not public.can_manage_legacy_import(v_batch.parish_id,v_batch.diocese_id) then
    raise exception 'No autorizado';
  end if;

  if upper(coalesce(v_batch.profile_key,'')) not in
     ('NTBAU001','NTBAU002','NTCON001','NTDEF001') then
    raise exception 'Perfil no soportado por materializador sacramental genérico';
  end if;

  for r in
    select *
    from public.legacy_import_rows
    where batch_id=p_batch_id and status in ('valid','review')
    order by row_number
    limit p_limit
    for update skip locked
  loop
    begin
      d:=coalesce(r.normalized_data,'{}'::jsonb);
      v_sacrament:=lower(coalesce(d->>'sacrament_type',''));
      v_target:=null;
      v_matches:=0;

      if nullif(trim(d->>'book_number'),'') is null
         or nullif(trim(d->>'folio'),'') is null
         or nullif(trim(d->>'number'),'') is null
         or nullif(trim(d->>'content'),'') is null then
        raise exception 'Libro/Folio/Número/nota incompletos';
      end if;

      if v_sacrament='bautismo' then
        select count(*),min(id) into v_matches,v_target
        from public.baptisms
        where parish_id=v_batch.parish_id
          and public.sacramentum_registry_ref(book_number)=public.sacramentum_registry_ref(d->>'book_number')
          and public.sacramentum_registry_ref(folio)=public.sacramentum_registry_ref(d->>'folio')
          and public.sacramentum_registry_ref(number)=public.sacramentum_registry_ref(d->>'number')
          and lower(coalesce(status,'seated')) not in ('anulada','annulled','deleted','reverted','cancelled');
      elsif v_sacrament='confirmacion' then
        select count(*),min(id) into v_matches,v_target
        from public.confirmations
        where parish_id=v_batch.parish_id
          and public.sacramentum_registry_ref(book_number)=public.sacramentum_registry_ref(d->>'book_number')
          and public.sacramentum_registry_ref(folio)=public.sacramentum_registry_ref(d->>'folio')
          and public.sacramentum_registry_ref(number)=public.sacramentum_registry_ref(d->>'number')
          and lower(coalesce(status,'seated')) not in ('anulada','annulled','deleted','reverted','cancelled');
      elsif v_sacrament='exequias' then
        select count(*),min(id) into v_matches,v_target
        from public.funerals
        where parish_id=v_batch.parish_id
          and public.sacramentum_registry_ref(book_number)=public.sacramentum_registry_ref(d->>'book_number')
          and public.sacramentum_registry_ref(folio)=public.sacramentum_registry_ref(d->>'folio')
          and public.sacramentum_registry_ref(number)=public.sacramentum_registry_ref(d->>'number')
          and lower(coalesce(status,'seated')) not in ('anulada','annulled','deleted','reverted','cancelled');
      else
        raise exception 'Sacramento legacy no soportado: %',v_sacrament;
      end if;

      if v_matches=1 then
        select id into v_note
        from public.marginal_notes
        where parish_id=v_batch.parish_id
          and sacrament_type=v_sacrament
          and sacrament_id=v_target
          and legacy_source->>'profile_key'=v_batch.profile_key
          and legacy_source->>'source_key'=coalesce(r.source_key,r.row_number::text)
        limit 1;

        if v_note is null then
          insert into public.marginal_notes(
            sacrament_type,note_type,content,parish_id,sacrament_id,note_date,
            source_type,created_by,status,print_policy,print_default,is_locked,
            print_label,legacy_source
          ) values (
            v_sacrament,'legacy_historical',d->>'content',
            v_batch.parish_id,v_target,null,
            'legacy',auth.uid(),'active','optional',true,true,
            'Nota histórica',
            jsonb_build_object(
              'batch_id',p_batch_id,
              'row_id',r.id,
              'profile_key',v_batch.profile_key,
              'source_key',coalesce(r.source_key,r.row_number::text),
              'legacy_dafe_code',d->>'legacy_dafe_code',
              'legacy_updated_at',d->>'legacy_updated_at',
              'original_data',r.original_data
            )
          ) returning id into v_note;
        end if;

        update public.legacy_import_rows
        set status='imported',target_table='marginal_notes',target_id=v_note,
            imported_at=coalesce(imported_at,now()),
            issue_details=coalesce(issue_details,'{}'::jsonb)||jsonb_build_object(
              'note_link_status','matched','sacrament_id',v_target,'marginal_note_id',v_note
            ),
            updated_at=now()
        where id=r.id;
        v_imported:=v_imported+1;
      else
        update public.legacy_import_rows
        set status='review',
            issue_codes=array(select distinct unnest(coalesce(issue_codes,'{}'::text[])||array[
              case when v_matches=0 then 'LEGACY_NOTE_TARGET_NOT_FOUND' else 'LEGACY_NOTE_TARGET_AMBIGUOUS' end
            ])),
            issue_details=coalesce(issue_details,'{}'::jsonb)||jsonb_build_object(
              'note_link_status',case when v_matches=0 then 'pending' else 'ambiguous' end,
              'matches',v_matches
            ),
            updated_at=now()
        where id=r.id;
        v_pending:=v_pending+1;
      end if;
    exception when others then
      update public.legacy_import_rows
      set status='error',
          issue_codes=array(select distinct unnest(coalesce(issue_codes,'{}'::text[])||array['IMPORT_ERROR'])),
          issue_details=coalesce(issue_details,'{}'::jsonb)||jsonb_build_object('import_error',sqlerrm),
          updated_at=now()
      where id=r.id;
      v_failed:=v_failed+1;
    end;
  end loop;

  update public.legacy_import_batches b
  set imported_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='imported'),
      valid_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='valid'),
      review_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='review'),
      error_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='error'),
      status=case
        when exists(select 1 from public.legacy_import_rows where batch_id=p_batch_id and status='valid') then 'ready'
        when exists(select 1 from public.legacy_import_rows where batch_id=p_batch_id and status in ('review','error')) then 'completed_with_review'
        else 'completed'
      end,
      updated_at=now()
  where id=p_batch_id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values (
    auth.uid(),v_batch.parish_id,v_batch.diocese_id,'legacy_import_batch',p_batch_id,
    'legacy_sacramental_notes_materialized',
    jsonb_build_object('imported',v_imported,'pending_review',v_pending,'failed',v_failed),
    jsonb_build_object('profile_key',v_batch.profile_key,'filename',v_batch.original_filename)
  );

  return jsonb_build_object(
    'imported',v_imported,'pending_review',v_pending,'failed',v_failed,'batch_id',p_batch_id
  );
end;
$$;

revoke all on function public.materialize_legacy_sacramental_notes_v43(uuid,integer) from public, anon;
grant execute on function public.materialize_legacy_sacramental_notes_v43(uuid,integer) to authenticated;
