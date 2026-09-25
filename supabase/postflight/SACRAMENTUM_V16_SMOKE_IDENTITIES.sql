select auth_user_id,parish_id,diocese_id,role
from public.user_profiles
where lower(coalesce(role,''))='parish'
  and coalesce(is_active,true)=true
  and auth_user_id is not null
order by created_at
limit 1;

select id,parish_id,nombres,apellidos,book_number,folio,number
from public.baptisms
where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
  and coalesce(lower(status),'active') not in ('anulada','annulled','deleted','reversed','revertida','replaced')
order by created_at
limit 2;

select id,parish_id,book_number,folio,number,celebration_date,status
from public.marriages
where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
order by created_at
limit 1;