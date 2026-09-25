select 'legacy_priest_directory' as source,count(*) as total from public.legacy_priest_directory
union all select 'directory_churches',count(*) from public.directory_churches
union all select 'location_dictionary',count(*) from public.location_dictionary
union all select 'legacy_obispos',count(*) from public.legacy_reference_catalog where profile_key='OBISPOS'
union all select 'legacy_batches',count(*) from public.legacy_import_batches;

select profile_key,coalesce(parish_id::text,'NULL') as parish_id,status,imported_count,original_filename,created_at
from public.legacy_import_batches
where profile_key in ('PARROCOS','IGLESIAS','CIUDADES','OBISPOS','DIOCESIS')
order by created_at desc
limit 30;

select legacy_code,priest_name,service_start,service_end,source_name,source_sha256
from public.legacy_priest_directory
order by legacy_code
limit 20;