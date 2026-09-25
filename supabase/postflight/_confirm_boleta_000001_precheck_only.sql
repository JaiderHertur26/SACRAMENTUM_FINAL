select
  exists(select 1 from public.pending_confirmations
    where id='571f5358-1a32-4a06-b438-64298c5156a2') as pending_conflict,
  exists(select 1 from public.confirmations
    where id='67ca9e4f-5cfe-406b-be70-61c574f9f8ef') as old_confirmation_id_exists,
  exists(select 1 from public.confirmations
    where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
      and book_number='0001' and folio='0001' and number='0001') as lfn_0001_occupied,
  (select id from public.confirmations
    where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
      and book_number='0001' and folio='0001' and number='0001'
    limit 1) as current_lfn_0001_id,
  (select count(*) from public.pending_confirmations
    where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
      and reportado=true) as current_reported_count;