select jsonb_pretty(jsonb_build_object(
  'parishes',(select count(*) from public.parishes),
  'baptisms',(select count(*) from public.baptisms),
  'marriages',(select count(*) from public.marriages),
  'chancery_users',(select count(*) from public.user_profiles where lower(coalesce(role,''))='chancery' and coalesce(is_active,true)=true),
  'parish_users',(select count(*) from public.user_profiles where lower(coalesce(role,''))='parish' and coalesce(is_active,true)=true)
)) as availability;

select id,name,diocese_id
from public.parishes
order by name
limit 20;

select id,parish_id,nombres,apellidos,book_number,folio,number,status
from public.baptisms
order by created_at desc
limit 20;

select id,parish_id,book_number,folio,number,celebration_date,status
from public.marriages
order by created_at desc
limit 20;