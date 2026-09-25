select id,parish_id,nombres,apellidos,book_number,folio,number
from public.baptisms
where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
  and coalesce(lower(status),'active') not in ('anulada','annulled','deleted','reversed','revertida','replaced')
order by created_at
limit 2;