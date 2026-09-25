select
  (select count(*) from public.parishes) as parishes,
  (select count(*) from public.baptisms) as baptisms,
  (select count(*) from public.marriages) as marriages,
  (select count(*) from public.user_profiles where lower(coalesce(role,''))='chancery' and coalesce(is_active,true)=true) as chancery_users,
  (select count(*) from public.user_profiles where lower(coalesce(role,''))='parish' and coalesce(is_active,true)=true) as parish_users;