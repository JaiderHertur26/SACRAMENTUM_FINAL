-- SACRAMENTUM · Core RLS policy set (Fase 2)
-- Requiere: 001_security_helpers_review.sql
-- IMPORTANTE: probar primero en staging y ejecutar preflight antes de producción.
--
-- Principio institucional:
--   * La jurisdicción superior puede CONSULTAR dentro de su alcance.
--   * La parroquia puede trabajar sus EXPEDIENTES PENDIENTES y configuración.
--   * Las PARTIDAS YA ASENTADAS son inmutables desde el navegador.
--   * Correcciones/reposiciones/reversiones se ejecutan únicamente mediante RPC
--     SECURITY DEFINER auditadas y transaccionales.

-- Limpiar políticas históricas de las tablas que esta capa gobierna. RLS combina
-- políticas permisivas con OR; conservar una política antigua demasiado amplia
-- anularía el blindaje nuevo.
do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'user_profiles','dioceses','parishes',
    'baptisms','confirmations','marriages',
    'pending_baptisms','pending_confirmations',
    'parish_parameters','sacrament_books','marginal_notes'
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

-- user_profiles -------------------------------------------------------------
alter table if exists public.user_profiles enable row level security;
create policy "profiles_select_scoped"
on public.user_profiles for select to authenticated
using (
  auth_user_id = auth.uid()
  or public.is_app_admin()
  or (
    public.current_app_role() = 'diocese'
    and diocese_id = public.current_app_diocese_id()
  )
  or (
    public.current_app_role() = 'chancery'
    and diocese_id = public.current_app_diocese_id()
  )
);

-- Estructura eclesiástica ---------------------------------------------------
alter table if exists public.dioceses enable row level security;
create policy "dioceses_select_scoped"
on public.dioceses for select to authenticated
using (public.is_app_admin() or id = public.current_app_diocese_id());

alter table if exists public.parishes enable row level security;
create policy "parishes_select_scoped"
on public.parishes for select to authenticated
using (public.can_access_parish(id));

-- Registros sacramentales PERMANENTES --------------------------------------
-- Sin UPDATE ni DELETE directos. El backend jurídico usa RPC auditadas.

alter table if exists public.baptisms enable row level security;
create policy "baptisms_select_scoped" on public.baptisms
for select to authenticated using (public.can_access_parish(parish_id));
drop policy if exists "baptisms_insert_owner" on public.baptisms;
-- Las partidas permanentes se crean únicamente mediante RPC transaccionales
-- (asentamiento ordinario o digitalización histórica).

alter table if exists public.confirmations enable row level security;
create policy "confirmations_select_scoped" on public.confirmations
for select to authenticated using (public.can_access_parish(parish_id));
drop policy if exists "confirmations_insert_owner" on public.confirmations;
-- Las partidas permanentes se crean únicamente mediante RPC transaccionales
-- (asentamiento ordinario o digitalización histórica).

alter table if exists public.marriages enable row level security;
create policy "marriages_select_scoped" on public.marriages
for select to authenticated using (public.can_access_parish(parish_id));
drop policy if exists "marriages_insert_owner" on public.marriages;
-- Las partidas permanentes se crean únicamente mediante RPC transaccionales
-- (asentamiento ordinario o digitalización histórica).

-- Expedientes PENDIENTES ---------------------------------------------------
-- Jurisdicción superior puede leer; sólo la parroquia propietaria/admin muta.

alter table if exists public.pending_baptisms enable row level security;
create policy "pending_baptisms_select_scoped" on public.pending_baptisms
for select to authenticated using (public.can_access_parish(parish_id));
create policy "pending_baptisms_write_owner" on public.pending_baptisms
for all to authenticated
using (
  public.is_app_admin()
  or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id())
)
with check (
  public.is_app_admin()
  or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id())
);

alter table if exists public.pending_confirmations enable row level security;
create policy "pending_confirmations_select_scoped" on public.pending_confirmations
for select to authenticated using (public.can_access_parish(parish_id));
create policy "pending_confirmations_write_owner" on public.pending_confirmations
for all to authenticated
using (
  public.is_app_admin()
  or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id())
)
with check (
  public.is_app_admin()
  or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id())
);

-- Parámetros y libros -------------------------------------------------------
alter table if exists public.parish_parameters enable row level security;
create policy "parish_parameters_select_scoped" on public.parish_parameters
for select to authenticated using (public.can_access_parish(parish_id));
create policy "parish_parameters_write_owner" on public.parish_parameters
for all to authenticated
using (
  public.is_app_admin()
  or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id())
)
with check (
  public.is_app_admin()
  or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id())
);

alter table if exists public.sacrament_books enable row level security;
create policy "sacrament_books_select_scoped" on public.sacrament_books
for select to authenticated using (public.can_access_parish(parish_id));
create policy "sacrament_books_write_owner" on public.sacrament_books
for all to authenticated
using (
  public.is_app_admin()
  or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id())
)
with check (
  public.is_app_admin()
  or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id())
);

-- Notas marginales ---------------------------------------------------------
-- Son append-only desde el cliente. Reversiones/estados sólo mediante RPC.
alter table if exists public.marginal_notes enable row level security;
create policy "marginal_notes_select_scoped" on public.marginal_notes
for select to authenticated using (public.can_access_parish(parish_id));
create policy "marginal_notes_insert_owner" on public.marginal_notes
for insert to authenticated
with check (
  public.is_app_admin()
  or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id())
);

-- pending_tokens NO recibe SELECT público. Los códigos de activación se
-- consumen server-side mediante la Edge Function activate-environment.
