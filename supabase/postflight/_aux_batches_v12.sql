select coalesce(jsonb_agg(jsonb_build_object(
  'id',id,
  'profile',profile_key,
  'parish_id',parish_id,
  'status',status,
  'imported_count',imported_count,
  'file',original_filename,
  'created_at',created_at
) order by created_at),'[]'::jsonb) as batches
from public.legacy_import_batches
where profile_key in ('PARROCOS','IGLESIAS','CIUDADES','OBISPOS');