-- V267 public-domain readiness, SELECT only; tables not listed will be flagged by the cutover.
SELECT 'baptisms' AS table_name,count(*) AS records FROM public."baptisms"
UNION ALL
SELECT 'chat_messages' AS table_name,count(*) AS records FROM public."chat_messages"
UNION ALL
SELECT 'chat_room_members' AS table_name,count(*) AS records FROM public."chat_room_members"
UNION ALL
SELECT 'chat_rooms' AS table_name,count(*) AS records FROM public."chat_rooms"
UNION ALL
SELECT 'confirmations' AS table_name,count(*) AS records FROM public."confirmations"
UNION ALL
SELECT 'decretos' AS table_name,count(*) AS records FROM public."decretos"
UNION ALL
SELECT 'diocesan_report_runs' AS table_name,count(*) AS records FROM public."diocesan_report_runs"
UNION ALL
SELECT 'document_issuances' AS table_name,count(*) AS records FROM public."document_issuances"
UNION ALL
SELECT 'document_sequences' AS table_name,count(*) AS records FROM public."document_sequences"
UNION ALL
SELECT 'funerals' AS table_name,count(*) AS records FROM public."funerals"
UNION ALL
SELECT 'later_note_reconciliations_v156' AS table_name,count(*) AS records FROM public."later_note_reconciliations_v156"
UNION ALL
SELECT 'legacy_archive_records' AS table_name,count(*) AS records FROM public."legacy_archive_records"
UNION ALL
SELECT 'legacy_import_batches' AS table_name,count(*) AS records FROM public."legacy_import_batches"
UNION ALL
SELECT 'legacy_import_ownership' AS table_name,count(*) AS records FROM public."legacy_import_ownership"
UNION ALL
SELECT 'legacy_import_profiles' AS table_name,count(*) AS records FROM public."legacy_import_profiles"
UNION ALL
SELECT 'legacy_import_rows' AS table_name,count(*) AS records FROM public."legacy_import_rows"
UNION ALL
SELECT 'legacy_link_review_events_v218' AS table_name,count(*) AS records FROM public."legacy_link_review_events_v218"
UNION ALL
SELECT 'legacy_marginal_note_queue' AS table_name,count(*) AS records FROM public."legacy_marginal_note_queue"
UNION ALL
SELECT 'legacy_marginal_template_snapshots' AS table_name,count(*) AS records FROM public."legacy_marginal_template_snapshots"
UNION ALL
SELECT 'legacy_marriage_children' AS table_name,count(*) AS records FROM public."legacy_marriage_children"
UNION ALL
SELECT 'legacy_parameter_snapshots' AS table_name,count(*) AS records FROM public."legacy_parameter_snapshots"
UNION ALL
SELECT 'legacy_physical_source_artifacts' AS table_name,count(*) AS records FROM public."legacy_physical_source_artifacts"
UNION ALL
SELECT 'legacy_physical_source_rows' AS table_name,count(*) AS records FROM public."legacy_physical_source_rows"
UNION ALL
SELECT 'legacy_pre_sacrament_registrations' AS table_name,count(*) AS records FROM public."legacy_pre_sacrament_registrations"
UNION ALL
SELECT 'legacy_print_events' AS table_name,count(*) AS records FROM public."legacy_print_events"
UNION ALL
SELECT 'legacy_record_links' AS table_name,count(*) AS records FROM public."legacy_record_links"
UNION ALL
SELECT 'legacy_report_definitions' AS table_name,count(*) AS records FROM public."legacy_report_definitions"
UNION ALL
SELECT 'legacy_source_files' AS table_name,count(*) AS records FROM public."legacy_source_files"
UNION ALL
SELECT 'legacy_source_installations' AS table_name,count(*) AS records FROM public."legacy_source_installations"
UNION ALL
SELECT 'legacy_source_origin_hashes' AS table_name,count(*) AS records FROM public."legacy_source_origin_hashes"
UNION ALL
SELECT 'legacy_source_origins' AS table_name,count(*) AS records FROM public."legacy_source_origins"
UNION ALL
SELECT 'legacy_source_parishes' AS table_name,count(*) AS records FROM public."legacy_source_parishes"
UNION ALL
SELECT 'marginal_notes' AS table_name,count(*) AS records FROM public."marginal_notes"
UNION ALL
SELECT 'marriage_dossiers' AS table_name,count(*) AS records FROM public."marriage_dossiers"
UNION ALL
SELECT 'marriages' AS table_name,count(*) AS records FROM public."marriages"
UNION ALL
SELECT 'matrimonial_notification_recipients' AS table_name,count(*) AS records FROM public."matrimonial_notification_recipients"
UNION ALL
SELECT 'matrimonial_notifications' AS table_name,count(*) AS records FROM public."matrimonial_notifications"
UNION ALL
SELECT 'nullity_court_clarifications_v112' AS table_name,count(*) AS records FROM public."nullity_court_clarifications_v112"
UNION ALL
SELECT 'nullity_court_decision_receipts' AS table_name,count(*) AS records FROM public."nullity_court_decision_receipts"
UNION ALL
SELECT 'nullity_court_receipt_checks' AS table_name,count(*) AS records FROM public."nullity_court_receipt_checks"
UNION ALL
SELECT 'nullity_execution_authorizations_v128' AS table_name,count(*) AS records FROM public."nullity_execution_authorizations_v128"
UNION ALL
SELECT 'nullity_judicial_review_cases' AS table_name,count(*) AS records FROM public."nullity_judicial_review_cases"
UNION ALL
SELECT 'nullity_judicial_review_events' AS table_name,count(*) AS records FROM public."nullity_judicial_review_events"
UNION ALL
SELECT 'official_notifications' AS table_name,count(*) AS records FROM public."official_notifications"
UNION ALL
SELECT 'parishioners' AS table_name,count(*) AS records FROM public."parishioners"
UNION ALL
SELECT 'pending_baptisms' AS table_name,count(*) AS records FROM public."pending_baptisms"
UNION ALL
SELECT 'pending_confirmations' AS table_name,count(*) AS records FROM public."pending_confirmations"
UNION ALL
SELECT 'pending_creation_requests' AS table_name,count(*) AS records FROM public."pending_creation_requests"
UNION ALL
SELECT 'pending_funerals' AS table_name,count(*) AS records FROM public."pending_funerals"
UNION ALL
SELECT 'pending_marriages' AS table_name,count(*) AS records FROM public."pending_marriages"
UNION ALL
SELECT 'pending_tokens' AS table_name,count(*) AS records FROM public."pending_tokens"
UNION ALL
SELECT 'registry_audit_log' AS table_name,count(*) AS records FROM public."registry_audit_log"
UNION ALL
SELECT 'registry_print_events' AS table_name,count(*) AS records FROM public."registry_print_events"
UNION ALL
SELECT 'registry_test_artifact_archive' AS table_name,count(*) AS records FROM public."registry_test_artifact_archive"
UNION ALL
SELECT 'sacrament_books' AS table_name,count(*) AS records FROM public."sacrament_books"
UNION ALL
SELECT 'sacramentum_test_record_archive' AS table_name,count(*) AS records FROM public."sacramentum_test_record_archive"
ORDER BY table_name;
