select column_name,data_type
from information_schema.columns
where table_schema='public' and table_name='registry_test_artifact_archive'
order by ordinal_position;