import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syntheticCleanMigrationReviewV231 } from './release-test-fixture-v231.mjs';
import {assessOfficialBuild} from '../release-guard-core-v223.mjs';
import {assessSecurityPreflightV224} from '../release-security-guard-v224.mjs';

const report=JSON.parse(fs.readFileSync('AUDITORIA_GRAPHQL_SUPERFICIE_LIVE_V230.json','utf8'));
const migration='supabase/migrations/20261027115104_disable_unused_pg_graphql_v230.sql';
const preflight='scripts/release-security-preflight-v230.sql';
const qa=JSON.parse(fs.readFileSync('AUDITORIA_SEGURIDAD_RPC_LIVE_V229.json','utf8'));
const goodSecurity={...qa.preflight.metrics, protocol:'V236',
 unused_pg_graphql_enabled:0,qa_legacy_dbf_concept_rows:0,qa_legacy_template_snapshot_rows:0,postgres_future_table_grants:0,postgres_future_sequence_grants:0,postgres_future_function_grants:0,postgres_missing_global_function_revoke:0,postgres_global_table_grants:0,postgres_global_sequence_grants:0,admin_risk_extensions_in_public:0,admin_owned_public_relations:0,admin_owned_public_functions:0,admin_owned_exposed_truncate_tables:0,privileged_rpc_without_auth_identity_path:0,privileged_rpc_using_delegated_identity:15,dangerous_default_table_grants:0,
 open_default_function_grants:0,future_user_table_grants:0,
 future_user_sequence_grants:0,future_user_function_grants:0,
 creators_missing_global_function_revoke:0,
 reviewed_security_definers:207,reviewed_authenticated_definers:152,
 manual_privileged_rpc_review:true,privileged_rpc_catalog_count:152,privileged_rpc_catalog_md5:'f5f6d63ed04cb647d96f7175a054f39a'};
const fixture={
 migration_review:syntheticCleanMigrationReviewV231,protocol:'V236',environment:'CLEAN_PRODUCTION',
 approved_for_official_mode:true,project_ref:'bbbbbbbbbbbbbbbbbbbb',
 verified_at:'2026-10-27T11:50:00Z',
 verification_source:'privileged-read-only:synthetic-test-only',
 counts:{business_rows:0,auth_users:0,storage_objects:0,
 unexpected_public_tables:0,missing_public_tables:0,
 tracked_public_tables:82,current_public_tables:82},
 security:goodSecurity};
const certify=x=>assessOfficialBuild({
 mode:'official',supabaseUrl:'https://bbbbbbbbbbbbbbbbbbbb.supabase.co',
 report:x,now:Date.parse('2026-10-27T11:52:00Z')});

test('V230 historical QA GraphQL evidence is actual server-side data, never an official release',()=>{
 assert.equal(report.protocol,'V230');
 assert.equal(report.project_ref,'foczofcmwampjvlfbsqn');
 assert.equal(report.testOnly,true);
 assert.equal(report.officialAllowed,false);
 assert.match(report.source,/apply_migration/);
});
test('V230 migration is the exact applied database version, safe if already disabled',()=>{
 assert.equal(report.migration.appliedToQa,true);
 assert.equal(report.migration.version,'20261027115104');
 assert.equal(report.migration.file,migration);
 assert.equal(report.migration.name,'disable_unused_pg_graphql_v230');
 const src=fs.readFileSync(migration,'utf8');
 assert.match(src,/DROP EXTENSION IF EXISTS pg_graphql RESTRICT;/);
 assert.doesNotMatch(src,/\bCASCADE\b|\b(?:TRUNCATE|DELETE FROM|INSERT INTO|DROP TABLE|DROP SCHEMA)\b/i);
 const later=fs.readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort();
 assert.ok(later.includes(migration.split('/').at(-1)),'V230 migration must remain versioned');
 assert.deepEqual(later.filter(x=>('supabase/migrations/'+x)>migration),
  ['20261027121500_harden_context_chat_matrimonial_identity_v242.sql',
   '20261027125848_harden_chat_actor_guard_v232.sql'],'Only reviewed V242 and V232 may follow GraphQL hardening');
});
test('V230 before/after SQL verification confirms GraphQL extension disappeared and placeholder returns disabled',()=>{
 assert.equal(report.migration.installedPgGraphqlBefore,1);
 assert.equal(report.migration.installedPgGraphqlAfter,0);
 assert.equal(report.migration.graphqlPlaceholderMessage,'pg_graphql extension is not enabled.');
 assert.equal(report.migration.removedBusinessRows,0);
});
test('V230 official Supabase security advisors dropped 64 visibility warnings to zero',()=>{
 assert.equal(report.adviser.priorGraphqlAuthenticatedVisibilityWarnings,64);
 assert.equal(report.adviser.postGraphqlAuthenticatedVisibilityWarnings,0);
});
test('V230 disabling GraphQL does not imply the privileged REST RPCs became safe',()=>{
 assert.equal(report.adviser.postAuthenticatedSecurityDefinerWarnings,152);
 assert.equal(report.adviser.postLeakedPasswordProtectionWarnings,1);
 assert.equal(report.adviser.postRlsNoPolicyInfo,5);
 assert.ok(report.boundaries.some(x=>x.includes('152 RPC')));
});
test('V230 actual GoTrue authentication and cross-jurisdiction role separation work after drop',()=>{
 const t=report.testEvidence;
 assert.equal(t.genuineQaGoTrueLoginsPassed,8);
 assert.equal(t.genuineQaGoTrueLoginsTotal,8);
 assert.equal(t.liveDeniedForeignSacramentCreation,24);
 assert.equal(t.liveDeniedForeignSacramentCreationTotal,24);
});
test('V230 14 real rollback sacramental and chancellery SQL scenarios remain valid',()=>{
 assert.equal(report.testEvidence.rollbackDbScenariosPassed,14);
 assert.equal(report.testEvidence.rollbackDbScenariosTotal,14);
 assert.equal(report.testEvidence.qaCountFieldsUnchanged,13);
});
test('V230 preserves all 13 QA business, audit, pending and auth counts',()=>{
 const v228=JSON.parse(fs.readFileSync('AUDITORIA_TRANSACCIONES_LIVE_V228.json','utf8'));
 assert.deepEqual(report.qaCountsBefore,v228.countsAfter);
 assert.deepEqual(report.qaCountsAfter,v228.countsAfter);
 assert.equal(report.qaCountsAfter.auth_accounts,12);
 assert.equal(report.qaCountsAfter.baptisms,5040);
});
test('V230 React code has no dependency on the GraphQL interface we disabled',()=>{
 let matches=0;
 function visit(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
   const f=dir+'/'+entry.name;
   if(entry.isDirectory())visit(f);
   else if(/\.(?:js|jsx|mjs|ts|tsx)$/.test(entry.name)){
    const s=fs.readFileSync(f,'utf8');
    if(/graphql_public|graphql\/v1|pg_graphql|supabase\.graphql/i.test(s))matches++;
   }
  }
 }
 visit('src');
 assert.equal(matches,0);
 assert.equal(report.migration.liveReactSourceGraphqlReferences,0);
});
test('V230 security preflight uses a read-only count of unexpected pg_graphql extension',()=>{
 const sql=fs.readFileSync(preflight,'utf8');
 assert.match(sql,/unused_pg_graphql_enabled/);
 assert.match(sql,/pg_extension WHERE extname='pg_graphql'/);
 const executable=sql.replace(/--[^\n]*/g,'');
 assert.doesNotMatch(executable,/^\s*(?:INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|REVOKE|GRANT|CREATE|DO)\b/gim);
 assert.equal(report.preflight.sqlFile,preflight);
 assert.equal(report.preflight.graphqlExtensionEnabled,0);
});
test('V230 clean imaginary attestation remains possible, but alone is not legal authorization',()=>{
 assert.deepEqual(certify(fixture),{ok:true,mode:'official',problems:[]});
});
test('V230 enabling unused pg_graphql again denies official build',()=>{
 const security={...goodSecurity,unused_pg_graphql_enabled:1};
 const out=certify({...fixture,security});
 assert.equal(out.ok,false);
 assert.ok(out.problems.some(s=>s.includes('unused_pg_graphql_enabled')));
});
test('V230 absent security measurement fails closed',()=>{
 const {unused_pg_graphql_enabled,...security}=goodSecurity;
 assert.equal(certify({...fixture,security}).ok,false);
 assert.ok(assessSecurityPreflightV224(security).some(s=>s.includes('unused_pg_graphql_enabled')));
});
test('V230 stale V229 audit, V229 security data, and QA project never authorize official operation',()=>{
 assert.equal(certify({...fixture,protocol:'V229'}).ok,false);
 assert.equal(certify({...fixture,security:{...goodSecurity,protocol:'V229'}}).ok,false);
 const q=assessOfficialBuild({
  mode:'official',supabaseUrl:'https://foczofcmwampjvlfbsqn.supabase.co',
  report:{...fixture,project_ref:'foczofcmwampjvlfbsqn'},now:Date.parse('2026-10-27T11:52:00Z')});
 assert.equal(q.ok,false);
});
test('V230 remaining supabase_admin default ACL dangers are not overlooked',()=>{
 assert.equal(report.preflight.remainingSupabaseAdminFutureTableGrants,16);
 assert.equal(report.preflight.remainingSupabaseAdminFutureSequenceGrants,6);
 assert.equal(report.preflight.remainingSupabaseAdminFutureFunctionGrants,2);
 assert.equal(report.preflight.creatorsWithoutGlobalPublicExecuteRevoke,1);
 assert.equal(report.preflight.authenticatedSecurityDefiners,152);
});
test('V230 evidence contains no user UUIDs, access tokens, secrets or names',()=>{
 const s=JSON.stringify(report);
 assert.doesNotMatch(s,/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
 assert.doesNotMatch(s,/"(?:email|password|refresh_token|access_token|service_role_key|apiKey)"\s*:/i);
});
test('V230 QA evidence test is installed in local master and GitHub CI gates',()=>{
 for(const p of ['scripts/audit-gate-v90.mjs','.github/workflows/sacramentum-auditoria-v90.yml']){
  assert.match(fs.readFileSync(p,'utf8'),/scripts\/test-disable-graphql-v230\.mjs/);
 }
 assert.doesNotMatch(fs.readFileSync('.github/workflows/sacramentum-auditoria-v90.yml','utf8'),/run:.*apply_migration/);
});
