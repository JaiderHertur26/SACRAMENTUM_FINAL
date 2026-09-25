select created_at,action,entity_type,entity_id,
       metadata->>'pending_id' as pending_id,
       coalesce(after_data->>'numeroRegistro',after_data->>'numero_registro') as numero_registro,
       after_data->>'apellidos' as apellidos,
       after_data->>'nombres' as nombres,
       metadata->>'book' as libro,metadata->>'folio' as folio,metadata->>'number' as numero
from public.registry_audit_log
where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
  and action='seat'
  and entity_type='baptism'
order by created_at desc
limit 20;