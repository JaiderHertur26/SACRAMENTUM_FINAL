select jsonb_pretty(jsonb_build_object(
  'legacy_priests',(select count(*) from public.legacy_priest_directory),
  'directory_churches',(select count(*) from public.directory_churches),
  'locations',(select count(*) from public.location_dictionary),
  'legacy_bishops',(select count(*) from public.legacy_reference_catalog where profile_key='OBISPOS'),
  'operational_priests',(select count(*) from public.parrocos where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'),
  'operational_churches',(select count(*) from public.iglesias where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'),
  'operational_cities',(select count(*) from public.ciudades where context_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'),
  'operational_bishops',(select count(*) from public.obispos where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687')
)) as inventory;