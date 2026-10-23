-- SACRAMENTUM V167: lock/uniqueness guarantees observed in live PostgreSQL.
-- READ ONLY. These are necessary conditions, NOT proof of two parallel sessions.
BEGIN READ ONLY;
DO $checks$
DECLARE
 funcs text[]:=ARRAY[
 'request_later_note_reconciliation_v156',
 'approve_later_note_reconciliation_v156',
 'reject_later_note_reconciliation_v157',
 'execute_later_note_reconciliation_v156'
 ];
 f text;
 sql_text text;
 idx integer;
BEGIN
 FOREACH f IN ARRAY funcs LOOP
  SELECT pg_get_functiondef(p.oid) INTO STRICT sql_text
  FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname=f;
  IF position('FOR UPDATE' in upper(sql_text))=0
   OR position('auth.uid()' in lower(sql_text))=0
  THEN RAISE EXCEPTION 'V167 missing lock/auth contract for %',f;END IF;
 END LOOP;
 SELECT count(*) INTO idx FROM pg_indexes
 WHERE schemaname='public' AND tablename='later_note_reconciliations_v156'
 AND indexname='uq_later_note_open_decree_v156'
 AND indexdef LIKE '%UNIQUE INDEX%'
 AND indexdef LIKE '%(decree_id, note_id)%'
 AND indexdef LIKE '%pending%'
 AND indexdef LIKE '%authorized%';
 IF idx<>1 THEN RAISE EXCEPTION 'V167 missing partial unique index for open cases';END IF;
END $checks$;
ROLLBACK;
