import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessSecurityPreflightV224,EXPECTED_PRIVILEGED_RPC_CATALOG_MD5_V236} from '../release-security-guard-v224.mjs';
import {assessOfficialBuild} from '../release-guard-core-v223.mjs';
import {syntheticCleanMigrationReviewV231} from './release-test-fixture-v231.mjs';

const evidence=JSON.parse(fs.readFileSync('AUDITORIA_HUELLAS_RPC_LIVE_V236.json','utf8'));
const sql=fs.readFileSync('scripts/release-security-preflight-v236.sql','utf8');
const safe={
 protocol:'V236',public_tables:82,rls_disabled:0,auth_truncate_tables:0,anon_truncate_tables:0,
 unvalidated_foreign_keys:0,anonymous_definer_functions:0,
 definer_missing_search_path:0,insecure_public_only_definers:0,unused_pg_graphql_enabled:0,
 qa_legacy_dbf_concept_rows:0,qa_legacy_template_snapshot_rows:0,
 privileged_rpc_without_auth_identity_path:0,privileged_rpc_using_delegated_identity:15,
 postgres_future_table_grants:0,postgres_future_sequence_grants:0,
 postgres_future_function_grants:0,postgres_missing_global_function_revoke:0,
 postgres_global_table_grants:0,postgres_global_sequence_grants:0,
 admin_risk_extensions_in_public:0,admin_owned_public_relations:0,
 admin_owned_public_functions:0,admin_owned_exposed_truncate_tables:0,
 dangerous_default_table_grants:8,open_default_function_grants:2,
 future_user_table_grants:16,future_user_sequence_grants:6,
 future_user_function_grants:2,creators_missing_global_function_revoke:1,
 public_functions:244,security_definers:207,authenticated_definer_functions:151,
 privileged_rpc_catalog_count:151,privileged_rpc_catalog_md5:EXPECTED_PRIVILEGED_RPC_CATALOG_MD5_V236,
 reviewed_security_definers:207,reviewed_authenticated_definers:151,
 manual_privileged_rpc_review:true
};
const fixture={
 protocol:'V236',environment:'CLEAN_PRODUCTION',approved_for_official_mode:true,
 project_ref:'bbbbbbbbbbbbbbbbbbbb',verified_at:'2026-10-27T14:40:00Z',
 verification_source:'privileged-read-only:synthetic-only',
 counts:{business_rows:0,auth_users:0,storage_objects:0,
 unexpected_public_tables:0,missing_public_tables:0,tracked_public_tables:82,current_public_tables:82},
 security:safe,migration_review:syntheticCleanMigrationReviewV231
};
const full=(security=safe,changes={})=>assessOfficialBuild({
 mode:'official',supabaseUrl:'https://bbbbbbbbbbbbbbbbbbbb.supabase.co',
 report:{...fixture,security,...changes},
 now:Date.parse('2026-10-27T14:42:00Z')
});
test('V236 actual QA PostgreSQL catalog had 152 privileged RPC and a deterministic digest',()=>{
 assert.equal(evidence.environment,'QA_TEST_ONLY_NOT_OFFICIAL');
 assert.equal(evidence.project_ref,'foczofcmwampjvlfbsqn');
 assert.equal(evidence.catalog_count,152);
 assert.equal(evidence.privileged_rpc_catalog_md5,'4ded9ebe1d9cde435befee3f8b131222'); // Preserved historical V236 fingerprint
 assert.equal(evidence.dynamic_sql_text_hits,0);
 assert.equal(evidence.read_only,true);
 assert.equal(evidence.qa_data_changed,false);
 assert.equal(evidence.manual_semantic_rpc_reviews_approved,0);
});
test('V236 safe synthetic fixture reaches release assessor but not actual production',()=>{
 assert.deepEqual(assessSecurityPreflightV224(safe),[]);
 assert.deepEqual(full(),{ok:true,mode:'official',problems:[]});
 assert.equal(evidence.official_database_created,false);
});
for(const invalid of [
 undefined,null,'','0'.repeat(32),'f'.repeat(32),
 EXPECTED_PRIVILEGED_RPC_CATALOG_MD5_V236.toUpperCase(),
 EXPECTED_PRIVILEGED_RPC_CATALOG_MD5_V236.slice(0,31),'x',
 1234
]) {
 test('V236 missing or changed RPC catalog hash must prevent official mode ('+String(invalid)+')',()=>{
  const s={...safe,privileged_rpc_catalog_md5:invalid};
  assert.ok(assessSecurityPreflightV224(s).some(x=>x.includes('huella')));
  assert.equal(full(s).ok,false);
 });
}
for(const invalid of [undefined,null,-1,0,152,153,2.5,'151']) {
 test('V236 missing or changed RPC count must prevent official mode ('+String(invalid)+')',()=>{
  const s={...safe,privileged_rpc_catalog_count:invalid};
  assert.ok(assessSecurityPreflightV224(s).some(x=>x.includes('número')));
  assert.equal(full(s).ok,false);
 });
}
test('V236 old V235 release attestations fail closed',()=>{
 assert.equal(full({...safe,protocol:'V235'}).ok,false);
 assert.equal(full(safe,{protocol:'V235'}).ok,false);
});
test('V236 real QA cannot become production via copied hash or forged synthetic fixture',()=>{
 const result=assessOfficialBuild({
  mode:'official',supabaseUrl:'https://foczofcmwampjvlfbsqn.supabase.co',
  report:{...fixture,project_ref:'foczofcmwampjvlfbsqn'},
  now:Date.parse('2026-10-27T14:42:00Z')
 });
 assert.equal(result.ok,false);
 assert.ok(result.problems.some(x=>x.includes('proyecto de pruebas')));
});
test('V236 a matching fingerprint is not semantic approval of 152 authorization paths',()=>{
 for(const changed of [
  {...safe,manual_privileged_rpc_review:false},
  {...safe,reviewed_authenticated_definers:0},
  {...safe,reviewed_security_definers:0}
 ])assert.equal(full(changed).ok,false);
});
test('V236 uses exact callable function signatures and PostgreSQL canonical definition body',()=>{
 for(const marker of [
  "AS privileged_rpc_catalog_md5","AS privileged_rpc_catalog_count",
  "pg_get_function_identity_arguments(p.oid)","md5(pg_get_functiondef(p.oid))",
  "has_function_privilege('authenticated',p.oid,'EXECUTE')",
  "ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)"
 ]) assert.ok(sql.includes(marker),marker);
 assert.doesNotMatch(sql.replace(/^--.*$/gm,''),/^\s*(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|DO)\b/gim);
});
test('V236 required in both local audit and CI workflow',()=>{
 for(const f of ['scripts/audit-gate-v90.mjs','.github/workflows/sacramentum-auditoria-v90.yml'])
  assert.match(fs.readFileSync(f,'utf8'),/scripts\/test-privileged-rpc-catalog-v236\.mjs/);
});
