-- SACRAMENTUM · Security helper layer
-- Safe foundation for RLS policies. Review in a staging project before production.

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(up.role, ''))
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
    and coalesce(up.is_active,true)=true
    and upper(coalesce(up.status,'ACTIVE'))='ACTIVE'
  limit 1;
$$;

create or replace function public.current_app_parish_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select up.parish_id
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
    and coalesce(up.is_active,true)=true
    and upper(coalesce(up.status,'ACTIVE'))='ACTIVE'
  limit 1;
$$;

create or replace function public.current_app_diocese_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select up.diocese_id
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
    and coalesce(up.is_active,true)=true
    and upper(coalesce(up.status,'ACTIVE'))='ACTIVE'
  limit 1;
$$;

create or replace function public.current_app_chancery_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select up.chancery_id
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
    and coalesce(up.is_active,true)=true
    and upper(coalesce(up.status,'ACTIVE'))='ACTIVE'
  limit 1;
$$;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = 'admin_general';
$$;

create or replace function public.can_access_diocese(target_diocese_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_app_admin()
    or (
      public.current_app_role() in ('diocese', 'chancery')
      and public.current_app_diocese_id() = target_diocese_id
    );
$$;

create or replace function public.can_access_parish(target_parish_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_app_admin()
    or (
      public.current_app_role() = 'parish'
      and public.current_app_parish_id() = target_parish_id
    )
    or (
      public.current_app_role() in ('diocese', 'chancery')
      and exists (
        select 1
        from public.parishes p
        where p.id = target_parish_id
          and p.diocese_id = public.current_app_diocese_id()
      )
    );
$$;

revoke all on function public.current_app_role() from public;
revoke all on function public.current_app_parish_id() from public;
revoke all on function public.current_app_diocese_id() from public;
revoke all on function public.current_app_chancery_id() from public;
revoke all on function public.is_app_admin() from public;
revoke all on function public.can_access_diocese(uuid) from public;
revoke all on function public.can_access_parish(uuid) from public;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_app_parish_id() to authenticated;
grant execute on function public.current_app_diocese_id() to authenticated;
grant execute on function public.current_app_chancery_id() to authenticated;
grant execute on function public.is_app_admin() to authenticated;
grant execute on function public.can_access_diocese(uuid) to authenticated;
grant execute on function public.can_access_parish(uuid) to authenticated;
