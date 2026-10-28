import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=x=>fs.readFileSync(x,'utf8');
const inventory=JSON.parse(read('AUDITORIA_LIBROS_HISTORICOS_V266_2026-10-28.json'));
const irregular=r=>r.internal_gaps>0||r.transitions>0||r.skipped_folios>0;
test('V266 live forensic inventory pins 8393 old records in exactly 22 scopes without PII',()=>{
 assert.equal(inventory.scopes,22);
 assert.equal(inventory.records,8393);
 assert.equal(inventory.rows.length,22);
 assert.equal(inventory.rows.reduce((t,r)=>t+r.records,0),8393);
 assert.equal(inventory.rows.filter(irregular).length,11);
 assert.equal(inventory.rows.filter(r=>r.folios_over_two>0).length,6);
 assert.equal(inventory.rows.reduce((t,r)=>t+r.duplicate_positions,0),0);
 for(const row of inventory.rows){
  assert.match(row.parish_key,/^[0-9a-f]{9}$/);
  assert.match(row.digest,/^[0-9a-f]{32}$/);
  assert.ok(row.last_three.every(x=>Number.isInteger(x.folio)&&Number.isInteger(x.number)));
  assert.equal(row.last_three.length,Math.min(row.records,3));
  assert.equal(Object.prototype.hasOwnProperty.call(row,'parish_id'),false);
  assert.equal(Object.prototype.hasOwnProperty.call(row,'person_name'),false);
 }
});
test('V266 scope inventory uses only SELECT across original four sacrament tables',()=>{
 const q=read('scripts/read-only-v266-scope-inventory.sql');
 for(const t of ['public.baptisms','public.confirmations','public.marriages','public.funerals'])assert.ok(q.includes(t));
 assert.match(q,/md5\(string_agg/);
 assert.match(q,/count\(\*\)-count\(DISTINCT\(fol,num\)\)/);
 assert.doesNotMatch(q,/\b(UPDATE|DELETE|INSERT|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/i);
});
test('V266 requires independent parish and diocese/chancery review, never auto-certifies clean digital sequences',()=>{
 const s=read('scripts/staged-v266-two-signature-physical-review.sql');
 for(const token of [
  'physical_reviews_v266','scope_snapshot_v266','review_physical_book_v266',
  "p_action NOT IN('submit','approve')",
  "p_action='submit' AND lower(up.role)='parish'",
  "p_action='approve' AND lower(up.role) IN('chancery','diocese')",
  'snapshot_digest<>v_snapshot','submitted_by=v_actor',
  'source_reference<>btrim(p_source_reference)','review_note<>btrim(p_review_note)',
  'legacy_reconciled)','INSERT INTO public.registry_audit_log',
  'reconciliation_proposed','reconciliation_approved',
  'FOR UPDATE','pg_advisory_xact_lock','REVOKE ALL ON FUNCTION public.review_physical_book_v266',
  'FROM PUBLIC,anon,authenticated'
 ])assert.ok(s.includes(token),'Missing double control: '+token);
 assert.doesNotMatch(s,/GRANT EXECUTE ON FUNCTION public\.review_physical_book_v266/);
 assert.match(s,/IF p_next_folio<\(v_snapshot->>'lastFolio'\)::integer/);
});
test('V266 fixture tests both signatures and stale physical source after signature',()=>{
 const sh=read('scripts/ci-two-signature-physical-review-v266.sh');
 for(const needle of [
  'PG_CONTAINER','staged-v266-two-signature-physical-review.sql',
  'admin_general cannot propose','chancery cannot propose',
  'parish cannot approve its own proposal','stale physical snapshot rejected',
  'different physical coordinates rejected','different documentation rejected',
  'forced audit rollback','V266 PG16 PASS',
 ])assert.ok(sh.includes(needle),'Missing fixture: '+needle);
 const workflow=read('.github/workflows/sacramentum-auditoria-v90.yml');
 const gate=read('scripts/audit-gate-v90.mjs');
 assert.match(workflow,/bash scripts\/ci-two-signature-physical-review-v266\.sh/);
 assert.match(gate,/scripts\/test-physical-reconciliation-v266\.mjs/);
});
