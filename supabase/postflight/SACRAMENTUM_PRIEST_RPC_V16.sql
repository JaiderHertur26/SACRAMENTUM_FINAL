select p.oid::regprocedure as signature,pg_get_function_result(p.oid) as result
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='sacramentum_priest_at_date';