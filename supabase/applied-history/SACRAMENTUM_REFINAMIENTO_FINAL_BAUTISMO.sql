-- SACRAMENTUM · Refinamiento final de Bautismo
-- Invariantes de datos, autoridad canónica de decretos y mínimo privilegio.
-- No modifica filas sacramentales existentes.

alter table public.baptisms
  drop constraint if exists ck_baptisms_registry_ref_complete;
alter table public.baptisms
  add constraint ck_baptisms_registry_ref_complete check (
    nullif(trim(coalesce(book_number,'')),'') is not null and
    nullif(trim(coalesce(folio,'')),'') is not null and
    nullif(trim(coalesce(number,'')),'') is not null
  ) not valid;
alter table public.baptisms validate constraint ck_baptisms_registry_ref_complete;

alter table public.baptisms
  drop constraint if exists ck_baptisms_identity_complete;
alter table public.baptisms
  add constraint ck_baptisms_identity_complete check (
    celebration_date is not null and
    nullif(trim(coalesce(nombres,'')),'') is not null and
    nullif(trim(coalesce(apellidos,'')),'') is not null
  ) not valid;
alter table public.baptisms validate constraint ck_baptisms_identity_complete;

alter table public.baptisms
  drop constraint if exists ck_baptisms_birth_before_baptism;
alter table public.baptisms
  add constraint ck_baptisms_birth_before_baptism check (
    fecha_nacimiento is null or celebration_date is null or fecha_nacimiento <= celebration_date
  ) not valid;
alter table public.baptisms validate constraint ck_baptisms_birth_before_baptism;

create or replace function public.sacramentum_guard_decree_authority()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_diocese uuid;
begin
  if v_uid is null then return new; end if;

  if lower(coalesce(new.tipo,'')) not in ('correccion','reposicion') then
    return new;
  end if;
  if tg_op='UPDATE' and not (
    lower(coalesce(new.status,''))='reversed' and
    lower(coalesce(old.status,''))<>'reversed'
  ) then
    return new;
  end if;

  select lower(coalesce(up.role,'')),up.diocese_id
    into v_role,v_diocese
  from public.user_profiles up
  where up.auth_user_id=v_uid
    and coalesce(up.is_active,true)=true
    and coalesce(up.status,'active') not in ('blocked','disabled','inactive')
  limit 1;

  if v_role is distinct from 'chancery' then
    raise exception 'Sólo Cancillería puede emitir o revertir decretos de corrección/reposición';
  end if;

  if v_diocese is distinct from coalesce(
    new.diocese_id,
    (select p.diocese_id from public.parishes p where p.id=new.parish_id)
  ) then
    raise exception 'El decreto está fuera de la jurisdicción de Cancillería';
  end if;

  return new;
end;
$$;
drop trigger if exists trg_sacramentum_guard_decree_authority on public.decretos;
create trigger trg_sacramentum_guard_decree_authority
before insert or update on public.decretos
for each row execute function public.sacramentum_guard_decree_authority();

revoke all on function public.sacramentum_guard_decree_authority() from public, anon, authenticated;
grant execute on function public.sacramentum_guard_decree_authority() to service_role;

revoke all on function public.register_historical_baptism(uuid,jsonb) from public, anon;
grant execute on function public.register_historical_baptism(uuid,jsonb) to authenticated, service_role;

revoke all on function public.create_pending_baptism(uuid,jsonb) from public, anon;
grant execute on function public.create_pending_baptism(uuid,jsonb) to authenticated, service_role;

revoke all on function public.seat_baptism_records(uuid,jsonb,integer,integer,integer) from public, anon;
grant execute on function public.seat_baptism_records(uuid,jsonb,integer,integer,integer) to authenticated, service_role;

revoke all on function public.save_baptism_parameters(uuid,jsonb,integer,integer,integer) from public, anon;
grant execute on function public.save_baptism_parameters(uuid,jsonb,integer,integer,integer) to authenticated, service_role;
revoke all on function public.search_baptisms_for_matrimonial_notification(uuid,text,text,text,text,text,integer) from public, anon;
grant execute on function public.search_baptisms_for_matrimonial_notification(uuid,text,text,text,text,text,integer) to authenticated, service_role;

revoke all on function public.apply_baptism_correction(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer) from public, anon;
grant execute on function public.apply_baptism_correction(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer) to authenticated, service_role;

revoke all on function public.apply_baptism_replacement(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer) from public, anon;
grant execute on function public.apply_baptism_replacement(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer) to authenticated, service_role;

revoke all on function public.reverse_correction_decree(uuid) from public, anon;
grant execute on function public.reverse_correction_decree(uuid) to authenticated, service_role;

revoke all on function public.reverse_replacement_decree(uuid) from public, anon;
grant execute on function public.reverse_replacement_decree(uuid) to authenticated, service_role;

comment on function public.sacramentum_guard_decree_authority() is
  'Guardia central: usuarios autenticados sólo pueden emitir/revertir correcciones y reposiciones desde Cancillería y dentro de su diócesis.';
