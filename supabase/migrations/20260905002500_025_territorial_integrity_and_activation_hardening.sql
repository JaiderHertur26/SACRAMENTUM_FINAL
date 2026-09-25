-- ============================================================================
-- SACRAMENTUM · Fase 4.25 · Integridad territorial y endurecimiento de activación
-- 2026-09-05
-- Jerarquía canónica: Diócesis/Arquidiócesis -> Vicaría -> Decanato -> Parroquia
-- Gobierno: Admin General autoriza sólo Diócesis; Diócesis autoriza Parroquia/Cancillería.
-- ============================================================================

begin;

-- 0. Precondiciones: este script NO inventa columnas. Si el esquema vivo no
-- coincide con el modelo ya utilizado por la aplicación, se detiene sin cambios.
do $$
declare
  required text[][] := array[
    array['vicarias','id'], array['vicarias','diocese_id'], array['vicarias','name'], array['vicarias','vicar_name'],
    array['decanatos','id'], array['decanatos','diocese_id'], array['decanatos','vicaria_id'], array['decanatos','name'], array['decanatos','dean_name'],
    array['parishes','id'], array['parishes','diocese_id'], array['parishes','name'], array['parishes','city'], array['parishes','parroco'], array['parishes','vicary_id'], array['parishes','decanate_id'],
    array['chancelleries','id'], array['chancelleries','diocese_id'], array['chancelleries','name'], array['chancelleries','city'],
    array['pending_tokens','id'], array['pending_tokens','token'], array['pending_tokens','type'], array['pending_tokens','payload'], array['pending_tokens','created_by'],
    array['user_profiles','auth_user_id'], array['user_profiles','role'], array['user_profiles','diocese_id'], array['user_profiles','parish_id'], array['user_profiles','chancery_id'], array['user_profiles','status'], array['user_profiles','is_active']
  ];
  item text[];
begin
  foreach item slice 1 in array required loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name=item[1] and column_name=item[2]
    ) then
      raise exception 'Fase 4.25 detenida: falta public.%.%', item[1], item[2];
    end if;
  end loop;
end $$;

-- 1. Los códigos de activación respetan estrictamente la jerarquía de creación.
drop policy if exists "pending_tokens_insert_owner" on public.pending_tokens;
create policy "pending_tokens_insert_owner"
on public.pending_tokens for insert to authenticated
with check (
  (
    public.is_app_admin()
    and created_by=auth.uid()
    and upper(type)='DIOCESE'
  )
  or
  (
    public.current_app_role()='diocese'
    and created_by=auth.uid()
    and upper(type) in ('PARISH','CHANCERY')
    and coalesce(payload->>'dioceseId','')=coalesce(public.current_effective_diocese_id()::text,'')
    and (
      upper(type)='CHANCERY'
      or (coalesce(payload->>'vicaryId','')<>'' and coalesce(payload->>'decanateId','')<>'')
    )
  )
);

comment on policy "pending_tokens_insert_owner" on public.pending_tokens is
'Admin General sólo DIOCESE; Diócesis sólo PARISH/CHANCERY dentro de su propia jurisdicción.';

-- 1B. La estructura interna es competencia exclusiva de la Diócesis/Arquidiócesis.
-- El Administrador General conserva lectura global, pero no crea/edita/elimina
-- Vicarías, Decanatos, Parroquias ni Cancillería.
drop policy if exists "vicarias_insert_diocese" on public.vicarias;
drop policy if exists "vicarias_update_diocese" on public.vicarias;
drop policy if exists "vicarias_delete_diocese" on public.vicarias;
create policy "vicarias_insert_diocese" on public.vicarias for insert to authenticated
with check (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id());
create policy "vicarias_update_diocese" on public.vicarias for update to authenticated
using (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id())
with check (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id());
create policy "vicarias_delete_diocese" on public.vicarias for delete to authenticated
using (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id());

drop policy if exists "decanatos_insert_diocese" on public.decanatos;
drop policy if exists "decanatos_update_diocese" on public.decanatos;
drop policy if exists "decanatos_delete_diocese" on public.decanatos;
create policy "decanatos_insert_diocese" on public.decanatos for insert to authenticated
with check (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id());
create policy "decanatos_update_diocese" on public.decanatos for update to authenticated
using (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id())
with check (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id());
create policy "decanatos_delete_diocese" on public.decanatos for delete to authenticated
using (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id());

-- La fila parroquial nace exclusivamente al consumir un código PARISH en la Edge Function.
-- Por eso no se recrea ninguna policy INSERT de navegador para public.parishes.
drop policy if exists "parishes_insert_diocese" on public.parishes;
drop policy if exists "parishes_update_diocese" on public.parishes;
drop policy if exists "parishes_delete_diocese" on public.parishes;
create policy "parishes_update_diocese" on public.parishes for update to authenticated
using (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id())
with check (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id());
create policy "parishes_delete_diocese" on public.parishes for delete to authenticated
using (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id());

-- La Cancillería nace exclusivamente al consumir un código CHANCERY en la Edge Function.
-- No se expone INSERT directo desde el navegador.
drop policy if exists "chancelleries_insert_diocese" on public.chancelleries;
drop policy if exists "chancelleries_update_diocese" on public.chancelleries;
drop policy if exists "chancelleries_delete_diocese" on public.chancelleries;
create policy "chancelleries_update_diocese" on public.chancelleries for update to authenticated
using (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id())
with check (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id());
create policy "chancelleries_delete_diocese" on public.chancelleries for delete to authenticated
using (public.current_app_role()='diocese' and diocese_id=public.current_effective_diocese_id());

-- 2. Una jurisdicción sólo puede tener una Cancillería institucional.
do $$
begin
  if exists (
    select diocese_id from public.chancelleries
    where diocese_id is not null
    group by diocese_id having count(*) > 1
  ) then
    raise exception 'Fase 4.25 detenida: existen jurisdicciones con más de una Cancillería. Corrija duplicados antes de aplicar la restricción.';
  end if;
end $$;

create unique index if not exists uq_chancelleries_one_per_diocese
  on public.chancelleries(diocese_id)
  where diocese_id is not null;

-- 3. Índices de navegación territorial.
create index if not exists idx_vicarias_diocese_name
  on public.vicarias(diocese_id,name);
create index if not exists idx_decanatos_diocese_vicaria
  on public.decanatos(diocese_id,vicaria_id,name);
create index if not exists idx_parishes_diocese_vicary_decanate
  on public.parishes(diocese_id,vicary_id,decanate_id,name);

-- 4. Un Decanato siempre pertenece a una Vicaría de la misma jurisdicción.
create or replace function public.enforce_decanato_hierarchy()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  v_vicaria_diocese uuid;
begin
  if new.diocese_id is null then
    raise exception 'El decanato debe pertenecer a una Diócesis/Arquidiócesis';
  end if;
  if new.vicaria_id is null then
    raise exception 'El decanato debe pertenecer a una Vicaría';
  end if;

  select diocese_id into v_vicaria_diocese
  from public.vicarias
  where id=new.vicaria_id;

  if v_vicaria_diocese is null then
    raise exception 'La Vicaría seleccionada no existe';
  end if;
  if v_vicaria_diocese is distinct from new.diocese_id then
    raise exception 'El Decanato y su Vicaría deben pertenecer a la misma jurisdicción';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_decanato_hierarchy on public.decanatos;
create trigger trg_enforce_decanato_hierarchy
before insert or update of diocese_id,vicaria_id
on public.decanatos
for each row execute function public.enforce_decanato_hierarchy();

-- 5. Si una Parroquia tiene Decanato, éste determina y valida su Vicaría.
create or replace function public.enforce_parish_hierarchy()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  v_vicaria_diocese uuid;
  v_decanato_diocese uuid;
  v_decanato_vicaria uuid;
begin
  if new.diocese_id is null then
    raise exception 'La parroquia debe pertenecer a una Diócesis/Arquidiócesis';
  end if;

  if tg_op='INSERT' and (new.vicary_id is null or new.decanate_id is null) then
    raise exception 'Toda nueva Parroquia debe pertenecer a una Vicaría y a un Decanato';
  end if;

  if new.decanate_id is not null then
    select diocese_id,vicaria_id
      into v_decanato_diocese,v_decanato_vicaria
    from public.decanatos
    where id=new.decanate_id;

    if v_decanato_diocese is null then
      raise exception 'El Decanato seleccionado no existe';
    end if;
    if v_decanato_diocese is distinct from new.diocese_id then
      raise exception 'La Parroquia y el Decanato deben pertenecer a la misma jurisdicción';
    end if;
    if new.vicary_id is null then
      new.vicary_id := v_decanato_vicaria;
    elsif new.vicary_id is distinct from v_decanato_vicaria then
      raise exception 'El Decanato seleccionado no pertenece a la Vicaría indicada';
    end if;
  end if;

  if new.vicary_id is not null then
    select diocese_id into v_vicaria_diocese
    from public.vicarias
    where id=new.vicary_id;

    if v_vicaria_diocese is null then
      raise exception 'La Vicaría seleccionada no existe';
    end if;
    if v_vicaria_diocese is distinct from new.diocese_id then
      raise exception 'La Parroquia y la Vicaría deben pertenecer a la misma jurisdicción';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_parish_hierarchy on public.parishes;
create trigger trg_enforce_parish_hierarchy
before insert or update of diocese_id,vicary_id,decanate_id
on public.parishes
for each row execute function public.enforce_parish_hierarchy();

-- 6. No borrar contenedores territoriales que todavía tengan descendientes.
create or replace function public.protect_vicaria_delete()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if exists(select 1 from public.decanatos where vicaria_id=old.id)
     or exists(select 1 from public.parishes where vicary_id=old.id) then
    raise exception 'No se puede eliminar una Vicaría que contiene Decanatos o Parroquias';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_protect_vicaria_delete on public.vicarias;
create trigger trg_protect_vicaria_delete
before delete on public.vicarias
for each row execute function public.protect_vicaria_delete();

create or replace function public.protect_decanato_delete()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if exists(select 1 from public.parishes where decanate_id=old.id) then
    raise exception 'No se puede eliminar un Decanato que contiene Parroquias';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_protect_decanato_delete on public.decanatos;
create trigger trg_protect_decanato_delete
before delete on public.decanatos
for each row execute function public.protect_decanato_delete();

-- 7. Las entidades que ya poseen identidad institucional no se eliminan físicamente.
create or replace function public.protect_institutional_entity_delete()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if tg_table_name='parishes' then
    if exists(select 1 from public.user_profiles where parish_id=old.id) then
      raise exception 'No se puede eliminar una Parroquia con identidad institucional vinculada';
    end if;
  elsif tg_table_name='chancelleries' then
    if exists(select 1 from public.user_profiles where chancery_id=old.id) then
      raise exception 'No se puede eliminar una Cancillería con identidad institucional vinculada';
    end if;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_protect_parish_identity_delete on public.parishes;
create trigger trg_protect_parish_identity_delete
before delete on public.parishes
for each row execute function public.protect_institutional_entity_delete();

drop trigger if exists trg_protect_chancery_identity_delete on public.chancelleries;
create trigger trg_protect_chancery_identity_delete
before delete on public.chancelleries
for each row execute function public.protect_institutional_entity_delete();

comment on function public.enforce_parish_hierarchy() is
'Garantiza que Diócesis, Vicaría y Decanato de una Parroquia pertenezcan a la misma jurisdicción.';

commit;
