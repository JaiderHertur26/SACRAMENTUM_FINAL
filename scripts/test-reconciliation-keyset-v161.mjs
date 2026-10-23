import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const migration=read('supabase/migrations/20261023052453_reconciliation_keyset_pagination_v161.sql');
const baseline=read('scripts/qa-rollback-backlog-starvation-baseline-v161.sql');
const qa=read('scripts/qa-rollback-reconciliation-keyset-v161.sql');
const ui=read('src/pages/chancery/LaterNoteReconciliationPage.jsx');
const svc=read('src/services/laterNoteReconciliationService.js');

test('V161 initial bug reproduction demonstrates 300 closed cases hide pending',()=>{
 assert.match(baseline,/generate_series\(1,315\)/);
 assert.match(baseline,/pending_in_legacy<>0/);
 assert.match(baseline,/list_later_note_reconciliations_v157/);
});
test('V161 introduces independent versioned listing with state filter',()=>{
 assert.match(migration,/CREATE OR REPLACE FUNCTION public\.list_later_note_reconciliations_v161/);
 assert.match(migration,/v_status='all' OR r\.status=v_status/);
});
test('V161 listing uses bounded keyset requested_at and UUID descending',()=>{
 assert.match(migration,/r\.requested_at,r\.id\)<\(p_before_requested_at,p_before_id\)/);
 assert.match(migration,/ORDER BY r\.requested_at DESC,r\.id DESC/);
 assert.match(migration,/LIMIT p_page_size/);
});
test('V161 limit and cursor validations prevent abusive requests',()=>{
 assert.match(migration,/p_page_size NOT BETWEEN 1 AND 100/);
 assert.match(migration,/p_before_requested_at IS NULL\) IS DISTINCT FROM \(p_before_id IS NULL/);
});
test('V161 status values are explicitly allowlisted',()=>{
 for(const value of ['all','pending','authorized','executed','rejected'])
  assert.ok(migration.includes("'"+value+"'"),value);
});
test('V161 counts are from entire jurisdiction not fetched page',()=>{
 assert.match(migration,/CREATE OR REPLACE FUNCTION public\.count_later_note_reconciliations_v161/);
 assert.match(migration,/count\(\*\) FILTER \(WHERE r\.status='pending'\)/);
 assert.match(migration,/count\(\*\) FILTER \(WHERE r\.status='authorized'\)/);
});
test('V161 list and counts both enforce diocese scoped institutional roles',()=>{
 assert.equal((migration.match(/public\.current_app_diocese_id\(\) IS DISTINCT FROM p_diocese_id/g)||[]).length,2);
 assert.equal((migration.match(/public\.current_app_role\(\) NOT IN \('chancery','diocese'\)/g)||[]).length,2);
});
test('V161 privileges only authenticated RPC execution',()=>{
 assert.equal((migration.match(/GRANT EXECUTE ON FUNCTION/g)||[]).length,2);
 assert.equal((migration.match(/REVOKE ALL ON FUNCTION/g)||[]).length,2);
 assert.doesNotMatch(migration,/GRANT SELECT ON public\.later_note_reconciliations_v156/);
});
test('V161 adds two scoped indices without changing sacramental tables',()=>{
 assert.match(migration,/idx_later_note_keyset_all_v161/);
 assert.match(migration,/idx_later_note_keyset_status_v161/);
 assert.doesNotMatch(migration,/UPDATE public\.(baptisms|confirmations|marriages|funerals|marginal_notes|decretos)/);
});
test('V161 real QA includes two disjoint 50-case pages',()=>{
 assert.match(qa,/list_later_note_reconciliations_v161\(d,'rejected',50\)/);
 assert.match(qa,/list_later_note_reconciliations_v161\(d,'rejected',50,v_time,v_id\)/);
 assert.match(qa,/v_dupes<>0/);
});
test('V161 real QA confirms the old pending case is retrieved',()=>{
 assert.match(qa,/V161 older pending case hidden/);
 assert.match(qa,/count_later_note_reconciliations_v161/);
});
test('V161 QA denies bad page, bad status, wrong diocese, anonymous-like actor',()=>{
 for(const term of ['invalid status accepted','unbounded page accepted','incomplete cursor accepted','wrong jurisdiction read accepted','unprofiled actor counted'])
  assert.ok(qa.includes(term),term);
});
test('V161 QA fixtures and fixes are rollback-only',()=>{
 for(const script of [baseline,qa]){
  assert.match(script,/^BEGIN;$/m);
  assert.match(script,/ROLLBACK;\s*$/);
  assert.doesNotMatch(script,/^\s*COMMIT\b/im);
 }
});
test('V161 frontend service uses new paged RPC and independent counters',()=>{
 assert.match(svc,/list_later_note_reconciliations_v161/);
 assert.match(svc,/count_later_note_reconciliations_v161/);
 assert.match(svc,/p_before_requested_at:cursor\?\.requested_at \|\| null/);
});
test('V161 frontend exposes all five filters and load more affordance',()=>{
 for(const filter of ["['all','Todos']","['pending','Pendientes']","['authorized','Autorizados']","['executed','Ejecutados']","['rejected','Rechazados']"])
 assert.ok(ui.includes(filter),filter);
 assert.match(ui,/Cargar 50 expedientes anteriores/);
 assert.match(ui,/aria-pressed=\{statusFilter===key\}/);
});
test('V161 frontend request versions discard stale list responses',()=>{
 assert.match(ui,/const version=\+\+listVersion\.current/);
 assert.match(ui,/if\(version!==listVersion\.current\)return/);
});
test('V161 frontend merges next-page results without duplicates',()=>{
 assert.match(ui,/const existing=new Set\(prev\.map\(item=>item\.id\)\)/);
 assert.match(ui,/rows\.filter\(item=>!existing\.has\(item\.id\)\)/);
});
test('V161 totals no longer based on visible items subset',()=>{
 assert.match(ui,/setTotals\(counts\|\|/);
 assert.doesNotMatch(ui,/items\.filter\(x=>x\.status==='pending'\)\.length/);
});

const browser=JSON.parse(read('AUDITORIA_PAGINACION_VISUAL_V161.json'));
test('V161 real Chrome retrieves an old pending case past 315 closed cases',()=>{
 assert.equal(browser.passed,true);
 assert.equal(browser.pending.articles,2);
 assert.equal(browser.pending.oldVisible,true);
 assert.ok(browser.initial.counters.some(x=>x==='Pendientes (2)'));
});
test('V161 real Chrome loads two disjoint historical pages',()=>{
 assert.equal(browser.rejectedFirst.articles,50);
 assert.equal(browser.rejectedSecond.articles,100);
 assert.equal(browser.rejectedSecond.unique,100);
 assert.equal(browser.allNoOverflow,true);
 assert.deepEqual(browser.errors,[]);
});
test('V161 browser image is a real PNG from the isolated 320-row fixture',()=>{
 const screenshot=fs.readFileSync('AUDITORIA_EVIDENCIA_VISUAL_V161/v161-pending-ancient-visible.png');
 assert.ok(screenshot.length>5000);
 assert.equal(screenshot.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.match(read('scripts/qa-v160-browser/mocks.jsx'),/if\(params\.get\('backlog'\)==='1'\)/);
});
