import fs from 'node:fs';
import assert from 'node:assert/strict';
const m=JSON.parse(fs.readFileSync('AUDITORIA_MATRIZ_RESET_V267_2026-10-28.json','utf8'));
const d=JSON.parse(fs.readFileSync('AUDITORIA_DEPENDENCIAS_RESET_V268_2026-10-28.json','utf8'));
assert.equal(m.publicTableCount,82);
assert.equal(m.preserve.length,26);
assert.equal(m.zeroRequired.length,56);
assert.equal(d.transactionalTruncate.length,54);
assert.deepEqual(d.transactionalDelete.sort(),['legacy_source_installations','legacy_source_origins']);
const names=[...m.zeroRequired,...m.preserve].sort();
const arr=a=>'ARRAY['+a.map(t=>"'"+t+"'").join(',')+']::text[]';
const q=t=>'public."'+t+'"';
const sql=String.raw`-- SACRAMENTUM V268 / STAGED CLEAR TEST DATA: IRREVERSIBLE WITHOUT VERIFIED BACKUP.
-- DO NOT APPLY TO CURRENT SUPABASE. Must be part of a supervised maintenance window.
-- Operator MUST produce and restore-test an encrypted, independently stored
-- full DB backup and authorize exactly this content-free transaction.
-- This script is NOT a general-purpose delete endpoint; postgres migration only.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='240s';
SELECT pg_advisory_xact_lock(hashtextextended('SACRAMENTUM_V268_TEST_CLEANSE_ONLY',268));
LOCK TABLE ${names.map(q).join(',')} IN SHARE ROW EXCLUSIVE MODE;
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
 v_zero text[]:=${arr(m.zeroRequired)};
 v_preserved text[]:=${arr(m.preserve)};
 v_truncate text[]:=${arr(d.transactionalTruncate)};
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
TRUNCATE TABLE ${d.transactionalTruncate.map(q).join(',')} RESTRICT;
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
`;
fs.writeFileSync('scripts/staged-v268-transactional-test-purge.sql',sql);
console.log(JSON.stringify({transactional:56,truncate:d.transactionalTruncate.length,delete:d.transactionalDelete.length,master:26,length:sql.length}));
