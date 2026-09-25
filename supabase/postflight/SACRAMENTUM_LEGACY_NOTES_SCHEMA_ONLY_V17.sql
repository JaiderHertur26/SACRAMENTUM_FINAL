select table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public'
  and table_name in ('marriages','marginal_notes','legacy_import_profiles','legacy_import_batches','legacy_import_rows')
order by table_name,ordinal_position;