select table_name,column_name,data_type,is_nullable
from information_schema.columns
where table_schema='public'
  and table_name in ('parrocos','obispos','iglesias','ciudades','legacy_priest_directory')
order by table_name,ordinal_position;

select 'parrocos' as t,count(*) as n from public.parrocos
union all select 'obispos',count(*) from public.obispos
union all select 'iglesias',count(*) from public.iglesias
union all select 'ciudades',count(*) from public.ciudades;