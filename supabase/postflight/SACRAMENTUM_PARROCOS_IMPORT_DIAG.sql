select 'legacy_priest_directory' as source,count(*) as rows
from public.legacy_priest_directory
union all
select 'parrocos_total',count(*) from public.parrocos
union all
select 'parrocos_main_parish',count(*) from public.parrocos where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687';

select id,original_filename,profile_key,parish_id,status,row_count,valid_count,review_count,imported_count,error_count,metadata,created_at,updated_at
from public.legacy_import_batches
where profile_key='PARROCOS'
order by created_at desc
limit 5;

select id,parish_id,nombre,apellido,fecha_ingreso,fecha_salida,estado,payload,created_at
from public.parrocos
where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
order by fecha_ingreso nulls last,created_at;

select id,legacy_code,priest_name,service_start,service_end,legacy_state,legacy_grade,mapping_status,original_data,created_at
from public.legacy_priest_directory
order by created_at desc
limit 10;

select action,parish_id,entity_id,after_data,metadata,created_at
from public.registry_audit_log
where action in ('legacy_import_batch_v2_applied','auxiliary_catalog_materialized')
order by created_at desc
limit 20;