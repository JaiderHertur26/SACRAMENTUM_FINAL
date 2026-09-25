select jsonb_pretty(jsonb_build_object(
  'active_count',(select count(*) from public.parrocos where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687' and upper(estado)='ACTIVO'),
  'active_code',(select payload->>'legacy_code' from public.parrocos where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687' and upper(estado)='ACTIVO' limit 1),
  'active_name',(select nombre from public.parrocos where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687' and upper(estado)='ACTIVO' limit 1),
  'current_rpc',public.sacramentum_current_priest('ada2c810-c6eb-4b75-8e3c-4941e3022687'),
  'priest_2003',public.sacramentum_priest_at_date('ada2c810-c6eb-4b75-8e3c-4941e3022687','2003-01-01'),
  'priest_2010',public.sacramentum_priest_at_date('ada2c810-c6eb-4b75-8e3c-4941e3022687','2010-01-01'),
  'priest_2018',public.sacramentum_priest_at_date('ada2c810-c6eb-4b75-8e3c-4941e3022687','2018-01-01'),
  'priest_2024',public.sacramentum_priest_at_date('ada2c810-c6eb-4b75-8e3c-4941e3022687','2024-01-01'),
  'priest_2026',public.sacramentum_priest_at_date('ada2c810-c6eb-4b75-8e3c-4941e3022687','2026-09-18'),
  'states',(select jsonb_agg(jsonb_build_object('code',payload->>'legacy_code','name',nombre,'start',fecha_ingreso,'end',fecha_salida,'state',estado) order by fecha_ingreso) from public.parrocos where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687')
)) as v19;