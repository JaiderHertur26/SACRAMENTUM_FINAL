select auth_user_id,parish_id,diocese_id,role
from public.user_profiles
where lower(coalesce(role,''))='parish'
  and coalesce(is_active,true)=true
  and auth_user_id is not null
order by created_at
limit 1;