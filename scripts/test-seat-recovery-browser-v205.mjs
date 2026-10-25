import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const result=JSON.parse(read('AUDITORIA_RECUPERACION_UI_V205.json'));
const names=['individual-reject','individual-lost-response','individual-read-failure','batch-partial','batch-lost-response','batch-read-failure','initial-read-error','batch-cancel'];
for(const scenario of names)test('V205 actual React recovery: '+scenario,()=>{
 const row=result.rows.find(r=>r.scenario===scenario);
 assert.ok(row,'missing scenario');assert.equal(row.passed,true,JSON.stringify(row.faults));
 assert.deepEqual(row.faults,[]);
 const end=row.final;assert.ok(end);
 assert.equal(new Set(end.reported).size,end.reported.length);
 assert.equal(end.next,end.reported.length+1);
 if(scenario==='initial-read-error'){assert.deepEqual(end.calls,[]);assert.equal(end.pending.length,3)}
 else if(scenario==='batch-cancel'){assert.equal(end.confirmCalls,2);assert.deepEqual(end.calls,['qa-1','qa-2','qa-3'])}
 else if(scenario==='batch-partial')assert.deepEqual(end.calls,['qa-1','qa-2','qa-2','qa-3']);
 else if(scenario.startsWith('batch'))assert.deepEqual(end.calls,['qa-1','qa-2','qa-3']);
 else if(scenario==='individual-reject')assert.deepEqual(end.calls,['qa-1','qa-1']);
 else assert.deepEqual(end.calls,['qa-1','qa-2']);
});
test('V205 browser evidence belongs to the current React source and stays isolated',()=>{
 assert.equal(result.total,8);assert.equal(result.passed,8);
 assert.deepEqual(result.exceptions,[]);assert.deepEqual(result.externalRequests,[]);
 assert.equal(result.sourceSha256,createHash('sha256').update(read('src/pages/parish/MatrimonioSentarRegistrosPage.jsx')).digest('hex'));
 assert.match(result.scope,/no authenticated production E2E/);
});
test('V205 regression test and live browser replay are mandatory in CI',()=>{
 const gate=read('scripts/audit-gate-v90.mjs'),ci=read('.github/workflows/sacramentum-auditoria-v90.yml');
 assert.ok(gate.includes('scripts/test-seat-recovery-browser-v205.mjs'));
 assert.ok(ci.includes('node scripts/audit-seat-recovery-browser-v205.mjs'));
 const gateFiles=[...gate.slice(gate.indexOf("exec('pruebas-sinteticas'"),gate.indexOf('const scripts=')).matchAll(/'([^']*test-[^']+\.mjs)'/g)].map(m=>m[1]);
 assert.ok(gateFiles.length>90);
 for(const name of gateFiles)assert.ok(ci.includes(name),'CI lost regression '+name);
});
