select jsonb_build_object(
  'parrocos', (select count(*) from public.parrocos where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'),
  'ciudades', (select count(*) from public.ciudades where context_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'),
  'actual', public.sacramentum_priest_at_date('ada2c810-c6eb-4b75-8e3c-4941e3022687',current_date),
  'hist_2014', public.sacramentum_priest_at_date('ada2c810-c6eb-4b75-8e3c-4941e3022687','2014-05-16'::date)
) as status;