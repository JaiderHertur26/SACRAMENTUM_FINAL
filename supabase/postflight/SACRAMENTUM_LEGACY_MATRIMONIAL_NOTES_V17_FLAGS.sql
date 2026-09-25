select
  (select count(*) from public.legacy_import_profiles where profile_key in ('NTMAT001','NTMAT002') and active=true)=2 as ntmat_profiles_active,
  to_regclass('public.legacy_marginal_note_queue') is not null as queue_table_ok,
  to_regprocedure('public.reconcile_legacy_matrimonial_notes(uuid)') is not null as reconcile_rpc_ok,
  to_regprocedure('public.apply_legacy_marginal_note_batch(uuid,integer)') is not null as apply_rpc_ok,
  has_function_privilege('authenticated','public.reconcile_legacy_matrimonial_notes(uuid)','EXECUTE') as reconcile_execute_ok,
  has_function_privilege('authenticated','public.apply_legacy_marginal_note_batch(uuid,integer)','EXECUTE') as apply_execute_ok,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='marginal_notes' and column_name='note_date' and is_nullable='YES') as historical_unknown_date_supported,
  exists(select 1 from pg_indexes where schemaname='public' and tablename='marginal_notes' and indexname='uq_legacy_matrimonial_note_source') as note_idempotency_index_ok,
  exists(select 1 from pg_indexes where schemaname='public' and tablename='legacy_marginal_note_queue' and indexname='idx_legacy_marginal_note_queue_ref') as queue_ref_index_ok;