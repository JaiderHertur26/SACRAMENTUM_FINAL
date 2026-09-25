select jsonb_build_object(
  'insbauti_requires_parish',(select requires_parish from public.legacy_import_profiles where profile_key='INSBAUTI'),
  'insconfi_requires_parish',(select requires_parish from public.legacy_import_profiles where profile_key='INSCONFI'),
  'batch_parish_scope_active', position('v_batch_parish' in pg_get_functiondef('public.reconcile_legacy_pre_registrations_v2_internal(text)'::regprocedure))>0,
  'status','OK'
) as legacy_boleta_parish_scope_v4;