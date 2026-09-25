select
 public.sacramentum_priest_at_date('ada2c810-c6eb-4b75-8e3c-4941e3022687','2021-02-01'::date) as historical,
 public.sacramentum_priest_at_date('ada2c810-c6eb-4b75-8e3c-4941e3022687',current_date) as current;