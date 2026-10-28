import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syntheticCleanMigrationReviewV231 } from './release-test-fixture-v231.mjs';
import {createHash} from 'node:crypto';
import {assessOfficialBuild} from '../release-guard-core-v223.mjs';

const rep=JSON.parse(fs.readFileSync('AUDITORIA_SEGURIDAD_RPC_LIVE_V229.json','utf8'));
const sha=f=>createHash('sha256').update(fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')).digest('hex');
const currentMigration='supabase/migrations/20261027044045_secure_definer_pg_temp_last_v229.sql';
// V276: exact-byte certification of the 14 INSTALL-ONLY migrations already applied to Supabase.
// Every newly deployed public RPC remains REVOKED until separately audited official cutover.
const rawSha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const approvedV276StagedLedger=new Map([
 ['20261028203353_sacramentum_v252_private_book_ledger_staged.sql','a86d1bc08d6f8922240f575028a4549f3c99e3fccab403f4fadbcec2360a05f7'],
 ['20261028203407_sacramentum_v253_private_operations_and_dependencies_staged.sql','3e1fcff911e5f613907a8b752c416876ac2ffff6a7ec9916a4b99b9535760222'],
 ['20261028203436_sacramentum_v263_four_sacrament_rpcs_private_staged.sql','0d35a37747c748e8c00cb49a089c1dd212ce1fededcc3791b03d22520cd84510'],
 ['20261028203453_sacramentum_v264_parish_ledger_context_staged.sql','dd77a6e697cfb361ee7aeaa170f02d8d09702579d3aa63df072bb81ef6098128'],
 ['20261028203456_sacramentum_v265_new_celebration_attestation_staged.sql','a6b93a3ee2736837574a64d36bb104b9f8c8516aa09d1656bbe4d8b12ad7dabd'],
 ['20261028203458_sacramentum_v266_two_signatures_physical_review_staged.sql','091b5e27a113f812e5aee58e995e82b468a707a24ebf9c2ee65a553d26ab0fc1'],
 ['20261028203526_sacramentum_v267_open_first_official_book_staged.sql','677a872161bb6d270f7baa17d778d7397c29424674f0210046308d6b68fc5316'],
 ['20261028203530_sacramentum_v270_open_next_official_book_staged.sql','dc16f66dc11eb6e0898c9c691952027bba46e4fb5a992d66706eb0ae6e97f7f4'],
 ['20261028203532_sacramentum_v271_open_first_supplementary_book_staged.sql','aea3e3a8a85070e2375d08d6eb5a0715c64bd55880d1676f7cac23d7caeb8d23'],
 ['20261028203535_sacramentum_v272_approve_supplementary_concept_staged.sql','f1c597a64a217b47dc5ec3a478aa57824966b141bc9cbd298ea38f620c8d1cd6'],
 ['20261028203538_sacramentum_v272_open_next_supplementary_book_staged.sql','de91ce7c275e6ebd2e0e78ed7436579ba0c6381ae6454a536e756375fc4ff7d2'],
 ['20261028203541_sacramentum_v273_institutional_master_review_staged.sql','372c42dc00b7e0f79d074e0f07bf95a53b71064976f8f16634ce2cdd15d95d47'],
 ['20261028203648_sacramentum_v271_new_supplement_decrees_staged.sql','1c942f970c3a611bf6ba952a5ad3988fe0f32d8c6798c72718c57bbe29044f09'],
 ['20261028203711_sacramentum_v256_boleta_counter_staged_without_client_grant.sql','dceb4404aa36d73afa2cf360815cf890f823aabbd9379ad67307dce13c66de5a'],
]);
const safeSecurity={...rep.preflight.metrics,protocol:'V236',unused_pg_graphql_enabled:0,qa_legacy_dbf_concept_rows:0,qa_legacy_template_snapshot_rows:0,postgres_future_table_grants:0,postgres_future_sequence_grants:0,postgres_future_function_grants:0,postgres_missing_global_function_revoke:0,postgres_global_table_grants:0,postgres_global_sequence_grants:0,admin_risk_extensions_in_public:0,admin_owned_public_relations:0,admin_owned_public_functions:0,admin_owned_exposed_truncate_tables:0,privileged_rpc_without_auth_identity_path:0,privileged_rpc_using_delegated_identity:15,dangerous_default_table_grants:0,
 open_default_function_grants:0,future_user_table_grants:0,future_user_sequence_grants:0,
 future_user_function_grants:0,creators_missing_global_function_revoke:0,
 authenticated_definer_functions:151,reviewed_security_definers:207,reviewed_authenticated_definers:151,manual_privileged_rpc_review:true,privileged_rpc_catalog_count:151,privileged_rpc_catalog_md5:'60019131a532a623a91c6128b9ab8daa'};
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
 assert.equal(approvedV276StagedLedger.size,14);
 for(const f of approvedV276StagedLedger.keys())assert.ok(all.includes(f),'certified migration missing: '+f);
 for(const later of all.filter(x=>('supabase/migrations/'+x)>currentMigration)) {
  const body=fs.readFileSync('supabase/migrations/'+later,'utf8');
  if(later==='20261027125848_harden_chat_actor_guard_v232.sql') {
    assert.equal((body.match(/CREATE OR REPLACE FUNCTION public[.]/g)||[]).length,3,'V232 only three reviewed functions');
    assert.equal((body.match(/IF auth[.]uid[(][)] IS NULL THEN/g)||[]).length,3,'V232 each mutator requires authenticated user');
    for(const name of ['mark_chat_room_read','send_chat_message','withdraw_chat_message'])
      assert.match(body,new RegExp('CREATE OR REPLACE FUNCTION public[.]'+name+'[(]'));
  } else if(later==='20261027170500_contain_document_void_exposure_v248.sql') {
    assert.match(body,/REVOKE EXECUTE ON FUNCTION public\.void_document_issuance\(uuid,text\) FROM authenticated/);
    assert.doesNotMatch(body,/\b(?:INSERT INTO|UPDATE\s+public\.|DELETE FROM|TRUNCATE\s+TABLE|DROP TABLE)\b/i);
  } else if(later==='20261027152000_close_original_legacy_batch_enumeration_v245.sql') {
    assert.match(body,/can_manage_legacy_import/);
    assert.match(body,/reconcile_legacy_anulacion_batch/);
    assert.match(body,/apply_legacy_import_batch/);
    assert.match(body,/audited initial batch lookup drift/);
    assert.doesNotMatch(body,/\b(?:INSERT INTO|UPDATE\s+public\.|DELETE FROM|TRUNCATE\s+TABLE|DROP TABLE)\b/i);
  } else if(later==='20261027143000_authorize_legacy_batch_before_profile_v244.sql') {
    assert.match(body,/can_manage_legacy_import/);
    assert.match(body,/apply_legacy_import_batch_v2/);
    assert.match(body,/apply_legacy_import_batch_v3/);
    assert.match(body,/audited lookup drift/);
    assert.doesNotMatch(body,/\\b(?:INSERT INTO|UPDATE\\s+public\\.|DELETE FROM|TRUNCATE\\s+TABLE|DROP TABLE)\\b/i);
  } else if(later==='20261027133000_harden_materialize_chancery_v243.sql') {
    assert.match(body,/pg_get_functiondef/);
    assert.match(body,/materialize_legacy_decrees_v68/);
    assert.match(body,/v_chancery IS NULL/);
    assert.doesNotMatch(body,/\\b(?:INSERT INTO|UPDATE\\s+public\\.|DELETE FROM|TRUNCATE\\s+TABLE|DROP TABLE)\\b/i);
  } else if (approvedV276StagedLedger.has(later)) {
    assert.equal(rawSha('supabase/migrations/'+later),approvedV276StagedLedger.get(later),
      'new staged migration content changed without re-certification: '+later);
    assert.doesNotMatch(body,/^\s*GRANT\s+EXECUTE\b/mi,
      'V276 cannot expose an installed but not activated RPC');
    assert.match(body,/\bREVOKE\s+ALL\b/i,
      'V276 must explicitly revoke privileged access');
    assert.doesNotMatch(body,/^\s*TRUNCATE\s+TABLE\b/mi,
      'V276 installation must not purge historical test data');
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
