import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessSecurityPreflightV224} from '../release-security-guard-v224.mjs';
import {assessOfficialBuild} from '../release-guard-core-v223.mjs';
import {syntheticCleanMigrationReviewV231} from './release-test-fixture-v231.mjs';

const live=JSON.parse(fs.readFileSync('AUDITORIA_ACL_SUPABASE_RESERVADA_LIVE_V234.json','utf8'));
const sql=fs.readFileSync('scripts/release-security-preflight-v236.sql','utf8');
const security={
 protocol:'V236',public_tables:82,rls_disabled:0,auth_truncate_tables:0,
 anon_truncate_tables:0,unvalidated_foreign_keys:0,
 // These 6 original aggregate counts intentionally mirror immutable
 // reserved supabase_admin ACLs, not insecure app-created objects:
 dangerous_default_table_grants:8,open_default_function_grants:2,
 future_user_table_grants:16,future_user_sequence_grants:6,
 future_user_function_grants:2,creators_missing_global_function_revoke:1,
 // Actual enforceable measures must all remain zero.
 postgres_future_table_grants:0,postgres_future_sequence_grants:0,
 postgres_future_function_grants:0,postgres_missing_global_function_revoke:0,postgres_global_table_grants:0,postgres_global_sequence_grants:0,
 admin_risk_extensions_in_public:0,admin_owned_public_relations:0,
 admin_owned_public_functions:0,admin_owned_exposed_truncate_tables:0,
 insecure_public_only_definers:0,unused_pg_graphql_enabled:0,
 qa_legacy_dbf_concept_rows:0,qa_legacy_template_snapshot_rows:0,
 privileged_rpc_without_auth_identity_path:0,
 privileged_rpc_using_delegated_identity:15,
 public_functions:244,security_definers:207,
 anonymous_definer_functions:0,authenticated_definer_functions:152,
 definer_missing_search_path:0,reviewed_security_definers:207,
 reviewed_authenticated_definers:152,manual_privileged_rpc_review:true,privileged_rpc_catalog_count:152,privileged_rpc_catalog_md5:'f5f6d63ed04cb647d96f7175a054f39a'
};
const report={
 protocol:'V236',environment:'CLEAN_PRODUCTION',
 approved_for_official_mode:true,project_ref:'bbbbbbbbbbbbbbbbbbbb',
 verified_at:'2026-10-27T14:05:00Z',
 verification_source:'privileged-read-only:synthetic-only',
 counts:{business_rows:0,auth_users:0,storage_objects:0,
  unexpected_public_tables:0,missing_public_tables:0,
  tracked_public_tables:82,current_public_tables:82},
 security,migration_review:syntheticCleanMigrationReviewV231
};
const assess=act=>assessOfficialBuild({mode:'official',
 supabaseUrl:'https://bbbbbbbbbbbbbbbbbbbb.supabase.co',
 report:act,now:Date.parse('2026-10-27T14:08:00Z')});

test('V234 real QA postgres-created future objects have no unauthorised default Data API grants',()=>{
 const x=live.postgres_owner_defaults;
 assert.deepEqual(x,{future_user_table_grants:0,
  future_user_sequence_grants:0,future_user_function_grants:0,
  missing_global_function_revoke:0});
});
test('V234 only reserved Supabase-owned future defaults contain the remaining 8/2/16/6/2 and 1',()=>{
 assert.deepEqual(live.supabase_admin_reserved_defaults,{
  dangerous_table_grants:8,open_function_grants:2,
  future_user_table_grants:16,future_user_sequence_grants:6,
  future_user_function_grants:2,global_execute_default_not_revoked:1,
  this_is_internal_and_not_user_reconfigurable:true
 });
 assert.match(live.reference,/supabase.com\/kb\/troubleshooting/);
});
test('V234 current public schema has zero extensions and zero Supabase-admin owned relation/functions',()=>{
 assert.deepEqual(live.exposure,{
  extensions_in_public:0,
  public_relations_owned_by_supabase_admin:0,
  public_functions_owned_by_supabase_admin:0,
  admin_owned_tables_with_authenticated_truncate:0,
  all_current_user_auth_truncate_tables:0,
  all_current_anon_truncate_tables:0,rls_disabled_tables:0
 });
});
test('V234 unchanged internal ACL telemetry is permitted only in a synthetic otherwise-clean database',()=>{
 assert.deepEqual(assessSecurityPreflightV224(security),[]);
 assert.deepEqual(assess(report),{ok:true,mode:'official',problems:[]});
 assert.equal(live.still_blocked.independent_official_project_created,false);
 assert.equal(live.still_blocked.legacy_qa_dbf_concepts,4);
});
for(const field of [
 'postgres_future_table_grants','postgres_future_sequence_grants',
 'postgres_future_function_grants','postgres_missing_global_function_revoke',
 'postgres_global_table_grants','postgres_global_sequence_grants',
 'admin_risk_extensions_in_public','admin_owned_public_relations',
 'admin_owned_public_functions','admin_owned_exposed_truncate_tables'
]){
 test('V234 official release refuses actual exposure of '+field,()=>{
  const bad={...security,[field]:1};
  const result=assess({...report,security:bad});
  assert.equal(result.ok,false);
  assert.ok(result.problems.some(x=>x.includes(field)));
 });
 test('V234 fail-closed when '+field+' was not measured',()=>{
  const bad={...security,[field]:undefined};
  assert.equal(assess({...report,security:bad}).ok,false);
 });
}
test('V234 existing TRUNCATE and RLS controls still deny even with reserved admin ACLs untouched',()=>{
 for(const field of ['auth_truncate_tables','anon_truncate_tables','rls_disabled']){
  const result=assess({...report,security:{...security,[field]:1}});
  assert.equal(result.ok,false);
  assert.ok(result.problems.some(x=>x.includes(field)));
 }
});
test('V234 reserved ACL telemetry must still be measured and nonnegative',()=>{
 for(const field of [
  'dangerous_default_table_grants','open_default_function_grants',
  'future_user_table_grants','future_user_sequence_grants',
  'future_user_function_grants','creators_missing_global_function_revoke'
 ]){
  for(const value of [undefined,-1]){
   const result=assess({...report,security:{...security,[field]:value}});
   assert.equal(result.ok,false,field);
  }
 }
});
test('V234 inconsistencies between owner and aggregate defaults cannot be attested',()=>{
 for(const [aggregate,owned] of [
  ['future_user_table_grants','postgres_future_table_grants'],
  ['future_user_sequence_grants','postgres_future_sequence_grants'],
  ['future_user_function_grants','postgres_future_function_grants'],
  ['creators_missing_global_function_revoke','postgres_missing_global_function_revoke']
 ]){
  const result=assess({...report,security:{...security,[aggregate]:0,[owned]:1}});
  assert.equal(result.ok,false,aggregate);
  assert.ok(result.problems.some(x=>x.includes('inventario inconsistente')));
 }
});
test('V234 cannot claim success for the actual QA project with 4 legacy fictitious concepts',()=>{
 const result=assessOfficialBuild({mode:'official',
  supabaseUrl:'https://foczofcmwampjvlfbsqn.supabase.co',
  report:{...report,project_ref:'foczofcmwampjvlfbsqn',
   security:{...security,qa_legacy_dbf_concept_rows:4}},
  now:Date.parse('2026-10-27T14:08:00Z')});
 assert.equal(result.ok,false);
 assert.ok(result.problems.some(x=>x.includes('proyecto de pruebas')));
});
test('V234 old V233 attestations, missing semantic review and missing clean schema evidence fail',()=>{
 assert.equal(assess({...report,protocol:'V233'}).ok,false);
 assert.equal(assess({...report,security:{...security,protocol:'V233'}}).ok,false);
 assert.equal(assess({...report,security:{...security,manual_privileged_rpc_review:false}}).ok,false);
 assert.equal(assess({...report,migration_review:undefined}).ok,false);
});
test('V234 SQL is pure read-only and scans actual exposure, own defaults and reserved telemetry',()=>{
 for(const name of [
  'postgres_future_table_grants','postgres_future_sequence_grants',
  'postgres_future_function_grants','postgres_missing_global_function_revoke',
  'postgres_global_table_grants','postgres_global_sequence_grants',
 'admin_risk_extensions_in_public','admin_owned_public_relations',
  'admin_owned_public_functions','admin_owned_exposed_truncate_tables',
  'future_user_table_grants','creators_missing_global_function_revoke'
 ])assert.ok(sql.includes('AS '+name),name);
 const stmt=sql.replace(/^--.*$/gm,'');
 assert.doesNotMatch(stmt,/^\s*(?:ALTER|CREATE|DROP|TRUNCATE|INSERT|UPDATE|DELETE|REVOKE|GRANT|DO)\b/gim);
});
test('V234 old unexecutable Supabase-admin reset script now terminates without modifying ACLs',()=>{
 const old=fs.readFileSync('supabase/security/requires-authorized-supabase-admin-v226.sql','utf8');
 assert.match(old,/RAISE EXCEPTION/);
 assert.match(old,/0A000/);
 assert.doesNotMatch(old,/^\s*(?:ALTER DEFAULT PRIVILEGES|GRANT|REVOKE)\b/gim);
});
test('V234 local and CI quality gates always run immutable-default ACL checks',()=>{
 for(const name of ['scripts/audit-gate-v90.mjs','.github/workflows/sacramentum-auditoria-v90.yml'])
  assert.match(fs.readFileSync(name,'utf8'),/scripts\/test-internal-default-acl-v234.mjs/);
});
test('V234 explanation never claims current QA can be made official',()=>{
 assert.equal(live.environment,'QA_TEST_ONLY_NOT_OFFICIAL');
 assert.equal(live.no_data_changes,true);
 assert.equal(live.no_ddl_executed,true);
 assert.equal(live.still_blocked.actual_restored_backup_tested,false);
 assert.equal(live.still_blocked.formal_security_definer_review_complete,false);
});
