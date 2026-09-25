select pg_get_functiondef(
  to_regprocedure('public.sacramentum_sync_baptism_death_from_funeral()')
) as function_definition;