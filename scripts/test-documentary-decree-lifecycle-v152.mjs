import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const newQA=read('scripts/qa-rollback-documentary-decree-lifecycle-v152.sql');
const authQA=read('scripts/qa-rollback-decree-concept-trace-v152.sql');
const issuer=read('supabase/migrations/20261021000100_chancery_documentary_decrees_v88.sql');
const trace=read('supabase/migrations/20261021152552_decree_trace_scoped_v89.sql');
const concept=read('supabase/migrations/20261021153810_guard_decree_concept_mutation_v89.sql');
test('V152 issuer is Chancery-only, with effective diocesan identity',()=>{
 assert.match(issuer,/v_role is distinct from 'chancery'/i);
 assert.match(issuer,/current_effective_diocese_id\(\)/);
});
test('V152 issuer checks parish diocese and operational state for new decrees',()=>{
 assert.match(issuer,/p\.diocese_id=v_diocese/i);
 assert.match(issuer,/v_parish\.is_operational/i);
});
test('V152 issuer requires verified historical source reference',()=>{
 assert.match(issuer,/p_historical,false\) and \(v_source is null or length\(v_source\)<4\)/i);
});
test('V152 issuer rejects future dates and unknown sacrament types',()=>{
 assert.match(issuer,/p_decree_date>current_date/i);
 assert.match(issuer,/bautismo','confirmacion','matrimonio','exequias/i);
});
test('V152 issuer serializes decree numbers by diocese',()=>{
 assert.match(issuer,/pg_advisory_xact_lock/);
 assert.match(issuer,/lower\(btrim\(d\.decree_number\)\)=lower\(v_number\)/i);
});
test('V152 issued documentary decrees expressly have no registral effect',()=>{
 for(const marker of ["'registersEffect',false","'generatesMarginalNote',false","'affectsSacramentalRecord',false"])
  assert.ok(issuer.includes(marker),marker);
});
test('V152 archived issuance preserves historical status, no false signatory',()=>{
 assert.match(issuer,/then 'archived' else 'active'/);
 assert.match(issuer,/then null else auth\.uid\(\)/);
});
test('V152 all issued decrees leave audit event',()=>assert.match(issuer,/insert into public\.registry_audit_log/i));
test('V152 trace is protected by auth.uid and parish isolation',()=>{
 assert.match(trace,/auth\.uid\(\) IS NOT NULL/i);
 assert.match(trace,/can_access_parish\(d\.parish_id\)/i);
});
test('V152 trace does not grant direct access to audit log',()=>{
 assert.match(trace,/REVOKE ALL ON FUNCTION/i);
 assert.match(trace,/GRANT EXECUTE ON FUNCTION/i);
 assert.doesNotMatch(trace,/GRANT\s+SELECT\s+ON\s+public\.registry_audit_log/i);
});
test('V152 private concept setter requires Chancery and rejects documentary types',()=>{
 assert.match(concept,/v_role is distinct from 'chancery'/i);
 assert.match(concept,/lower\(coalesce\(v_decree\.tipo,''\)\) not in \('correccion','reposicion'\)/i);
});
test('V152 concept setter rejects historical origins and replacement of fixed concept',()=>{
 assert.match(concept,/historical_archive','legacy_import'/i);
 assert.match(concept,/conceptoAnulacionId/i);
});
test('V152 QA creates new and historical decrees for real scopes with fake names',()=>{
 assert.match(newQA,/issue_documentary_decree_v88\(v_operational,'bautismo'/);
 assert.match(newQA,/issue_documentary_decree_v88\(v_operational,'matrimonio'/);
 assert.match(newQA,/issue_documentary_decree_v88\(v_historical,'exequias'/);
 assert.match(newQA,/PERSONA FICTICIA/);
});
test('V152 QA inspects audit through permitted trace RPC, not table grants',()=>{
 assert.match(newQA,/get_decree_trace_v89/);
 assert.doesNotMatch(newQA,/FROM public\.registry_audit_log/i);
});
test('V152 QA verifies no changes to sacrament tables and fake duplicate rejection',()=>{
 assert.match(newQA,/v_before IS DISTINCT FROM v_after/);
 assert.match(newQA,/duplicate decree accepted/i);
});
test('V152 QA checks historical source and operational container restrictions',()=>{
 assert.match(newQA,/historical container issued new decree/i);
 assert.match(newQA,/missing historical source accepted/i);
});
test('V152 QA rejects diocesan issuance rather than treating diocese as chancery',()=>{
 assert.match(newQA,/diocese issued chancery-only decree/i);
});
test('V152 QA rejects attaching concepts to new and historical documentary decrees',()=>{
 assert.match(authQA,/private\.attach_decree_concept_policy_internal/);
 assert.match(authQA,/public\.attach_decree_concept_policy\(/);
 assert.match(authQA,/documentary decree acquired concept policy/);
});
test('V152 QA verifies own-parish audit trace and blocks other parish',()=>{
 assert.match(authQA,/parish cannot inspect own decree trace/);
 assert.match(authQA,/parish sees other parish trace/);
 assert.match(authQA,/unprofiled actor sees decree trace/);
});
test('V152 QA denies changing concept policy from Diocese',()=>{
 assert.match(authQA,/diocese modified documentary policy/);
});
for(const [name,sql] of [['documentary decree lifecycle',newQA],['concept and trace',authQA]]){
 test('V152 '+name+' has BEGIN/ROLLBACK and never COMMIT',()=>{
  assert.match(sql,/^BEGIN;$/m);
  assert.match(sql,/ROLLBACK;\s*$/);
  assert.doesNotMatch(sql,/^\s*COMMIT\b/im);
 });
}
