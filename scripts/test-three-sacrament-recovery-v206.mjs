import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {assertV251RevisedSource} from './v251-reviewed-source-receipt.mjs';
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const report=JSON.parse(read('AUDITORIA_RECUPERACION_TRES_SACRAMENTOS_V206.json'));
const definitions=[...['bautismo','confirmacion'].flatMap(kind=>['individual-timeout','individual-lost-response','individual-read-failure','success-read-failure','batch-timeout','batch-lost-response','batch-read-failure','initial-read-error','batch-cancel'].map(scenario=>({kind,scenario}))),...['individual-timeout','individual-lost-response','individual-read-failure','success-read-failure','initial-read-error','double-across-records'].map(scenario=>({kind:'exequias',scenario}))];
for(const {kind,scenario} of definitions)test('V206 actual React '+kind+' '+scenario,()=>{
 const row=report.rows.find(r=>r.kind===kind&&r.scenario===scenario);
 assert.ok(row);assert.equal(row.passed,true,JSON.stringify(row.faults));assert.deepEqual(row.faults,[]);
 const end=row.final;assert.ok(end);assert.equal(new Set(end.reported).size,end.reported.length);assert.equal(end.next,end.reported.length+1);
 if(scenario==='initial-read-error'){assert.equal(end.calls.length,0);assert.equal(end.pending.length,3)}
 else if(scenario==='batch-cancel'){assert.equal(end.confirmCalls,2);assert.equal(end.calls.length,1);assert.equal(end.reported.length,3)}
 else if(scenario.startsWith('batch')&&scenario!=='batch-timeout'){assert.equal(end.calls.length,1);assert.equal(end.pending.length,0)}
 else if(scenario==='success-read-failure'){assert.equal(end.calls.length,1);assert.equal(end.pending.length,2)}
 else {assert.equal(end.calls.length,2);assert.equal(end.calls[1].ids[0],scenario.includes('timeout')?'qa-1':'qa-2')}
 if(scenario==='batch-timeout'){assert.equal(end.calls[0].expected,1);assert.equal(end.calls[1].expected,1);assert.equal(end.reported.length,3)}
 else if(scenario.includes('lost')&&kind!=='exequias'&&!scenario.startsWith('batch'))assert.equal(end.calls[1].expected,2);
});
test('V206 evidence matches all three current pages with no external requests or exceptions',()=>{
 assert.equal(report.total,24);assert.equal(report.passed,24);assert.deepEqual(report.exceptions,[]);assert.deepEqual(report.externalRequests,[]);
 assert.equal(Object.keys(report.sourceSha256).length,3);
 for(const [file,hash] of Object.entries(report.sourceSha256))assertV251RevisedSource({file,historicalSha256:hash,currentSha256:createHash('sha256').update(read(file)).digest('hex')});
 assert.match(report.scope,/no authenticated production E2E/);
});
test('V206 browser replay and assertions are mandatory in CI and local quality gate',()=>{
 const ci=read('.github/workflows/sacramentum-auditoria-v90.yml'),gate=read('scripts/audit-gate-v90.mjs');
 assert.ok(ci.includes('node scripts/audit-three-sacrament-recovery-browser-v206.mjs'));
 assert.ok(ci.includes('scripts/test-three-sacrament-recovery-v206.mjs'));
 assert.ok(gate.includes('scripts/test-three-sacrament-recovery-v206.mjs'));
});
