select table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public'
  and table_name in ('marriages','marginal_notes','legacy_import_profiles','legacy_import_batches','legacy_import_rows')
order by table_name,ordinal_position;

select p.oid::regprocedure as signature,pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('create_legacy_import_batch','sacramentum_registry_ref')
order by p.proname;