import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syntheticCleanMigrationReviewV231 } from './release-test-fixture-v231.mjs';
import {assessOfficialBuild} from '../release-guard-core-v223.mjs';
import {assessSecurityPreflightV224} from '../release-security-guard-v224.mjs';

const qa=JSON.parse(fs.readFileSync('AUDITORIA_PRIVILEGIOS_PREDETERMINADOS_LIVE_V226.json','utf8'));
const rpc=JSON.parse(fs.readFileSync('AUDITORIA_RPC_INVENTARIO_LIVE_V226.json','utf8'));
const sql=fs.readFileSync('scripts/release-security-preflight-v226.sql','utf8');
const postgres=fs.readFileSync('supabase/security/qa-postgres-default-privileges-v226.sql','utf8');
const admin=fs.readFileSync('supabase/security/requires-authorized-supabase-admin-v226.sql','utf8');
const now=Date.parse('2026-10-27T03:30:00Z');
const fakeClean={...qa.security,protocol:'V236',
 dangerous_default_table_grants:0,open_default_function_grants:0,
 future_user_table_grants:0,future_user_sequence_grants:0,
 future_user_function_grants:0,creators_missing_global_function_revoke:0,insecure_public_only_definers:0,unused_pg_graphql_enabled:0,qa_legacy_dbf_concept_rows:0,qa_legacy_template_snapshot_rows:0,postgres_future_table_grants:0,postgres_future_sequence_grants:0,postgres_future_function_grants:0,postgres_missing_global_function_revoke:0,postgres_global_table_grants:0,postgres_global_sequence_grants:0,admin_risk_extensions_in_public:0,admin_owned_public_relations:0,admin_owned_public_functions:0,admin_owned_exposed_truncate_tables:0,privileged_rpc_without_auth_identity_path:0,privileged_rpc_using_delegated_identity:15,
 authenticated_definer_functions:151,reviewed_security_definers:207,reviewed_authenticated_definers:151,
 manual_privileged_rpc_review:true,privileged_rpc_catalog_count:151,privileged_rpc_catalog_md5:'60019131a532a623a91c6128b9ab8daa'};
const act={
 migration_review:syntheticCleanMigrationReviewV231,protocol:'V236',environment:'CLEAN_PRODUCTION',
 approved_for_official_mode:true,project_ref:'bbbbbbbbbbbbbbbbbbbb',
 verified_at:'2026-10-27T03:20:00Z',
 verification_source:'privileged-read-only:synthetic-fixture-only',
 counts:{business_rows:0,auth_users:0,storage_objects:0,unexpected_public_tables:0,missing_public_tables:0,tracked_public_tables:82,current_public_tables:82},
 security:fakeClean};
const attempt=patch=>assessOfficialBuild({mode:'official',supabaseUrl:'https://bbbbbbbbbbbbbbbbbbbb.supabase.co',report:{...act,...patch},now});

test('V226 QA postgres default ACL changes are real, non-retroactive and isolated from test rows',()=>{
 assert.equal(qa.protocol,'V226');
 assert.equal(qa.change.owner,'postgres');
 assert.equal(qa.change.appliedToQa,true);
 assert.equal(qa.change.dataModified,false);
 assert.equal(qa.change.existingGrantsModified,false);
 assert.equal(qa.change.unapprovedOtherOwnerAltered,false);
 assert.equal(qa.change.baptismsUnchanged,5040);
 assert.equal(qa.projectRef,'foczofcmwampjvlfbsqn');
 assert.equal(qa.approvedForOfficialMode,false);
 for(const key of ['anonCanSelectNewTable','authenticatedCanSelectNewTable','anonCanExecuteNewFunction','authenticatedCanExecuteNewFunction'])
  assert.equal(qa.change.futureObjectProbe[key],false);
 assert.equal(qa.change.futureObjectProbe.rolledBack,true);
});
test('V226 exact residual live risks are not excused because postgres was hardened',()=>{
 assert.equal(qa.security.future_user_table_grants,16);
 assert.equal(qa.security.future_user_sequence_grants,6);
 assert.equal(qa.security.future_user_function_grants,2);
 assert.equal(qa.security.creators_missing_global_function_revoke,1);
 assert.equal(qa.security.open_default_function_grants,2);
 assert.equal(qa.security.dangerous_default_table_grants,8);
 assert.equal(qa.security.anonymous_definer_functions,0);
 assert.notEqual(assessSecurityPreflightV224(qa.security).length,0);
});
test('V226 clean fictional attestation remains possible but is not evidence of official launch',()=>{
 assert.deepEqual(attempt(),{ok:true,mode:'official',problems:[]});
 assert.equal(attempt({security:qa.security}).ok,false);
 assert.equal(attempt({protocol:'V224'}).ok,false);
});
for(const field of ['postgres_future_table_grants','postgres_future_sequence_grants','postgres_future_function_grants','postgres_missing_global_function_revoke']){
 test('V226 release fails closed when '+field+' is nonzero',()=>{
  const out=attempt({security:{...fakeClean,[field]:1}});
  assert.equal(out.ok,false);
  assert.ok(out.problems.some(x=>x.includes(field)));
 });
 test('V226 release fails closed when '+field+' is unmeasured',()=>{
  assert.equal(attempt({security:{...fakeClean,[field]:undefined}}).ok,false);
 });
}
test('V226 SQL counts both global and schema-level grants from both object creators',()=>{
 for(const expected of ['future_user_table_grants','future_user_sequence_grants',
  'future_user_function_grants','creators_missing_global_function_revoke',
  'pg_default_acl','supabase_admin','postgres','aclexplode'])
  assert.ok(sql.includes(expected),'missing '+expected);
 const executable=sql.replace(/--[^\n]*/g,'');
 assert.doesNotMatch(executable,/^\s*(?:INSERT|UPDATE|DELETE|ALTER|TRUNCATE|DROP|GRANT|REVOKE|CREATE|DO)\b/gim);
});
test('V226 owner-specific fix revokes global PUBLIC execution and leaves existing grants intact',()=>{
 assert.match(postgres,/ALTER DEFAULT PRIVILEGES FOR ROLE postgres\s+REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC/);
 assert.match(postgres,/ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public/);
 assert.match(postgres,/REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM anon, authenticated, service_role/);
 assert.match(postgres,/REVOKE USAGE, SELECT, UPDATE ON SEQUENCES FROM anon, authenticated, service_role/);
 assert.match(postgres,/BEGIN;/);
 assert.match(postgres,/COMMIT;/);
 assert.doesNotMatch(postgres,/(?:DELETE FROM|TRUNCATE TABLE|DROP TABLE|ALTER TABLE public[.])/i);
});
test('V234 supersedes unsafe V226 attempt to alter Supabase internal admin defaults',()=>{
 assert.match(admin,/RAISE EXCEPTION/);
 assert.match(admin,/supabase_admin default ACL remediation is unsupported/);
 assert.doesNotMatch(admin,/ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin/);
 assert.doesNotMatch(admin,/\bGRANT\s+supabase_admin\b/i);
 assert.doesNotMatch(fs.readFileSync('.github/workflows/sacramentum-auditoria-v90.yml','utf8'),/run:.*requires-authorized-supabase-admin-v226\.sql/);
});
test('V226 real catalogue lists all 152 privileged callable RPCs with stable signatures and no bodies',()=>{
 assert.equal(rpc.protocol,'V226');
 assert.equal(rpc.signatures.length,152);
 assert.equal(rpc.summary.count,152);
 assert.equal(rpc.summary.directUid,134);
 assert.equal(rpc.summary.delegated,83);
 assert.equal(rpc.summary.noObviousGuard,0);
 assert.equal(rpc.summary.writeish,101);
 assert.equal(rpc.summary.dynamic,0);
 assert.equal(rpc.summary.insecurePath,0);
 assert.equal(rpc.approvedForOfficialMode,false);
 assert.ok(rpc.signatures.every(x=>x.secured_search_path&&/^[a-f0-9]{32}$/.test(x.definition_md5)));
 assert.ok(rpc.signatures.every(x=>typeof x.proname==='string'&&typeof x.arguments==='string'));
 assert.ok(!rpc.signatures.some(x=>Object.keys(x).some(k=>k==='body'||k==='source')));
});
test('V226 RPC source heuristics are not presented as formal manual authorization review',()=>{
 assert.match(rpc.methodLimitations,/Final review must inspect/);
 assert.equal(qa.rpcInventory.formallyReviewed,0);
 assert.equal(qa.rpcInventory.total,152);
});
test('V226 test is wired to CI and local quality gate',()=>{
 for(const file of ['scripts/audit-gate-v90.mjs','.github/workflows/sacramentum-auditoria-v90.yml']){
  assert.match(fs.readFileSync(file,'utf8'),/scripts\/test-security-default-privileges-v226\.mjs/);
 }
});
