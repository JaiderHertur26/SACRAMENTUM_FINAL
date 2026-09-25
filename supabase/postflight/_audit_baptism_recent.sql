select created_at,action,entity_type,entity_id,parish_id,
       after_data->>'numeroRegistro' as numero_registro,
       after_data->>'apellidos' as apellidos,
       after_data->>'nombres' as nombres,
       metadata
from public.registry_audit_log
where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
  and entity_type in ('pending_baptism','bautismo','baptism')
order by created_at desc
limit 25;

select id,created_at,status,book_number,folio,number,
       apellidos,nombres,source,raw_data->>'numeroRegistro' as numero_registro
from public.baptisms
where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
order by created_at desc
limit 12;