select
  position('seated_baptism_id' in pg_get_functiondef('public.seat_baptism_records(uuid,jsonb,integer,integer,integer)'::regprocedure)) > 0 as seat_preserves_link,
  (select count(*) from public.pending_baptisms
   where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687' and reportado=true) as reportadas_bautismo,
  (select count(*) from public.pending_baptisms
   where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687' and reportado=false) as pendientes_bautismo,
  (select count(*) from public.pending_baptisms
   where raw_data->>'boleta_archived'='true') as boletas_archivadas_v8;