select
  exists(select 1 from public.baptisms
    where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
      and book_number='0001' and folio='0001' and number='0001') as lfn_conflict,
  exists(select 1 from public.baptisms
    where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
      and numero_registro='000001') as registro_conflict,
  exists(select 1 from public.pending_baptisms
    where id='f17a57ee-4904-4a57-94d3-0e089b3de2fa') as pending_conflict,
  exists(select 1 from public.baptisms
    where id='c4570f19-b42c-425c-aaf8-5ca51f4ab58e') as baptism_id_conflict,
  (select bautizos_params from public.parish_parameters
   where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as current_params;