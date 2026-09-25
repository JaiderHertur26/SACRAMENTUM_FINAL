select relname,relrowsecurity
from pg_class
where relnamespace='public'::regnamespace
  and relname in ('parrocos','iglesias','ciudades','obispos','diocesis');