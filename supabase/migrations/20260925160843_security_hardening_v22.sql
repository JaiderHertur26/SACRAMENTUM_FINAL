-- SACRAMENTUM V22 · SECURITY HARDENING
-- 2026-09-25
-- Objetivo: mínimo privilegio para clientes públicos, RLS explícito y funciones con search_path fijo.

begin;

-- ============================================================================
-- 1) CERRAR COMPLETAMENTE EL ROL ANON SOBRE EL ESQUEMA DE DATOS
-- La portada pública usa Supabase Auth + Edge Function; no requiere acceso
-- directo a tablas, secuencias ni RPC de public.
-- ============================================================================
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;

-- Evitar que objetos futuros vuelvan a heredar permisos públicos por defecto.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;

-- ============================================================================
-- 2) NOTIFICACIONES OFICIALES: LECTURA POR ÁMBITO, MUTACIÓN SÓLO POR RPC
-- ============================================================================
drop policy if exists "official_notifications_select_scoped" on public.official_notifications;
create policy "official_notifications_select_scoped"
on public.official_notifications
for select
to authenticated
using (
  public.is_app_admin()
  or (
    public.current_app_role() = 'parish'
    and receiver_parish_id = public.current_app_parish_id()
  )
  or (
    public.current_app_role() in ('diocese','chancery')
    and diocese_id = public.current_app_diocese_id()
  )
);

revoke all privileges on public.official_notifications from authenticated;
grant select on public.official_notifications to authenticated;

-- Las acciones de lectura/archivo se realizan mediante RPC con validación interna.
revoke all on function public.mark_official_notification_read(uuid) from public;
revoke all on function public.archive_official_notification(uuid) from public;
grant execute on function public.mark_official_notification_read(uuid) to authenticated;
grant execute on function public.archive_official_notification(uuid) to authenticated;

-- ============================================================================
-- 3) OBJETOS INTERNOS / LEGACY SIN ACCESO DIRECTO DE CLIENTE
-- Ya estaban cerrados por RLS sin políticas. Se expresa la intención de forma
-- explícita y se eliminan grants de authenticated para reducir superficie API.
-- ============================================================================
revoke all privileges on public.archdioceses from authenticated;
revoke all privileges on public.deaneries from authenticated;
revoke all privileges on public.vicariates from authenticated;
revoke all privileges on public.document_sequences from authenticated;
revoke all privileges on public.legacy_priest_directory from authenticated;
revoke all privileges on public.legacy_source_parishes from authenticated;
revoke all privileges on public.parishioners from authenticated;
revoke all privileges on public.registry_audit_log from authenticated;
revoke all privileges on public.registry_test_artifact_archive from authenticated;
revoke all privileges on public.sacramentum_test_record_archive from authenticated;

drop policy if exists "archdioceses_deny_client_access" on public.archdioceses;
create policy "archdioceses_deny_client_access"
on public.archdioceses for all to authenticated
using (false) with check (false);

drop policy if exists "deaneries_deny_client_access" on public.deaneries;
create policy "deaneries_deny_client_access"
on public.deaneries for all to authenticated
using (false) with check (false);

drop policy if exists "vicariates_deny_client_access" on public.vicariates;
create policy "vicariates_deny_client_access"
on public.vicariates for all to authenticated
using (false) with check (false);

drop policy if exists "document_sequences_deny_client_access" on public.document_sequences;
create policy "document_sequences_deny_client_access"
on public.document_sequences for all to authenticated
using (false) with check (false);

drop policy if exists "legacy_priest_directory_deny_client_access" on public.legacy_priest_directory;
create policy "legacy_priest_directory_deny_client_access"
on public.legacy_priest_directory for all to authenticated
using (false) with check (false);

drop policy if exists "legacy_source_parishes_deny_client_access" on public.legacy_source_parishes;
create policy "legacy_source_parishes_deny_client_access"
on public.legacy_source_parishes for all to authenticated
using (false) with check (false);

drop policy if exists "parishioners_deny_client_access" on public.parishioners;
create policy "parishioners_deny_client_access"
on public.parishioners for all to authenticated
using (false) with check (false);

drop policy if exists "registry_audit_log_deny_client_access" on public.registry_audit_log;
create policy "registry_audit_log_deny_client_access"
on public.registry_audit_log for all to authenticated
using (false) with check (false);

drop policy if exists "registry_test_artifact_archive_deny_client_access" on public.registry_test_artifact_archive;
create policy "registry_test_artifact_archive_deny_client_access"
on public.registry_test_artifact_archive for all to authenticated
using (false) with check (false);

drop policy if exists "sacramentum_test_record_archive_deny_client_access" on public.sacramentum_test_record_archive;
create policy "sacramentum_test_record_archive_deny_client_access"
on public.sacramentum_test_record_archive for all to authenticated
using (false) with check (false);

-- ============================================================================
-- 4) SEARCH_PATH INMUTABLE EN FUNCIONES AUXILIARES SEÑALADAS POR EL LINTER
-- ============================================================================
alter function public.touch_updated_at() set search_path = public, pg_temp;
alter function public.sacramentum_set_updated_at() set search_path = public, pg_temp;
alter function public.sacramentum_registry_ref(text) set search_path = public, pg_temp;
alter function public.sacramentum_legacy_norm_text(text) set search_path = public, pg_temp;
alter function public.sacramentum_person_norm(text) set search_path = public, pg_temp;
alter function public.sacramentum_safe_date(text) set search_path = public, pg_temp;
alter function public.sacramentum_age_years(date,date) set search_path = public, pg_temp;
alter function public.sacramentum_default_baptism_params() set search_path = public, pg_temp;
alter function public.sacramentum_default_confirmation_params() set search_path = public, pg_temp;
alter function public.sacramentum_default_marriage_params() set search_path = public, pg_temp;
alter function public.sacramentum_default_funeral_params() set search_path = public, pg_temp;

notify pgrst, 'reload schema';
commit;
