import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assessSecurityPreflightV224 } from '../release-security-guard-v224.mjs';
import { assessOfficialBuild } from '../release-guard-core-v223.mjs';
import { syntheticCleanMigrationReviewV231 } from './release-test-fixture-v231.mjs';

const baseline={
 protocol:'V235',public_tables:82,rls_disabled:0,auth_truncate_tables:0,
 anon_truncate_tables:0,unvalidated_foreign_keys:0,anonymous_definer_functions:0,
 definer_missing_search_path:0,insecure_public_only_definers:0,
 unused_pg_graphql_enabled:0,qa_legacy_dbf_concept_rows:0,
 qa_legacy_template_snapshot_rows:0,privileged_rpc_without_auth_identity_path:0,
 postgres_future_table_grants:0,postgres_future_sequence_grants:0,
 postgres_future_function_grants:0,postgres_missing_global_function_revoke:0,
 postgres_global_table_grants:0,postgres_global_sequence_grants:0,
 admin_risk_extensions_in_public:0,admin_owned_public_relations:0,
 admin_owned_public_functions:0,admin_owned_exposed_truncate_tables:0,
 dangerous_default_table_grants:8,open_default_function_grants:2,
 future_user_table_grants:16,future_user_sequence_grants:6,
 future_user_function_grants:2,creators_missing_global_function_revoke:1,
 public_functions:244,security_definers:207,authenticated_definer_functions:152,
 privileged_rpc_using_delegated_identity:15,
 reviewed_security_definers:207,reviewed_authenticated_definers:152,
 manual_privileged_rpc_review:true
};
const attestation={
 protocol:'V235',environment:'CLEAN_PRODUCTION',approved_for_official_mode:true,
 project_ref:'bbbbbbbbbbbbbbbbbbbb',
 verified_at:'2026-10-27T14:10:00Z',
 verification_source:'privileged-read-only:synthetic-security-unit-test',
 counts:{business_rows:0,auth_users:0,storage_objects:0,
  unexpected_public_tables:0,missing_public_tables:0,
  tracked_public_tables:82,current_public_tables:82},
 security:baseline,migration_review:syntheticCleanMigrationReviewV231
};
const assess=security=>assessOfficialBuild({
 mode:'official',supabaseUrl:'https://bbbbbbbbbbbbbbbbbbbb.supabase.co',
 report:{...attestation,security},now:Date.parse('2026-10-27T14:12:00Z')
});
test('V235 independent SQL evidence: global postgres table and sequence default grants are zero in QA',()=>{
 const evidence=JSON.parse(fs.readFileSync('AUDITORIA_ACL_GLOBALES_POSTGRES_V235.json','utf8'));
 assert.equal(evidence.environment,'QA_TEST_ONLY_NOT_OFFICIAL');
 assert.equal(evidence.project_ref,'foczofcmwampjvlfbsqn');
 assert.deepEqual(evidence.global_user_grants,[]);
 assert.equal(evidence.read_only,true);
 assert.equal(evidence.qa_data_changed,false);
});
test('V235 baseline with immutable internal defaults is accepted by evaluator only as a synthetic unit fixture',()=>{
 assert.deepEqual(assessSecurityPreflightV224(baseline),[]);
 assert.equal(assess(baseline).ok,true);
});
for(const name of ['postgres_global_table_grants','postgres_global_sequence_grants']){
 for(const value of [1,7,-1,undefined,null,0.1,'0']){
  test('V235 blocks '+name+' = '+String(value),()=>{
   const bad={...baseline,[name]:value};
   assert.ok(assessSecurityPreflightV224(bad).some(x=>x.includes(name)));
   const res=assess(bad);
   assert.equal(res.ok,false);
   assert.ok(res.problems.some(x=>x.includes(name)));
  });
 }
}
test('V235 previous V234 security and inventory protocols fail closed',()=>{
 assert.equal(assess({...baseline,protocol:'V234'}).ok,false);
 assert.equal(assessOfficialBuild({
  mode:'official',supabaseUrl:'https://bbbbbbbbbbbbbbbbbbbb.supabase.co',
  report:{...attestation,protocol:'V234'},
  now:Date.parse('2026-10-27T14:12:00Z')
 }).ok,false);
});
test('V235 security preflight counts global ACLs without touching data',()=>{
 const sql=fs.readFileSync('scripts/release-security-preflight-v235.sql','utf8');
 for(const metric of ['postgres_global_table_grants','postgres_global_sequence_grants'])
  assert.ok(sql.includes('AS '+metric));
 assert.match(sql,/defaclnamespace=0 AND a.defaclobjtype='r'/);
 assert.match(sql,/defaclnamespace=0 AND a.defaclobjtype='S'/);
 assert.match(sql,/a\.defaclrole='postgres'::regrole/);
 assert.doesNotMatch(sql.replace(/^--.*$/gm,''),/^\s*(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE|DO)\b/gim);
});
test('V235 enforced on local and GitHub quality gates',()=>{
 for(const name of ['scripts/audit-gate-v90.mjs','.github/workflows/sacramentum-auditoria-v90.yml'])
  assert.match(fs.readFileSync(name,'utf8'),/scripts\/test-global-default-acl-v235\.mjs/);
});
