select table_name,column_name,data_type,is_nullable
from information_schema.columns
where table_schema='public'
  and table_name in ('parrocos','iglesias','ciudades','obispos','diocesis','mis_datos')
order by table_name,ordinal_position;

select p.proname,pg_get_function_identity_arguments(p.oid) as args
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('current_app_role','current_app_parish_id','current_app_diocese_id','is_app_admin')
order by p.proname;