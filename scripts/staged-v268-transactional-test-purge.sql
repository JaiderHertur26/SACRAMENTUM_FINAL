-- SACRAMENTUM V268 / STAGED CLEAR TEST DATA: IRREVERSIBLE WITHOUT VERIFIED BACKUP.
-- DO NOT APPLY TO CURRENT SUPABASE. Must be part of a supervised maintenance window.
-- Operator MUST produce and restore-test an encrypted, independently stored
-- full DB backup and authorize exactly this content-free transaction.
-- This script is NOT a general-purpose delete endpoint; postgres migration only.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='240s';
SELECT pg_advisory_xact_lock(hashtextextended('SACRAMENTUM_V268_TEST_CLEANSE_ONLY',268));
LOCK TABLE public."archdioceses",public."baptisms",public."bishop_tenures",public."chancelleries",public."chat_messages",public."chat_room_members",public."chat_rooms",public."ciudades",public."conceptos_anulacion",public."confirmations",public."deaneries",public."decanatos",public."decretos",public."diocesan_report_runs",public."dioceses",public."diocesis",public."directory_churches",public."directory_dioceses",public."document_issuances",public."document_sequences",public."document_templates",public."funerals",public."iglesias",public."later_note_reconciliations_v156",public."legacy_archive_records",public."legacy_import_batches",public."legacy_import_ownership",public."legacy_import_profiles",public."legacy_import_rows",public."legacy_link_review_events_v218",public."legacy_marginal_note_queue",public."legacy_marginal_template_snapshots",public."legacy_marriage_children",public."legacy_parameter_snapshots",public."legacy_physical_source_artifacts",public."legacy_physical_source_rows",public."legacy_pre_sacrament_registrations",public."legacy_priest_directory",public."legacy_print_events",public."legacy_record_links",public."legacy_reference_catalog",public."legacy_report_definitions",public."legacy_source_files",public."legacy_source_installations",public."legacy_source_origin_hashes",public."legacy_source_origins",public."legacy_source_parishes",public."location_dictionary",public."marginal_note_template_clauses",public."marginal_note_templates",public."marginal_notes",public."marriage_dossiers",public."marriages",public."matrimonial_notification_recipients",public."matrimonial_notifications",public."mis_datos",public."nullity_court_clarifications_v112",public."nullity_court_decision_receipts",public."nullity_court_receipt_checks",public."nullity_execution_authorizations_v128",public."nullity_judicial_review_cases",public."nullity_judicial_review_events",public."obispos",public."official_notifications",public."parish_parameters",public."parishes",public."parishioners",public."parrocos",public."pending_baptisms",public."pending_confirmations",public."pending_creation_requests",public."pending_funerals",public."pending_marriages",public."pending_tokens",public."registry_audit_log",public."registry_print_events",public."registry_test_artifact_archive",public."sacrament_books",public."sacramentum_test_record_archive",public."user_profiles",public."vicarias",public."vicariates" IN SHARE ROW EXCLUSIVE MODE;
CREATE SCHEMA IF NOT EXISTS sacramentum_ledger;
CREATE TABLE IF NOT EXISTS sacramentum_ledger.purge_receipts_v268(
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 executed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 executed_by text NOT NULL,
 backup_sha256 text NOT NULL CHECK(backup_sha256~'^[0-9a-f]{64}$'),
 restore_verified boolean NOT NULL CHECK(restore_verified),
 authorization_ticket text NOT NULL CHECK(length(authorization_ticket)>=12),
 discarded_table_count integer NOT NULL CHECK(discarded_table_count=56),
 preserved_table_count integer NOT NULL CHECK(preserved_table_count=26),
 discarded_rows bigint NOT NULL CHECK(discarded_rows>0),
 parishes_test_origin_refs_removed integer NOT NULL,
 baseline_counts jsonb NOT NULL,
 retained_counts jsonb NOT NULL,
 evidence_type text NOT NULL DEFAULT 'TEST_ONLY_RESET_V268'
);
ALTER TABLE sacramentum_ledger.purge_receipts_v268 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sacramentum_ledger.purge_receipts_v268 FROM PUBLIC,anon,authenticated;
CREATE TEMP TABLE v268_baseline (
 category text NOT NULL,table_name text NOT NULL PRIMARY KEY,
 row_count bigint NOT NULL,content_digest text
) ON COMMIT DROP;
DO $preflight$
DECLARE
 v_zero text[]:=ARRAY['baptisms','chat_messages','chat_room_members','chat_rooms','confirmations','decretos','diocesan_report_runs','document_issuances','document_sequences','funerals','later_note_reconciliations_v156','legacy_archive_records','legacy_import_batches','legacy_import_ownership','legacy_import_profiles','legacy_import_rows','legacy_link_review_events_v218','legacy_marginal_note_queue','legacy_marginal_template_snapshots','legacy_marriage_children','legacy_parameter_snapshots','legacy_physical_source_artifacts','legacy_physical_source_rows','legacy_pre_sacrament_registrations','legacy_print_events','legacy_record_links','legacy_report_definitions','legacy_source_files','legacy_source_installations','legacy_source_origin_hashes','legacy_source_origins','legacy_source_parishes','marginal_notes','marriage_dossiers','marriages','matrimonial_notification_recipients','matrimonial_notifications','nullity_court_clarifications_v112','nullity_court_decision_receipts','nullity_court_receipt_checks','nullity_execution_authorizations_v128','nullity_judicial_review_cases','nullity_judicial_review_events','official_notifications','parishioners','pending_baptisms','pending_confirmations','pending_creation_requests','pending_funerals','pending_marriages','pending_tokens','registry_audit_log','registry_print_events','registry_test_artifact_archive','sacrament_books','sacramentum_test_record_archive']::text[];
 v_preserved text[]:=ARRAY['archdioceses','bishop_tenures','chancelleries','ciudades','conceptos_anulacion','deaneries','decanatos','dioceses','diocesis','directory_churches','directory_dioceses','document_templates','iglesias','legacy_priest_directory','legacy_reference_catalog','location_dictionary','marginal_note_template_clauses','marginal_note_templates','mis_datos','obispos','parish_parameters','parishes','parrocos','user_profiles','vicarias','vicariates']::text[];
 v_truncate text[]:=ARRAY['baptisms','chat_messages','chat_room_members','chat_rooms','confirmations','decretos','diocesan_report_runs','document_issuances','document_sequences','funerals','later_note_reconciliations_v156','legacy_archive_records','legacy_import_batches','legacy_import_ownership','legacy_import_profiles','legacy_import_rows','legacy_link_review_events_v218','legacy_marginal_note_queue','legacy_marginal_template_snapshots','legacy_marriage_children','legacy_parameter_snapshots','legacy_physical_source_artifacts','legacy_physical_source_rows','legacy_pre_sacrament_registrations','legacy_print_events','legacy_record_links','legacy_report_definitions','legacy_source_files','legacy_source_origin_hashes','legacy_source_parishes','marginal_notes','marriage_dossiers','marriages','matrimonial_notification_recipients','matrimonial_notifications','nullity_court_clarifications_v112','nullity_court_decision_receipts','nullity_court_receipt_checks','nullity_execution_authorizations_v128','nullity_judicial_review_cases','nullity_judicial_review_events','official_notifications','parishioners','pending_baptisms','pending_confirmations','pending_creation_requests','pending_funerals','pending_marriages','pending_tokens','registry_audit_log','registry_print_events','registry_test_artifact_archive','sacrament_books','sacramentum_test_record_archive']::text[];
 v_table text;
 v_rows bigint;
 v_hash text;
 v_unexpected bigint;
BEGIN
 IF current_user NOT IN ('postgres','supabase_admin') THEN
  RAISE EXCEPTION 'V268: requires infrastructure migration role';
 END IF;
 IF coalesce(current_setting('sacramentum.v268.backup_sha256',true),'') !~ '^[0-9a-f]{64}$'
  OR current_setting('sacramentum.v268.restore_verified',true) IS DISTINCT FROM 'true'
  OR length(coalesce(current_setting('sacramentum.v268.authorization_ticket',true),''))<12
 THEN RAISE EXCEPTION 'V268: verified external backup and release authorization are mandatory'; END IF;
 IF EXISTS(SELECT 1 FROM sacramentum_ledger.purge_receipts_v268) THEN
  RAISE EXCEPTION 'V268: test purge already completed; never repeat after official opening'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.tables
  WHERE table_schema='public' AND table_type='BASE TABLE'
  AND table_name<>ALL(v_zero) AND table_name<>ALL(v_preserved))
  OR (SELECT count(*) FROM pg_tables WHERE schemaname='public')<>82 THEN
  RAISE EXCEPTION 'V268: new or unclassified public table. Halt cleanup.'; END IF;
 -- Fail closed if any non-truncated table in any schema references a
 -- table in the TRUNCATE group. TRUNCATE ... CASCADE is prohibited.
 SELECT count(*) INTO v_unexpected
 FROM pg_constraint c
 JOIN pg_class child ON child.oid=c.conrelid
 JOIN pg_namespace child_ns ON child_ns.oid=child.relnamespace
 JOIN pg_class parent ON parent.oid=c.confrelid
 JOIN pg_namespace parent_ns ON parent_ns.oid=parent.relnamespace
 WHERE c.contype='f'
  AND parent_ns.nspname='public' AND parent.relname=ANY(v_truncate)
  AND NOT(child_ns.nspname='public' AND child.relname=ANY(v_truncate));
 IF v_unexpected>0 THEN
   RAISE EXCEPTION 'V268: % unexpected FK references block safe TRUNCATE',v_unexpected; END IF;
 -- One approved exception: public.parishes.legacy_origin_id references
 -- public.legacy_source_origins, which is handled by DELETE after clearing
 -- only this obsolete import pointer. No other preserved->test FK allowed.
 SELECT count(*) INTO v_unexpected
 FROM pg_constraint c
 JOIN pg_class child ON child.oid=c.conrelid
 JOIN pg_namespace child_ns ON child_ns.oid=child.relnamespace
 JOIN pg_class parent ON parent.oid=c.confrelid
 JOIN pg_namespace parent_ns ON parent_ns.oid=parent.relnamespace
 WHERE c.contype='f'
   AND parent_ns.nspname='public' AND parent.relname=ANY(v_zero)
   AND child_ns.nspname='public' AND child.relname=ANY(v_preserved)
   AND NOT(child.relname='parishes'
    AND parent.relname='legacy_source_origins'
    AND c.conname='parishes_legacy_origin_id_fkey');
 IF v_unexpected>0 THEN
  RAISE EXCEPTION 'V268: unapproved institutional FK points to test data'; END IF;
 -- A future populated storage bucket is a separate document purge and
 -- must never be erased or ignored by this SQL. Auth users are retained.
 IF to_regclass('storage.objects') IS NOT NULL THEN
  EXECUTE 'SELECT count(*) FROM storage.objects' INTO v_rows;
  IF v_rows<>0 THEN RAISE EXCEPTION 'V268: storage contains objects, review separately'; END IF;
 END IF;
 IF to_regclass('sacramentum_ledger.book_memories') IS NOT NULL THEN
  EXECUTE 'SELECT count(*) FROM sacramentum_ledger.book_memories' INTO v_rows;
  IF v_rows<>0 THEN RAISE EXCEPTION 'V268: real/new private book state is not empty'; END IF;
 END IF;
 FOREACH v_table IN ARRAY v_zero LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',v_table) INTO v_rows;
  INSERT INTO pg_temp.v268_baseline(category,table_name,row_count)
  VALUES('test',v_table,v_rows);
 END LOOP;
 IF (SELECT sum(row_count) FROM pg_temp.v268_baseline WHERE category='test')<1 THEN
  RAISE EXCEPTION 'V268: already empty; do not create another purge receipt'; END IF;
 FOREACH v_table IN ARRAY v_preserved LOOP
  -- Allow exactly one change to institutional masters: unlink old test import
  -- origins. Compare all other values, in row-sorted canonical representation.
  EXECUTE format(
    'SELECT count(*),md5(coalesce(string_agg((%s)::text,''|'' ORDER BY (%s)::text),'''')) FROM public.%I v',
    CASE WHEN v_table='parishes'
     THEN 'to_jsonb(v)-''legacy_origin_id''' ELSE 'to_jsonb(v)' END,
    CASE WHEN v_table='parishes'
     THEN 'to_jsonb(v)-''legacy_origin_id''' ELSE 'to_jsonb(v)' END,
    v_table) INTO v_rows,v_hash;
  INSERT INTO pg_temp.v268_baseline(category,table_name,row_count,content_digest)
  VALUES('preserved',v_table,v_rows,v_hash);
 END LOOP;
 INSERT INTO pg_temp.v268_baseline(category,table_name,row_count)
 VALUES('link','parishes_legacy_origin_id',
  (SELECT count(*) FROM public.parishes WHERE legacy_origin_id IS NOT NULL));
END $preflight$;
-- The only master-table mutation: unlink a deprecated test-import origin.
UPDATE public.parishes SET legacy_origin_id=NULL
WHERE legacy_origin_id IS NOT NULL;
-- Statement-level TRUNCATE; never CASCADE and never disable constraints.
-- Legacy origins/installations are withheld from TRUNCATE because a preserved
-- parish references origins and origins reference installations.
TRUNCATE TABLE public."baptisms",public."chat_messages",public."chat_room_members",public."chat_rooms",public."confirmations",public."decretos",public."diocesan_report_runs",public."document_issuances",public."document_sequences",public."funerals",public."later_note_reconciliations_v156",public."legacy_archive_records",public."legacy_import_batches",public."legacy_import_ownership",public."legacy_import_profiles",public."legacy_import_rows",public."legacy_link_review_events_v218",public."legacy_marginal_note_queue",public."legacy_marginal_template_snapshots",public."legacy_marriage_children",public."legacy_parameter_snapshots",public."legacy_physical_source_artifacts",public."legacy_physical_source_rows",public."legacy_pre_sacrament_registrations",public."legacy_print_events",public."legacy_record_links",public."legacy_report_definitions",public."legacy_source_files",public."legacy_source_origin_hashes",public."legacy_source_parishes",public."marginal_notes",public."marriage_dossiers",public."marriages",public."matrimonial_notification_recipients",public."matrimonial_notifications",public."nullity_court_clarifications_v112",public."nullity_court_decision_receipts",public."nullity_court_receipt_checks",public."nullity_execution_authorizations_v128",public."nullity_judicial_review_cases",public."nullity_judicial_review_events",public."official_notifications",public."parishioners",public."pending_baptisms",public."pending_confirmations",public."pending_creation_requests",public."pending_funerals",public."pending_marriages",public."pending_tokens",public."registry_audit_log",public."registry_print_events",public."registry_test_artifact_archive",public."sacrament_books",public."sacramentum_test_record_archive" RESTRICT;
DELETE FROM public.legacy_source_origins;
DELETE FROM public.legacy_source_installations;

DO $finalize$
DECLARE
 v_item record;
 v_count bigint;
 v_hash text;
 v_total bigint;
 v_unlinked integer;
BEGIN
 FOR v_item IN SELECT * FROM pg_temp.v268_baseline LOOP
  IF v_item.category='test' THEN
   EXECUTE format('SELECT count(*) FROM public.%I',v_item.table_name) INTO v_count;
   IF v_count<>0 THEN
    RAISE EXCEPTION 'V268: residual test rows in %: %',v_item.table_name,v_count;
   END IF;
  ELSIF v_item.category='preserved' THEN
   EXECUTE format(
   'SELECT count(*),md5(coalesce(string_agg((%s)::text,''|'' ORDER BY (%s)::text),'''')) FROM public.%I v',
   CASE WHEN v_item.table_name='parishes'
     THEN 'to_jsonb(v)-''legacy_origin_id''' ELSE 'to_jsonb(v)' END,
   CASE WHEN v_item.table_name='parishes'
     THEN 'to_jsonb(v)-''legacy_origin_id''' ELSE 'to_jsonb(v)' END,
   v_item.table_name) INTO v_count,v_hash;
   IF v_count<>v_item.row_count OR v_hash IS DISTINCT FROM v_item.content_digest THEN
    RAISE EXCEPTION 'V268: retained institutional data changed: %',v_item.table_name;
   END IF;
  END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.parishes WHERE legacy_origin_id IS NOT NULL) THEN
  RAISE EXCEPTION 'V268: legacy import references remain in institutional parishes'; END IF;
 SELECT sum(row_count) INTO v_total FROM pg_temp.v268_baseline WHERE category='test';
 SELECT row_count INTO v_unlinked FROM pg_temp.v268_baseline
 WHERE category='link' AND table_name='parishes_legacy_origin_id';
 INSERT INTO sacramentum_ledger.purge_receipts_v268(
 executed_by,backup_sha256,restore_verified,authorization_ticket,
 discarded_table_count,preserved_table_count,discarded_rows,
 parishes_test_origin_refs_removed,baseline_counts,retained_counts)
 VALUES(current_user,current_setting('sacramentum.v268.backup_sha256'),
  true,current_setting('sacramentum.v268.authorization_ticket'),56,26,
  v_total,v_unlinked,
  (SELECT jsonb_object_agg(table_name,row_count) FROM pg_temp.v268_baseline
    WHERE category='test'),
  (SELECT jsonb_object_agg(table_name,jsonb_build_object('rows',row_count,'hash',content_digest))
   FROM pg_temp.v268_baseline WHERE category='preserved'));
END $finalize$;
COMMIT;
