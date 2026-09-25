select artifact_type,source_table,source_id,reason,archived_at,snapshot
from public.registry_test_artifact_archive
where source_id in (
  'f17a57ee-4904-4a57-94d3-0e089b3de2fa'::uuid,
  'c4570f19-b42c-425c-aaf8-5ca51f4ab58e'::uuid
)
order by archived_at;