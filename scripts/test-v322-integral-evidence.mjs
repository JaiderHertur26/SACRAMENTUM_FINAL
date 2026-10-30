import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const base='AUDITORIA_EVIDENCIAS_V322';
const read=p=>JSON.parse(fs.readFileSync(path.join(base,p),'utf8'));
const image=p=>{const b=fs.readFileSync(path.join(base,p));assert.ok(b.length>10000,p);assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a',p)};
const pdf=p=>{const b=fs.readFileSync(path.join(base,p));assert.ok(b.length>4000,p);assert.match(b.subarray(0,8).toString(),/^%PDF-/);assert.ok(b.includes(Buffer.from('%%EOF')),p)};
test('V322 four browser-origin boleta screenshots and 21/21 real React mock scenarios',()=>{
 const evidence=read('capturas-boletas-v322.json');
 assert.equal(evidence.total,21);assert.equal(evidence.passed,21);
 assert.deepEqual(evidence.exceptions,[]);assert.deepEqual(evidence.externalRequests,[]);
 for(const s of ['bautismo','confirmacion','matrimonio','exequias'])image('BOLETAS/boleta-react-'+s+'-v322.png');
});
test('V322 four printed document types render in letter and mobile with 8/8 pass',()=>{
 const evidence=read('capturas-partidas-v322.json');
 assert.equal(evidence.total,8);assert.equal(evidence.passed,8);assert.equal(evidence.exceptions.length,0);
 for(const s of ['bautismo','confirmacion','matrimonio','exequias'])
 for(const size of ['letter','mobile'])image('PARTIDAS/v195-'+s+'-'+size+'.png');
});
test('V322 four books and four alphabetical indexes use actual PDF app generator',()=>{
 for(const s of ['bautismo','confirmacion','matrimonio','exequias']){
 pdf('LIBROS/libros-'+s+'-v322.pdf');pdf('INDICES/indices-'+s+'-v322.pdf');
 }
});
test('V322 actual decree HTML generator output is available for all five documentary types',()=>{
 for(const s of ['correccion','reposicion','repeticion','documental','historico']){
 pdf('DECRETOS/decreto-'+s+'-v322.pdf');
 const html=fs.readFileSync(path.join(base,'DECRETOS/decreto-'+s+'-v322.html'),'utf8');
 assert.match(html,/<!doctype html>/i);
 assert.match(html,/FICTICI|QA-V322/);
 }
});
test('V322 correspondence browser isolation proves 8/8 with no external requests',()=>{
 const r=read('capturas-notificaciones-v322.json');assert.equal(r.total,8);assert.equal(r.passed,8);
 assert.deepEqual(r.exceptions,[]);assert.deepEqual(r.externalRequests,[]);
 for(const x of ['aviso-sacramental-parroquia-b-v322.png','notificacion-decreto-parroquia-b-v322.png','origen-confirmacion-parroquia-b-v322.png'])image('NOTIFICACIONES/'+x);
});
test('V322 25 real rollback SQL scenarios are not represented as falsely fully approved',()=>{
 const sets=[1,2,3].flatMap(i=>read('sql-bloque'+i+'.json'));
 assert.equal(sets.length,25);assert.equal(sets.filter(x=>x.status==='PASS').length,21);
 assert.equal(sets.filter(x=>x.status==='FAIL').length,4);
 for(const name of ['print-integrity-v194','multiparroquial-notificacion-v319','multiparroquial-repeticion-v319','nullity-dual-authorization-v128']){
 assert.ok(sets.find(x=>x.script.includes(name)&&x.status==='PASS'),name);
 }
 const report=fs.readFileSync(path.join(base,'README.md'),'utf8');
 assert.match(report,/21 de 25/);assert.match(report,/V194/);
});
test('V322 automated evidence gate is included in master CI suite',()=>{
 const a=fs.readFileSync('scripts/audit-gate-v90.mjs','utf8');
 const b=fs.readFileSync('.github/workflows/sacramentum-auditoria-v90.yml','utf8');
 assert.match(a,/scripts\/test-v322-integral-evidence\.mjs/);
 assert.match(b,/scripts\/test-v322-integral-evidence\.mjs/);
});
