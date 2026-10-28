import fs from 'node:fs';
const manifest=JSON.parse(fs.readFileSync('AUDITORIA_MATRIZ_RESET_V267_2026-10-28.json','utf8'));
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const zeros=manifest.zeroRequired,keep=manifest.preserve;
if(new Set([...zeros,...keep]).size!==82||zeros.length!==56||keep.length!==26)throw Error('V267 public schema inventory drift');
const arr=a=>'ARRAY['+a.map(quote).join(',')+']::text[]';
const sql=`-- SACRAMENTUM V267 FRESH-START GO-LIVE · STAGED · NO DATA DELETION.
-- The 8,393 physical records and 89,714 test/transaction rows still exist
-- in the current instance: this script MUST FAIL there. It is not a purge.
-- Exact scope: 82 known public tables; 56 must have COUNT(*) = 0,
-- 26 reviewed institutional master tables are preserved.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='180s';
SELECT pg_advisory_xact_lock(hashtextextended('SACRAMENTUM_V267_FRESH_OFFICIAL_CUTOVER',267));
-- The master fingerprints are part of the SAME cutover transaction: lock all
-- 82 classified relations to prevent post-review drift before the ACL flip.
LOCK TABLE ${[...zeros,...keep].sort().map(x=>'public."'+x+'"').join(',')} IN SHARE ROW EXCLUSIVE MODE;
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
  v_zero_tables text[]:=${arr(zeros)};
  v_master_tables text[]:=${arr(keep)};
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
 -- The V268 transaction protects structural preservation, NOT institutional
 -- authenticity. No master table can be retained without two named reviewers
 -- and a current match against the independently backed-up V268 receipt.
 IF to_regclass('sacramentum_ledger.master_review_v273') IS NULL THEN
   RAISE EXCEPTION 'V273: falta control independiente de las 26 tablas institucionales';
 END IF;
 IF (SELECT count(*) FROM sacramentum_ledger.master_review_v273)<>26 THEN
   RAISE EXCEPTION 'V273: deben revisarse exactamente las 26 tablas institucionales';
 END IF;
 -- All active user profiles MUST point to a real authenticated identity.
 -- Inactive placeholders may remain only if their institutional role is vetted.
 IF to_regclass('auth.users') IS NULL THEN
   RAISE EXCEPTION 'V273: no existe la tabla de autenticación';
 END IF;
 IF EXISTS (
   SELECT 1 FROM public.user_profiles up
   LEFT JOIN auth.users au ON au.id=up.auth_user_id
   WHERE up.is_active IS TRUE AND upper(coalesce(up.status,''))='ACTIVE'
     AND (up.auth_user_id IS NULL OR au.id IS NULL)
 ) THEN
   RAISE EXCEPTION 'V273: usuarios ACTIVOS sin cuenta autenticada: revisar antes de operar';
 END IF;
 -- The single GoTrue identity must not activate two overlapping institutional
 -- profiles. Email/username are not security keys for identity binding.
 IF EXISTS(SELECT 1 FROM public.user_profiles up
   WHERE up.is_active IS TRUE AND upper(coalesce(up.status,''))='ACTIVE'
     AND up.auth_user_id IS NOT NULL
   GROUP BY up.auth_user_id HAVING count(*)>1) THEN
   RAISE EXCEPTION 'V274: una cuenta Auth no puede activar múltiples perfiles';
 END IF;
 -- An authenticated user with a stale or wrong ecclesiastical jurisdiction
 -- would break tenant isolation. Check real database FKs, not display names.
 IF EXISTS(
   SELECT 1 FROM public.user_profiles up
   LEFT JOIN public.dioceses d ON d.id=up.diocese_id
   LEFT JOIN public.parishes p ON p.id=up.parish_id
   LEFT JOIN public.chancelleries c ON c.id=up.chancery_id
   WHERE up.is_active IS TRUE AND upper(coalesce(up.status,''))='ACTIVE'
    AND (
     (lower(up.role)='parish' AND
       (p.id IS NULL OR p.is_operational IS DISTINCT FROM TRUE
        OR p.diocese_id IS DISTINCT FROM up.diocese_id))
     OR (lower(up.role)='chancery' AND
       (c.id IS NULL OR c.diocese_id IS DISTINCT FROM up.diocese_id))
     OR (lower(up.role)='diocese' AND d.id IS NULL)
     OR (lower(up.role)='admin_general' AND
       (up.diocese_id IS NOT NULL OR up.parish_id IS NOT NULL
        OR up.chancery_id IS NOT NULL))
     OR lower(up.role) NOT IN
       ('parish','chancery','diocese','admin_general')
    )
   )
 ) THEN
   RAISE EXCEPTION 'V274: jurisdicción o rol activo inválido: revisar identidad institucional';
 END IF;
 -- No test-era new-book authorizations or unpublished seat events survive
 -- the launch. Signoffs themselves are intentionally retained as evidence.
 IF to_regclass('sacramentum_ledger.supplementary_concept_approvals_v272') IS NULL THEN
   RAISE EXCEPTION 'V273: infraestructura privada de autorizaciones V272 ausente';
 END IF;
 IF EXISTS(SELECT 1 FROM sacramentum_ledger.supplementary_concept_approvals_v272) THEN
   RAISE EXCEPTION 'V273: autorizaciones de conceptos de pruebas no pueden sobrevivir';
 END IF;
 -- All master hashes are recalculated AFTER the purge and before ACL flip.
 FOR t IN SELECT unnest(v_master_tables) LOOP
   IF NOT EXISTS (
     SELECT 1 FROM sacramentum_ledger.master_review_v273 r
     JOIN sacramentum_ledger.purge_receipts_v268 p ON p.id=true
     WHERE r.table_name=t
       AND r.expected_rows=(p.retained_counts->t->>'rows')::bigint
       AND r.expected_md5=p.retained_counts->t->>'hash'
       AND r.signed_at<=clock_timestamp()
   ) THEN
     RAISE EXCEPTION 'V273: falta doble revisión coincidente con respaldo para %',t;
   END IF;
   EXECUTE format(
     'SELECT count(*),md5(coalesce(string_agg((%s)::text,''|''
       ORDER BY (%s)::text),'''')) FROM public.%I v',
     CASE WHEN t='parishes' THEN 'to_jsonb(v)-''legacy_origin_id'''
       ELSE 'to_jsonb(v)' END,
     CASE WHEN t='parishes' THEN 'to_jsonb(v)-''legacy_origin_id'''
       ELSE 'to_jsonb(v)' END,
     t
   ) INTO cnt,v_index;
   IF NOT EXISTS(SELECT 1 FROM sacramentum_ledger.master_review_v273 r
      WHERE r.table_name=t AND r.expected_rows=cnt AND r.expected_md5=v_index) THEN
     RAISE EXCEPTION 'V273: tabla institucional modificada tras su aprobación %',t;
   END IF;
 END LOOP;
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
  'public.open_next_official_book_v270(uuid,text,uuid,bigint,uuid,text,integer,integer,integer,boolean,text)',
  'public.issue_new_supplementary_decree_v271(uuid,text,uuid,uuid,text,date,text,text,text)',
  'public.approve_new_supplementary_decree_v271(uuid,text)',
  'public.open_first_supplementary_book_v271(uuid,text,uuid,text,integer,integer,integer,boolean)',
  'public.approve_supplementary_concept_v272(uuid,text)',
  'public.open_next_supplementary_book_v272(uuid,text,uuid,bigint,uuid,text,integer,integer,integer,boolean,text)'
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
GRANT EXECUTE ON FUNCTION public.get_parish_ledger_seat_context_v264(uuid,text,jsonb)
 TO authenticated;
GRANT EXECUTE ON FUNCTION public.attest_new_celebration_v265(uuid,text,uuid,text)
 TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_first_official_book_v267(
 uuid,text,uuid,text,integer,integer,integer,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_next_official_book_v270(
 uuid,text,uuid,bigint,uuid,text,integer,integer,integer,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_new_supplementary_decree_v271(
 uuid,text,uuid,uuid,text,date,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_new_supplementary_decree_v271(
 uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_first_supplementary_book_v271(
 uuid,text,uuid,text,integer,integer,integer,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_supplementary_concept_v272(
 uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_next_supplementary_book_v272(
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
  'public.get_parish_ledger_seat_context_v264(uuid,text,jsonb)',
  'public.attest_new_celebration_v265(uuid,text,uuid,text)',
  'public.open_first_official_book_v267(uuid,text,uuid,text,integer,integer,integer,boolean)',
  'public.open_next_official_book_v270(uuid,text,uuid,bigint,uuid,text,integer,integer,integer,boolean,text)',
  'public.issue_new_supplementary_decree_v271(uuid,text,uuid,uuid,text,date,text,text,text)',
  'public.approve_new_supplementary_decree_v271(uuid,text)',
  'public.open_first_supplementary_book_v271(uuid,text,uuid,text,integer,integer,integer,boolean)',
  'public.approve_supplementary_concept_v272(uuid,text)',
  'public.open_next_supplementary_book_v272(uuid,text,uuid,bigint,uuid,text,integer,integer,integer,boolean,text)'
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
`;
fs.writeFileSync('scripts/staged-v267-fresh-zero-rpc-cutover.sql',sql);
console.log({zeros:zeros.length,masters:keep.length,sqlBytes:sql.length});
