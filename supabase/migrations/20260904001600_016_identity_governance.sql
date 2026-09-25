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
