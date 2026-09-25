select
  (select count(*) from public.confirmations
   where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as confirmations_total,
  (select count(*) from public.confirmations
   where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
     and celebration_date is not null) as confirmations_with_date,
  (select count(*) from public.pending_confirmations
   where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
     and reportado=true) as confirmation_history_boletas,
  exists(select 1 from public.pending_confirmations
   where id='571f5358-1a32-4a06-b438-64298c5156a2'
     and reportado=true and status='seated'
     and raw_data->>'numeroRegistro'='000001'
     and raw_data->>'boleta_archived'='true') as manual_boleta_000001_ok,
  position('seated_confirmation_id' in
    pg_get_functiondef('public.seat_confirmation_records(uuid,jsonb,integer,integer,integer)'::regprocedure)
  ) > 0 as future_seats_preserve_boleta;