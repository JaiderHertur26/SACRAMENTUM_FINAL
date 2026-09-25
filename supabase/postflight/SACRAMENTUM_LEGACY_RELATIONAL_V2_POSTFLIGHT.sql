select jsonb_pretty(jsonb_build_object(
 'profiles',(select jsonb_object_agg(profile_key,jsonb_build_object('target',target_entity,'mode',import_mode,'requires_parish',requires_parish)) from public.legacy_import_profiles where profile_key in ('INSBAUTI','INSCONFI','PARROCOS','OBISPOS','CIUDADES','DIOCESIS','IGLESIAS')),
 'pre_registry_table',to_regclass('public.legacy_pre_sacrament_registrations') is not null,
 'reference_catalog',to_regclass('public.legacy_reference_catalog') is not null,
 'apply_v2',to_regprocedure('public.apply_legacy_import_batch_v2(uuid,integer)') is not null,
 'reconcile_rpc',to_regprocedure('public.reconcile_legacy_pre_registrations(text)') is not null,
 'directory_link_rpc',to_regprocedure('public.refresh_legacy_directory_links()') is not null,
 'directory_dioceses',(select count(*) from public.directory_dioceses),
 'directory_churches',(select count(*) from public.directory_churches),
 'location_dictionary',(select count(*) from public.location_dictionary),
 'legacy_priests',(select count(*) from public.legacy_priest_directory)
)) as legacy_relational_v2_postflight;
