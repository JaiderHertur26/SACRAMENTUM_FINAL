select id,created_at,status,book_number,folio,number,
       apellidos,nombres,
       coalesce(raw_data->>'source',raw_data->>'recordSource') as source,
       coalesce(raw_data->>'numeroRegistro',raw_data->>'numero_registro') as numero_registro
from public.baptisms
where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
order by created_at desc
limit 12;