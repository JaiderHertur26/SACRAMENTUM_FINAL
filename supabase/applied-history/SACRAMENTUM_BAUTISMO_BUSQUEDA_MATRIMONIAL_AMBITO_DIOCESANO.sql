-- SACRAMENTUM · BAUTISMO · BÚSQUEDA MATRIMONIAL CON ÁMBITO DIOCESANO
-- Una cuenta parroquial sólo puede localizar partidas vigentes dentro de
-- su propia diócesis/arquidiócesis. Nunca existe búsqueda nacional implícita.

begin;

do $$
begin
  if to_regprocedure('public.search_baptisms_for_matrimonial_notification_internal(uuid,text,text,text,text,text,integer)') is null then
    if to_regprocedure('public.search_baptisms_for_matrimonial_notification(uuid,text,text,text,text,text,integer)') is null then
      raise exception 'Falta search_baptisms_for_matrimonial_notification canónica';
    end if;
    execute 'alter function public.search_baptisms_for_matrimonial_notification(uuid,text,text,text,text,text,integer) rename to search_baptisms_for_matrimonial_notification_internal';
  end if;
end;
$$;

create or replace function public.search_baptisms_for_matrimonial_notification(
  p_diocese_id uuid default null,
  p_book text default null,
  p_folio text default null,
  p_number text default null,
  p_first_name text default null,
  p_last_name text default null,
  p_limit integer default 50
)
returns table(
  id uuid,
  parish_id uuid,
  parish_name text,
  diocese_id uuid,
  nombres text,
  apellidos text,
  book_number text,
  folio text,
  number text,
  celebration_date date,
  fecha_nacimiento date,
  lugar_nacimiento text,
  nombre_padre text,
  nombre_madre text
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text;
  v_parish_id uuid;
  v_own_diocese uuid;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  select lower(coalesce(up.role,'')),up.parish_id,up.diocese_id
    into v_role,v_parish_id,v_own_diocese
  from public.user_profiles up
  where up.auth_user_id=auth.uid()
    and coalesce(up.is_active,true)=true
    and coalesce(up.status,'active') not in ('blocked','disabled','inactive')
  limit 1;

  if v_role is distinct from 'parish' or v_parish_id is null then
    raise exception 'Sólo una cuenta parroquial activa puede buscar partidas para notificación matrimonial';
  end if;

  if v_own_diocese is null then
    select p.diocese_id into v_own_diocese
    from public.parishes p where p.id=v_parish_id;
  end if;
  if v_own_diocese is null then
    raise exception 'La parroquia de la sesión no tiene diócesis configurada';
  end if;

  if p_diocese_id is not null and p_diocese_id is distinct from v_own_diocese then
    raise exception 'La cuenta parroquial sólo puede buscar partidas dentro de su propia diócesis';
  end if;
  return query
  select *
  from public.search_baptisms_for_matrimonial_notification_internal(
    v_own_diocese,
    p_book,
    p_folio,
    p_number,
    p_first_name,
    p_last_name,
    greatest(1,least(coalesce(p_limit,50),100))
  );
end;
$$;

revoke all on function public.search_baptisms_for_matrimonial_notification_internal(uuid,text,text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.search_baptisms_for_matrimonial_notification_internal(uuid,text,text,text,text,text,integer) to service_role;

revoke all on function public.search_baptisms_for_matrimonial_notification(uuid,text,text,text,text,text,integer) from public,anon;
grant execute on function public.search_baptisms_for_matrimonial_notification(uuid,text,text,text,text,text,integer) to authenticated,service_role;

comment on function public.search_baptisms_for_matrimonial_notification(uuid,text,text,text,text,text,integer)
is 'Búsqueda bautismal mínima para notificación matrimonial; la cuenta parroquial queda limitada obligatoriamente a su propia diócesis.';

commit;
select jsonb_pretty(jsonb_build_object(
  'public_search_exists',to_regprocedure('public.search_baptisms_for_matrimonial_notification(uuid,text,text,text,text,text,integer)') is not null,
  'internal_search_exists',to_regprocedure('public.search_baptisms_for_matrimonial_notification_internal(uuid,text,text,text,text,text,integer)') is not null,
  'anon_public_search',has_function_privilege('anon','public.search_baptisms_for_matrimonial_notification(uuid,text,text,text,text,text,integer)','EXECUTE'),
  'auth_public_search',has_function_privilege('authenticated','public.search_baptisms_for_matrimonial_notification(uuid,text,text,text,text,text,integer)','EXECUTE'),
  'auth_internal_search',has_function_privilege('authenticated','public.search_baptisms_for_matrimonial_notification_internal(uuid,text,text,text,text,text,integer)','EXECUTE')
)) as matrimonial_search_scope_postcheck;
