import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const e=JSON.parse(fs.readFileSync('AUDITORIA_MATRIZ_ROLES_LIVE_V238.json','utf8'));
const roleCases=Object.entries(e.role_profiles);
const sum=(values)=>values.reduce((a,b)=>a+b,0);

test('V238 evidence is explicitly QA-only with no official users or DB mutations',()=>{
 assert.equal(e.environment,'SUPABASE_QA_ONLY_NOT_OFFICIAL');
 assert.equal(e.project_ref,'foczofcmwampjvlfbsqn');
 assert.equal(e.qa_data_changes,0);
 assert.equal(e.qa_schema_changes,0);
 assert.equal(e.official_launch_authorized,false);
 assert.equal(e.semantic_rpc_approvals,0);
});
test('V238 identities cover all four institutional QA roles and all 12 active users',()=>{
 assert.equal(e.qa_profiles,12);
 assert.deepEqual(e.role_profiles,{admin_general:2,chancery:2,diocese:3,parish:5});
 assert.equal(sum(roleCases.map(([,count])=>count)),e.qa_profiles);
 assert.equal(e.role_predicates.principals,e.qa_profiles);
 assert.deepEqual([...e.role_predicates.distinct_roles_tested].sort(),roleCases.map(([name])=>name).sort());
});
test('V238 reported 132 role and jurisdiction checks must be mathematically consistent',()=>{
 assert.equal(e.qa_dioceses,3);
 assert.equal(e.qa_parishes,6);
 assert.equal(e.role_predicates.check_dioceses_per_principal,e.qa_dioceses);
 assert.equal(e.role_predicates.check_parishes_per_principal,e.qa_parishes);
 assert.deepEqual(e.role_predicates.additional_checks_per_principal,['is_app_admin','can_manage_legacy_import(NULL,NULL)']);
 const expected=e.qa_profiles*(e.qa_dioceses+e.qa_parishes+e.role_predicates.additional_checks_per_principal.length);
 assert.equal(expected,132);
 assert.equal(e.role_predicates.evaluated,expected);
 assert.equal(e.role_predicates.passed,expected);
 assert.equal(e.role_predicates.failed,0);
});
test('V238 RLS read checks cover every institutional role on all four sacraments',()=>{
 assert.deepEqual(e.sacramental_rls.tables,['baptisms','confirmations','marriages','funerals']);
 assert.equal(e.sacramental_rls.policy_expression,'can_access_parish(parish_id)');
 assert.equal(e.sacramental_rls.principals,e.qa_profiles);
 assert.equal(e.sacramental_rls.checks_per_principal,e.sacramental_rls.tables.length);
 assert.equal(e.sacramental_rls.evaluated,48);
 assert.equal(e.sacramental_rls.passed,48);
 assert.equal(e.sacramental_rls.failed,0);
});
test('V238 total independent live observations are consistent and cannot be inflated',()=>{
 assert.equal(e.total_live_checks,e.role_predicates.evaluated+e.sacramental_rls.evaluated);
 assert.equal(e.total_passed,e.role_predicates.passed+e.sacramental_rls.passed);
 assert.equal(e.total_failed,e.role_predicates.failed+e.sacramental_rls.failed);
 assert.equal(e.total_live_checks,180);
 assert.equal(e.total_failed,0);
 assert.ok(e.weighted_estimated_percent<100);
});
test('V238 tests ran with authenticated PostgreSQL role and a read-only reversible transaction',()=>{
 assert.match(e.session_method,/BEGIN READ ONLY/i);
 assert.match(e.session_method,/SET LOCAL ROLE authenticated/i);
 assert.match(e.session_method,/request\.jwt\.claim\.sub/i);
 assert.match(e.session_method,/ROLLBACK/i);
 assert.equal(e.independently_observed_no_session.auth_uid_null,true);
 assert.equal(e.independently_observed_no_session.can_access_parish,false);
 assert.equal(e.independently_observed_no_session.is_app_admin,false);
});
test('V238 offline evidence audit must not be misrepresented as continuous live monitoring',()=>{
 assert.match(e.negative_cases_interpretation,/does not validate all mutations/i);
 assert.match(e.sacramental_rls.interpretation,/COUNT\(\*\)/i);
 assert.match(e.authority,/PostgreSQL/i);
 assert.match(e.environment,/QA/);
});
test('V238 wired into local master suite and GitHub CI',()=>{
 for(const p of ['scripts/audit-gate-v90.mjs','.github/workflows/sacramentum-auditoria-v90.yml'])
  assert.match(fs.readFileSync(p,'utf8'),/scripts\/test-live-role-perimeter-evidence-v238\.mjs/);
});
