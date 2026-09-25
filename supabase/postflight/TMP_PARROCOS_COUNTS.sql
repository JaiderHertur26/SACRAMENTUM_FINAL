
select jsonb_pretty(jsonb_build_object(
 'legacy_priest_directory',(select count(*) from public.legacy_priest_directory),
 'parrocos_total',(select count(*) from public.parrocos),
 'parrocos_main_parish',(select count(*) from public.parrocos where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'),
 'last_batch',(select to_jsonb(x) from (
   select id,original_filename,profile_key,parish_id,status,row_count,valid_count,review_count,imported_count,error_count,metadata,created_at
   from public.legacy_import_batches where profile_key='PARROCOS' order by created_at desc limit 1
 ) x),
 'parrocos',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
   select id,parish_id,nombre,apellido,fecha_ingreso,fecha_salida,estado,payload,created_at
   from public.parrocos where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
   order by fecha_ingreso nulls last,created_at
 ) x),
 'legacy_rows',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
   select legacy_code,priest_name,service_start,service_end,legacy_state,legacy_grade,mapping_status
   from public.legacy_priest_directory order by created_at desc limit 10
 ) x)
)) as diag;