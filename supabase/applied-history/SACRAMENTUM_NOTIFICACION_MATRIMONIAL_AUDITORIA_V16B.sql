-- SACRAMENTUM · V16B · Auditoría completa de lectura/acuse matrimonial
begin;

create or replace function public.mark_sacramental_notification_read(p_recipient_id uuid)
returns public.matrimonial_notification_recipients
language plpgsql
security definer
set search_path=public
as $$
declare
  v_row public.matrimonial_notification_recipients%rowtype;
  v_parish uuid;
  v_diocese uuid;
  v_doc public.matrimonial_notifications%rowtype;
  v_first_read boolean:=false;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select up.parish_id,up.diocese_id
    into v_parish,v_diocese
  from public.user_profiles up
  where up.auth_user_id=auth.uid()
    and lower(coalesce(up.role,''))='parish'
    and coalesce(up.is_active,true)=true
    and upper(coalesce(up.status,'ACTIVE'))='ACTIVE'
  limit 1;

  if v_parish is null then
    raise exception 'Cuenta parroquial activa requerida';
  end if;  select * into v_row
  from public.matrimonial_notification_recipients
  where id=p_recipient_id
  for update;

  if not found then
    raise exception 'Notificación sacramental no encontrada';
  end if;

  if v_row.receiver_parish_id is distinct from v_parish then
    raise exception 'La notificación no pertenece a esta parroquia';
  end if;

  select * into v_doc
  from public.matrimonial_notifications
  where id=v_row.notification_id;

  if not found then
    raise exception 'Documento sacramental asociado no encontrado';
  end if;

  if v_row.read_at is null then
    update public.matrimonial_notification_recipients
    set read_at=now(),read_by=auth.uid(),updated_at=now()
    where id=v_row.id
    returning * into v_row;

    v_first_read:=true;
  end if;  if v_first_read then
    insert into public.registry_audit_log(
      actor_user_id,parish_id,diocese_id,entity_type,entity_id,
      action,after_data,metadata
    ) values (
      auth.uid(),v_parish,coalesce(v_diocese,v_doc.diocese_id),
      'matrimonial_notification_recipient',v_row.id,
      'read_sacramental_notification',
      jsonb_build_object(
        'read_at',v_row.read_at,
        'read_by',v_row.read_by,
        'status',v_row.status
      ),
      jsonb_build_object(
        'notification_id',v_doc.id,
        'document_number',v_doc.document_number,
        'notification_type',coalesce(v_doc.notification_type,'matrimonio'),
        'sender_parish_id',v_doc.sender_parish_id,
        'receiver_parish_id',v_row.receiver_parish_id,
        'target_baptism_id',v_row.target_baptism_id
      )
    );
  end if;

  return v_row;
end;
$$;create or replace function public.mark_sacramental_receipt_read(p_recipient_id uuid)
returns public.matrimonial_notification_recipients
language plpgsql
security definer
set search_path=public
as $$
declare
  v_row public.matrimonial_notification_recipients%rowtype;
  v_doc public.matrimonial_notifications%rowtype;
  v_current uuid;
  v_diocese uuid;
  v_first_read boolean:=false;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select up.parish_id,up.diocese_id
    into v_current,v_diocese
  from public.user_profiles up
  where up.auth_user_id=auth.uid()
    and lower(coalesce(up.role,''))='parish'
    and coalesce(up.is_active,true)=true
    and upper(coalesce(up.status,'ACTIVE'))='ACTIVE'
  limit 1;

  if v_current is null then
    raise exception 'Cuenta parroquial activa requerida';
  end if;  select r.* into v_row
  from public.matrimonial_notification_recipients r
  where r.id=p_recipient_id
  for update;

  if not found then
    raise exception 'Acuse sacramental no encontrado';
  end if;

  select * into v_doc
  from public.matrimonial_notifications
  where id=v_row.notification_id;

  if not found then
    raise exception 'Documento sacramental asociado no encontrado';
  end if;

  if v_doc.sender_parish_id is distinct from v_current then
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

    v_first_read:=true;
  end if;  if v_first_read then
    insert into public.registry_audit_log(
      actor_user_id,parish_id,diocese_id,entity_type,entity_id,
      action,after_data,metadata
    ) values (
      auth.uid(),v_current,coalesce(v_diocese,v_doc.diocese_id),
      'matrimonial_notification_recipient',v_row.id,
      'read_sacramental_receipt',
      jsonb_build_object(
        'sender_read_at',v_row.sender_read_at,
        'receipt_document_number',v_row.receipt_document_number
      ),
      jsonb_build_object(
        'notification_id',v_doc.id,
        'document_number',v_doc.document_number,
        'notification_type',coalesce(v_doc.notification_type,'matrimonio'),
        'sender_parish_id',v_doc.sender_parish_id,
        'receiver_parish_id',v_row.receiver_parish_id,
        'receipt_document_number',v_row.receipt_document_number
      )
    );
  end if;

  return v_row;
end;
$$;

revoke all on function public.mark_sacramental_notification_read(uuid) from public,anon;
grant execute on function public.mark_sacramental_notification_read(uuid) to authenticated,service_role;

revoke all on function public.mark_sacramental_receipt_read(uuid) from public,anon;
grant execute on function public.mark_sacramental_receipt_read(uuid) to authenticated,service_role;

commit;
