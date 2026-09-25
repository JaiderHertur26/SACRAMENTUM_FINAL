select jsonb_pretty(jsonb_build_object(
  'parish_users',(
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
    from (
      select auth_user_id,role,parish_id,diocese_id,is_active,status
      from public.user_profiles
      where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
        and coalesce(is_active,true)=true
      order by created_at
    ) x
  ),
  'policies',(
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
    from (
      select policyname,roles,cmd,qual,with_check
      from pg_policies
      where schemaname='public' and tablename='parrocos'
      order by policyname
    ) x
  ),
  'grants',(
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
    from (
      select grantee,privilege_type
      from information_schema.role_table_grants
      where table_schema='public' and table_name='parrocos'
        and grantee in ('authenticated','anon')
      order by grantee,privilege_type
    ) x
  )
)) as diag;