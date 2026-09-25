select table_name, column_name, data_type
from information_schema.columns
where table_schema='public'
  and table_name in (
    'legacy_import_batches','legacy_import_rows',
    'legacy_pre_sacrament_registrations','legacy_import_ownership',
    'legacy_record_links','baptisms','confirmations','parish_parameters'
  )
order by table_name, ordinal_position;
