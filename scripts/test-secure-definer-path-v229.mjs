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
const approvedV294SignerDecree=new Map([['20261029041812_sacramentum_v294_decree_signer_role_name_and_audit.sql','6d60f378118403950894f6260ab5e87371d1874f5a45c67f6bc0ec45765a85d9']]);
const approvedV293ChanceryAutonomy=new Map([['20261029034915_sacramentum_v293_chancery_role_authorized_no_diocese_concept_gate.sql','7f558e8d059acd1c6cbb7848956c68cf4937a44e700a73afcfccfee8664f4810']]);
const approvedV292ConceptPreflight=new Map([['20261029032959_sacramentum_v292_chancery_concept_approval_preflight.sql','de6eeea79847f58141ead9e449ad3d292afdad625f811f40704bfc51ecf2725b']]);
const approvedV291Search=new Map([['20261029031120_sacramentum_v291_search_celebrated_sources_paged.sql','3ed447cf3918d8ee09dd417ac73234137e7ff917bd652e8a4e28acc5318ae5b0']]);
const approvedV288IntegratedNotifications=new Map([
 ['20261029021505_sacramentum_v288_complete_notifications_and_private_return_evidence.sql','550108e2f481b59a22a7cfef7ed28e0db1f122c3797500cca6f84ad09a44d0c7'],
 ['20261029021716_sacramentum_v289_shared_case_document_sender_and_recipient.sql','41e620bfc8147b9c008d22e971ed04ec1c385cda93b6853bffb5b961f53368ab'],
 ['20261029022546_sacramentum_v290_storage_evidence_parish_guard.sql','8e68d8a2549e6f76ad0f54bb36e97d1a341043f23518211240386616dd97d603'],
]);
const approvedV287NoPrematureCoords=new Map([
 ['20261029013539_sacramentum_v287_keep_full_chancery_forms_remove_new_record_coordinates.sql','2cb2bda635d33e9d37ffc33e2b103a348b14d31609665be61447cbed15a16235'],
]);
const approvedV280AppliedIntegrity=new Map([
 ['20261029000944_sacramentum_v279_parameters_read_only_counter_only.sql','f5c685351063eb19773fe9760ff19e31ddf5927e252dab04a8260db03a4acd48'],
 ['20261029001435_sacramentum_v281_production_ledger_kernel_missing_dependency_repair.sql','76d566458c759176fd1ea732bef8218cca0976aad0bec2ca1fe086042acf7a46'],
 ['20261029001737_sacramentum_v280_issue_decree_without_book_coordinates.sql','1d23b3b33f8f618d0226ee24bb3291c5f0dea819ce644bae11001fc278e7b77f'],
 ['20261029001740_sacramentum_v280_parish_seat_strict_order_and_chancery_receipt.sql','de99e6cf9377c309387b8bde1812ecfc0e3334d29bad53f32d7ebd481d82e851'],
 ['20261029001838_sacramentum_v280b_screen_context_decree_parish_and_chancery.sql','005c5bbdfec8d2e67acbdcc82bd827947a4bbeb41646ff04d7bd9999b564514d'],
 ['20261029002432_sacramentum_v282_diocese_approve_new_correction_reposition_concepts.sql','a1383118546d5967707d4e953588fd6778c22d8b775f06ec2fc508010b4ce196'],
 ['20261029002837_sacramentum_v283_revoke_legacy_parameter_save_rpcs.sql','ab4b9cbce987f4aebd49dcacace1c7e087c3e75cc046eeefdcb0dcead28b7c8c'],
]);
const approvedV276StagedLedger=new Map([
 ['20261028203353_sacramentum_v252_private_book_ledger_staged.sql','24023b8ceb3904df98574141004e8d19428886a0b4f9192ec5c43468910c5a51'],
 ['20261028203407_sacramentum_v253_private_operations_and_dependencies_staged.sql','f0d4282904af1ed013c9cfbb94cb03e23d4bbb45f9229c3d54e63b18238655a1'],
 ['20261028203436_sacramentum_v263_four_sacrament_rpcs_private_staged.sql','1fa78cab679af64bda49f07cb47324b090787e2e50a174047f1bc6c5b972d1ec'],
 ['20261028203453_sacramentum_v264_parish_ledger_context_staged.sql','5d522db9445f5121ce918713c4be414b712f5c5a1cd4f8de680580751d3d9e37'],
 ['20261028203456_sacramentum_v265_new_celebration_attestation_staged.sql','191bb20ea81bd3f0e25d038674a9daefa1e2e6e649a13257736f9c18b596d400'],
 ['20261028203458_sacramentum_v266_two_signatures_physical_review_staged.sql','9f3ea0d8099f412c543229ad03336fb445e831f84189ad7372b188ba1a166fd3'],
 ['20261028203526_sacramentum_v267_open_first_official_book_staged.sql','206656a7cc76bce10385c544f372d078b4be596286669613b34218dcb2f41ca0'],
 ['20261028203530_sacramentum_v270_open_next_official_book_staged.sql','b35d1ffbb92dc7ca0e2bd2aab009b44f805c14abea1999cdc71b1cad41eba9d9'],
 ['20261028203532_sacramentum_v271_open_first_supplementary_book_staged.sql','1689bb89cd6b74ad043cdc5cd078853e09c07e1baaa539ba8a43d1f4d8b7c6f2'],
 ['20261028203535_sacramentum_v272_approve_supplementary_concept_staged.sql','a15b3472af81948252d60db16aa06e6e166fae7b98248a761815b70a404c5ba4'],
 ['20261028203538_sacramentum_v272_open_next_supplementary_book_staged.sql','a08b93a879ab204b8523ba45a0ed0eb7544a19c419e74907e0ffbf7d52fd9e7d'],
 ['20261028203541_sacramentum_v273_institutional_master_review_staged.sql','50d81ca1b60a855c8b7fbbdda33141e882374faafbb82cabcd1afc39f7e89c0b'],
 ['20261028203648_sacramentum_v271_new_supplement_decrees_staged.sql','11a57ba092ad1c7aa8bab0334b84552e8d860af4d9f82c0efd570c74ebdb3883'],
 ['20261028203711_sacramentum_v256_boleta_counter_staged_without_client_grant.sql','7f3b3ffa0537874352a6c9f0553206523b755784ebc70b3ff76e0dead7d87481'],
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
 assert.equal(approvedV280AppliedIntegrity.size,7);
 for(const f of approvedV280AppliedIntegrity.keys())assert.ok(all.includes(f),'V280 migrated RPC missing: '+f);
 assert.equal(approvedV287NoPrematureCoords.size,1);
 for(const f of approvedV287NoPrematureCoords.keys())assert.ok(all.includes(f),'V287 RPC migration missing: '+f);
 assert.equal(approvedV288IntegratedNotifications.size,3);
 for(const f of approvedV288IntegratedNotifications.keys())assert.ok(all.includes(f),'V288 notification migration missing: '+f);
 assert.equal(approvedV291Search.size,1);
 for(const f of approvedV291Search.keys())assert.ok(all.includes(f),'V291 migration missing: '+f);
 assert.equal(approvedV292ConceptPreflight.size,1);
 for(const f of approvedV292ConceptPreflight.keys())assert.ok(all.includes(f),'V292 migration missing: '+f);
 assert.equal(approvedV293ChanceryAutonomy.size,1);
 for(const f of approvedV293ChanceryAutonomy.keys())assert.ok(all.includes(f),'V293 migration missing: '+f);
 assert.equal(approvedV294SignerDecree.size,1);
 for(const f of approvedV294SignerDecree.keys())assert.ok(all.includes(f),'V294 migration missing: '+f);
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
  } else if (approvedV294SignerDecree.has(later)) {
    assert.equal(sha('supabase/migrations/'+later),approvedV294SignerDecree.get(later),'V294 decree signer SQL changed');
    assert.match(body,/issue_chancery_form_decree_v294/);
    assert.match(body,/list_chancery_decree_signers_v294/);
    assert.match(body,/up\.role='chancery'/);
    assert.match(body,/REVOKE ALL ON FUNCTION/);
  } else if (approvedV293ChanceryAutonomy.has(later)) {
    assert.equal(sha('supabase/migrations/'+later),approvedV293ChanceryAutonomy.get(later),'V293 certified autonomy SQL changed');
    assert.match(body,/CREATE OR REPLACE FUNCTION public\.issue_chancery_decree_v280/);
    assert.match(body,/DROP FUNCTION IF EXISTS public\.check_chancery_decree_concept_v292/);
    assert.doesNotMatch(body,/supplementary_concept_approvals_v272/);
    assert.match(body,/up\.role='chancery'/);
  } else if (approvedV292ConceptPreflight.has(later)) {
    assert.equal(sha('supabase/migrations/'+later),approvedV292ConceptPreflight.get(later),'V292 reviewed SQL changed');
    assert.match(body,/check_chancery_decree_concept_v292/);
    assert.match(body,/up\.role='chancery'/);
    assert.match(body,/approved_by IS NOT NULL/);
    assert.doesNotMatch(body,/^\s*INSERT\s+INTO\b/mi);
  } else if (approvedV291Search.has(later)) {
    assert.equal(sha('supabase/migrations/'+later),approvedV291Search.get(later),'V291 reviewed SQL changed');
    assert.match(body,/search_celebrated_sacramental_records_v291/);
    assert.match(body,/up\.auth_user_id=auth\.uid\(\)/);
    assert.match(body,/REVOKE ALL ON FUNCTION/);
    assert.doesNotMatch(body,/^\s*TRUNCATE\s+TABLE\b/mi);
  } else if (approvedV288IntegratedNotifications.has(later)) {
    assert.equal(sha('supabase/migrations/'+later),approvedV288IntegratedNotifications.get(later),
      'V288/V289 integrated notifications migration changed without review: '+later);
    assert.match(body,/SECURITY DEFINER/);
    assert.match(body,/REVOKE ALL ON FUNCTION public\./);
    assert.doesNotMatch(body,/^\s*TRUNCATE\s+TABLE\b/mi);
    assert.doesNotMatch(body,/^\s*DELETE\s+FROM\s+public\./mi);
    if(later.includes('v288_')){assert.match(body,/guard_v277_case_completion/);assert.match(body,/sacramental_evidence_sender_insert_v288/);}
    if(later.includes('v289_'))assert.match(body,/get_sacramental_case_document_v289/);
    if(later.includes('v290_')){assert.match(body,/can_access_sacramental_evidence_v290/);assert.match(body,/up\.auth_user_id=auth\.uid\(\)/);}
  } else if (approvedV287NoPrematureCoords.has(later)) {
    assert.equal(sha('supabase/migrations/'+later),approvedV287NoPrematureCoords.get(later),
      'V287 migration changed without integrity approval: '+later);
    assert.match(body,/CREATE FUNCTION public\.issue_chancery_form_decree_v287/);
    assert.match(body,/issue_chancery_decree_v280/);
    assert.match(body,/noPhysicalCoordinatesAssigned/);
    assert.match(body,/REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC,anon,authenticated/);
    assert.doesNotMatch(body,/^\s*TRUNCATE\s+TABLE\b/mi);
  } else if (approvedV280AppliedIntegrity.has(later)) {
    assert.equal(sha('supabase/migrations/'+later),approvedV280AppliedIntegrity.get(later),
      'changed approved V280 SQL without renewed review: '+later);
    assert.doesNotMatch(body,/^\s*TRUNCATE\s+TABLE\b/mi);
    assert.doesNotMatch(body,/^\s*DELETE\s+FROM\s+public\./mi);
    if(later.includes('v279_')) {
      assert.match(body,/REVOKE INSERT, UPDATE, DELETE/);
      assert.match(body,/update_parish_boleta_counter_v256/);
    } else if (later.includes('v283_')) {
      assert.match(body,/REVOKE EXECUTE ON FUNCTION public\.save_baptism_parameters/);
      assert.match(body,/save_confirmation_parameters/);
      assert.match(body,/save_marriage_parameters/);
      assert.match(body,/save_funeral_parameters/);
    } else if (later.includes('v281_')) {
      assert.match(body,/append_verified_batch_v281/);
      assert.match(body,/REVOKE ALL ON FUNCTION sacramentum_ledger/);
    } else {
      assert.match(body,/SECURITY DEFINER/);
      assert.match(body,/auth\.uid\(\)/);
      assert.match(body,/REVOKE ALL ON FUNCTION public\./);
    }
  } else if (approvedV276StagedLedger.has(later)) {
    assert.equal(sha('supabase/migrations/'+later),approvedV276StagedLedger.get(later),
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
