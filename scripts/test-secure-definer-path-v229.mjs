import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syntheticCleanMigrationReviewV231 } from './release-test-fixture-v231.mjs';
import {createHash} from 'node:crypto';
import {assessOfficialBuild} from '../release-guard-core-v223.mjs';

const rep=JSON.parse(fs.readFileSync('AUDITORIA_SEGURIDAD_RPC_LIVE_V229.json','utf8'));
const sha=f=>createHash('sha256').update(fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')).digest('hex');
const currentMigration='supabase/migrations/20261027044045_secure_definer_pg_temp_last_v229.sql';
const safeSecurity={...rep.preflight.metrics,protocol:'V236',unused_pg_graphql_enabled:0,qa_legacy_dbf_concept_rows:0,qa_legacy_template_snapshot_rows:0,postgres_future_table_grants:0,postgres_future_sequence_grants:0,postgres_future_function_grants:0,postgres_missing_global_function_revoke:0,postgres_global_table_grants:0,postgres_global_sequence_grants:0,admin_risk_extensions_in_public:0,admin_owned_public_relations:0,admin_owned_public_functions:0,admin_owned_exposed_truncate_tables:0,privileged_rpc_without_auth_identity_path:0,privileged_rpc_using_delegated_identity:15,dangerous_default_table_grants:0,
 open_default_function_grants:0,future_user_table_grants:0,future_user_sequence_grants:0,
 future_user_function_grants:0,creators_missing_global_function_revoke:0,
 reviewed_security_definers:207,reviewed_authenticated_definers:152,manual_privileged_rpc_review:true,privileged_rpc_catalog_count:152,privileged_rpc_catalog_md5:'d68b18810533c368d26f2c43e2ea9711'};
const fixture={
 migration_review:syntheticCleanMigrationReviewV231,protocol:'V236',environment:'CLEAN_PRODUCTION',approved_for_official_mode:true,
 project_ref:'bbbbbbbbbbbbbbbbbbbb',verified_at:'2026-10-27T04:44:00Z',
 verification_source:'privileged-read-only:synthetic-only',
 counts:{business_rows:0,auth_users:0,storage_objects:0,unexpected_public_tables:0,missing_public_tables:0,
 tracked_public_tables:82,current_public_tables:82},security:safeSecurity};
const now=Date.parse('2026-10-27T04:48:00Z');
const certify=(r=fixture,url='https://bbbbbbbbbbbbbbbbbbbb.supabase.co')=>
 assessOfficialBuild({mode:'official',supabaseUrl:url,report:r,now});

test('V229 Supabase QA migration alters 131 definer search paths, including 88 callable by authenticated',()=>{
 assert.equal(rep.protocol,'V229');
 assert.equal(rep.project_ref,'foczofcmwampjvlfbsqn');
 assert.equal(rep.approvedForOfficialMode,false);
 assert.equal(rep.migration.applied,true);
 assert.equal(rep.migration.priorInsecurePublicOnlyDefinerPaths,131);
 assert.equal(rep.migration.priorExposedAuthDefinerPaths,88);
 assert.equal(rep.migration.afterInsecurePublicOnlyDefinerPaths,0);
 assert.equal(rep.migration.afterTempLastDefinerPaths,131);
 assert.equal(rep.migration.afterTempLastAuthCallable,88);
 assert.equal(rep.migration.additionalSecurityDefinersWithOtherSearchPath,76);
 assert.equal(rep.migration.remoteVersion,'20261027044045');
});
test('V229 remote migration version is identical to the checked-in CLI-created migration filename',()=>{
 assert.equal(rep.migration.localFile,currentMigration);
 assert.equal(rep.migration.sha256,sha(currentMigration));
 assert.match(currentMigration,/^supabase\/migrations\/20261027044045_/);
 const all=fs.readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort();
 for(const later of all.filter(x=>('supabase/migrations/'+x)>currentMigration)) {
  const body=fs.readFileSync('supabase/migrations/'+later,'utf8');
  if(later==='20261027125848_harden_chat_actor_guard_v232.sql') {
    assert.equal((body.match(/CREATE OR REPLACE FUNCTION public[.]/g)||[]).length,3,'V232 only three reviewed functions');
    assert.equal((body.match(/IF auth[.]uid[(][)] IS NULL THEN/g)||[]).length,3,'V232 each mutator requires authenticated user');
    for(const name of ['mark_chat_room_read','send_chat_message','withdraw_chat_message'])
      assert.match(body,new RegExp('CREATE OR REPLACE FUNCTION public[.]'+name+'[(]'));
  } else {
    assert.doesNotMatch(body,/\b(?:ALTER|CREATE|DROP)\s+(?:(?:OR\s+REPLACE)\s+)?FUNCTION\b|\bSET\s+search_path\b/i,
      'later migration must not alter privileged functions without new certification: '+later);
  }
 }
});
test('V229 migration is idempotent, targets only postgres-owned public SECURITY DEFINERs and never touches data',()=>{
 const sql=fs.readFileSync(currentMigration,'utf8');
 for(const term of ["p.prosecdef","n.nspname = 'public'","p.proowner = 'postgres'::regrole",
  "p.proconfig @> ARRAY['search_path=public']::text[]","pg_get_function_identity_arguments",
  "SET search_path TO public, pg_temp","ALTER FUNCTION","unexpected_owners"])
  assert.ok(sql.includes(term),term);
 assert.doesNotMatch(sql,/\b(?:INSERT INTO|UPDATE\s+public\.|DELETE FROM|TRUNCATE\s+TABLE|DROP TABLE|CREATE TABLE)\b/i);
 assert.doesNotMatch(sql,/\bGRANT\s+EXECUTE\b/i);
});
test('V229 hardening report commits no person UUIDs, passwords, tokens or source bodies',()=>{
 const raw=JSON.stringify(rep);
 assert.doesNotMatch(raw,/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
 assert.doesNotMatch(raw,/"(?:email|password|refresh_token|access_token|encrypted_password|service_role_key)"\s*:/i);
 assert.equal(rep.dataTransferredToOfficial,0);
 assert.equal(rep.qaUsersMigratedToOfficial,0);
});
test('V229 QA stage is tested with 14 live PostgreSQL BEGIN/ROLLBACK workflows',()=>{
 assert.equal(rep.transactionalRevalidation.total,14);
 assert.equal(rep.transactionalRevalidation.passed,14);
 assert.equal(rep.transactionalRevalidation.allRollbackResults,true);
 assert.equal(rep.transactionalRevalidation.rollbackRequired,true);
 assert.ok(rep.transactionalRevalidation.scenarios.every(x=>x.passed===true));
 assert.equal(new Set(rep.transactionalRevalidation.scenarios.map(x=>x.script)).size,14);
});
test('V229 following hardening, all 13 QA counts are stable and remain nonofficial',()=>{
 const previous=JSON.parse(fs.readFileSync('AUDITORIA_TRANSACCIONES_LIVE_V228.json','utf8'));
 assert.deepEqual(rep.qaCountsBefore,previous.countsAfter);
 assert.deepEqual(rep.qaCountsAfter,previous.countsAfter);
 assert.equal(rep.qaCountsAfter.baptisms,5040);
 assert.equal(rep.qaCountsAfter.confirmations,2091);
 assert.equal(rep.qaCountsAfter.marriages,1261);
 assert.equal(rep.qaCountsAfter.funerals,1);
 assert.equal(rep.qaCountsAfter.auth_accounts,12);
});
test('V229 privileged preflight SQL is SELECT-only and inspects the new shadowing risk',()=>{
 assert.equal(rep.preflight.sha256,sha(rep.preflight.file));
 assert.equal(rep.preflight.metrics.insecure_public_only_definers,0);
 const sql=fs.readFileSync(rep.preflight.file,'utf8');
 assert.match(sql,/insecure_public_only_definers/);
 assert.match(sql,/proconfig @> ARRAY\['search_path=public'\]/);
 const executable=sql.replace(/--[^\n]*/g,'');
 assert.doesNotMatch(executable,/^\s*(?:UPDATE|DELETE|INSERT|TRUNCATE|ALTER|GRANT|REVOKE|DROP|CREATE|DO)\b/gim);
});
test('V229 official build denies one dangerous SECURITY DEFINER even with a clean synthetic record census',()=>{
 assert.deepEqual(certify(),{ok:true,mode:'official',problems:[]});
 const problem=certify({...fixture,security:{...safeSecurity,insecure_public_only_definers:1}});
 assert.equal(problem.ok,false);
 assert.ok(problem.problems.some(x=>x.includes('insecure_public_only_definers')));
});
test('V229 official build denies missing path count and stale V226 attestation',()=>{
 assert.equal(certify({...fixture,security:{...safeSecurity,insecure_public_only_definers:undefined}}).ok,false);
 assert.equal(certify({...fixture,protocol:'V226'}).ok,false);
 assert.equal(certify({...fixture,security:{...safeSecurity,protocol:'V226'}}).ok,false);
 assert.equal(certify({...fixture,project_ref:'foczofcmwampjvlfbsqn'},'https://foczofcmwampjvlfbsqn.supabase.co').ok,false);
});
test('V229 real QA security is still NOT formally cleared for official production',()=>{
 const m=rep.preflight.metrics;
 assert.equal(m.public_tables,82);
 assert.equal(m.rls_disabled,0);
 assert.equal(m.security_definers,207);
 assert.equal(m.authenticated_definer_functions,152);
 assert.equal(m.anonymous_definer_functions,0);
 assert.ok(m.future_user_table_grants>0);
 assert.ok(m.creators_missing_global_function_revoke>0);
 assert.ok(rep.limitations.some(x=>x.includes('supabase_admin')));
});
test('V229 new security checks run in GitHub CI and master gate and are not run with database credentials',()=>{
 const master=fs.readFileSync('scripts/audit-gate-v90.mjs','utf8');
 const ci=fs.readFileSync('.github/workflows/sacramentum-auditoria-v90.yml','utf8');
 assert.match(master,/scripts\/test-secure-definer-path-v229\.mjs/);
 assert.match(ci,/scripts\/test-secure-definer-path-v229\.mjs/);
 assert.doesNotMatch(ci,/run:.*seal-definer-path-audit-v229/);
});
