import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const get=f=>fs.readFileSync(f,'utf8');
const report=JSON.parse(get('AUDITORIA_REACT_BROWSER_NULIDAD_V131.json'));
const config=get('scripts/qa-v131/vite.config.mjs');
const browser=get('scripts/qa-v131/audit-browser-nullity-v131.mjs');
const entry=get('scripts/qa-v131/entry.jsx');
const panel=get('src/components/chancery/NullityInstitutionalPreflightPanel.jsx');
const mocks=get('scripts/qa-v131/mock-supabase.js');
test('V131 el laboratorio usa el componente React real de la aplicación',()=>{
 assert.match(entry,/NullityInstitutionalPreflightPanel from '\.\.\/\.\.\/src\/components\/chancery\/NullityInstitutionalPreflightPanel.jsx'/);
 assert.match(entry,/src\/index.css/);
 assert.match(config,/host:'127\.0\.0\.1'/);
 assert.match(config,/mock-auth\.jsx/);
 assert.match(config,/mock-supabase\.js/);
});
test('V131 pruebas CDP verificables: 6 vistas y 2 acciones',()=>{
 assert.equal(report.total,8);
 assert.equal(report.passed,8);
 assert.equal(report.failed,0);
 assert.equal(report.tests.length,8);
});
test('V131 permite dos roles, bloquea los otros dos y no desborda dispositivos',()=>{
 for(const name of ['chancery-desktop','chancery-mobile','diocese-desktop','diocese-mobile']){
  const t=report.tests.find(x=>x.test===name);
  assert.ok(t?.pass&&t.rendered&&t.noOverflow&&t.noErrors,name);
  assert.equal(t.externalRequests,0);
  assert.match(t.sha256,/^[a-f0-9]{64}$/);
 }
 for(const name of ['parish-desktop','admin_general-desktop']){
  const t=report.tests.find(x=>x.test===name);
  assert.ok(t?.pass&&!t.rendered&&t.noOverflow&&t.noErrors,name);
 }
});
test('V131 bloquea documentos diferentes y exige archivo coincidente antes de revisión',()=>{
 const t=report.tests.find(x=>x.test==='diocesan-review-click');
 assert.ok(t?.pass);
 assert.equal(t.detail.disabledBefore,true);
 assert.equal(t.detail.rejectedWrong,true);
 assert.equal(t.detail.matches,true);
 assert.equal(t.detail.calls,1);
 assert.match(browser,/DataTransfer/);
 assert.match(panel,/Cotejar copia del documento judicial antes de autorizar/);
});
test('V131 no ejecuta ningún decreto sin acción de Cancillería',()=>{
 const t=report.tests.find(x=>x.test==='chancery-execute-authorized-click');
 assert.ok(t?.pass);
 assert.equal(t.detail.count,1);
 assert.equal(t.detail.executed,true);
 assert.match(browser,/before.count===0/);
});
test('V131 navegador no utiliza llamadas reales a Supabase durante el laboratorio',()=>{
 assert.match(browser,/external\.length===0/);
 assert.doesNotMatch(mocks,/fetch\(|createClient|signInWithPassword|service_role/);
 assert.match(report.mode,/sin ninguna credencial/);
});
test('V132 interfaz coteja SHA y envía huella requerida al RPC seguro',()=>{
 assert.match(panel,/verifiedDocumentHash:decision==='authorize'\?reviewedDocuments\[row.id\]\?\.digest:null/);
 assert.match(get('src/services/nullityInstitutionalPreflightService.js'),/p_verified_sha256:/);
 assert.match(get('supabase/migrations/20261022153516_require_verified_document_hash_for_nullity_v132.sql'),/p_verified_sha256 text/);
});
