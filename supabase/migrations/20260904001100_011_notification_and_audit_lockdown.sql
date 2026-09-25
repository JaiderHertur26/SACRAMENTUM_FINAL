-- ============================================================================
-- SACRAMENTUM · Cierre de permisos jurídicos, notificaciones y auditoría
-- 2026-09-04
-- Requiere 001..010 + security/001 + security/002.
-- Aditiva/no destructiva: no elimina expedientes ni registros.
-- ============================================================================

-- 1) Los decretos nuevos se emiten únicamente desde jurisdicción superior.
drop policy if exists "decretos_insert_authorized" on public.decretos;
create policy "decretos_insert_authorized" on public.decretos
for insert to authenticated
with check (
  public.current_app_role() in ('chancery','diocese','admin_general')
  and public.can_access_parish(parish_id)
);

-- 2) Una parroquia no puede editar libremente subject/payload/decree_id de una
--    notificación. Sólo puede cambiar su estado mediante RPC acotadas.
drop policy if exists "official_notifications_update_receiver" on public.official_notifications;

create or replace function public.mark_official_notification_read(p_notification_id uuid)
returns public.official_notifications
language plpgsql
security definer
set search_path = public
as $$
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
    public.is_app_admin()
    or (public.current_app_role()='parish' and v_row.receiver_parish_id=public.current_app_parish_id())
    or (public.current_app_role() in ('chancery','diocese') and v_row.diocese_id=public.current_app_diocese_id())
  ) then
    raise exception 'No autorizado para esta notificación';
  end if;

  if lower(coalesce(v_row.status,'')) not in ('cancelled','archived') then
    update public.official_notifications
    set status='read', read_at=coalesce(read_at,now()), updated_at=now()
    where id=p_notification_id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

create or replace function public.archive_official_notification(p_notification_id uuid)
returns public.official_notifications
language plpgsql
security definer
set search_path = public
as $$
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
    public.is_app_admin()
    or (public.current_app_role()='parish' and v_row.receiver_parish_id=public.current_app_parish_id())
  ) then
    raise exception 'Sólo la parroquia destinataria puede archivar esta comunicación';
  end if;

  update public.official_notifications
  set status='archived',
      read_at=coalesce(read_at,now()),
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
$$;

revoke all on function public.mark_official_notification_read(uuid) from public;
revoke all on function public.archive_official_notification(uuid) from public;
grant execute on function public.mark_official_notification_read(uuid) to authenticated;
grant execute on function public.archive_official_notification(uuid) to authenticated;

-- 3) El log de auditoría es append-only pero únicamente para el backend
--    transaccional (SECURITY DEFINER). Evita que el cliente fabrique auditorías.
drop policy if exists "audit_insert_authenticated" on public.registry_audit_log;
revoke insert, update, delete on public.registry_audit_log from authenticated;

-- La lectura continúa gobernada por audit_select_authorized.
