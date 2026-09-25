select
  (select count(*) from public.pending_baptisms where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687' and reportado=false) as bautismo_individual,
  (select count(*) from public.pending_baptisms where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687' and reportado=true) as bautismo_reportadas,
  (select count(*) from public.pending_confirmations where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687' and reportado=false) as confirmacion_individual,
  (select count(*) from public.pending_confirmations where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687' and reportado=true) as confirmacion_reportadas,
  (select jsonb_agg(jsonb_build_object(
      'nombres',raw_data->>'nombres',
      'apellidos',raw_data->>'apellidos',
      'reported',reportado,
      'reconciliation',raw_data->>'legacy_reconciliation_status'
    ))
   from (
     select raw_data,reportado
     from public.pending_baptisms
     where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
     order by created_at
     limit 3
   ) s) as muestra_bautismo;