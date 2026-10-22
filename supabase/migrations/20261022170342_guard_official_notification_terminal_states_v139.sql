-- V139 · Comunicaciones oficiales: impedir falsos acuses y degradación de estados cerrados.
-- archive_official_notification · V139
CREATE OR REPLACE FUNCTION public.archive_official_notification(p_notification_id uuid)
 RETURNS official_notifications
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.official_notifications%rowtype;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select * into v_row
  from public.official_notifications
  where id = p_notification_id
  for update;

  if not found then raise exception 'Notificación no encontrada'; end if;

  if not (
    (public.current_app_role()='parish' and v_row.receiver_parish_id=public.current_app_parish_id())
  ) then
    raise exception 'Sólo la parroquia destinataria puede archivar esta comunicación';
  end if;

  if lower(coalesce(v_row.status,'')) in ('cancelled','reversed','revertida','annulled','anulada') then
    raise exception 'Una comunicación cancelada o revertida no puede archivarse como recibida'
      using errcode='23514';
  end if;
  if lower(coalesce(v_row.status,''))='archived' then
    raise exception 'La comunicación ya se encontraba archivada' using errcode='23514';
  end if;
  if lower(coalesce(v_row.status,'')) not in ('read','processed')
    or v_row.read_at is null then
    raise exception 'Para archivar una comunicación primero debe constar su lectura real por la parroquia'
      using errcode='23514';
  end if;

  update public.official_notifications
  set status='archived',
      read_at=v_row.read_at,
      processed_at=coalesce(processed_at,now()),
      updated_at=now()
  where id=p_notification_id
  returning * into v_row;

  insert into public.registry_audit_log(
    actor_user_id, parish_id, diocese_id, entity_type, entity_id, action, after_data, metadata
  ) values (
    auth.uid(), v_row.receiver_parish_id, v_row.diocese_id,
    'official_notification', v_row.id, 'archive', to_jsonb(v_row),
    jsonb_build_object('decree_id',v_row.decree_id,'category',v_row.category)
  );

  return v_row;
end;
$function$;

-- mark_official_notification_read · V139
CREATE OR REPLACE FUNCTION public.mark_official_notification_read(p_notification_id uuid)
 RETURNS official_notifications
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.official_notifications%rowtype;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select * into v_row
  from public.official_notifications
  where id = p_notification_id
  for update;

  if not found then raise exception 'Notificación no encontrada'; end if;

  if not (
    (public.current_app_role()='parish' and v_row.receiver_parish_id=public.current_app_parish_id())
  ) then
    raise exception 'No autorizado para esta notificación';
  end if;

  -- Una constancia already processed no retrocede a read.
  if lower(coalesce(v_row.status,'')) in ('pending','unread') then
    update public.official_notifications
    set status='read', read_at=coalesce(read_at,now()), updated_at=now()
    where id=p_notification_id
    returning * into v_row;
  elsif lower(coalesce(v_row.status,'')) in ('read','processed','archived','cancelled') then
    -- Operación idempotente sin degradar un estado final.
    null;
  else
    raise exception 'Estado de comunicación no válido para marcar lectura'
      using errcode='23514';
  end if;

  return v_row;
end;
$function$;
