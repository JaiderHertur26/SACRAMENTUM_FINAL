
select
  (select count(*) from public.baptisms where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as baptisms,
  (select count(*) from public.confirmations where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as confirmations,
  (select count(*) from public.marriages where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as marriages,
  (select count(*) from public.funerals where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as funerals,
  (select count(*) from public.pending_baptisms where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as pending_baptisms,
  (select count(*) from public.pending_confirmations where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as pending_confirmations,
  (select count(*) from public.parrocos where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as parrocos,
  (select count(*) from public.iglesias where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as iglesias,
  (select count(*) from public.ciudades where context_id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as ciudades,
  (select count(*) from public.obispos where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as obispos,
  (select count(*) from public.bishop_tenures where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as bishop_tenures,
  (select count(*) from public.legacy_pre_sacrament_registrations where profile_key='INSBAUTI') as insbauti,
  (select count(*) from public.legacy_pre_sacrament_registrations where profile_key='INSCONFI') as insconfi;
