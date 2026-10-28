import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(f,'utf8');
const manifest=JSON.parse(read('AUDITORIA_MATRIZ_RESET_V267_2026-10-28.json'));
const d=JSON.parse(read('AUDITORIA_DEPENDENCIAS_RESET_V268_2026-10-28.json'));
const snapshot=JSON.parse(read('AUDITORIA_FOTO_COMPLETA_RESET_V267_2026-10-28.json'));
test('V268 live snapshot: 56 transactions, 26 masters and one exceptional FK to a test origin',()=>{
 assert.equal(manifest.zeroRequired.length,56);
 assert.equal(manifest.preserve.length,26);
 assert.equal(d.transactionalTruncate.length,54);
 assert.deepEqual([...d.transactionalDelete].sort(),['legacy_source_installations','legacy_source_origins']);
 assert.equal(d.preservedReferencingToBeRemoved.length,1);
 assert.equal(d.preservedReferencingToBeRemoved[0].child_table,'parishes');
 assert.equal(d.preservedReferencingToBeRemoved[0].parent_table,'legacy_source_origins');
 assert.equal(snapshot.rows.reduce((a,x)=>a+x.records,0),89714);
 assert.ok(d.nonPublic.some(x=>x.parent_schema==='auth'&&x.child_table==='user_profiles'));
});
test('V268 no CASCADE, no real-data endpoint, atomic 56-table clearing only under verified backup',()=>{
 const s=read('scripts/staged-v268-transactional-test-purge.sql');
 for(const phrase of [
  'BEGIN;','COMMIT;','SHARE ROW EXCLUSIVE','TRUNCATE TABLE',
  'RESTRICT;','DELETE FROM public.legacy_source_origins;',
  'DELETE FROM public.legacy_source_installations;',
  'UPDATE public.parishes SET legacy_origin_id=NULL',
  'sacramentum.v268.backup_sha256','sacramentum.v268.restore_verified',
  'sacramentum.v268.authorization_ticket','current_user NOT IN',
  'master','pg_temp.v268_baseline',
  'to_jsonb(v)','content_digest','IF v_count<>0',
  'storage.objects','unapproved institutional FK',
  'purge_receipts_v268','parishes_test_origin_refs_removed'
 ]) assert.ok(s.includes(phrase),phrase);
 assert.equal((s.match(/TRUNCATE TABLE/g)||[]).length,1);
 assert.doesNotMatch(s,/\bTRUNCATE TABLE[\s\S]*?\bCASCADE\b/);
 assert.doesNotMatch(s,/DISABLE TRIGGER|SET session_replication_role|DROP CONSTRAINT/);
 for(const x of manifest.zeroRequired)assert.ok(s.includes("'"+x+"'"),x);
});
test('V268 aborts on unknown public schema or preserve-to-zero FKs and protects log of reset',()=>{
 const s=read('scripts/staged-v268-transactional-test-purge.sql');
 assert.match(s,/unclassified public table/);
 assert.match(s,/unexpected FK references block safe TRUNCATE/);
 assert.match(s,/unapproved institutional FK points to test data/);
 assert.match(s,/IF EXISTS\(SELECT 1 FROM sacramentum_ledger.purge_receipts_v268\)/);
 assert.match(s,/ALTER TABLE sacramentum_ledger.purge_receipts_v268 ENABLE ROW LEVEL SECURITY/);
 assert.match(s,/REVOKE ALL ON sacramentum_ledger.purge_receipts_v268/);
});
test('V268 CI drills actual PostgreSQL dump+restore, bad backup, FK drift, storage and a second purge',()=>{
 const ci=read('scripts/ci-verified-test-purge-v268.sh');
 for(const s of [
  'PG_CONTAINER','pg_dump -U postgres -Fc',
  'pg_restore -U postgres','sha256sum',
  'should_fail apply','storage.objects','unclassified_v268',
  'parishes_legacy_origin_id_fkey','Unexpected',
  'parishes_test_origin_refs_removed','discarded_rows',
  'auth.users','V268 PG16 PASS',
 ])assert.ok(ci.toLowerCase().includes(s.toLowerCase()),s);
 assert.ok(read('.github/workflows/sacramentum-auditoria-v90.yml')
   .includes('bash scripts/ci-verified-test-purge-v268.sh'));
 assert.ok(read('scripts/audit-gate-v90.mjs')
   .includes('scripts/test-verified-reset-v268.mjs'));
});
