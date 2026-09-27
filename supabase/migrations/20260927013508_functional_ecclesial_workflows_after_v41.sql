-- Funciones eclesiales recuperadas después de V41.
-- Esta migración NO crea un archivo legacy paralelo.
-- Sólo consolida capacidades modernas: expediente matrimonial y notificación de Confirmación.

alter table public.matrimonial_notifications
  add column if not exists notification_type varchar(32) not null default 'matrimonio',
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid;

alter table public.matrimonial_notification_recipients
  add column if not exists receipt_document_number varchar(80),
  add column if not exists receipt_payload jsonb,
  add column if not exists receipt_created_at timestamptz,
  add column if not exists sender_read_at timestamptz;

create index if not exists idx_matrimonial_notifications_type
  on public.matrimonial_notifications(notification_type, created_at desc);

create table if not exists public.marriage_dossiers (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete restrict,
  pending_marriage_id uuid references public.pending_marriages(id) on delete set null,
  marriage_id uuid references public.marriages(id) on delete set null,
  dossier_number text,
  dossier_date date,
  planned_marriage_date date,
  ceremony_place text,
  status text not null default 'draft',
  dossier_data jsonb not null default '{}'::jsonb,  created_by uuid,
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

create index if not exists idx_marriage_dossiers_parish
  on public.marriage_dossiers(parish_id, planned_marriage_date desc, created_at desc);

alter table public.marriage_dossiers enable row level security;

drop policy if exists marriage_dossiers_select_scoped on public.marriage_dossiers;
create policy marriage_dossiers_select_scoped
on public.marriage_dossiers
for select to authenticated
using (public.can_access_parish(parish_id));

grant select on public.marriage_dossiers to authenticated;
revoke insert, update, delete on public.marriage_dossiers from authenticated;
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
  if v_role <> 'parish'
     or public.current_app_parish_id() is distinct from p_parish_id then
    raise exception 'Sólo la parroquia propietaria puede modificar el expediente matrimonial';
  end if;

  if p_pending_marriage_id is not null and not exists(
    select 1 from public.pending_marriages
    where id=p_pending_marriage_id and parish_id=p_parish_id
  ) then
    raise exception 'El matrimonio por celebrar no pertenece a esta parroquia';
  end if;

  if p_marriage_id is not null and not exists(
    select 1 from public.marriages
    where id=p_marriage_id and parish_id=p_parish_id
  ) then
    raise exception 'La partida matrimonial no pertenece a esta parroquia';
  end if;

  if p_dossier_id is null then
    insert into public.marriage_dossiers(
      parish_id,pending_marriage_id,marriage_id,dossier_number,dossier_date,
      planned_marriage_date,ceremony_place,status,dossier_data,created_by,updated_by
    ) values (
      p_parish_id,p_pending_marriage_id,p_marriage_id,nullif(trim(p_dossier_number),''),
      p_dossier_date,p_planned_marriage_date,nullif(trim(p_ceremony_place),''),
      v_status,coalesce(p_dossier_data,'{}'::jsonb),auth.uid(),auth.uid()
    )    on conflict (pending_marriage_id) where pending_marriage_id is not null
    do update set
      marriage_id=coalesce(excluded.marriage_id,public.marriage_dossiers.marriage_id),
      dossier_number=excluded.dossier_number,
      dossier_date=excluded.dossier_date,
      planned_marriage_date=excluded.planned_marriage_date,
      ceremony_place=excluded.ceremony_place,
      status=excluded.status,
      dossier_data=excluded.dossier_data,
      updated_by=auth.uid(),
      updated_at=now()
    returning id into v_id;
  else
    update public.marriage_dossiers
    set pending_marriage_id=coalesce(p_pending_marriage_id,pending_marriage_id),
        marriage_id=coalesce(p_marriage_id,marriage_id),
        dossier_number=nullif(trim(p_dossier_number),''),
        dossier_date=p_dossier_date,
        planned_marriage_date=p_planned_marriage_date,
        ceremony_place=nullif(trim(p_ceremony_place),''),
        status=v_status,
        dossier_data=coalesce(p_dossier_data,'{}'::jsonb),
        updated_by=auth.uid(),
        updated_at=now()
    where id=p_dossier_id and parish_id=p_parish_id
    returning id into v_id;
    if v_id is null then raise exception 'Expediente matrimonial no encontrado'; end if;
  end if;
  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values (
    auth.uid(),p_parish_id,
    (select diocese_id from public.parishes where id=p_parish_id),
    'marriage_dossier',v_id,'save',
    jsonb_build_object(
      'status',v_status,
      'dossier_number',p_dossier_number,
      'planned_marriage_date',p_planned_marriage_date
    ),
    jsonb_build_object(
      'pending_marriage_id',p_pending_marriage_id,
      'marriage_id',p_marriage_id
    )
  );

  return v_id;
end;
$$;

revoke all on function public.upsert_marriage_dossier_v43(
  uuid,uuid,uuid,uuid,text,date,date,text,text,jsonb
) from public, anon;
grant execute on function public.upsert_marriage_dossier_v43(
  uuid,uuid,uuid,uuid,text,date,date,text,text,jsonb
) to authenticated;
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
    set marriage_id=new.id,
        status='celebrated',
        updated_at=now()
    where pending_marriage_id=v_pending
      and parish_id=new.parish_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_marriage_dossier_after_seat_v43 on public.marriages;
create trigger trg_sync_marriage_dossier_after_seat_v43
after insert on public.marriages
for each row execute function public.sync_marriage_dossier_after_seat_v43();

revoke all on function public.sync_marriage_dossier_after_seat_v43()
from public, anon, authenticated;
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
  where id=p_confirmation_id
    and parish_id=v_sender
    and lower(coalesce(status,'seated'))
      not in ('anulada','annulled','deleted','reverted','cancelled');
  if not found then
    raise exception 'Confirmación no encontrada o no vigente en esta parroquia';
  end if;

  select diocese_id into v_diocese
  from public.parishes where id=v_sender;

  select name into v_receiver_name
  from public.parishes
  where id=p_receiver_parish_id and diocese_id=v_diocese;
  if v_receiver_name is null then
    raise exception 'La parroquia destinataria no pertenece a la misma jurisdicción';
  end if;

  if v_target_baptism is not null and not exists(
    select 1 from public.baptisms
    where id=v_target_baptism
      and parish_id=p_receiver_parish_id
      and lower(coalesce(status,'seated'))
        not in ('anulada','annulled','deleted','reverted','cancelled')
  ) then
    raise exception 'La partida bautismal destinataria no pertenece a la parroquia seleccionada';
  end if;
  if v_target_baptism is null then
    if nullif(trim(coalesce(p_manual_locator->>'book','')),'') is null
       or nullif(trim(coalesce(p_manual_locator->>'folio','')),'') is null
       or nullif(trim(coalesce(p_manual_locator->>'number','')),'') is null then
      raise exception 'Sin partida digital debe indicar Libro, Folio y Número del Bautismo';
    end if;

    select count(*), min(id)
      into v_matches, v_target_baptism
    from public.baptisms
    where parish_id=p_receiver_parish_id
      and public.sacramentum_registry_ref(book_number)
        = public.sacramentum_registry_ref(p_manual_locator->>'book')
      and public.sacramentum_registry_ref(folio)
        = public.sacramentum_registry_ref(p_manual_locator->>'folio')
      and public.sacramentum_registry_ref(number)
        = public.sacramentum_registry_ref(p_manual_locator->>'number')
      and lower(coalesce(status,'seated'))
        not in ('anulada','annulled','deleted','reverted','cancelled');

    if v_matches <> 1 then
      v_target_baptism := null;
    end if;
  end if;

  if exists(
    select 1
    from public.matrimonial_notifications n
    join public.matrimonial_notification_recipients r
      on r.notification_id=n.id    where n.sender_parish_id=v_sender
      and n.notification_type='confirmacion'
      and n.payload->>'confirmationId'=p_confirmation_id::text
      and r.receiver_parish_id=p_receiver_parish_id
      and lower(coalesce(r.status,'pending')) <> 'cancelled'
  ) then
    raise exception 'Ya existe una notificación activa de esta Confirmación para la parroquia seleccionada';
  end if;

  v_person := trim(concat_ws(' ',v_conf.nombres,v_conf.apellidos));
  if v_person='' then
    raise exception 'La Confirmación no tiene identidad suficiente';
  end if;

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
  from public.next_document_sequence(
    v_sender,'confirmation_notification','NCF'
  );
  insert into public.matrimonial_notifications(
    sender_parish_id,diocese_id,source_baptism_id,spouse_baptism_id,
    marriage_id,consecutive,document_number,person_name,spouse_name,
    status,payload,created_by,notification_type
  ) values (
    v_sender,v_diocese,null,null,null,
    v_sequence,v_document,v_person,null,'sent',
    coalesce(p_payload,'{}'::jsonb) || jsonb_build_object(
      'notificationType','confirmacion',
      'confirmationId',v_conf.id,
      'confirmationBook',v_conf.book_number,
      'confirmationFolio',v_conf.folio,
      'confirmationNumber',v_conf.number,
      'confirmationDate',v_conf.celebration_date,
      'receiverParishId',p_receiver_parish_id,
      'receiverParishName',v_receiver_name
    ),
    auth.uid(),'confirmacion'
  ) returning id into v_notification;

  insert into public.matrimonial_notification_recipients(
    notification_id,receiver_parish_id,target_baptism_id,
    status,note_applied,payload
  ) values (
    v_notification,p_receiver_parish_id,v_target_baptism,
    'pending',false,
    jsonb_build_object(      'partyRole','confirmando',
      'receiverParishName',v_receiver_name,
      'marginalNote',v_note,
      'manualLocator',
        case when v_target_baptism is null
          then coalesce(p_manual_locator,'{}'::jsonb)
          else null
        end,
      'referenceResolution',
        case
          when p_target_baptism_id is not null then 'explicit'
          when v_target_baptism is not null then 'book_folio_number'
          else 'manual_pending'
        end
    )
  ) returning id into v_recipient;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,
    action,after_data,metadata
  ) values (
    auth.uid(),v_sender,v_diocese,
    'sacramental_notification',v_notification,
    'issue_confirmation_notification',
    jsonb_build_object(
      'document_number',v_document,
      'person_name',v_person,
      'receiver_parish_id',p_receiver_parish_id
    ),    jsonb_build_object(
      'confirmation_id',v_conf.id,
      'target_baptism_id',v_target_baptism,
      'manual_locator',p_manual_locator
    )
  );

  return query select v_notification,v_recipient,v_document;
end;
$$;

revoke all on function public.issue_confirmation_notification_v43(
  uuid,uuid,uuid,jsonb,text,jsonb
) from public, anon;
grant execute on function public.issue_confirmation_notification_v43(
  uuid,uuid,uuid,jsonb,text,jsonb
) to authenticated;

comment on table public.marriage_dossiers is
'Expediente matrimonial digital: entrevistas, testigos, hijos, documentos, dispensas y acta, vinculado al registro matrimonial.';