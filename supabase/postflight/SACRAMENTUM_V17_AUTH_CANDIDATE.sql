select auth_user_id,role,diocese_id,parish_id,is_active,status
from public.user_profiles
where coalesce(is_active,true)=true
  and lower(coalesce(role,'')) in ('admin_general','diocese')
order by case when lower(role)='diocese' then 0 else 1 end
limit 10;