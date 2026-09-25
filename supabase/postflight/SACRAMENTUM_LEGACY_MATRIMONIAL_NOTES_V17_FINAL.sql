select
  (select count(*) from public.legacy_import_profiles where profile_key in ('NTMAT001','NTMAT002') and active=true)=2 as ntmat_profiles_active,
  to_regclass('public.legacy_marginal_note_queue') is not null as queue_table_ok,
  to_regprocedure('public.reconcile_legacy_matrimonial_notes(uuid)') is not null as reconcile_rpc_ok,
  to_regprocedure('public.apply_legacy_marginal_note_batch(uuid,integer)') is not null as apply_rpc_ok,
  has_function_privilege('authenticated','public.reconcile_legacy_matrimonial_notes(uuid)','EXECUTE') as reconcile_execute_ok,
  has_function_privilege('authenticated','public.apply_legacy_marginal_note_batch(uuid,integer)','EXECUTE') as apply_execute_ok,
  exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='marginal_notes'
      and column_name='note_date' and is_nullable='YES'
  ) as historical_unknown_date_supported,
  exists(
    select 1 from pg_indexes
    where schemaname='public'
      and tablename='marginal_notes'
      and indexname='uq_legacy_matrimonial_note_source'
  ) as note_idempotency_index_ok,
  exists(
    select 1 from pg_indexes
    where schemaname='public'
      and tablename='legacy_marginal_note_queue'
      and indexname='idx_legacy_marginal_note_queue_ref'
  ) as queue_ref_index_ok;

select
  (select count(*) from public.legacy_marginal_note_queue where source_sha256='V17-SMOKE-HASH') as smoke_queue_rows,
  (select count(*) from public.marginal_notes where content like 'SMOKE V17%') as smoke_notes,
  (select count(*) from public.marriages where raw_data->>'smokeV17'='true') as smoke_marriages,
  (select count(*) from public.legacy_import_batches where sha256='V17-SMOKE-HASH') as smoke_batches,
  (select count(*) from public.marriages where id='c73f8483-fadd-4919-8045-7ef93871ca83' and parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687' and book_number='0001' and folio='0001' and number='0001' and celebration_date='2026-09-08'::date and status='seated')=1 as real_marriage_unchanged,
  (select count(*) from public.legacy_marginal_note_queue) as live_queue_rows,
  (select count(*) from public.marginal_notes where source_type='legacy_matrimonial_note') as live_linked_legacy_marriage_notes;