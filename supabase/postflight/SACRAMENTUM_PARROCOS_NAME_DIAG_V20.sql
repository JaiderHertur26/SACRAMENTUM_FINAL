select jsonb_pretty(jsonb_build_object(
 'batch_rows',(
   select coalesce(jsonb_agg(jsonb_build_object(
     'row',lr.row_number,
     'original',lr.original_data,
     'normalized',lr.normalized_data
   ) order by lr.row_number),'[]'::jsonb)
   from public.legacy_import_rows lr
   join public.legacy_import_batches b on b.id=lr.batch_id
   where b.profile_key='PARROCOS'
     and b.parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
 ),
 'materialized',(
   select coalesce(jsonb_agg(jsonb_build_object(
     'id',p.id,
     'code',p.payload->>'legacy_code',
     'nombre',p.nombre,
     'apellido',p.apellido,
     'start',p.fecha_ingreso,
     'end',p.fecha_salida,
     'state',p.estado
   ) order by p.fecha_ingreso),'[]'::jsonb)
   from public.parrocos p
   where p.parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
 )
)) as diag;