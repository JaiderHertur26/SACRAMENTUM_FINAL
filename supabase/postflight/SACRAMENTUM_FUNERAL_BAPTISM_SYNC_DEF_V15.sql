select pg_get_functiondef(
  to_regprocedure('public.sacramentum_sync_baptism_death_from_funeral()')
) as function_definition;

select
  c.relname as table_name,
  t.tgname,
  pg_get_triggerdef(t.oid) as trigger_definition
from pg_trigger t
join pg_class c on c.oid=t.tgrelid
join pg_proc p on p.oid=t.tgfoid
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname='sacramentum_sync_baptism_death_from_funeral'
  and not t.tgisinternal;