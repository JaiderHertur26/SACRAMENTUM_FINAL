-- SACRAMENTUM V267 FRESH-START GO-LIVE · STAGED · NO DATA DELETION.
-- The 8,393 physical records and 89,714 test/transaction rows still exist
-- in the current instance: this script MUST FAIL there. It is not a purge.
-- Exact scope: 82 known public tables; 56 must have COUNT(*) = 0,
-- 26 reviewed institutional master tables are preserved.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='180s';
SELECT pg_advisory_xact_lock(hashtextextended('SACRAMENTUM_V267_FRESH_OFFICIAL_CUTOVER',267));
LOCK TABLE public."baptisms",public."chat_messages",public."chat_room_members",public."chat_rooms",public."confirmations",public."decretos",public."diocesan_report_runs",public."document_issuances",public."document_sequences",public."funerals",public."later_note_reconciliations_v156",public."legacy_archive_records",public."legacy_import_batches",public."legacy_import_ownership",public."legacy_import_profiles",public."legacy_import_rows",public."legacy_link_review_events_v218",public."legacy_marginal_note_queue",public."legacy_marginal_template_snapshots",public."legacy_marriage_children",public."legacy_parameter_snapshots",public."legacy_physical_source_artifacts",public."legacy_physical_source_rows",public."legacy_pre_sacrament_registrations",public."legacy_print_events",public."legacy_record_links",public."legacy_report_definitions",public."legacy_source_files",public."legacy_source_installations",public."legacy_source_origin_hashes",public."legacy_source_origins",public."legacy_source_parishes",public."marginal_notes",public."marriage_dossiers",public."marriages",public."matrimonial_notification_recipients",public."matrimonial_notifications",public."nullity_court_clarifications_v112",public."nullity_court_decision_receipts",public."nullity_court_receipt_checks",public."nullity_execution_authorizations_v128",public."nullity_judicial_review_cases",public."nullity_judicial_review_events",public."official_notifications",public."parishioners",public."pending_baptisms",public."pending_confirmations",public."pending_creation_requests",public."pending_funerals",public."pending_marriages",public."pending_tokens",public."registry_audit_log",public."registry_print_events",public."registry_test_artifact_archive",public."sacrament_books",public."sacramentum_test_record_archive" IN SHARE ROW EXCLUSIVE MODE;
-- Receipt lives OUTSIDE public transactional tables and is committed with
-- the ACL flip, never representing an uncommitted or failed release.
CREATE TABLE IF NOT EXISTS sacramentum_ledger.go_live_receipt_v267(
  id boolean PRIMARY KEY DEFAULT true CHECK(id),
  executed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  activated_by text NOT NULL,
  reset_scope_total integer NOT NULL CHECK(reset_scope_total=56),
  institutional_tables_preserved integer NOT NULL CHECK(institutional_tables_preserved=26),
  mode text NOT NULL CHECK(mode='FRESH_FROM_ZERO'),
  authorization_reference text NOT NULL
);
ALTER TABLE sacramentum_ledger.go_live_receipt_v267 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sacramentum_ledger.go_live_receipt_v267 FROM PUBLIC,anon,authenticated;

DO $preflight$
DECLARE
  t text;
  cnt bigint;
  v_index text;
  v_fn text;
  v_all_tables integer;
  v_zero_tables text[]:=ARRAY['baptisms','chat_messages','chat_room_members','chat_rooms','confirmations','decretos','diocesan_report_runs','document_issuances','document_sequences','funerals','later_note_reconciliations_v156','legacy_archive_records','legacy_import_batches','legacy_import_ownership','legacy_import_profiles','legacy_import_rows','legacy_link_review_events_v218','legacy_marginal_note_queue','legacy_marginal_template_snapshots','legacy_marriage_children','legacy_parameter_snapshots','legacy_physical_source_artifacts','legacy_physical_source_rows','legacy_pre_sacrament_registrations','legacy_print_events','legacy_record_links','legacy_report_definitions','legacy_source_files','legacy_source_installations','legacy_source_origin_hashes','legacy_source_origins','legacy_source_parishes','marginal_notes','marriage_dossiers','marriages','matrimonial_notification_recipients','matrimonial_notifications','nullity_court_clarifications_v112','nullity_court_decision_receipts','nullity_court_receipt_checks','nullity_execution_authorizations_v128','nullity_judicial_review_cases','nullity_judicial_review_events','official_notifications','parishioners','pending_baptisms','pending_confirmations','pending_creation_requests','pending_funerals','pending_marriages','pending_tokens','registry_audit_log','registry_print_events','registry_test_artifact_archive','sacrament_books','sacramentum_test_record_archive']::text[];
  v_master_tables text[]:=ARRAY['archdioceses','bishop_tenures','chancelleries','ciudades','conceptos_anulacion','deaneries','decanatos','dioceses','diocesis','directory_churches','directory_dioceses','document_templates','iglesias','legacy_priest_directory','legacy_reference_catalog','location_dictionary','marginal_note_template_clauses','marginal_note_templates','mis_datos','obispos','parish_parameters','parishes','parrocos','user_profiles','vicarias','vicariates']::text[];
BEGIN
 IF current_user NOT IN('postgres','supabase_admin') THEN
  RAISE EXCEPTION 'V267: solo infraestructura de migración puede activar';
 END IF;
 IF EXISTS(SELECT 1 FROM sacramentum_ledger.go_live_receipt_v267) THEN
  RAISE EXCEPTION 'V267: la apertura oficial ya fue registrada';
 END IF;
 -- V268 test-data cleanup MUST be backed up, restore-verified and recorded
 -- before any official RPC cutover. Never allow an undocumented empty reset.
 IF to_regclass('sacramentum_ledger.purge_receipts_v268') IS NULL THEN
  RAISE EXCEPTION 'V267: falta constancia V268 de eliminación de datos ficticios';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM sacramentum_ledger.purge_receipts_v268
  WHERE id=true AND restore_verified=true AND discarded_table_count=56
    AND preserved_table_count=26 AND discarded_rows>0
    AND backup_sha256~'^[0-9a-f]{64}$') THEN
  RAISE EXCEPTION 'V267: la limpieza V268 no tiene respaldo y restauración verificados';
 END IF;
 -- Unexpected new public tables block release until categorized.
 SELECT count(*) INTO v_all_tables FROM pg_tables WHERE schemaname='public';
 IF v_all_tables<>82 THEN
  RAISE EXCEPTION 'V267: inventario público cambió (% tablas); revisar matriz de reinicio',v_all_tables;
 END IF;
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
  IF NOT(t=ANY(v_zero_tables) OR t=ANY(v_master_tables)) THEN
   RAISE EXCEPTION 'V267: tabla nueva sin clasificación %',t;
  END IF;
 END LOOP;
 -- Exact COUNT(*) under lock, no approximate estimates and no retained
 -- fictitious decrees, archives, documents, church messages or printed events.
 FOREACH t IN ARRAY v_zero_tables LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',t) INTO cnt;
  IF cnt<>0 THEN
    RAISE EXCEPTION 'V267: todavía existen % filas de pruebas en %',cnt,t;
  END IF;
 END LOOP;
 IF to_regclass('sacramentum_ledger.book_memories') IS NULL
  OR to_regclass('sacramentum_ledger.seat_events') IS NULL
  OR to_regclass('sacramentum_ledger.active_seats') IS NULL
  OR to_regclass('sacramentum_ledger.seat_operations') IS NULL
  OR to_regclass('sacramentum_ledger.celebration_attestations_v263') IS NULL THEN
  RAISE EXCEPTION 'V267: infraestructura privada de libros incompleta';
 END IF;
 IF EXISTS(SELECT 1 FROM sacramentum_ledger.book_memories)
  OR EXISTS(SELECT 1 FROM sacramentum_ledger.active_seats)
  OR EXISTS(SELECT 1 FROM sacramentum_ledger.seat_events)
  OR EXISTS(SELECT 1 FROM sacramentum_ledger.seat_operations)
  OR EXISTS(SELECT 1 FROM sacramentum_ledger.celebration_attestations_v263) THEN
  RAISE EXCEPTION 'V267: las memorias privadas también deben empezar vacías';
 END IF;
 IF to_regclass('sacramentum_ledger.physical_reviews_v266') IS NOT NULL THEN
   EXECUTE 'SELECT count(*) FROM sacramentum_ledger.physical_reviews_v266' INTO cnt;
   IF cnt<>0 THEN RAISE EXCEPTION 'V267: propuestas históricas de prueba aún existen'; END IF;
 END IF;
 FOREACH v_index IN ARRAY ARRAY[
   'uq_v260_baptism_physical_coordinates',
   'uq_v260_confirmation_physical_coordinates',
   'uq_v260_marriage_physical_coordinates',
   'uq_v260_funeral_physical_coordinates'
 ] LOOP
  IF NOT EXISTS(
   SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
    JOIN pg_index i ON i.indexrelid=c.oid
   WHERE n.nspname='public' AND c.relname=v_index
     AND i.indisunique AND i.indisvalid AND i.indnullsnotdistinct
  ) THEN RAISE EXCEPTION 'V267: índice de unicidad física no válido %',v_index; END IF;
 END LOOP;
 FOREACH v_fn IN ARRAY ARRAY[
  'public.seat_baptism_records(uuid,jsonb,integer,integer,integer)',
  'public.seat_confirmation_records(uuid,jsonb,integer,integer,integer)',
  'public.seat_pending_marriage(uuid)',
  'public.seat_funeral_record(jsonb,uuid)',
  'public.seat_baptism_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)',
  'public.seat_confirmation_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)',
  'public.seat_marriage_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)',
  'public.seat_funeral_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)',
  'public.get_parish_ledger_seat_context_v264(uuid,text,jsonb)',
  'public.attest_new_celebration_v265(uuid,text,uuid,text)',
  'public.open_first_official_book_v267(uuid,text,uuid,text,integer,integer,integer,boolean)',
  'public.open_next_official_book_v270(uuid,text,uuid,bigint,uuid,text,integer,integer,integer,boolean,text)'
 ] LOOP
  IF to_regprocedure(v_fn) IS NULL THEN
    RAISE EXCEPTION 'V267: servicio indispensable ausente %',v_fn;
  END IF;
 END LOOP;
END $preflight$;

-- All test boletas and related transactions were proven absent. Restore only
-- the legacy registration counter to zero, retaining its configured width.
-- Other institutional parameter JSON and templates remain intact.
UPDATE public.parish_parameters SET
 bautizos_params=CASE WHEN coalesce(bautizos_params,'{}'::jsonb) ? 'numeroRegistroActual'
 THEN jsonb_set(coalesce(bautizos_params,'{}'::jsonb),'{numeroRegistroActual}',
    to_jsonb(lpad('0',greatest(1,length(coalesce(bautizos_params->>'numeroRegistroActual','0'))),'0')),false)
 ELSE bautizos_params END,
 confirmaciones_params=CASE WHEN coalesce(confirmaciones_params,'{}'::jsonb) ? 'numeroRegistroActual'
 THEN jsonb_set(coalesce(confirmaciones_params,'{}'::jsonb),'{numeroRegistroActual}',
    to_jsonb(lpad('0',greatest(1,length(coalesce(confirmaciones_params->>'numeroRegistroActual','0'))),'0')),false)
 ELSE confirmaciones_params END,
 matrimonios_params=CASE WHEN coalesce(matrimonios_params,'{}'::jsonb) ? 'numeroRegistroActual'
 THEN jsonb_set(coalesce(matrimonios_params,'{}'::jsonb),'{numeroRegistroActual}',
    to_jsonb(lpad('0',greatest(1,length(coalesce(matrimonios_params->>'numeroRegistroActual','0'))),'0')),false)
 ELSE matrimonios_params END,
 exequias_params=CASE WHEN coalesce(exequias_params,'{}'::jsonb) ? 'numeroRegistroActual'
 THEN jsonb_set(coalesce(exequias_params,'{}'::jsonb),'{numeroRegistroActual}',
    to_jsonb(lpad('0',greatest(1,length(coalesce(exequias_params->>'numeroRegistroActual','0'))),'0')),false)
 ELSE exequias_params END,
 updated_at=clock_timestamp();

REVOKE EXECUTE ON FUNCTION public.seat_baptism_records(uuid,jsonb,integer,integer,integer)
 FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.seat_confirmation_records(uuid,jsonb,integer,integer,integer)
 FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.seat_pending_marriage(uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.seat_funeral_record(jsonb,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.seat_baptism_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)
 TO authenticated;
GRANT EXECUTE ON FUNCTION public.seat_confirmation_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)
 TO authenticated;
GRANT EXECUTE ON FUNCTION public.seat_marriage_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)
 TO authenticated;
GRANT EXECUTE ON FUNCTION public.seat_funeral_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)
 TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_first_official_book_v267(
 uuid,text,uuid,text,integer,integer,integer,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_next_official_book_v270(
 uuid,text,uuid,bigint,uuid,text,integer,integer,integer,boolean,text) TO authenticated;

DO $verify$
DECLARE s text;
BEGIN
 FOREACH s IN ARRAY ARRAY[
  'public.seat_baptism_records(uuid,jsonb,integer,integer,integer)',
  'public.seat_confirmation_records(uuid,jsonb,integer,integer,integer)',
  'public.seat_pending_marriage(uuid)','public.seat_funeral_record(jsonb,uuid)'
 ] LOOP
  IF has_function_privilege('anon',s,'EXECUTE')
    OR has_function_privilege('authenticated',s,'EXECUTE') THEN
   RAISE EXCEPTION 'V267: procedimiento anterior todavía accesible %',s; END IF;
 END LOOP;
 FOREACH s IN ARRAY ARRAY[
  'public.seat_baptism_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)',
  'public.seat_confirmation_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)',
  'public.seat_marriage_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)',
  'public.seat_funeral_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)',
  'public.open_first_official_book_v267(uuid,text,uuid,text,integer,integer,integer,boolean)',
  'public.open_next_official_book_v270(uuid,text,uuid,bigint,uuid,text,integer,integer,integer,boolean,text)'
 ] LOOP
  IF has_function_privilege('anon',s,'EXECUTE')
   OR NOT has_function_privilege('authenticated',s,'EXECUTE') THEN
   RAISE EXCEPTION 'V267: privilegios de nueva API incorrectos %',s; END IF;
 END LOOP;
END $verify$;
INSERT INTO sacramentum_ledger.go_live_receipt_v267
  (id,activated_by,reset_scope_total,institutional_tables_preserved,mode,
   authorization_reference)
VALUES(true,current_user,56,26,'FRESH_FROM_ZERO',
  'V267-CUTOVER-EMPTY-TRANSACTIONAL-REGISTRY');
COMMIT;
