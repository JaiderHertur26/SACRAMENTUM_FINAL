-- SACRAMENTUM · V14 · NOTIFICACIONES SACRAMENTALES + ACUSE DE RECIBIDO
begin;

alter table public.matrimonial_notifications
  add column if not exists notification_type varchar(64) not null default 'matrimonio';

alter table public.matrimonial_notification_recipients
  add column if not exists receipt_document_number varchar(80),
  add column if not exists receipt_payload jsonb,
  add column if not exists receipt_created_at timestamptz,
  add column if not exists sender_read_at timestamptz;

create unique index if not exists uq_sacramental_receipt_number_per_parish
  on public.matrimonial_notification_recipients(receiver_parish_id, receipt_document_number)
  where receipt_document_number is not null;

create index if not exists idx_sacramental_receipts_sender_unread
  on public.matrimonial_notification_recipients(notification_id, sender_read_at, receipt_created_at desc)
  where receipt_document_number is not null;

create or replace function public.mark_sacramental_notification_read(p_recipient_id uuid)
returns public.matrimonial_notification_recipients
language plpgsql
security definer
set search_path=public
as $$
declare
  v_row public.matrimonial_notification_recipients%rowtype;
  v_parish uuid;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select up.parish_id into v_parish
  from public.user_profiles up
  where up.auth_user_id=auth.uid()
    and lower(coalesce(up.role,''))='parish'
    and coalesce(up.is_active,true)=true
  limit 1;

  if v_parish is null then raise exception 'Cuenta parroquial activa requerida'; end if;

  select * into v_row
  from public.matrimonial_notification_recipients
  where id=p_recipient_id
  for update;

  if not found then raise exception 'Notificación sacramental no encontrada'; end if;
  if v_row.receiver_parish_id is distinct from v_parish then
    raise exception 'La notificación no pertenece a esta parroquia';
  end if;

  if v_row.read_at is null then
    update public.matrimonial_notification_recipients
    set read_at=now(),read_by=auth.uid(),updated_at=now()
    where id=v_row.id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

revoke all on function public.mark_sacramental_notification_read(uuid) from public;
grant execute on function public.mark_sacramental_notification_read(uuid) to authenticated;

create or replace function public.sacramentum_prepare_sacramental_receipt()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_doc public.matrimonial_notifications%rowtype;
  v_seq bigint;
  v_year integer;
  v_receiver_name text;
  v_sender_name text;
  v_baptism jsonb;
begin
  if lower(coalesce(new.status,'')) <> 'processed'
     or new.receipt_document_number is not null then
    return new;
  end if;

  select * into v_doc
  from public.matrimonial_notifications
  where id=new.notification_id;

  if not found then
    raise exception 'No existe el documento asociado a la notificación sacramental';
  end if;

  v_year := extract(year from coalesce(new.processed_at,now()))::integer;

  insert into public.document_sequences(scope_id,document_type,current_value)
  values(new.receiver_parish_id,'sacramental_receipt_'||v_year,1)
  on conflict(scope_id,document_type)
  do update set current_value=public.document_sequences.current_value+1,
                updated_at=now()
  returning current_value into v_seq;

  select p.name into v_receiver_name from public.parishes p where p.id=new.receiver_parish_id;
  select p.name into v_sender_name from public.parishes p where p.id=v_doc.sender_parish_id;

  if new.target_baptism_id is not null then
    select jsonb_build_object(
      'id',b.id,
      'book',b.book_number,
      'folio',b.folio,
      'number',b.number,
      'name',trim(concat_ws(' ',b.nombres,b.apellidos))
    ) into v_baptism
    from public.baptisms b
    where b.id=new.target_baptism_id;
  else
    v_baptism := coalesce(new.payload->'manualLocator','{}'::jsonb);
  end if;

  new.receipt_document_number :=
    'RNS-'||v_year||'-'||lpad(v_seq::text,6,'0');
  new.receipt_created_at := coalesce(new.processed_at,now());
  new.sender_read_at := null;
  new.receipt_payload := jsonb_build_object(
    'receiptNumber',new.receipt_document_number,
    'notificationId',new.notification_id,
    'notificationDocumentNumber',v_doc.document_number,
    'notificationType',coalesce(v_doc.notification_type,'matrimonio'),
    'senderParishId',v_doc.sender_parish_id,
    'senderParishName',v_sender_name,
    'receiverParishId',new.receiver_parish_id,
    'receiverParishName',v_receiver_name,
    'acceptedAt',new.receipt_created_at,
    'acceptedBy',new.processed_by,
    'personName',v_doc.person_name,
    'spouseName',v_doc.spouse_name,
    'marriageDate',v_doc.marriage_date,
    'noteApplied',new.note_applied,
    'targetBaptismId',new.target_baptism_id,
    'baptism',coalesce(v_baptism,'{}'::jsonb)
  );

  new.payload := coalesce(new.payload,'{}'::jsonb)
    || jsonb_build_object(
      'receiptDocumentNumber',new.receipt_document_number,
      'receiptCreatedAt',new.receipt_created_at
    );

  return new;
end;
$$;

drop trigger if exists trg_prepare_sacramental_receipt
  on public.matrimonial_notification_recipients;

create trigger trg_prepare_sacramental_receipt
before update of status,note_applied,target_baptism_id,processed_at
on public.matrimonial_notification_recipients
for each row
when (
  lower(coalesce(new.status,''))='processed'
  and new.receipt_document_number is null
)
execute function public.sacramentum_prepare_sacramental_receipt();

create or replace function public.mark_sacramental_receipt_read(p_recipient_id uuid)
returns public.matrimonial_notification_recipients
language plpgsql
security definer
set search_path=public
as $$
declare
  v_row public.matrimonial_notification_recipients%rowtype;
  v_sender uuid;
  v_current uuid;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select up.parish_id into v_current
  from public.user_profiles up
  where up.auth_user_id=auth.uid()
    and lower(coalesce(up.role,''))='parish'
    and coalesce(up.is_active,true)=true
  limit 1;

  select r.* into v_row
  from public.matrimonial_notification_recipients r
  where r.id=p_recipient_id
  for update;

  if not found then raise exception 'Acuse sacramental no encontrado'; end if;

  select n.sender_parish_id into v_sender
  from public.matrimonial_notifications n
  where n.id=v_row.notification_id;
  if v_sender is distinct from v_current then
    raise exception 'El acuse no pertenece a esta parroquia emisora';
  end if;
  if v_row.receipt_document_number is null then
    raise exception 'La notificación aún no tiene acuse de recibido';
  end if;

  if v_row.sender_read_at is null then
    update public.matrimonial_notification_recipients
    set sender_read_at=now(),updated_at=now()
    where id=v_row.id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

revoke all on function public.mark_sacramental_receipt_read(uuid) from public;
grant execute on function public.mark_sacramental_receipt_read(uuid) to authenticated;

-- Crear acuses para notificaciones históricas ya procesadas que aún no los tengan.
update public.matrimonial_notification_recipients
set status=status
where lower(coalesce(status,''))='processed'
  and receipt_document_number is null;

commit;
