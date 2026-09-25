select jsonb_pretty(jsonb_build_object(
  'directory_dioceses',(select count(*) from public.directory_dioceses),
  'directory_churches',(select count(*) from public.directory_churches),
  'location_dictionary',(select count(*) from public.location_dictionary),
  'legacy_priest_directory',(select count(*) from public.legacy_priest_directory),
  'profiles',(select jsonb_agg(profile_key order by profile_key) from public.legacy_import_profiles where active)
)) as legacy_catalog_precheck;
