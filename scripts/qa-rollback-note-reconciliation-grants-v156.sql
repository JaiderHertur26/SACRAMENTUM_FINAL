-- V156: repeatable live security metadata check; read-only and transaction-scoped.
BEGIN;
DO $qa$
BEGIN
 IF has_table_privilege('authenticated','public.later_note_reconciliations_v156','SELECT')
   OR has_table_privilege('authenticated','public.later_note_reconciliations_v156','UPDATE')
   OR has_table_privilege('anon','public.later_note_reconciliations_v156','SELECT')
 THEN RAISE EXCEPTION 'V156-FAIL direct access to reconciliation evidence table';END IF;
 IF has_function_privilege('anon','public.request_later_note_reconciliation_v156(uuid,uuid,text,text)','EXECUTE')
   OR has_function_privilege('anon','public.approve_later_note_reconciliation_v156(uuid,text,text)','EXECUTE')
   OR has_function_privilege('anon','public.execute_later_note_reconciliation_v156(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'V156-FAIL anonymous reconciliation RPC executable';END IF;
 IF NOT has_function_privilege('authenticated','public.request_later_note_reconciliation_v156(uuid,uuid,text,text)','EXECUTE')
   OR NOT has_function_privilege('authenticated','public.approve_later_note_reconciliation_v156(uuid,text,text)','EXECUTE')
   OR NOT has_function_privilege('authenticated','public.execute_later_note_reconciliation_v156(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'V156-FAIL missing authorized RPC permission';END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.later_note_reconciliations_v156'::regclass)
 THEN RAISE EXCEPTION 'V156-FAIL new reconciliation table without RLS';END IF;
END $qa$;
ROLLBACK;
