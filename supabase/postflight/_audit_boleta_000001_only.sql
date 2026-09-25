select created_at,action,entity_type,entity_id,
       metadata->>'pending_id' as pending_id,
       coalesce(after_data->>'numeroRegistro',after_data->>'numero_registro') as numero_registro,
       after_data->>'apellidos' as apellidos,
       after_data->>'nombres' as nombres,
       after_data
from public.registry_audit_log
where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
  and (
    coalesce(after_data->>'numeroRegistro',after_data->>'numero_registro')='000001'
    or metadata->>'pending_id'='f17a57ee-4904-4a57-94d3-0e089b3de2fa'
    or entity_id='c4570f19-b42c-425c-aaf8-5ca51f4ab58e'::uuid
  )
order by created_at;