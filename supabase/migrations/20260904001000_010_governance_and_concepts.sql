-- ============================================================================
-- SACRAMENTUM · Fase 2.10 · Gobierno territorial y conceptos diocesanos
-- 2026-09-04
-- Requiere security/001_security_helpers_review.sql.
-- No borra información. Los conceptos se desactivan, nunca se eliminan.
-- ============================================================================

create or replace function public.current_effective_diocese_id()
returns uuid
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(
    (select up.diocese_id from public.user_profiles up
      where up.auth_user_id=auth.uid() and coalesce(up.is_active,true)=true limit 1),
    (select p.diocese_id
       from public.user_profiles up join public.parishes p on p.id=up.parish_id
      where up.auth_user_id=auth.uid() and coalesce(up.is_active,true)=true limit 1),
    (select c.diocese_id
       from public.user_profiles up join public.chancelleries c on c.id=up.chancery_id
      where up.auth_user_id=auth.uid() and coalesce(up.is_active,true)=true limit 1)
  );
$$;
revoke all on function public.current_effective_diocese_id() from public;
grant execute on function public.current_effective_diocese_id() to authenticated;

-- Conceptos de anulación: catálogo diocesano versionable/no destructivo.
alter table if exists public.conceptos_anulacion
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz default now();

create index if not exists idx_conceptos_anulacion_diocese_active
  on public.conceptos_anulacion(diocese_id,is_active,codigo);

alter table if exists public.conceptos_anulacion enable row level security;
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='conceptos_anulacion'
  loop execute format('drop policy if exists %I on public.conceptos_anulacion',p.policyname); end loop;
end $$;
create policy "conceptos_select_diocese" on public.conceptos_anulacion
for select to authenticated
using (public.is_app_admin() or diocese_id=public.current_effective_diocese_id());
create policy "conceptos_insert_authority" on public.conceptos_anulacion
for insert to authenticated
with check (
  public.is_app_admin()
  or (public.current_app_role() in ('diocese','chancery') and diocese_id=public.current_effective_diocese_id())
);
create policy "conceptos_update_authority" on public.conceptos_anulacion
for update to authenticated
using (
  public.is_app_admin()
  or (public.current_app_role() in ('diocese','chancery') and diocese_id=public.current_effective_diocese_id())
)
with check (
  public.is_app_admin()
  or (public.current_app_role() in ('diocese','chancery') and diocese_id=public.current_effective_diocese_id())
);
-- Intencionalmente no existe política DELETE: un concepto utilizado forma parte de la historia documental.

-- Estructura territorial canónica: dioceses -> vicarias -> decanatos -> parishes.
alter table if exists public.vicarias enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='vicarias' loop execute format('drop policy if exists %I on public.vicarias',p.policyname); end loop; end $$;
create policy "vicarias_select_scope" on public.vicarias for select to authenticated
using (public.is_app_admin() or diocese_id=public.current_effective_diocese_id());
create policy "vicarias_insert_diocese" on public.vicarias for insert to authenticated
with check (public.is_app_admin() or (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id()));
create policy "vicarias_update_diocese" on public.vicarias for update to authenticated
using (public.is_app_admin() or (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id()))
with check (public.is_app_admin() or (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id()));
create policy "vicarias_delete_diocese" on public.vicarias for delete to authenticated
using (public.is_app_admin() or (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id()));

alter table if exists public.decanatos enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='decanatos' loop execute format('drop policy if exists %I on public.decanatos',p.policyname); end loop; end $$;
create policy "decanatos_select_scope" on public.decanatos for select to authenticated
using (public.is_app_admin() or diocese_id=public.current_effective_diocese_id());
create policy "decanatos_insert_diocese" on public.decanatos for insert to authenticated
with check (public.is_app_admin() or (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id()));
create policy "decanatos_update_diocese" on public.decanatos for update to authenticated
using (public.is_app_admin() or (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id()))
with check (public.is_app_admin() or (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id()));
create policy "decanatos_delete_diocese" on public.decanatos for delete to authenticated
using (public.is_app_admin() or (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id()));

alter table if exists public.chancelleries enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='chancelleries' loop execute format('drop policy if exists %I on public.chancelleries',p.policyname); end loop; end $$;
create policy "chancelleries_select_scope" on public.chancelleries for select to authenticated
using (public.is_app_admin() or diocese_id=public.current_effective_diocese_id());
create policy "chancelleries_insert_diocese" on public.chancelleries for insert to authenticated
with check (public.is_app_admin() or (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id()));
create policy "chancelleries_update_diocese" on public.chancelleries for update to authenticated
using (public.is_app_admin() or (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id()))
with check (public.is_app_admin() or (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id()));
create policy "chancelleries_delete_diocese" on public.chancelleries for delete to authenticated
using (public.is_app_admin() or (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id()));

-- Completar permisos administrativos que la capa core deja deliberadamente cerrados.
drop policy if exists "dioceses_insert_admin" on public.dioceses;
drop policy if exists "dioceses_update_admin" on public.dioceses;
drop policy if exists "dioceses_delete_admin" on public.dioceses;
create policy "dioceses_insert_admin" on public.dioceses for insert to authenticated with check (public.is_app_admin());
create policy "dioceses_update_admin" on public.dioceses for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy "dioceses_delete_admin" on public.dioceses for delete to authenticated using (public.is_app_admin());

drop policy if exists "parishes_insert_diocese" on public.parishes;
drop policy if exists "parishes_update_diocese" on public.parishes;
drop policy if exists "parishes_delete_diocese" on public.parishes;
create policy "parishes_insert_diocese" on public.parishes for insert to authenticated
with check (public.is_app_admin() or (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id()));
create policy "parishes_update_diocese" on public.parishes for update to authenticated
using (public.is_app_admin() or (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id()))
with check (public.is_app_admin() or (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id()));
create policy "parishes_delete_diocese" on public.parishes for delete to authenticated
using (public.is_app_admin() or (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id()));

comment on column public.conceptos_anulacion.is_active is 'Los conceptos se desactivan para preservar decretos históricos; no se eliminan físicamente.';
