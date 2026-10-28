-- V265 STAGED FINAL ACL CUTOVER. NEVER APPLY BEFORE BACKUP, DOCUMENTARY
-- reconciliation of all physical books, approved institutional attestation and
-- V252-V265 schema migrations. This is an ATOMIC grant switch, NOT deployment.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='90s';
SELECT pg_advisory_xact_lock(hashtextextended('SACRAMENTUM_V265_BOOK_CUTOVER',265));
-- Drain active sacramental seat writers before changing public RPC privileges.
LOCK TABLE public.baptisms,public.confirmations,public.marriages,public.funerals,
 public.pending_baptisms,public.pending_confirmations,
 public.pending_marriages,public.pending_funerals IN SHARE ROW EXCLUSIVE MODE;
DO $preflight$
DECLARE v_missing int;
DECLARE v_index text;
DECLARE v_old text;
DECLARE v_new text;
BEGIN
 IF to_regclass('sacramentum_ledger.book_memories') IS NULL
  OR to_regclass('sacramentum_ledger.celebration_attestations_v263') IS NULL
  OR to_regclass('sacramentum_ledger.seat_events') IS NULL
  OR to_regclass('sacramentum_ledger.seat_operations') IS NULL THEN
  RAISE EXCEPTION 'V265: memoria, constancias o eventos aún no instalados';
 END IF;
 FOREACH v_old IN ARRAY ARRAY[
   'public.seat_baptism_records(uuid,jsonb,integer,integer,integer)',
   'public.seat_confirmation_records(uuid,jsonb,integer,integer,integer)',
   'public.seat_pending_marriage(uuid)',
   'public.seat_funeral_record(jsonb,uuid)'
 ] LOOP
  IF to_regprocedure(v_old) IS NULL THEN
   RAISE EXCEPTION 'V265: firma antigua ausente %',v_old; END IF;
 END LOOP;
 FOREACH v_new IN ARRAY ARRAY[
   'public.seat_baptism_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)',
   'public.seat_confirmation_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)',
   'public.seat_marriage_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)',
   'public.seat_funeral_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)',
   'public.get_parish_ledger_seat_context_v264(uuid,text,jsonb)',
   'public.attest_new_celebration_v265(uuid,text,uuid,text)'
 ] LOOP
  IF to_regprocedure(v_new) IS NULL THEN
   RAISE EXCEPTION 'V265: firma nueva ausente %',v_new; END IF;
 END LOOP;
 FOREACH v_index IN ARRAY ARRAY[
  'uq_v260_baptism_physical_coordinates',
  'uq_v260_confirmation_physical_coordinates',
  'uq_v260_marriage_physical_coordinates',
  'uq_v260_funeral_physical_coordinates'
 ] LOOP
  IF NOT EXISTS(
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_index i ON i.indexrelid=c.oid
    WHERE n.nspname='public' AND c.relname=v_index AND i.indisunique
      AND i.indisvalid AND i.indnullsnotdistinct
  ) THEN RAISE EXCEPTION 'V265: índice físico único obligatorio no válido %',v_index; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM sacramentum_ledger.book_memories
     WHERE legacy_reconciled=true AND retired_at IS NULL) THEN
  RAISE EXCEPTION 'V265: no existen libros conciliados habilitados';
 END IF;
 IF EXISTS(SELECT 1 FROM sacramentum_ledger.book_memories
      WHERE legacy_reconciled=false AND retired_at IS NULL) THEN
  RAISE EXCEPTION 'V265: existen memorias físicas sin conciliación';
 END IF;
 -- Every historical book scope MUST have explicitly reconciled memory.
 -- No automatic reconstruction of a next number from max(historical.number).
 WITH physical_books AS (
  SELECT parish_id,'bautismo'::text sacrament,'ordinario'::text book_type,
   CASE WHEN book_number ~ '^[0-9]+$'
      THEN coalesce(nullif(ltrim(book_number,'0'),''),'0') ELSE upper(book_number) END book_code
   FROM public.baptisms
  UNION
  SELECT parish_id,'confirmacion','ordinario',
   CASE WHEN book_number ~ '^[0-9]+$'
      THEN coalesce(nullif(ltrim(book_number,'0'),''),'0') ELSE upper(book_number) END
   FROM public.confirmations
  UNION
  SELECT parish_id,'matrimonio',lower(book_type),
   CASE WHEN book_number ~ '^[0-9]+$'
      THEN coalesce(nullif(ltrim(book_number,'0'),''),'0') ELSE upper(book_number) END
   FROM public.marriages
  UNION
  SELECT parish_id,'exequias',lower(book_type),
   CASE WHEN book_number ~ '^[0-9]+$'
      THEN coalesce(nullif(ltrim(book_number,'0'),''),'0') ELSE upper(book_number) END
   FROM public.funerals
 )
 SELECT count(*) INTO v_missing
 FROM physical_books b LEFT JOIN sacramentum_ledger.book_memories m
 ON m.parish_id=b.parish_id AND m.sacrament=b.sacrament
   AND m.book_type=b.book_type AND m.canonical_code=b.book_code
   AND m.legacy_reconciled=true AND m.retired_at IS NULL
 WHERE m.id IS NULL;
 IF v_missing<>0 THEN
  RAISE EXCEPTION 'V265: % libros físicos existentes carecen de memoria conciliada',v_missing;
 END IF;
END $preflight$;

-- The entire switch commits or rolls back as one transaction. No application
-- env flag or frontend deployment is changed by SQL: maintenance window required.
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
DO $verify$
DECLARE v_func text;
BEGIN
 FOREACH v_func IN ARRAY ARRAY[
  'public.seat_baptism_records(uuid,jsonb,integer,integer,integer)',
  'public.seat_confirmation_records(uuid,jsonb,integer,integer,integer)',
  'public.seat_pending_marriage(uuid)','public.seat_funeral_record(jsonb,uuid)'
 ] LOOP
  IF has_function_privilege('anon',v_func,'EXECUTE')
   OR has_function_privilege('authenticated',v_func,'EXECUTE') THEN
    RAISE EXCEPTION 'V265: antigua API sigue ejecutable: %',v_func; END IF;
 END LOOP;
 FOREACH v_func IN ARRAY ARRAY[
  'public.seat_baptism_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)',
  'public.seat_confirmation_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)',
  'public.seat_marriage_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)',
  'public.seat_funeral_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)'
 ] LOOP
  IF has_function_privilege('anon',v_func,'EXECUTE')
    OR NOT has_function_privilege('authenticated',v_func,'EXECUTE') THEN
    RAISE EXCEPTION 'V265: ACL de nueva API incorrecta: %',v_func; END IF;
 END LOOP;
END $verify$;
COMMIT;
