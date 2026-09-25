select jsonb_pretty(jsonb_build_object(
 'parrocos_rls',(select jsonb_build_object('enabled',c.relrowsecurity,'forced',c.relforcerowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='parrocos'),
 'parrocos_policies',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select policyname,cmd,roles,qual,with_check from pg_policies where schemaname='public' and tablename='parrocos' order by policyname) x),
 'iglesias_policies',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select policyname,cmd,roles,qual,with_check from pg_policies where schemaname='public' and tablename='iglesias' order by policyname) x),
 'ciudades_policies',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select policyname,cmd,roles,qual,with_check from pg_policies where schemaname='public' and tablename='ciudades' order by policyname) x),
 'obispos_policies',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select policyname,cmd,roles,qual,with_check from pg_policies where schemaname='public' and tablename='obispos' order by policyname) x)
)) as diag;