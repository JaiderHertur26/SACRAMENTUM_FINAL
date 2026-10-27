import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessSecurityPreflightV224} from '../release-security-guard-v224.mjs';
import {assessOfficialBuild} from '../release-guard-core-v223.mjs';
import {syntheticCleanMigrationReviewV231} from './release-test-fixture-v231.mjs';

const source=JSON.parse(fs.readFileSync('AUDITORIA_RPC_CADENAS_IDENTIDAD_LIVE_V233.json','utf8'));
const sql=fs.readFileSync('scripts/release-security-preflight-v233.sql','utf8');
const qa=JSON.parse(fs.readFileSync('AUDITORIA_PRELAUNCH_DATOS_QA_V231.json','utf8'));
const sourceV232=JSON.parse(fs.readFileSync('AUDITORIA_RPC_152_POST_LIVE_V232.json','utf8'));
const safe={
 protocol:'V236',public_tables:82,rls_disabled:0,auth_truncate_tables:0,
 anon_truncate_tables:0,unvalidated_foreign_keys:0,dangerous_default_table_grants:0,
 open_default_function_grants:0,future_user_table_grants:0,future_user_sequence_grants:0,
 future_user_function_grants:0,creators_missing_global_function_revoke:0,
 insecure_public_only_definers:0,unused_pg_graphql_enabled:0,
 qa_legacy_dbf_concept_rows:0,qa_legacy_template_snapshot_rows:0,postgres_future_table_grants:0,postgres_future_sequence_grants:0,postgres_future_function_grants:0,postgres_missing_global_function_revoke:0,postgres_global_table_grants:0,postgres_global_sequence_grants:0,admin_risk_extensions_in_public:0,admin_owned_public_relations:0,admin_owned_public_functions:0,admin_owned_exposed_truncate_tables:0,
 privileged_rpc_without_auth_identity_path:0,privileged_rpc_using_delegated_identity:15,
 public_functions:244,security_definers:207,anonymous_definer_functions:0,
 authenticated_definer_functions:152,definer_missing_search_path:0,
 reviewed_security_definers:207,reviewed_authenticated_definers:152,
 manual_privileged_rpc_review:true,privileged_rpc_catalog_count:152,privileged_rpc_catalog_md5:'f5f6d63ed04cb647d96f7175a054f39a'
};
const report={
 protocol:'V236',environment:'CLEAN_PRODUCTION',approved_for_official_mode:true,
 project_ref:'bbbbbbbbbbbbbbbbbbbb',verification_source:'privileged-read-only:synthetic-fixture',
 verified_at:'2026-10-27T16:00:00Z',
 counts:{business_rows:0,auth_users:0,storage_objects:0,
 unexpected_public_tables:0,missing_public_tables:0,tracked_public_tables:82,
 current_public_tables:82},
 security:safe,migration_review:syntheticCleanMigrationReviewV231
};
const certify=r=>assessOfficialBuild({mode:'official',supabaseUrl:'https://bbbbbbbbbbbbbbbbbbbb.supabase.co',
 report:r,now:Date.parse('2026-10-27T16:02:00Z')});

test('V233 live inventory lists all 152 privileged RPCs, 137 direct identity references, and 15 indirect',()=>{
 assert.equal(source.protocol,'V233');
 assert.equal(source.project_ref,'foczofcmwampjvlfbsqn');
 assert.equal(source.environment,'QA_NONOFFICIAL');
 assert.equal(source.exposed_security_definers,152);
 assert.equal(source.direct_auth_uid_references,137);
 assert.equal(source.delegated_functions,15);
 assert.equal(source.delegated_reaching_auth_uid,15);
 assert.equal(source.privileged_rpc_without_auth_identity_path,0);
 assert.equal(source.chains.length,15);
});
test('V233 all fifteen indirect privileged routines reach auth.uid within one static call edge',()=>{
 assert.ok(source.chains.every(x=>x.hops_to_auth_uid===1));
 assert.ok(source.chains.every(x=>x.immediate_guards?.length>0));
 assert.ok(source.chains.every(x=>x.reachable_nodes>=2));
 assert.equal(new Set(source.chains.map(x=>x.function+'('+x.signature+')')).size,15);
});
test('V233 all fifteen indirect signatures are present in the real V232 pg_proc inventory',()=>{
 const index=new Map(sourceV232.entries.map(x=>[x.name+'('+x.args+')',x]));
 for(const f of source.chains){
  const s=index.get(f.function+'('+f.signature+')');
  assert.ok(s,'Unrecognized privileged signature '+f.function);
  assert.equal(s.references_auth_uid,false);
 }
 assert.equal(sourceV232.counts.direct_uid,137);
});
test('V233 check includes four sacramental correction/replacement endpoints and two decree reversals',()=>{
 const names=new Set(source.chains.map(x=>x.function));
 for(const n of ['apply_baptism_correction','apply_baptism_replacement',
  'apply_confirmation_correction','apply_confirmation_replacement',
  'reverse_correction_decree_with_reason','reverse_replacement_decree_with_reason'])
 assert.ok(names.has(n),n);
});
test('V233 chat, matrimonial notices and historical reconciliation appear in guarded indirect chain',()=>{
 const names=new Set(source.chains.map(x=>x.function));
 for(const n of ['get_chat_room_messages_v166','get_chat_room_messages',
  'count_unread_chat_messages','can_read_matrimonial_notification',
  'can_read_matrimonial_recipient','assess_unresolved_legacy_links_v219',
  'register_historical_baptism','is_app_admin','can_access_diocese'])
 assert.ok(names.has(n),n);
});
test('V233 security preflight SQL is privileged SELECT-only and exposes both call-chain metrics',()=>{
 assert.match(sql,/WITH RECURSIVE public_tables/);
 assert.match(sql,/privileged_rpc_identity_gaps/);
 assert.match(sql,/privileged_rpc_without_auth_identity_path/);
 assert.match(sql,/privileged_rpc_using_delegated_identity/);
 assert.match(sql,/auth\[\.\]uid/);
 assert.doesNotMatch(sql.replace(/--[^\n]*/g,''),/^\s*(?:TRUNCATE|UPDATE|INSERT|DELETE|ALTER|CREATE|REVOKE|GRANT|DROP|DO)\b/gim);
});
test('V233 actual QA preflight confirms the same 152 signatures and still identifies uncleared owner grants',()=>{
 assert.equal(qa.security.authenticatedSecurityDefiners,152);
 assert.equal(qa.security.ownerWithoutGlobalFunctionRevoke,1);
 assert.ok(qa.security.authenticatedFutureTableGrants>0);
 assert.equal(source.semantically_approved_functions,0);
 assert.match(source.important_limitation,/NOT actual authorization/);
});
test('V233 does NOT treat call graph reachability as formal authorization approval',()=>{
 assert.match(fs.readFileSync('release-security-guard-v224.mjs','utf8'),/manual_privileged_rpc_review/);
 assert.equal(source.semantically_approved_functions,0);
 assert.ok(source.remaining_issues.some(s=>s.includes('semantic')));
});
test('V233 clean synthetic release fixture passes the technical check only, without authorizing a real instance',()=>{
 assert.deepEqual(certify(report),{ok:true,mode:'official',problems:[]});
});
for(const bad of [1,2,15,-1,null,undefined]){
 test('V233 one unguarded or missing privileged identity chain value '+String(bad)+' denies release',()=>{
  const security={...safe,privileged_rpc_without_auth_identity_path:bad};
  assert.equal(certify({...report,security}).ok,false);
  assert.ok(assessSecurityPreflightV224(security).some(x=>x.includes('privileged_rpc_without_auth_identity_path')));
 });
}
test('V233 missing delegated count cannot be certified even with zero missing identity paths',()=>{
 const {privileged_rpc_using_delegated_identity,...security}=safe;
 assert.equal(certify({...report,security}).ok,false);
});
test('V233 previous V231 release evidence is obsolete and QA can never be official',()=>{
 assert.equal(certify({...report,protocol:'V231'}).ok,false);
 assert.equal(certify({...report,security:{...safe,protocol:'V231'}}).ok,false);
 const qaAttempt=assessOfficialBuild({mode:'official',
  supabaseUrl:'https://foczofcmwampjvlfbsqn.supabase.co',
  report:{...report,project_ref:'foczofcmwampjvlfbsqn'},now:Date.parse('2026-10-27T16:02:00Z')});
 assert.equal(qaAttempt.ok,false);
});
test('V233 no QA personal records or credentials in real identity graph evidence',()=>{
 const body=JSON.stringify(source);
 assert.doesNotMatch(body,/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
 assert.doesNotMatch(body,/"(?:email|password|access_token|refresh_token|apiKey|service_role_key)"\s*:/i);
});
test('V233 identity chain test is mandatory in both local gate and GitHub CI',()=>{
 const target='scripts/test-rpc-identity-path-v233.mjs';
 for(const f of ['scripts/audit-gate-v90.mjs','.github/workflows/sacramentum-auditoria-v90.yml'])
 assert.ok(fs.readFileSync(f,'utf8').includes(target),f);
});
