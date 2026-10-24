import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const visual=JSON.parse(read('AUDITORIA_VISUAL_PARTIDAS_V195.json'));
const xss=JSON.parse(read('AUDITORIA_XSS_PARTIDAS_V195.json'));
const source=read('scripts/qa-v195-print-visual/entry.jsx');
const runner=read('scripts/audit-print-visual-browser-v195.mjs');
const allKinds=['bautismo','confirmacion','matrimonio','exequias'];
const expectedKeys=new Set(allKinds.flatMap(kind=>['letter','mobile'].map(size=>kind+'/'+size)));

test('V195 las 8 capturas de plantillas React originales conservan coordenadas e identidad ficticia',()=>{
 assert.equal(visual.total,8);
 assert.equal(visual.passed,8);
 assert.deepEqual(new Set(visual.results.map(r=>r.type+'/'+r.size)),expectedKeys);
 for(const row of visual.results){
  assert.equal(row.passed,true);
  assert.equal(row.missing.length,0);
  assert.equal(row.legacyLeaks.length,0);
  assert.ok(row.renderedChars>600);
  assert.match(row.sha256,/^[0-9a-f]{64}$/);
  assert.ok(row.screenshotBytes>25000);
 }
});
test('V195 los 8 ataques HTML no crean DOM ejecutable, ni alteran los documentos',()=>{
 assert.equal(xss.total,8);
 assert.equal(xss.passed,8);
 assert.deepEqual(new Set(xss.results.map(r=>r.type+'/'+r.size)),expectedKeys);
 for(const row of xss.results){
  assert.equal(row.passed,true);
  assert.equal(row.attack,true);
  assert.equal(row.injectedNodes,0);
  assert.equal(row.scriptExecuted,false);
  assert.equal(row.exceptionDelta,0);
 }
});
test('V195 renderiza las cuatro plantillas reales con fuentes históricas contradictorias',()=>{
 for(const s of ['BaptismPrintTemplate','ConfirmationPrintTemplate','MatrimonioPrintTemplate','buildFuneralPartidaHtml'])assert.ok(source.includes(s));
 assert.ok(source.includes('book_number:\'9999\''));
 assert.ok(source.includes('book_number:\'31\''));
 assert.ok(source.includes('numero:\'9997\''));
 assert.match(source,/attack\?injection/);
});
test('V195 QA de navegador se mantiene aislada de la sesión, no pretende certificar impresión física',()=>{
 assert.match(runner,/Chrome CDP/);
 assert.match(runner,/ficticios/);
 assert.match(runner,/authenticated UI session/);
 assert.doesNotMatch(source,/supabase\.rpc\(|supabase\.auth\./);
 assert.equal(visual.exceptions.length,0);
 assert.equal(xss.exceptions.length,0);
});
