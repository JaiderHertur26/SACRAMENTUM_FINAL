import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const manifest=JSON.parse(read('AUDITORIA_MATRIZ_RESET_V267_2026-10-28.json'));
const review=read('scripts/staged-v273-institutional-master-review.sql');
const cutover=read('scripts/staged-v267-fresh-zero-rpc-cutover.sql');
const fixture=read('scripts/ci-fresh-official-start-v267.sh');
test('V273 26 reviewed institutional masters must be separately attested; never auto-authorized on live',()=>{
 assert.equal(manifest.preserve.length,26);
 assert.match(review,/CREATE TABLE sacramentum_ledger\.master_review_v273/);
 assert.match(review,/ck_v273_two_distinct_signers/);
 assert.match(review,/approved_by/);
 assert.match(review,/approval_reference/);
 assert.match(review,/ENABLE ROW LEVEL SECURITY/);
 assert.match(review,/REVOKE ALL/);
 assert.doesNotMatch(review,/INSERT INTO.*master_review/);
 const reader=read('scripts/read-only-v273-institutional-master-inventory.sql');
 for(const name of manifest.preserve) assert.ok(reader.includes('public."'+name+'"'),name);
 assert.doesNotMatch(reader,/\b(DELETE|UPDATE|TRUNCATE|INSERT|ALTER)\s+(FROM|INTO|TABLE|public\.)/i);
});
test('V273 zero-cutover locks ALL 82 tables and checks independently signed hashes against backed-up V268 receipt',()=>{
 const lock=cutover.match(/LOCK TABLE ([^;]+) IN SHARE ROW EXCLUSIVE MODE;/);
 assert.ok(lock,'V267 public locks');
 assert.equal((lock[1].match(/public\."[^"]+"/g)||[]).length,82);
 for(const s of [
  "master_review_v273","purge_receipts_v268","r.expected_md5=p.retained_counts",
  "r.expected_rows=(p.retained_counts",
  "r.expected_rows=cnt AND r.expected_md5=v_index",
  "tabla institucional modificada tras su aprobación",
  "deben revisarse exactamente las 26 tablas",
  "auth.users","usuarios ACTIVOS sin cuenta autenticada",
  "supplementary_concept_approvals_v272",
  "autorizaciones de conceptos de pruebas no pueden sobrevivir"
 ])assert.ok(cutover.includes(s),s);
});
test('V273 disposable PG16 cuts over ONLY after exact reviews; blocks missing auth, drift and unknown master',()=>{
 for(const s of [
  "no 26-table institutional review",
  "26 approvals not yet established",
  "auth.users prerequisite absent",
  "an ACTIVE user without an actual auth identity",
  "institutional master changed after verification",
  "fixture-master-review-v273.mjs",
  "staged-v273-institutional-master-review.sql"
 ])assert.ok(fixture.includes(s),s);
 const seed=read('scripts/fixture-master-review-v273.mjs');
 assert.ok(seed.includes('QA_REVIEWER_A'));
 assert.ok(seed.includes('QA_APPROVER_B'));
 assert.ok(seed.includes('FIXTURE-APPROVAL-NOT-OFFICIAL'));
 assert.ok(read('.github/workflows/sacramentum-auditoria-v90.yml')
  .includes('test-institutional-review-v273.mjs'));
});
