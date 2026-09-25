select pg_get_functiondef('public.can_access_parish(uuid)'::regprocedure) as can_access_parish_def;
select pg_get_functiondef('public.current_app_role()'::regprocedure) as current_app_role_def;