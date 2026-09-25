select id,created_at,status,book_number,folio,number,numero_registro,
       apellidos,nombres,
       coalesce(raw_data->>'source',raw_data->>'recordSource','') as source,
       raw_data->>'pending_id' as raw_pending_id
from public.baptisms
where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
order by created_at desc
limit 60;