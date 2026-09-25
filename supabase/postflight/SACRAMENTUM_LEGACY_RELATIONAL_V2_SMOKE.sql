select public.reconcile_legacy_pre_registrations('INSBAUTI') as insbauti_reconcile_smoke;
select public.reconcile_legacy_pre_registrations('INSCONFI') as insconfi_reconcile_smoke;
select public.refresh_legacy_directory_links() as directory_refresh_smoke;
select jsonb_build_object(
  'diocese_unique_code_name',exists(select 1 from pg_indexes where schemaname='public' and indexname='uq_directory_dioceses_source_code_name'),
  'bad_unique_code_removed',not exists(select 1 from pg_indexes where schemaname='public' and indexname='uq_directory_dioceses_source_code'),
  'pre_rows',(select count(*) from public.legacy_pre_sacrament_registrations)
) as smoke_status;
