-- SACRAMENTUM V81 · identidad institucional de Cancillería y autoridades en Mis Datos
-- Mantiene la privacidad de user_profiles: las parroquias leen únicamente nombres institucionales
-- publicados en chancelleries dentro de su propia jurisdicción.

alter table public.chancelleries
  add column if not exists chancellor_name text,
  add column if not exists vice_chancellor_name text;

comment on column public.chancelleries.chancellor_name is
  'Nombre institucional del Canciller activo. Se sincroniza desde el perfil de Cancillería y su identidad legal.';
comment on column public.chancelleries.vice_chancellor_name is
  'Nombre opcional del Vice-Canciller configurado por la Cancillería.';

create schema if not exists private;

create or replace function private.refresh_chancery_chancellor_name(p_chancery_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_chancery_id is null then
    return;
  end if;

  update public.chancelleries c
     set chancellor_name = (
       select coalesce(
         nullif(btrim(up.full_name), ''),
         nullif(btrim(up.username), ''),
         nullif(btrim(up.email), '')
       )
       from public.user_profiles up
       where up.chancery_id = p_chancery_id
         and lower(coalesce(up.role, '')) = 'chancery'
         and coalesce(up.is_active, true) = true
       order by up.updated_at desc nulls last, up.created_at desc nulls last
       limit 1
     )
   where c.id = p_chancery_id;
end;
$$;

revoke all on function private.refresh_chancery_chancellor_name(uuid) from public;

create or replace function private.sync_chancery_name_from_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.chancery_id is not null then
      perform private.refresh_chancery_chancellor_name(old.chancery_id);
    end if;
    return old;
  end if;

  if new.chancery_id is not null then
    perform private.refresh_chancery_chancellor_name(new.chancery_id);
  end if;

  if tg_op = 'UPDATE'
     and old.chancery_id is distinct from new.chancery_id
     and old.chancery_id is not null then
    perform private.refresh_chancery_chancellor_name(old.chancery_id);
  end if;

  return new;
end;
$$;

revoke all on function private.sync_chancery_name_from_profile() from public;

drop trigger if exists trg_chancery_name_profile_insert_delete on public.user_profiles;
create trigger trg_chancery_name_profile_insert_delete
after insert or delete on public.user_profiles
for each row execute function private.sync_chancery_name_from_profile();

drop trigger if exists trg_chancery_name_profile_update on public.user_profiles;
create trigger trg_chancery_name_profile_update
after update of full_name, username, email, role, is_active, chancery_id on public.user_profiles
for each row execute function private.sync_chancery_name_from_profile();

create or replace function private.sync_chancery_identity_from_mis_datos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity uuid;
  v_payload jsonb;
  v_chancellor text;
  v_vice_chancellor text;
begin
  if tg_op = 'DELETE' then
    v_entity := old.entity_id;
    if exists (select 1 from public.chancelleries c where c.id = v_entity) then
      update public.chancelleries
         set vice_chancellor_name = null
       where id = v_entity;
      perform private.refresh_chancery_chancellor_name(v_entity);
    end if;
    return old;
  end if;

  v_entity := new.entity_id;
  if exists (select 1 from public.chancelleries c where c.id = v_entity) then
    v_payload := coalesce(new.payload, '{}'::jsonb);
    v_chancellor := coalesce(
      nullif(btrim(v_payload ->> 'canciller'), ''),
      nullif(btrim(v_payload ->> 'nombreCanciller'), ''),
      nullif(btrim(v_payload ->> 'parroco'), '')
    );
    v_vice_chancellor := coalesce(
      nullif(btrim(v_payload ->> 'viceCanciller'), ''),
      nullif(btrim(v_payload ->> 'vice_canciller'), ''),
      nullif(btrim(v_payload ->> 'vicecanciller'), '')
    );

    update public.chancelleries
       set chancellor_name = coalesce(v_chancellor, chancellor_name),
           vice_chancellor_name = v_vice_chancellor
     where id = v_entity;
  end if;

  if tg_op = 'UPDATE'
     and old.entity_id is distinct from new.entity_id
     and exists (select 1 from public.chancelleries c where c.id = old.entity_id) then
    update public.chancelleries
       set vice_chancellor_name = null
     where id = old.entity_id;
    perform private.refresh_chancery_chancellor_name(old.entity_id);
  end if;

  return new;
end;
$$;

revoke all on function private.sync_chancery_identity_from_mis_datos() from public;

drop trigger if exists trg_chancery_identity_mis_datos on public.mis_datos;
create trigger trg_chancery_identity_mis_datos
after insert or update of entity_id, payload or delete on public.mis_datos
for each row execute function private.sync_chancery_identity_from_mis_datos();

-- La propia Cancillería puede administrar exclusivamente su identidad legal en mis_datos.
drop policy if exists mis_datos_select_scoped on public.mis_datos;
create policy mis_datos_select_scoped
on public.mis_datos
for select
to authenticated
using (
  public.is_app_admin()
  or (public.current_app_role() = 'parish' and entity_id = public.current_app_parish_id())
  or (
    public.current_app_role() = 'diocese'
    and (entity_id = public.current_app_diocese_id() or public.can_access_parish(entity_id))
  )
  or (
    public.current_app_role() = 'chancery'
    and (
      entity_id = public.current_app_chancery_id()
      or entity_id = public.current_app_diocese_id()
      or public.can_access_parish(entity_id)
    )
  )
);

drop policy if exists mis_datos_insert_owner on public.mis_datos;
create policy mis_datos_insert_owner
on public.mis_datos
for insert
to authenticated
with check (
  public.is_app_admin()
  or (public.current_app_role() = 'parish' and entity_id = public.current_app_parish_id())
  or (
    public.current_app_role() = 'diocese'
    and (entity_id = public.current_app_diocese_id() or public.can_access_parish(entity_id))
  )
  or (
    public.current_app_role() = 'chancery'
    and entity_id = public.current_app_chancery_id()
  )
);

drop policy if exists mis_datos_update_owner on public.mis_datos;
create policy mis_datos_update_owner
on public.mis_datos
for update
to authenticated
using (
  public.is_app_admin()
  or (public.current_app_role() = 'parish' and entity_id = public.current_app_parish_id())
  or (
    public.current_app_role() = 'diocese'
    and (entity_id = public.current_app_diocese_id() or public.can_access_parish(entity_id))
  )
  or (
    public.current_app_role() = 'chancery'
    and entity_id = public.current_app_chancery_id()
  )
)
with check (
  public.is_app_admin()
  or (public.current_app_role() = 'parish' and entity_id = public.current_app_parish_id())
  or (
    public.current_app_role() = 'diocese'
    and (entity_id = public.current_app_diocese_id() or public.can_access_parish(entity_id))
  )
  or (
    public.current_app_role() = 'chancery'
    and entity_id = public.current_app_chancery_id()
  )
);

drop policy if exists mis_datos_delete_owner on public.mis_datos;
create policy mis_datos_delete_owner
on public.mis_datos
for delete
to authenticated
using (
  public.is_app_admin()
  or (public.current_app_role() = 'parish' and entity_id = public.current_app_parish_id())
  or (
    public.current_app_role() = 'diocese'
    and (entity_id = public.current_app_diocese_id() or public.can_access_parish(entity_id))
  )
  or (
    public.current_app_role() = 'chancery'
    and entity_id = public.current_app_chancery_id()
  )
);

-- Backfill inmediato del Canciller ya existente sin exponer user_profiles a Parroquia.
update public.chancelleries c
set chancellor_name = x.display_name
from (
  select distinct on (up.chancery_id)
    up.chancery_id,
    coalesce(
      nullif(btrim(up.full_name), ''),
      nullif(btrim(up.username), ''),
      nullif(btrim(up.email), '')
    ) as display_name
  from public.user_profiles up
  where up.chancery_id is not null
    and lower(coalesce(up.role, '')) = 'chancery'
    and coalesce(up.is_active, true) = true
  order by up.chancery_id, up.updated_at desc nulls last, up.created_at desc nulls last
) x
where c.id = x.chancery_id;
