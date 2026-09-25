select jsonb_build_object(
  'status',case when
    not exists(select 1 from public.legacy_import_profiles where active=true and requires_parish=false)
    and to_regclass('public.legacy_import_ownership') is not null
    and exists(select 1 from information_schema.columns where table_schema='public' and table_name='legacy_pre_sacrament_registrations' and column_name='owner_parish_id')
    and exists(select 1 from pg_trigger where tgname='trg_sacramentum_set_legacy_import_owner' and not tgisinternal)
    and exists(select 1 from pg_trigger where tgname='trg_sacramentum_pre_registration_owner' and not tgisinternal)
    then 'OK' else 'FAIL' end,
  'profiles_without_owner_requirement',(select count(*) from public.legacy_import_profiles where active=true and requires_parish=false),
  'ownership_rows',(select count(*) from public.legacy_import_ownership),
  'pre_rows_without_owner',(select count(*) from public.legacy_pre_sacrament_registrations where owner_parish_id is null),
  'batches_without_parish',(select count(*) from public.legacy_import_batches where created_at>=now()-interval '1 day' and parish_id is null)
) as parish_ownership_v5;