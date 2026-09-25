select jsonb_pretty(jsonb_build_object(
  'current_priest',
    public.sacramentum_priest_at_date('ada2c810-c6eb-4b75-8e3c-4941e3022687',current_date),
  'priest_2003',
    public.sacramentum_priest_at_date('ada2c810-c6eb-4b75-8e3c-4941e3022687','2003-01-01'),
  'priest_2010',
    public.sacramentum_priest_at_date('ada2c810-c6eb-4b75-8e3c-4941e3022687','2010-01-01'),
  'priest_2018',
    public.sacramentum_priest_at_date('ada2c810-c6eb-4b75-8e3c-4941e3022687','2018-01-01'),
  'priest_2024',
    public.sacramentum_priest_at_date('ada2c810-c6eb-4b75-8e3c-4941e3022687','2024-01-01'),
  'priest_after_documented_exit',
    public.sacramentum_priest_at_date('ada2c810-c6eb-4b75-8e3c-4941e3022687','2026-09-18'),
  'active_priests',
    (select count(*) from public.parrocos
     where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687' and upper(estado)='ACTIVO'),
  'bishop_after_closed_tenure',
    public.sacramentum_bishop_at_date('ada2c810-c6eb-4b75-8e3c-4941e3022687',current_date)
)) as temporal_authority_v13_postflight;