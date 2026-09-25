select created_at,action,entity_type,entity_id,parish_id,
       coalesce(after_data->>'numeroRegistro',after_data->>'numero_registro') as numero_registro,
       after_data->>'apellidos' as apellidos,
       after_data->>'nombres' as nombres,
       metadata
from public.registry_audit_log
where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
  and entity_type in ('pending_baptism','bautismo','baptism')
order by created_at desc
limit 25;