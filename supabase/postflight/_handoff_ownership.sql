select
 to_regclass('public.legacy_import_ownership') is not null as legacy_import_ownership,
 exists(select 1 from information_schema.columns where table_schema='public' and table_name='legacy_pre_sacrament_registrations' and column_name='owner_parish_id') as legacy_pre_owner,
 exists(select 1 from information_schema.columns where table_schema='public' and table_name='legacy_pre_sacrament_registrations' and column_name='reconciliation_status') as legacy_pre_reconciliation;