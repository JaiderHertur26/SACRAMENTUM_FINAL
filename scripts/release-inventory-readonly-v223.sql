-- V223 — SINGLE-STATEMENT READ-ONLY exact count of ALL currently known public tables.
-- Run via Supabase SQL Editor with privileged read-only responsibility; anon sees RLS-subset only.
-- No TRUNCATE, DELETE, UPDATE, CREATE, DROP, ALTER, GRANT, REVOKE or user data extraction.
-- If missing_table_count>0 or unexpected_table_count>0, the audit is incomplete.
WITH counted AS (
  SELECT 'public.archdioceses'::text AS object_name, (SELECT count(*)::bigint FROM public.archdioceses) AS rows_count
UNION ALL
  SELECT 'public.baptisms'::text AS object_name, (SELECT count(*)::bigint FROM public.baptisms) AS rows_count
UNION ALL
  SELECT 'public.bishop_tenures'::text AS object_name, (SELECT count(*)::bigint FROM public.bishop_tenures) AS rows_count
UNION ALL
  SELECT 'public.chancelleries'::text AS object_name, (SELECT count(*)::bigint FROM public.chancelleries) AS rows_count
UNION ALL
  SELECT 'public.chat_messages'::text AS object_name, (SELECT count(*)::bigint FROM public.chat_messages) AS rows_count
UNION ALL
  SELECT 'public.chat_room_members'::text AS object_name, (SELECT count(*)::bigint FROM public.chat_room_members) AS rows_count
UNION ALL
  SELECT 'public.chat_rooms'::text AS object_name, (SELECT count(*)::bigint FROM public.chat_rooms) AS rows_count
UNION ALL
  SELECT 'public.ciudades'::text AS object_name, (SELECT count(*)::bigint FROM public.ciudades) AS rows_count
UNION ALL
  SELECT 'public.conceptos_anulacion'::text AS object_name, (SELECT count(*)::bigint FROM public.conceptos_anulacion) AS rows_count
UNION ALL
  SELECT 'public.confirmations'::text AS object_name, (SELECT count(*)::bigint FROM public.confirmations) AS rows_count
UNION ALL
  SELECT 'public.deaneries'::text AS object_name, (SELECT count(*)::bigint FROM public.deaneries) AS rows_count
UNION ALL
  SELECT 'public.decanatos'::text AS object_name, (SELECT count(*)::bigint FROM public.decanatos) AS rows_count
UNION ALL
  SELECT 'public.decretos'::text AS object_name, (SELECT count(*)::bigint FROM public.decretos) AS rows_count
UNION ALL
  SELECT 'public.diocesan_report_runs'::text AS object_name, (SELECT count(*)::bigint FROM public.diocesan_report_runs) AS rows_count
UNION ALL
  SELECT 'public.dioceses'::text AS object_name, (SELECT count(*)::bigint FROM public.dioceses) AS rows_count
UNION ALL
  SELECT 'public.diocesis'::text AS object_name, (SELECT count(*)::bigint FROM public.diocesis) AS rows_count
UNION ALL
  SELECT 'public.directory_churches'::text AS object_name, (SELECT count(*)::bigint FROM public.directory_churches) AS rows_count
UNION ALL
  SELECT 'public.directory_dioceses'::text AS object_name, (SELECT count(*)::bigint FROM public.directory_dioceses) AS rows_count
UNION ALL
  SELECT 'public.document_issuances'::text AS object_name, (SELECT count(*)::bigint FROM public.document_issuances) AS rows_count
UNION ALL
  SELECT 'public.document_sequences'::text AS object_name, (SELECT count(*)::bigint FROM public.document_sequences) AS rows_count
UNION ALL
  SELECT 'public.document_templates'::text AS object_name, (SELECT count(*)::bigint FROM public.document_templates) AS rows_count
UNION ALL
  SELECT 'public.funerals'::text AS object_name, (SELECT count(*)::bigint FROM public.funerals) AS rows_count
UNION ALL
  SELECT 'public.iglesias'::text AS object_name, (SELECT count(*)::bigint FROM public.iglesias) AS rows_count
UNION ALL
  SELECT 'public.later_note_reconciliations_v156'::text AS object_name, (SELECT count(*)::bigint FROM public.later_note_reconciliations_v156) AS rows_count
UNION ALL
  SELECT 'public.legacy_archive_records'::text AS object_name, (SELECT count(*)::bigint FROM public.legacy_archive_records) AS rows_count
UNION ALL
  SELECT 'public.legacy_import_batches'::text AS object_name, (SELECT count(*)::bigint FROM public.legacy_import_batches) AS rows_count
UNION ALL
  SELECT 'public.legacy_import_ownership'::text AS object_name, (SELECT count(*)::bigint FROM public.legacy_import_ownership) AS rows_count
UNION ALL
  SELECT 'public.legacy_import_profiles'::text AS object_name, (SELECT count(*)::bigint FROM public.legacy_import_profiles) AS rows_count
UNION ALL
  SELECT 'public.legacy_import_rows'::text AS object_name, (SELECT count(*)::bigint FROM public.legacy_import_rows) AS rows_count
UNION ALL
  SELECT 'public.legacy_link_review_events_v218'::text AS object_name, (SELECT count(*)::bigint FROM public.legacy_link_review_events_v218) AS rows_count
UNION ALL
  SELECT 'public.legacy_marginal_note_queue'::text AS object_name, (SELECT count(*)::bigint FROM public.legacy_marginal_note_queue) AS rows_count
UNION ALL
  SELECT 'public.legacy_marginal_template_snapshots'::text AS object_name, (SELECT count(*)::bigint FROM public.legacy_marginal_template_snapshots) AS rows_count
UNION ALL
  SELECT 'public.legacy_marriage_children'::text AS object_name, (SELECT count(*)::bigint FROM public.legacy_marriage_children) AS rows_count
UNION ALL
  SELECT 'public.legacy_parameter_snapshots'::text AS object_name, (SELECT count(*)::bigint FROM public.legacy_parameter_snapshots) AS rows_count
UNION ALL
  SELECT 'public.legacy_physical_source_artifacts'::text AS object_name, (SELECT count(*)::bigint FROM public.legacy_physical_source_artifacts) AS rows_count
UNION ALL
  SELECT 'public.legacy_physical_source_rows'::text AS object_name, (SELECT count(*)::bigint FROM public.legacy_physical_source_rows) AS rows_count
UNION ALL
  SELECT 'public.legacy_pre_sacrament_registrations'::text AS object_name, (SELECT count(*)::bigint FROM public.legacy_pre_sacrament_registrations) AS rows_count
UNION ALL
  SELECT 'public.legacy_priest_directory'::text AS object_name, (SELECT count(*)::bigint FROM public.legacy_priest_directory) AS rows_count
UNION ALL
  SELECT 'public.legacy_print_events'::text AS object_name, (SELECT count(*)::bigint FROM public.legacy_print_events) AS rows_count
UNION ALL
  SELECT 'public.legacy_record_links'::text AS object_name, (SELECT count(*)::bigint FROM public.legacy_record_links) AS rows_count
UNION ALL
  SELECT 'public.legacy_reference_catalog'::text AS object_name, (SELECT count(*)::bigint FROM public.legacy_reference_catalog) AS rows_count
UNION ALL
  SELECT 'public.legacy_report_definitions'::text AS object_name, (SELECT count(*)::bigint FROM public.legacy_report_definitions) AS rows_count
UNION ALL
  SELECT 'public.legacy_source_files'::text AS object_name, (SELECT count(*)::bigint FROM public.legacy_source_files) AS rows_count
UNION ALL
  SELECT 'public.legacy_source_installations'::text AS object_name, (SELECT count(*)::bigint FROM public.legacy_source_installations) AS rows_count
UNION ALL
  SELECT 'public.legacy_source_origin_hashes'::text AS object_name, (SELECT count(*)::bigint FROM public.legacy_source_origin_hashes) AS rows_count
UNION ALL
  SELECT 'public.legacy_source_origins'::text AS object_name, (SELECT count(*)::bigint FROM public.legacy_source_origins) AS rows_count
UNION ALL
  SELECT 'public.legacy_source_parishes'::text AS object_name, (SELECT count(*)::bigint FROM public.legacy_source_parishes) AS rows_count
UNION ALL
  SELECT 'public.location_dictionary'::text AS object_name, (SELECT count(*)::bigint FROM public.location_dictionary) AS rows_count
UNION ALL
  SELECT 'public.marginal_note_template_clauses'::text AS object_name, (SELECT count(*)::bigint FROM public.marginal_note_template_clauses) AS rows_count
UNION ALL
  SELECT 'public.marginal_note_templates'::text AS object_name, (SELECT count(*)::bigint FROM public.marginal_note_templates) AS rows_count
UNION ALL
  SELECT 'public.marginal_notes'::text AS object_name, (SELECT count(*)::bigint FROM public.marginal_notes) AS rows_count
UNION ALL
  SELECT 'public.marriage_dossiers'::text AS object_name, (SELECT count(*)::bigint FROM public.marriage_dossiers) AS rows_count
UNION ALL
  SELECT 'public.marriages'::text AS object_name, (SELECT count(*)::bigint FROM public.marriages) AS rows_count
UNION ALL
  SELECT 'public.matrimonial_notification_recipients'::text AS object_name, (SELECT count(*)::bigint FROM public.matrimonial_notification_recipients) AS rows_count
UNION ALL
  SELECT 'public.matrimonial_notifications'::text AS object_name, (SELECT count(*)::bigint FROM public.matrimonial_notifications) AS rows_count
UNION ALL
  SELECT 'public.mis_datos'::text AS object_name, (SELECT count(*)::bigint FROM public.mis_datos) AS rows_count
UNION ALL
  SELECT 'public.nullity_court_clarifications_v112'::text AS object_name, (SELECT count(*)::bigint FROM public.nullity_court_clarifications_v112) AS rows_count
UNION ALL
  SELECT 'public.nullity_court_decision_receipts'::text AS object_name, (SELECT count(*)::bigint FROM public.nullity_court_decision_receipts) AS rows_count
UNION ALL
  SELECT 'public.nullity_court_receipt_checks'::text AS object_name, (SELECT count(*)::bigint FROM public.nullity_court_receipt_checks) AS rows_count
UNION ALL
  SELECT 'public.nullity_execution_authorizations_v128'::text AS object_name, (SELECT count(*)::bigint FROM public.nullity_execution_authorizations_v128) AS rows_count
UNION ALL
  SELECT 'public.nullity_judicial_review_cases'::text AS object_name, (SELECT count(*)::bigint FROM public.nullity_judicial_review_cases) AS rows_count
UNION ALL
  SELECT 'public.nullity_judicial_review_events'::text AS object_name, (SELECT count(*)::bigint FROM public.nullity_judicial_review_events) AS rows_count
UNION ALL
  SELECT 'public.obispos'::text AS object_name, (SELECT count(*)::bigint FROM public.obispos) AS rows_count
UNION ALL
  SELECT 'public.official_notifications'::text AS object_name, (SELECT count(*)::bigint FROM public.official_notifications) AS rows_count
UNION ALL
  SELECT 'public.parish_parameters'::text AS object_name, (SELECT count(*)::bigint FROM public.parish_parameters) AS rows_count
UNION ALL
  SELECT 'public.parishes'::text AS object_name, (SELECT count(*)::bigint FROM public.parishes) AS rows_count
UNION ALL
  SELECT 'public.parishioners'::text AS object_name, (SELECT count(*)::bigint FROM public.parishioners) AS rows_count
UNION ALL
  SELECT 'public.parrocos'::text AS object_name, (SELECT count(*)::bigint FROM public.parrocos) AS rows_count
UNION ALL
  SELECT 'public.pending_baptisms'::text AS object_name, (SELECT count(*)::bigint FROM public.pending_baptisms) AS rows_count
UNION ALL
  SELECT 'public.pending_confirmations'::text AS object_name, (SELECT count(*)::bigint FROM public.pending_confirmations) AS rows_count
UNION ALL
  SELECT 'public.pending_creation_requests'::text AS object_name, (SELECT count(*)::bigint FROM public.pending_creation_requests) AS rows_count
UNION ALL
  SELECT 'public.pending_funerals'::text AS object_name, (SELECT count(*)::bigint FROM public.pending_funerals) AS rows_count
UNION ALL
  SELECT 'public.pending_marriages'::text AS object_name, (SELECT count(*)::bigint FROM public.pending_marriages) AS rows_count
UNION ALL
  SELECT 'public.pending_tokens'::text AS object_name, (SELECT count(*)::bigint FROM public.pending_tokens) AS rows_count
UNION ALL
  SELECT 'public.registry_audit_log'::text AS object_name, (SELECT count(*)::bigint FROM public.registry_audit_log) AS rows_count
UNION ALL
  SELECT 'public.registry_print_events'::text AS object_name, (SELECT count(*)::bigint FROM public.registry_print_events) AS rows_count
UNION ALL
  SELECT 'public.registry_test_artifact_archive'::text AS object_name, (SELECT count(*)::bigint FROM public.registry_test_artifact_archive) AS rows_count
UNION ALL
  SELECT 'public.sacrament_books'::text AS object_name, (SELECT count(*)::bigint FROM public.sacrament_books) AS rows_count
UNION ALL
  SELECT 'public.sacramentum_test_record_archive'::text AS object_name, (SELECT count(*)::bigint FROM public.sacramentum_test_record_archive) AS rows_count
UNION ALL
  SELECT 'public.user_profiles'::text AS object_name, (SELECT count(*)::bigint FROM public.user_profiles) AS rows_count
UNION ALL
  SELECT 'public.vicarias'::text AS object_name, (SELECT count(*)::bigint FROM public.vicarias) AS rows_count
UNION ALL
  SELECT 'public.vicariates'::text AS object_name, (SELECT count(*)::bigint FROM public.vicariates) AS rows_count
), platform AS (
  SELECT 'auth.users'::text AS object_name,(SELECT count(*)::bigint FROM auth.users) AS rows_count
  UNION ALL SELECT 'storage.objects',(SELECT count(*)::bigint FROM storage.objects)
  UNION ALL SELECT 'storage.buckets',(SELECT count(*)::bigint FROM storage.buckets)
), discovered AS (
  SELECT ('public.' || tablename)::text AS object_name
  FROM pg_catalog.pg_tables
  WHERE schemaname = 'public'
), coverage AS (
  SELECT (SELECT count(*) FROM counted)::bigint AS tracked_public_tables,
    (SELECT count(*) FROM discovered)::bigint AS current_public_tables,
    (SELECT count(*) FROM discovered d WHERE NOT EXISTS(SELECT 1 FROM counted c WHERE c.object_name=d.object_name))::bigint AS unexpected_table_count,
    (SELECT count(*) FROM counted c WHERE NOT EXISTS(SELECT 1 FROM discovered d WHERE d.object_name=c.object_name))::bigint AS missing_table_count
)
SELECT object_name,rows_count,
  CASE WHEN object_name IN ('auth.users','storage.objects','storage.buckets') THEN 'platform' ELSE 'public' END AS data_family,
  (SELECT tracked_public_tables FROM coverage) AS tracked_public_tables,
  (SELECT current_public_tables FROM coverage) AS current_public_tables,
  (SELECT unexpected_table_count FROM coverage) AS unexpected_table_count,
  (SELECT missing_table_count FROM coverage) AS missing_table_count
FROM (SELECT * FROM counted UNION ALL SELECT * FROM platform) all_counts
ORDER BY data_family,object_name;
