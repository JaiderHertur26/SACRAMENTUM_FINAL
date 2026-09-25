select jsonb_pretty(jsonb_object_agg(table_name, cols)) as schema
from (
  select table_name,
         jsonb_agg(jsonb_build_object(
           'name',column_name,'type',data_type,'nullable',is_nullable
         ) order by ordinal_position) as cols
  from information_schema.columns
  where table_schema='public'
    and table_name in ('parrocos','obispos','iglesias','ciudades')
  group by table_name
) s;