import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const e=JSON.parse(fs.readFileSync('AUDITORIA_GUARDAS_RPC_QA_LIVE_V239.json','utf8'));
test('V239 evidence only QA, real SQL role, read-only and explicit rollback',()=>{
 assert.equal(e.environment,'QA_ONLY_FICTITIOUS');
 assert.equal(e.project_ref,'foczofcmwampjvlfbsqn');
 assert.match(e.test_engine,/SET LOCAL ROLE authenticated/);
 assert.match(e.transaction_safety,/BEGIN READ ONLY/);
 assert.match(e.transaction_safety,/ROLLBACK/);
 assert.equal(e.qa_data_mutations,0);
 assert.equal(e.mutating_calls_succeeded,0);
 assert.equal(e.source_rpc_sql_changed,false);
});
test('V239 all four privileged correction and replacement RPC wrappers covered',()=>{
 assert.deepEqual(e.functions,[
  'apply_baptism_correction','apply_baptism_replacement',
  'apply_confirmation_correction','apply_confirmation_replacement'
 ]);
});
test('V239 non-Chancery institutional actors all fail before touching records',()=>{
 const x=e.stages.find(s=>s.name==='parish_diocese_admin_denial');
 assert.deepEqual(x.actor_roles,['parish','diocese','admin_general']);
 assert.equal(x.functions_per_actor,4);
 assert.equal(x.executed,12);
 assert.equal(x.passed,12);
 assert.match(x.expected,/Sólo Cancillería activa/);
});
test('V239 cross-diocese Chancery user is blocked; competent Chancery reaches argument validation',()=>{
 const ok=e.stages.find(s=>s.name==='chancery_own_diocese_first_guard');
 const bad=e.stages.find(s=>s.name==='chancery_foreign_diocese_denial');
 assert.equal(ok.executed,4);assert.equal(ok.passed,4);
 assert.equal(bad.executed,4);assert.equal(bad.passed,4);
 assert.match(ok.expected,/concepto/i);
 assert.match(bad.expected,/fuera de la jurisdicción/i);
});
test('V239 live counts cannot be inflated in summary',()=>{
 assert.equal(e.total_live_checks,e.stages.reduce((n,s)=>n+s.executed,0));
 assert.equal(e.passed,e.stages.reduce((n,s)=>n+s.passed,0));
 assert.equal(e.total_live_checks,20);assert.equal(e.passed,20);assert.equal(e.failed,0);
});
test('V239 negative preconditions do not magically certify RPC business semantics or official mode',()=>{
 assert.equal(e.institutional_semantic_approvals,0);
 assert.equal(e.official_mode_authorized,false);
 assert.match(e.limitations,/do not exercise valid decrees/);
 assert.match(e.limitations,/all 152 privileged RPCs/);
 assert.match(e.limitations,/offline/);
});
test('V239 documented real QA runs and offline CI test are wired',()=>{
 for(const file of ['scripts/audit-gate-v90.mjs','.github/workflows/sacramentum-auditoria-v90.yml'])
  assert.match(fs.readFileSync(file,'utf8'),/scripts\/test-live-chancery-rpc-guards-v239\.mjs/);
});
