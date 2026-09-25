select 'audit' as src,
       a.created_at,
       a.action,
       a.entity_type,
       a.entity_id::text as entity_id,
       a.metadata->>'pending_id' as pending_id,
       coalesce(a.after_data->>'numeroRegistro',a.after_data->>'numero_registro') as numero_registro,
       a.after_data->>'apellidos' as apellidos,
       a.after_data->>'nombres' as nombres,
       a.after_data as payload
from public.registry_audit_log a
where a.parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
  and (
    coalesce(a.after_data->>'numeroRegistro',a.after_data->>'numero_registro')='000001'
    or a.metadata->>'pending_id'='f17a57ee-4904-4a57-94d3-0e089b3de2fa'
    or a.entity_id='c4570f19-b42c-425c-aaf8-5ca51f4ab58e'::uuid
  )
order by a.created_at;

select *
from public.registry_test_artifact_archive
where source_record_id in (
  'f17a57ee-4904-4a57-94d3-0e089b3de2fa'::uuid,
  'c4570f19-b42c-425c-aaf8-5ca51f4ab58e'::uuid
)
or payload::text ilike '%000001%'
order by created_at;