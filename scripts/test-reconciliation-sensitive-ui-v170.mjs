// V170: verify fail-closed rendering of institutional counters/errors,
// plus evidence captured by an independent isolated Chrome run.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const page=fs.readFileSync('src/pages/chancery/LaterNoteReconciliationPage.jsx','utf8');
const mocks=fs.readFileSync('scripts/qa-v160-browser/mocks.jsx','utf8');
const browser=fs.readFileSync('scripts/audit-reconciliation-sensitive-ui-browser-v170.mjs','utf8');
const qa=JSON.parse(fs.readFileSync('AUDITORIA_NAVEGADOR_CONTEOS_V170.json','utf8'));
test('V170 guards all four displayed counters against identity mismatch',()=>{
 assert.match(page,/const visibleTotals = dataCurrent \? totals : \{all:0,pending:0,authorized:0,executed:0,rejected:0\}/);
 for(const name of ['pending','authorized','executed','rejected'])
  assert.match(page,new RegExp('visibleTotals\\.'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\]'));
 const start=page.indexOf("['Pendientes de aprobación'");
 const end=page.indexOf('].map(([label,count])',start);
 assert.ok(start>=0&&end>start);
 assert.doesNotMatch(page.slice(start,end),/(?<!visible)totals\./);
});
test('V170 hides stale institution-specific error text before useEffect cleanup',()=>{
 assert.match(page,/const visibleError = scopeCurrent \? error : ''/);
 assert.match(page,/\{visibleError && <p role="alert"/);
 assert.doesNotMatch(page,/\{error && <p role="alert"/);
});
test('V170 restores missing isolated browser mock for V168 multi-note RPC',()=>{
 assert.match(mocks,/export const executeLaterNoteReconciliationBatch=async ids=>/);
 assert.match(mocks,/history\.push\(\{action:'executeBatch'/);
 assert.match(mocks,/SIN CONEXIÓN A SUPABASE/);
});
test('V170 browser suite measures identity changes, stale results and logout',()=>{
 for(const step of ['A_COUNTS_FULL','B_IMMEDIATE_FENCING','B_OWN_COUNTS',
  'A_DELAYED_REPLY_NO_LEAK','LOGOUT_FENCES_SENSITIVE_COUNTS','RETURN_A_RESTORES_CORRECT_COUNTS'])
  assert.ok(browser.includes(step),step);
});
test('V170 observed six passes in isolated Chrome with no runtime exceptions',()=>{
 assert.equal(qa.passed,true);
 assert.equal(qa.steps.length,6);
 assert.ok(qa.steps.every(x=>x.ok));
 assert.deepEqual(qa.exceptions,[]);
 assert.match(qa.scope,/no Supabase login/);
});
