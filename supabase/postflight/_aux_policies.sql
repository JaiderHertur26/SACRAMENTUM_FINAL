select tablename,policyname,cmd,qual,with_check
from pg_policies
where schemaname='public'
  and tablename in ('parrocos','iglesias','ciudades','obispos','diocesis')
order by tablename,policyname;