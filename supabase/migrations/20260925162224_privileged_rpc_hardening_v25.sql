-- SACRAMENTUM V25 · PRIVILEGED RPC HARDENING
-- 2026-09-25
-- Cierra funciones internas/trigger al cliente, blinda el recálculo de párroco
-- y completa índices de claves foráneas restantes.

begin;

-- ============================================================================
-- 1) RPC USADO POR LA APP: BLINDAJE DE JURISDICCIÓN
-- ============================================================================
create or replace function public.sacramentum_recalculate_current_priest(p_parish_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_current uuid;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  if p_parish_id is null then
    raise exception 'Parroquia requerida';
  end if;

  if not (
    public.is_app_admin()
    or (
      public.current_app_role()='parish'
      and public.current_app_parish_id()=p_parish_id
    )
  ) then
    raise exception 'No autorizado para recalcular el párroco actual de esta parroquia';
  end if;

  if not exists(select 1 from public.parishes where id=p_parish_id) then
    raise exception 'Parroquia no encontrada';
  end if;

  select p.id into v_current
  from public.parrocos p
  where p.parish_id=p_parish_id
  order by p.fecha_ingreso desc nulls last,p.created_at desc,p.id desc
  limit 1;

  update public.parrocos
  set estado=case when id=v_current then 'ACTIVO' else 'HISTORICO' end
  where parish_id=p_parish_id;
end;
$$;

revoke all on function public.sacramentum_recalculate_current_priest(uuid) from public;
grant execute on function public.sacramentum_recalculate_current_priest(uuid) to authenticated, service_role;

-- ============================================================================
-- 2) FUNCIONES INTERNAS / MANTENIMIENTO: NO SON API DE CLIENTE
-- Sus callers legítimos son SECURITY DEFINER o procesos internos.
-- ============================================================================
revoke execute on function public.reconcile_legacy_pre_registrations_v2_internal(text) from authenticated;
revoke execute on function public.reconcile_legacy_pre_registrations(text) from authenticated;
revoke execute on function public.refresh_legacy_directory_links() from authenticated;
revoke execute on function public.sacramentum_bishop_at_date(uuid,date) from authenticated;
revoke execute on function public.sacramentum_current_priest(uuid) from authenticated;
revoke execute on function public.sacramentum_priest_at_date(uuid,date) from authenticated;
revoke execute on function public.sacramentum_registry_health() from authenticated;

-- Toda función TRIGGER debe ser invocada por su trigger, no por PostgREST.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prorettype='pg_catalog.trigger'::regtype
      and has_function_privilege('authenticated',p.oid,'EXECUTE')
  loop
    execute format('revoke execute on function %s from authenticated',r.signature);
  end loop;
end
$$;

-- Helpers con sufijo _internal no deben ser invocables desde el cliente.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname like '%\_internal' escape '\'
      and has_function_privilege('authenticated',p.oid,'EXECUTE')
  loop
    execute format('revoke execute on function %s from authenticated',r.signature);
  end loop;
end
$$;

-- ============================================================================
-- 3) COBERTURA DE FK RESTANTES
-- ============================================================================
create index if not exists idx_v25_deaneries_vicariate_id
  on public.deaneries(vicariate_id);
create index if not exists idx_v25_dioceses_archdiocese_id
  on public.dioceses(archdiocese_id);
create index if not exists idx_v25_directory_churches_directory_diocese_id
  on public.directory_churches(directory_diocese_id);

create index if not exists idx_v25_legacy_import_batches_parish_id
  on public.legacy_import_batches(parish_id);
create index if not exists idx_v25_legacy_import_batches_profile_key
  on public.legacy_import_batches(profile_key);

create index if not exists idx_v25_legacy_import_ownership_owner_parish_id
  on public.legacy_import_ownership(owner_parish_id);
create index if not exists idx_v25_legacy_import_ownership_row_id
  on public.legacy_import_ownership(row_id);

create index if not exists idx_v25_legacy_marginal_note_queue_batch_id
  on public.legacy_marginal_note_queue(batch_id);
create index if not exists idx_v25_legacy_marginal_note_queue_diocese_id
  on public.legacy_marginal_note_queue(diocese_id);
create index if not exists idx_v25_legacy_marginal_note_queue_marginal_note_id
  on public.legacy_marginal_note_queue(marginal_note_id);
create index if not exists idx_v25_legacy_marginal_note_queue_matched_record_id
  on public.legacy_marginal_note_queue(matched_record_id);
create index if not exists idx_v25_legacy_marginal_note_queue_row_id
  on public.legacy_marginal_note_queue(row_id);

create index if not exists idx_v25_legacy_pre_sacrament_batch_id
  on public.legacy_pre_sacrament_registrations(batch_id);
create index if not exists idx_v25_legacy_pre_sacrament_owner_parish_id
  on public.legacy_pre_sacrament_registrations(owner_parish_id);
create index if not exists idx_v25_legacy_pre_sacrament_row_id
  on public.legacy_pre_sacrament_registrations(row_id);

create index if not exists idx_v25_legacy_priest_directory_mapped_parish_id
  on public.legacy_priest_directory(mapped_parish_id);

create index if not exists idx_v25_legacy_record_links_batch_id
  on public.legacy_record_links(batch_id);
create index if not exists idx_v25_legacy_record_links_row_id
  on public.legacy_record_links(row_id);

create index if not exists idx_v25_legacy_source_parishes_mapped_parish_id
  on public.legacy_source_parishes(mapped_parish_id);

create index if not exists idx_v25_registry_audit_log_parish_id
  on public.registry_audit_log(parish_id);

create index if not exists idx_v25_vicariates_diocese_id
  on public.vicariates(diocese_id);

notify pgrst, 'reload schema';
commit;
