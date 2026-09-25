select jsonb_pretty(jsonb_agg(jsonb_build_object(
 'table',c.relname,
 'rls',c.relrowsecurity,
 'forced',c.relforcerowsecurity,
 'policies',(select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname)
) order by c.relname)) as aux_rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('parrocos','iglesias','ciudades','obispos','diocesis','mis_datos');