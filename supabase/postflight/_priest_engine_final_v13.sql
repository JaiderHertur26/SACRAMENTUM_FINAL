select jsonb_build_object(
  'current',public.sacramentum_priest_at_date('ada2c810-c6eb-4b75-8e3c-4941e3022687',current_date),
  'historical_2014',public.sacramentum_priest_at_date('ada2c810-c6eb-4b75-8e3c-4941e3022687','2014-05-16'::date),
  'active_rows',(select count(*) from public.parrocos where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687' and estado='ACTIVO')
) as priest_engine;