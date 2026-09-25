`r`n-- ============================================================`r`n-- ARCHIVO: supabase\migrations\20260904_014_marginal_note_templates.sql`r`n-- ============================================================`r`n
-- SACRAMENTUM · Fase 2
-- Plantillas institucionales de notas marginales como configuración parroquial explícita.
-- Migración aditiva: no elimina datos anteriores.

alter table public.parish_parameters
  add column if not exists marginal_notes_templates jsonb not null default '{}'::jsonb;

comment on column public.parish_parameters.marginal_notes_templates is
  'Plantillas oficiales de redacción de notas marginales de la parroquia. Fuente canónica; reemplaza almacenamiento local del navegador.';

-- Recupera, cuando exista, la estructura histórica almacenada dentro de bautizos_params.
update public.parish_parameters
set marginal_notes_templates = coalesce(bautizos_params->'plantillas_notas', '{}'::jsonb)
where marginal_notes_templates = '{}'::jsonb
  and jsonb_typeof(bautizos_params->'plantillas_notas') = 'object'
  and bautizos_params->'plantillas_notas' <> '{}'::jsonb;
`r`n-- ============================================================`r`n-- ARCHIVO: supabase\migrations\20260904_015_integrity_constraints.sql`r`n-- ============================================================`r`n
-- ==========================================================================
-- SACRAMENTUM · Fase 2.15 · Integridad canónica adicional
-- Crea índices únicos únicamente cuando los datos actuales permiten hacerlo.
-- No elimina, fusiona ni modifica registros históricos conflictivos.
-- ==========================================================================

do $$
begin
  if not exists (
    select 1 from public.parish_parameters where parish_id is not null
    group by parish_id having count(*) > 1
  ) then
    execute 'create unique index if not exists uq_parish_parameters_parish on public.parish_parameters(parish_id) where parish_id is not null';
  else
    raise notice 'SACRAMENTUM: parish_parameters tiene parroquias duplicadas; no se creó uq_parish_parameters_parish.';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from public.sacrament_books
    where parish_id is not null and sacrament_type is not null and book_number is not null
    group by parish_id, lower(trim(sacrament_type)), book_number having count(*) > 1
  ) then
    execute 'create unique index if not exists uq_sacrament_books_scope on public.sacrament_books(parish_id, lower(trim(sacrament_type)), book_number) where parish_id is not null';
  else
    raise notice 'SACRAMENTUM: sacrament_books contiene libros repetidos; no se creó uq_sacrament_books_scope.';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from public.user_profiles where auth_user_id is not null
    group by auth_user_id having count(*) > 1
  ) then
    execute 'create unique index if not exists uq_user_profiles_auth_user on public.user_profiles(auth_user_id) where auth_user_id is not null';
  else
    raise notice 'SACRAMENTUM: user_profiles contiene auth_user_id repetidos; no se creó uq_user_profiles_auth_user.';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from public.pending_tokens where token is not null and trim(token) <> ''
    group by token having count(*) > 1
  ) then
    execute 'create unique index if not exists uq_pending_tokens_token on public.pending_tokens(token) where token is not null and trim(token) <> ''''';
  else
    raise notice 'SACRAMENTUM: pending_tokens contiene tokens repetidos; no se creó uq_pending_tokens_token.';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from public.decretos
    where diocese_id is not null and decree_number is not null and trim(decree_number) <> ''
    group by diocese_id, lower(trim(decree_number)) having count(*) > 1
  ) then
    execute 'create unique index if not exists uq_decretos_diocese_number on public.decretos(diocese_id, lower(trim(decree_number))) where diocese_id is not null and decree_number is not null and trim(decree_number) <> ''''';
  else
    raise notice 'SACRAMENTUM: existen números de decreto repetidos dentro de una diócesis; no se creó uq_decretos_diocese_number.';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from public.user_profiles
    where chancery_id is not null and lower(coalesce(role,''))='chancery' and coalesce(is_active,true)=true
    group by chancery_id having count(*) > 1
  ) then
    execute 'create unique index if not exists uq_active_chancery_user on public.user_profiles(chancery_id) where chancery_id is not null and lower(coalesce(role,''''))=''''chancery'''' and coalesce(is_active,true)=true';
  else
    raise notice 'SACRAMENTUM: existe más de un usuario Canciller activo para una Cancillería; no se creó uq_active_chancery_user.';
  end if;
end $$;
`r`n-- ============================================================`r`n-- ARCHIVO: supabase\migrations\20260904_016_identity_governance.sql`r`n-- ============================================================`r`n
-- ============================================================================
-- SACRAMENTUM · Fase 2.16 · Gobierno de identidad y tokens de activación
-- 2026-09-04
-- Requiere security/001 + security/002 y migraciones 001..015.
-- No elimina identidades. Los accesos se desactivan para preservar auditoría.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. pending_tokens: nunca son públicos. Sólo quien los crea (Diócesis) o el
--    Administrador General puede administrarlos. La Edge Function usa service
--    role y consume el token server-side, por lo que no necesita política pública.
-- --------------------------------------------------------------------------
alter table if exists public.pending_tokens enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='pending_tokens'
  loop
    execute format('drop policy if exists %I on public.pending_tokens',p.policyname);
  end loop;
end $$;

create policy "pending_tokens_select_owner"
on public.pending_tokens for select to authenticated
using (
  public.is_app_admin()
  or created_by=auth.uid()
);

create policy "pending_tokens_insert_owner"
on public.pending_tokens for insert to authenticated
with check (
  public.is_app_admin()
  or (
    public.current_app_role()='diocese'
    and created_by=auth.uid()
    and upper(type) in ('PARISH','CHANCERY')
  )
);

create policy "pending_tokens_delete_owner"
on public.pending_tokens for delete to authenticated
using (
  public.is_app_admin()
  or (public.current_app_role()='diocese' and created_by=auth.uid())
);

-- --------------------------------------------------------------------------
-- 2. Edición acotada de perfiles subordinados.
--    Nunca acepta role/diocese_id arbitrarios del navegador: deriva el alcance
--    desde la entidad seleccionada y conserva el rol del perfil objetivo.
-- --------------------------------------------------------------------------
create or replace function public.update_managed_user_profile(
  p_profile_id uuid,
  p_username text default null,
  p_parish_id uuid default null,
  p_chancery_id uuid default null
)
returns public.user_profiles
language plpgsql
security definer
set search_path=public
as $$
declare
  v_actor_role text;
  v_actor_diocese uuid;
  v_target public.user_profiles%rowtype;
  v_entity_diocese uuid;
  v_result public.user_profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select lower(coalesce(role,'')),diocese_id
  into v_actor_role,v_actor_diocese
  from public.user_profiles
  where auth_user_id=auth.uid() and coalesce(is_active,true)=true
    and upper(coalesce(status,'ACTIVE'))='ACTIVE'
  limit 1;

  if v_actor_role not in ('admin_general','diocese') then
    raise exception 'No autorizado para administrar perfiles institucionales';
  end if;

  select * into v_target from public.user_profiles where id=p_profile_id for update;
  if not found then raise exception 'Perfil no encontrado'; end if;
  if v_target.auth_user_id=auth.uid() then raise exception 'No puede reasignar su propio perfil desde esta operación'; end if;
  if lower(coalesce(v_target.role,'')) not in ('parish','chancery') then
    raise exception 'Esta operación sólo administra perfiles de Parroquia o Cancillería';
  end if;

  if v_actor_role='diocese' and v_target.diocese_id is distinct from v_actor_diocese then
    raise exception 'El perfil está fuera de su diócesis';
  end if;

  if lower(v_target.role)='parish' then
    if p_parish_id is null then raise exception 'Debe seleccionar una parroquia'; end if;
    select diocese_id into v_entity_diocese from public.parishes where id=p_parish_id;
    if v_entity_diocese is null then raise exception 'Parroquia no encontrada o sin diócesis'; end if;
    if v_actor_role='diocese' and v_entity_diocese is distinct from v_actor_diocese then
      raise exception 'La parroquia seleccionada está fuera de su diócesis';
    end if;

    update public.user_profiles
    set username=nullif(trim(p_username),''),
        parish_id=p_parish_id,
        chancery_id=null,
        diocese_id=v_entity_diocese,
        updated_at=now()
    where id=p_profile_id
    returning * into v_result;
  else
    if p_chancery_id is null then raise exception 'Debe seleccionar una cancillería'; end if;
    select diocese_id into v_entity_diocese from public.chancelleries where id=p_chancery_id;
    if v_entity_diocese is null then raise exception 'Cancillería no encontrada o sin diócesis'; end if;
    if v_actor_role='diocese' and v_entity_diocese is distinct from v_actor_diocese then
      raise exception 'La cancillería seleccionada está fuera de su diócesis';
    end if;

    update public.user_profiles
    set username=nullif(trim(p_username),''),
        chancery_id=p_chancery_id,
        parish_id=null,
        diocese_id=v_entity_diocese,
        updated_at=now()
    where id=p_profile_id
    returning * into v_result;
  end if;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,before_data,after_data,metadata
  ) values (
    auth.uid(),v_result.parish_id,v_result.diocese_id,'user_profile',v_result.id,'reassign_managed_profile',
    to_jsonb(v_target),to_jsonb(v_result),jsonb_build_object('target_role',v_result.role)
  );

  return v_result;
end;
$$;

revoke all on function public.update_managed_user_profile(uuid,text,uuid,uuid) from public;
grant execute on function public.update_managed_user_profile(uuid,text,uuid,uuid) to authenticated;

-- --------------------------------------------------------------------------
-- 3. Revocación/reactivación no destructiva de acceso.
-- --------------------------------------------------------------------------
create or replace function public.set_managed_user_active(
  p_profile_id uuid,
  p_active boolean
)
returns public.user_profiles
language plpgsql
security definer
set search_path=public
as $$
declare
  v_actor_role text;
  v_actor_diocese uuid;
  v_target public.user_profiles%rowtype;
  v_result public.user_profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select lower(coalesce(role,'')),diocese_id
  into v_actor_role,v_actor_diocese
  from public.user_profiles
  where auth_user_id=auth.uid() and coalesce(is_active,true)=true
    and upper(coalesce(status,'ACTIVE'))='ACTIVE'
  limit 1;

  if v_actor_role not in ('admin_general','diocese') then
    raise exception 'No autorizado para administrar accesos';
  end if;

  select * into v_target from public.user_profiles where id=p_profile_id for update;
  if not found then raise exception 'Perfil no encontrado'; end if;
  if v_target.auth_user_id=auth.uid() then raise exception 'No puede desactivar su propia cuenta desde esta operación'; end if;
  if lower(coalesce(v_target.role,'')) not in ('parish','chancery') then
    raise exception 'Esta operación sólo administra accesos de Parroquia o Cancillería';
  end if;
  if v_actor_role='diocese' and v_target.diocese_id is distinct from v_actor_diocese then
    raise exception 'El perfil está fuera de su diócesis';
  end if;

  update public.user_profiles
  set is_active=p_active,
      status=case when p_active then 'ACTIVE' else 'INACTIVE' end,
      updated_at=now()
  where id=p_profile_id
  returning * into v_result;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,before_data,after_data,metadata
  ) values (
    auth.uid(),v_result.parish_id,v_result.diocese_id,'user_profile',v_result.id,
    case when p_active then 'reactivate_access' else 'revoke_access' end,
    to_jsonb(v_target),to_jsonb(v_result),jsonb_build_object('non_destructive',true)
  );

  return v_result;
end;
$$;

revoke all on function public.set_managed_user_active(uuid,boolean) from public;
grant execute on function public.set_managed_user_active(uuid,boolean) to authenticated;
