-- SACRAMENTUM V67
-- La certificación de asiento físico aplica también a notificaciones de Confirmación.
-- Conserva el mismo guard de integridad y el trigger existente que genera RNS.

create or replace function public.process_manual_matrimonial_notification_physical(
  p_recipient_id uuid
)
returns table(recipient_id uuid, notification_id uuid, status text, note_applied boolean)
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_row public.matrimonial_notification_recipients%rowtype;
  v_doc public.matrimonial_notifications%rowtype;
  v_parish uuid;
  v_diocese uuid;
  v_note text;
  v_locator jsonb;
  v_type text;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

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
  end if;

  select * into v_row
  from public.matrimonial_notification_recipients
  where id=p_recipient_id
  for update;

  if not found then
    raise exception 'Notificación sacramental no encontrada';
  end if;

  if v_row.receiver_parish_id is distinct from v_parish then
    raise exception 'La notificación no pertenece a esta parroquia';
  end if;

  if lower(coalesce(v_row.status,'pending'))='processed' then
    return query select v_row.id,v_row.notification_id,'processed'::text,v_row.note_applied;
    return;
  end if;

  if lower(coalesce(v_row.status,'pending'))='cancelled' then
    raise exception 'La notificación está cancelada';
  end if;

  if v_row.target_baptism_id is not null then
    raise exception 'La notificación ya está vinculada digitalmente; utilice la aceptación normal';
  end if;

  select * into v_doc
  from public.matrimonial_notifications
  where id=v_row.notification_id;

  if not found then
    raise exception 'Documento sacramental asociado no encontrado';
  end if;

  v_type:=lower(coalesce(nullif(v_doc.notification_type,''),'matrimonio'));
  if v_type not in ('matrimonio','confirmacion') then
    raise exception 'La certificación física sólo aplica a notificaciones de Matrimonio o Confirmación';
  end if;

  v_note:=nullif(v_row.payload->>'marginalNote','');
  v_locator:=coalesce(v_row.payload->'manualLocator','{}'::jsonb);

  if v_note is null then
    raise exception 'La notificación no contiene nota marginal';
  end if;

  if nullif(trim(v_locator->>'book'),'') is null
     or nullif(trim(v_locator->>'folio'),'') is null
     or nullif(trim(v_locator->>'number'),'') is null then
    raise exception 'Libro/Folio/Número de Bautismo incompletos';
  end if;

  update public.matrimonial_notification_recipients
  set status='processed',
      note_applied=true,
      processed_by=auth.uid(),
      processed_at=now(),
      read_at=coalesce(read_at,now()),
      read_by=coalesce(read_by,auth.uid()),
      payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object(
        'physicalNoteCertified',true,
        'physicalCertifiedAt',now(),
        'physicalCertifiedBy',auth.uid(),
        'acceptanceMode','physical_book',
        'physicalNotificationType',v_type
      ),
      updated_at=now()
  where id=v_row.id
  returning * into v_row;

  if not exists(
    select 1
    from public.matrimonial_notification_recipients r
    where r.notification_id=v_row.notification_id
      and lower(coalesce(r.status,'pending')) not in ('processed','cancelled')
  ) then
    update public.matrimonial_notifications
    set status='processed',updated_at=now()
    where id=v_row.notification_id;
  end if;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,
    action,after_data,metadata
  ) values (
    auth.uid(),v_parish,v_diocese,
    'sacramental_notification_recipient',v_row.id,
    'process_physical_book',
    jsonb_build_object(
      'status','processed',
      'note_applied',true,
      'physical_note_certified',true,
      'notification_type',v_type,
      'manual_locator',v_locator,
      'receipt_document_number',v_row.receipt_document_number
    ),
    jsonb_build_object(
      'notification_id',v_row.notification_id,
      'document_number',v_doc.document_number,
      'notification_type',v_type
    )
  );

  return query
  select v_row.id,v_row.notification_id,'processed'::text,true;
end;
$$;

revoke all on function public.process_manual_matrimonial_notification_physical(uuid) from public;
revoke all on function public.process_manual_matrimonial_notification_physical(uuid) from anon;
grant execute on function public.process_manual_matrimonial_notification_physical(uuid) to authenticated;

comment on function public.process_manual_matrimonial_notification_physical(uuid)
is 'Certifica el asiento físico de una nota marginal recibida por notificación sacramental de Matrimonio o Confirmación; el trigger de recibos genera el RNS.';
