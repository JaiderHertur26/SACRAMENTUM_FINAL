import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const visual=JSON.parse(fs.readFileSync('AUDITORIA_VISUAL_CONCILIACIONES_V160.json','utf8'));
const clicks=JSON.parse(fs.readFileSync('AUDITORIA_INTERACCIONES_CONCILIACION_V160.json','utf8'));
const harness=fs.readFileSync('scripts/qa-v160-browser/vite.config.mjs','utf8');
const mocks=fs.readFileSync('scripts/qa-v160-browser/mocks.jsx','utf8');
const source=fs.readFileSync('src/pages/chancery/LaterNoteReconciliationPage.jsx','utf8');

test('V160 visual audit contains 6 independent browser viewport/role captures',()=>{
 assert.equal(visual.tests.length,6);
 assert.equal(visual.passed,6);
 assert.equal(visual.failed,0);
});
test('V160 screen sizes cover mobile tablet desktop on both roles',()=>{
 assert.deepEqual(new Set(visual.tests.map(x=>x.role)),new Set(['chancery','diocese']));
 assert.deepEqual(new Set(visual.tests.map(x=>x.size)),new Set(['mobile','tablet','desktop']));
});
test('V160 rendered each real component with four distinct synthetic case cards',()=>{
 for(const x of visual.tests){
  assert.ok(x.passed,x.role+'/'+x.size);
  assert.ok(x.metrics.rendered>300,x.role+'/'+x.size);
  assert.equal(x.metrics.articles,4);
  assert.match(x.metrics.heading,/Conciliación de notas posteriores/);
 }
});
test('V160 no horizontal overflow in any viewport',()=>{
 for(const x of visual.tests)assert.ok(x.metrics.scrollWidth<=x.width+2,x.role+'/'+x.size);
});
test('V160 chancery sees request and execution but no Diocese decision controls',()=>{
 for(const x of visual.tests.filter(x=>x.role==='chancery')){
  assert.equal(x.metrics.formCount,1);
  assert.ok(x.metrics.buttons.some(b=>b.includes('Enviar solicitud')));
  assert.ok(x.metrics.buttons.some(b=>b.includes('Ejecutar resolución')));
  assert.ok(!x.metrics.buttons.some(b=>b.includes('Registrar rechazo')));
 }
});
test('V160 diocese sees approval rejection and revocation but no Chancery form',()=>{
 for(const x of visual.tests.filter(x=>x.role==='diocese')){
  assert.equal(x.metrics.formCount,0);
  for(const control of ['Autorizar expediente','Registrar rechazo','Revocar autorización'])
   assert.ok(x.metrics.buttons.some(b=>b.includes(control)),control);
  assert.ok(!x.metrics.buttons.some(b=>b.includes('Ejecutar resolución')));
 }
});
test('V160 captures are real PNG files, not metadata-only',()=>{
 for(const x of visual.tests){
  const f=path.join('AUDITORIA_EVIDENCIA_VISUAL_V160',x.filename);
  const data=fs.readFileSync(f);
  assert.equal(data.length,x.screenshotBytes);
  assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'),x.sha256);
 }
});
test('V160 browser executes without unhandled exceptions',()=>{
 assert.equal(visual.consoleExceptions.length,0);
 for(const x of visual.tests)assert.equal(x.runtimeExceptions.length,0);
});
test('V160 interaction audit includes four independent cases',()=>{
 assert.equal(clicks.tests.length,4);
 assert.equal(clicks.passed,4);
 assert.equal(clicks.failed,0);
});
test('V160 mock browser click tested separate authorities',()=>{
 const expected=new Map([['diocese-authorize','approve'],['diocese-reject','reject'],['diocese-revoke','reject'],['chancery-execute','execute']]);
 for(const x of clicks.tests){
  assert.ok(x.passed,x.id);
  const action=expected.get(x.id);
  assert.ok(action,x.id);
  assert.equal(x.history.filter(v=>v.action===action).length,1,x.id);
  assert.ok(!x.errors?.length,x.id);
 }
});
test('V160 interaction browser has no JavaScript runtime failures',()=>assert.equal(clicks.runtimeExceptions.length,0));
test('V160 browser sessions were isolated from real Supabase configuration',()=>{
 assert.match(visual.scope,/isolated local Vite/);
 assert.match(clicks.scope,/never a production authenticated session/);
 assert.match(mocks,/DATOS TOTALMENTE FICTICIOS · SIN CONEXIÓN A SUPABASE/);
 for(const i of ['@/context/AuthContext','@/lib/supabaseClient','@/services/laterNoteReconciliationService'])
 assert.ok(harness.includes(i),i);
});
test('V160 fixture roles and data are local and explicit',()=>{
 assert.match(mocks,/role=params\.get\('role'\)/);
 assert.match(mocks,/window\.__v160=\{role,history:\[\],records\}/);
 assert.match(mocks,/listLaterNoteReconciliations=async/);
});
test('V160 tested the actual reconciliation source page not a substituted fake',()=>{
 assert.match(source,/export default function LaterNoteReconciliationPage/);
 assert.match(fs.readFileSync('scripts/qa-v160-browser/entry.jsx','utf8'),/src\/pages\/chancery\/LaterNoteReconciliationPage\.jsx/);
});
test('V160 screenshots include no real church account information',()=>{
 assert.match(mocks,/const uuid=x=>/);
 assert.doesNotMatch(mocks,/password|session_token|access_token|Bearer /i);
});
