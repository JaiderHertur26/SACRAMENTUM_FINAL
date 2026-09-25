select table_name
from information_schema.tables
where table_schema='public'
  and table_name in ('diocesis','legacy_import_rows','legacy_import_batches');
select column_name,data_type
from information_schema.columns
where table_schema='public' and table_name='diocesis'
order by ordinal_position;