select
  'ada2c810-c6eb-4b75-8e3c-4941e3022687'::uuid as parish_id,
  (select name from public.parishes where id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as parish_name,
  (select count(*) from public.pending_baptisms where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as pending_total,
  (select count(*) from public.pending_baptisms where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687' and coalesce(reportado,false)=false) as pending_not_reported,
  (select count(*) from public.pending_baptisms where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687' and coalesce(reportado,false)=true) as pending_reported,
  (select count(*) from public.baptisms where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as baptisms_total,
  (select count(*) from public.legacy_pre_sacrament_registrations where profile_key='INSBAUTI') as insbauti_legacy_total;