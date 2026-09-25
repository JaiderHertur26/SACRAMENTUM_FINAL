select
  (select count(*) from public.pending_baptisms where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as pending_baptisms_total,
  (select count(*) from public.pending_baptisms where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687' and coalesce(reportado,false)=false) as pending_baptisms_not_reported,
  (select count(*) from public.pending_baptisms where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687' and coalesce(reportado,false)=true) as pending_baptisms_reported,
  (select count(*) from public.pending_confirmations where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as pending_confirmations_total,
  (select count(*) from public.legacy_pre_sacrament_registrations where profile_key='INSBAUTI' and owner_parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as insbauti_owned,
  (select count(*) from public.legacy_pre_sacrament_registrations where profile_key='INSBAUTI' and reconciliation_status='matched') as insbauti_matched,
  (select count(*) from public.legacy_pre_sacrament_registrations where profile_key='INSBAUTI' and reconciliation_status='unmatched') as insbauti_unmatched,
  (select count(*) from public.legacy_pre_sacrament_registrations where profile_key='INSBAUTI' and reconciliation_status='not_seated') as insbauti_not_seated;