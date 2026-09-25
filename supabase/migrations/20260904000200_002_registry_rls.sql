-- ============================================================================
-- SACRAMENTUM · RLS para registros, decretos, exequias y notificaciones
-- Requiere: supabase/security/001_security_helpers_review.sql
--           supabase/migrations/20260904_001_registry_core.sql
-- Probar primero en staging con los cuatro roles.
-- ============================================================================

-- Reinicio controlado de políticas de las tablas gobernadas por esta migración.
-- PostgreSQL combina políticas permisivas con OR; una regla histórica amplia podría
-- anular el aislamiento nuevo si no se retira explícitamente.
do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'pending_marriages','funerals','pending_funerals','decretos',
    'official_notifications','matrimonial_notifications',
    'matrimonial_notification_recipients','registry_audit_log','document_sequences'
  ]
  loop
    for p in
      select policyname from pg_policies
      where schemaname='public' and tablename=t
    loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end $$;

-- Nuevas tablas parroquiales ------------------------------------------------
-- Igual que los registros históricos: jurisdicción superior puede consultar,
-- pero sólo la parroquia propietaria/admin trabaja pendientes. Una Exequia ya
-- asentada no se actualiza ni elimina desde el navegador.

alter table public.pending_marriages enable row level security;
drop policy if exists "pending_marriages_scoped_all" on public.pending_marriages;
drop policy if exists "pending_marriages_select_scoped" on public.pending_marriages;
drop policy if exists "pending_marriages_write_owner" on public.pending_marriages;
create policy "pending_marriages_select_scoped" on public.pending_marriages
for select to authenticated using (public.can_access_parish(parish_id));
create policy "pending_marriages_write_owner" on public.pending_marriages
for all to authenticated
using (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()))
with check (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()));

alter table public.funerals enable row level security;
drop policy if exists "funerals_scoped_all" on public.funerals;
drop policy if exists "funerals_select_scoped" on public.funerals;
drop policy if exists "funerals_insert_owner" on public.funerals;
create policy "funerals_select_scoped" on public.funerals
for select to authenticated using (public.can_access_parish(parish_id));
-- Las exequias permanentes se crean únicamente mediante RPC transaccionales.

alter table public.pending_funerals enable row level security;
drop policy if exists "pending_funerals_scoped_all" on public.pending_funerals;
drop policy if exists "pending_funerals_select_scoped" on public.pending_funerals;
drop policy if exists "pending_funerals_write_owner" on public.pending_funerals;
create policy "pending_funerals_select_scoped" on public.pending_funerals
for select to authenticated using (public.can_access_parish(parish_id));
create policy "pending_funerals_write_owner" on public.pending_funerals
for all to authenticated
using (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()))
with check (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()));

-- Decretos -----------------------------------------------------------------
alter table public.decretos enable row level security;
drop policy if exists "decretos_select_scoped" on public.decretos;
create policy "decretos_select_scoped" on public.decretos
for select to authenticated
using (public.can_access_parish(parish_id));

drop policy if exists "decretos_insert_authorized" on public.decretos;
create policy "decretos_insert_authorized" on public.decretos
for insert to authenticated
with check (
  public.current_app_role() in ('chancery','diocese','admin_general')
  and public.can_access_parish(parish_id)
);

-- Los decretos emitidos son inmutables desde el cliente. Las reversiones
-- usan reverse_correction_decree / reverse_replacement_decree y conservan historia.
drop policy if exists "decretos_update_authorized" on public.decretos;

-- Notificaciones oficiales -------------------------------------------------
alter table public.official_notifications enable row level security;
drop policy if exists "official_notifications_select" on public.official_notifications;
create policy "official_notifications_select" on public.official_notifications
for select to authenticated
using (
  public.is_app_admin()
  or (public.current_app_role() = 'parish' and receiver_parish_id = public.current_app_parish_id())
  or (public.current_app_role() in ('chancery','diocese') and diocese_id = public.current_app_diocese_id())
);

drop policy if exists "official_notifications_insert_chancery" on public.official_notifications;
create policy "official_notifications_insert_chancery" on public.official_notifications
for insert to authenticated
with check (
  public.current_app_role() in ('chancery','diocese','admin_general')
  and public.can_access_parish(receiver_parish_id)
);

drop policy if exists "official_notifications_update_receiver" on public.official_notifications;
-- Estados de lectura/archivo se cambian únicamente mediante RPC específicas.

-- Notificación matrimonial -------------------------------------------------

-- Helpers SECURITY DEFINER para evitar recursión entre las políticas de
-- matrimonial_notifications y matrimonial_notification_recipients.
create or replace function public.owns_matrimonial_notification(target_notification_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matrimonial_notifications n
    where n.id = target_notification_id
      and n.sender_parish_id = public.current_app_parish_id()
  );
$$;

create or replace function public.is_matrimonial_notification_recipient(target_notification_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matrimonial_notification_recipients r
    where r.notification_id = target_notification_id
      and r.receiver_parish_id = public.current_app_parish_id()
  );
$$;

revoke all on function public.owns_matrimonial_notification(uuid) from public;
revoke all on function public.is_matrimonial_notification_recipient(uuid) from public;
grant execute on function public.owns_matrimonial_notification(uuid) to authenticated;
grant execute on function public.is_matrimonial_notification_recipient(uuid) to authenticated;

alter table public.matrimonial_notifications enable row level security;
drop policy if exists "matrimonial_notifications_select" on public.matrimonial_notifications;
create policy "matrimonial_notifications_select" on public.matrimonial_notifications
for select to authenticated
using (
  public.is_app_admin()
  or sender_parish_id = public.current_app_parish_id()
  or public.can_access_parish(sender_parish_id)
  or public.is_matrimonial_notification_recipient(id)
);

drop policy if exists "matrimonial_notifications_insert_sender" on public.matrimonial_notifications;

drop policy if exists "matrimonial_notifications_update_sender" on public.matrimonial_notifications;

alter table public.matrimonial_notification_recipients enable row level security;
drop policy if exists "matrimonial_recipients_select" on public.matrimonial_notification_recipients;
create policy "matrimonial_recipients_select" on public.matrimonial_notification_recipients
for select to authenticated
using (
  public.is_app_admin()
  or receiver_parish_id = public.current_app_parish_id()
  or public.owns_matrimonial_notification(notification_id)
  or public.can_access_parish(receiver_parish_id)
);

drop policy if exists "matrimonial_recipients_insert_sender" on public.matrimonial_notification_recipients;

drop policy if exists "matrimonial_recipients_update_receiver" on public.matrimonial_notification_recipients;

-- Las notificaciones matrimoniales se crean/procesan/cancelan/archivan sólo mediante RPC transaccionales.

-- Auditoría: lectura administrativa; inserción autenticada dentro del alcance.
alter table public.registry_audit_log enable row level security;
drop policy if exists "audit_select_authorized" on public.registry_audit_log;
create policy "audit_select_authorized" on public.registry_audit_log
for select to authenticated
using (
  public.is_app_admin()
  or (public.current_app_role() in ('diocese','chancery') and diocese_id = public.current_app_diocese_id())
  or (public.current_app_role() = 'parish' and parish_id = public.current_app_parish_id())
);

drop policy if exists "audit_insert_authenticated" on public.registry_audit_log;
-- La auditoría es append-only y sólo puede ser escrita por RPC SECURITY DEFINER.

-- document_sequences sólo se manipula mediante RPC security-definer.
alter table public.document_sequences enable row level security;
revoke all on public.document_sequences from authenticated;
