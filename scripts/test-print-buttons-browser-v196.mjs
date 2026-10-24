import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=file=>fs.readFileSync(file,'utf8');
const report=JSON.parse(read('AUDITORIA_BOTONES_IMPRESION_V196.json'));
const browser=read('scripts/audit-print-buttons-browser-v196.mjs');
const fixture=read('scripts/qa-v196-print-buttons/entry.jsx');
test('V196 four actual UI click paths complete audit-first flow in Chrome',()=>{
 assert.equal(report.total,4);
 assert.equal(report.passed,4);
 assert.deepEqual(new Set(report.rows.map(x=>x.kind)),new Set(['bautismo','confirmacion','matrimonio','exequias']));
 assert.equal(report.exceptions.length,0);
});
test('V196 failed server audit blocks all four print actions with a toast',()=>{
 for(const x of report.rows){
  assert.equal(x.passed,true);
  assert.equal(x.denied.calls,1);
  assert.equal(x.denied.printed,0);
  assert.equal(x.denied.toasts,1);
  if(x.kind==='exequias')assert.equal(x.denied.popupClosed,1);
 }
});
test('V196 print document uses canonical coordinates and invokes correct browser mechanism',()=>{
 for(const x of report.rows){
  assert.equal(x.allowed.calls,2);
  assert.equal(x.allowed.hasHtml,true);
  assert.deepEqual([x.allowed.book,x.allowed.folio,x.allowed.number],['31','442','888']);
  assert.ok(x.allowed.htmlLength>700);
  if(x.kind==='exequias')assert.ok(x.allowed.popups>=1);
  else assert.equal(x.allowed.printed,1);
 }
});
test('V196 runner mocks all services, never authenticates or mutates production',()=>{
 assert.match(browser,/NO authenticated Supabase session/);
 assert.match(browser,/fake data\/services/);
 assert.match(fixture,/FICTICIA V196/);
 assert.doesNotMatch(fixture,/supabase\.auth|supabase\.rpc|service_role/i);
 assert.ok(read('scripts/qa-v196-print-buttons/mockNotes.js').includes('QA V196 rechazo simulado'));
});
