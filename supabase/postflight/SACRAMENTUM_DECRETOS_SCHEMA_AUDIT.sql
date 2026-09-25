select
  column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public' and table_name='decretos'
order by ordinal_position;

select indexname,indexdef
from pg_indexes
where schemaname='public' and tablename='official_notifications'
order by indexname;