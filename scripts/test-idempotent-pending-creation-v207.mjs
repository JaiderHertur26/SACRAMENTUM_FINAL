import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {assertV251RevisedSource} from './v251-reviewed-source-receipt.mjs';
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const source=read('src/services/pendingCreationService.js').replace(/^import .*;\n/gm,'');
const lib=await import('data:text/javascript;base64,'+Buffer.from("const supabase={};const generateUUID=()=>crypto.randomUUID();\n"+source).toString('base64'));
const requestId='00000000-0000-4000-a000-000000000207';
for(const kind of ['bautismo','confirmacion','matrimonio','exequias'])test('V207 service routes '+kind+' through the same durable receipt RPC',async()=>{
 let captured;const client={rpc:async(name,args)=>{captured={name,args};return {data:{pending_id:'id'},error:null}}};
 const result=await lib.createPendingRegistrationWithClient(client,{kind,parishId:'parish',record:{nombres:'QA'},requestId});
 assert.equal(captured.name,'create_pending_registration_v207');assert.equal(captured.args.p_kind,kind);
 assert.equal(captured.args.p_request_id,requestId);assert.equal(captured.args.p_parish_id,'parish');assert.deepEqual(result.data,{pending_id:'id'});
});
test('V207 volatile previews and generated IDs do not change a creation attempt',async()=>{
 const record={id:'generated',numero:'12',numeroRegistro:'12',numero_registro:'12',nombres:'QA',raw_data:{source:'form'}};
 let args;await lib.createPendingRegistrationWithClient({rpc:async(_,a)=>{args=a;return {data:null,error:null}}},{kind:'bautismo',parishId:'parish',record,requestId,confirmationRecord:{fechaSacramento:'2026-10-20'}});
 assert.deepEqual(args.p_record,{nombres:'QA',raw_data:{source:'form'}});assert.equal(record.id,'generated');assert.equal(record.numero,'12');assert.deepEqual(args.p_confirmation_record,{fechaSacramento:'2026-10-20'});
});
test('V207 compatibility callers receive a new UUID if none supplied',async()=>{
 let args;await lib.createPendingRegistrationWithClient({rpc:async(_,a)=>{args=a;return {data:null,error:null}}},{kind:'confirmacion',parishId:'parish',record:{}});
 assert.match(args.p_request_id,/^[0-9a-f-]{36}$/i);
});
test('V207 service does not replay a failed write automatically',async()=>{
 let calls=0;const error=Error('Failed to fetch');const result=await lib.createPendingRegistrationWithClient({rpc:async()=>{calls++;return {data:null,error}}},{kind:'exequias',parishId:'parish',record:{},requestId});
 assert.equal(calls,1);assert.equal(result.error,error);
});
const report=JSON.parse(read('AUDITORIA_CREACION_BOLETAS_NAVEGADOR_V207.json'));
const definitions=['bautismo','confirmacion','matrimonio','exequias'].flatMap(kind=>['double-success','lost-response','reject-before-save','changed-after-commit',kind==='exequias'?'refresh-failure':'verify-read-failure'].map(scenario=>({kind,scenario})));
definitions.push({kind:'exequias',scenario:'new-registration'});
for(const {kind,scenario} of definitions)test('V207 real page and services '+kind+'/'+scenario,()=>{
 const row=report.rows.find(r=>r.kind===kind&&r.scenario===scenario);assert.ok(row);assert.equal(row.passed,true,JSON.stringify(row.faults));assert.deepEqual(row.faults,[]);
 const final=row.final;assert.ok(final);assert.equal(final.next,final.reservations+1);
 if(scenario==='new-registration'){assert.equal(final.reservations,2);assert.notEqual(final.calls[0].requestId,final.calls[1].requestId)}
 else {assert.equal(final.reservations,1);if(final.calls.length===2)assert.equal(final.calls[0].requestId,final.calls[1].requestId)}
 if(scenario==='changed-after-commit')assert.equal(final.success,false);
 if(scenario==='lost-response'||(scenario==='verify-read-failure'&&kind!=='matrimonio'))assert.equal(final.calls.length,2);
});
test('V207 browser receipt matches eight current production source files',()=>{
 assert.equal(report.passed,21);assert.equal(report.total,21);assert.deepEqual(report.exceptions,[]);assert.deepEqual(report.externalRequests,[]);
 assert.equal(Object.keys(report.sourceSha256).length,8);for(const [file,hash] of Object.entries(report.sourceSha256))assertV251RevisedSource({file,historicalSha256:hash,currentSha256:createHash('sha256').update(read(file)).digest('hex')});
 assert.match(report.scope,/no authenticated browser E2E/);
});
test('V207 PostgreSQL fixture covers five circuits, stable counters and no QA residue',()=>{
 const receipt=JSON.parse(read('AUDITORIA_CREACION_BOLETAS_SQL_V207.json'));
 assert.deepEqual(receipt.actual_postgres_tests,{circuits:5,same_receipt_replays:15,changed_payload_rejected:5,unauthorized_rejected:2,direct_ledger_read_denied:true,counter_changes_after_replay:0,rollback:true});
 assert.deepEqual(receipt.atomicity,{forced_receipt_failures:4,recovered_with_same_request_ids:4,receipts_after_recovery:4,orphaned_records_or_audits:0});
 assert.equal(receipt.post_rollback.persisted_receipts,0);assert.equal(receipt.post_rollback.qa_residue,0);
 assert.equal(receipt.post_rollback.anon_execute,false);assert.equal(receipt.post_rollback.authenticated_ledger_select,false);
 const sql=read('scripts/qa-rollback-idempotent-pending-creation-v207.sql');assert.ok(sql.trimEnd().endsWith('ROLLBACK;'));assert.doesNotMatch(sql,/\bCOMMIT\s*;/i);
 const migration=read('supabase/migrations/'+receipt.migration);assert.match(migration,/ENABLE ROW LEVEL SECURITY/);assert.match(migration,/pg_advisory_xact_lock/);assert.match(migration,/SET search_path = ''/);
});
test('V207 creation browser audit is required in CI and assertions in the local gate',()=>{
 const ci=read('.github/workflows/sacramentum-auditoria-v90.yml'),gate=read('scripts/audit-gate-v90.mjs');
 assert.ok(ci.includes('node scripts/audit-pending-creation-browser-v207.mjs'));assert.ok(ci.includes('scripts/test-idempotent-pending-creation-v207.mjs'));assert.ok(gate.includes('scripts/test-idempotent-pending-creation-v207.mjs'));
});
