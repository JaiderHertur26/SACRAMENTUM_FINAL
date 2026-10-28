import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {EXPECTED_PRIVILEGED_RPC_CATALOG_MD5_V236} from '../release-security-guard-v224.mjs';
import {HISTORICAL_MIGRATION_MANIFEST_SHA256,CLEAN_REPLAY_HISTORICAL_MIGRATIONS} from '../release-migration-provenance-v231.mjs';
import {report} from './audit-production-migration-safety-v231.mjs';

const sql=fs.readFileSync('supabase/migrations/20261027143000_authorize_legacy_batch_before_profile_v244.sql','utf8');
const e=JSON.parse(fs.readFileSync('AUDITORIA_ACL_IMPORTACIONES_LIVE_V244.json','utf8'));
test('V244 corrects confirmed cross-diocese ANULACION batch type disclosure, not theoretical only',()=>{
 assert.equal(e.before.foreign_existing_anulacion_leaked_message_both_rpcs,true);
 assert.equal(e.before.independent_other_diocese,true);
 assert.equal(e.live_sql_cases,6);
 assert.equal(e.live_cases_passed,6);
 assert.equal(e.qa_data_changed,false);
});
test('V244 both exposed import wrappers authorize scope before inspecting profile or acquiring row lock',()=>{
 for(const signature of ['apply_legacy_import_batch_v2(uuid,integer)','apply_legacy_import_batch_v3(uuid,integer)'])
  assert.ok(sql.includes(signature),signature);
 assert.match(sql,/where id=p_batch_id and public[.]can_manage_legacy_import[(]parish_id,diocese_id[)] for update/);
 assert.match(sql,/where id=p_batch_id and public[.]can_manage_legacy_import[(]parish_id,diocese_id[)];/);
 assert.equal(e.routines.length,2);
});
test('V244 fails closed if any historically audited SQL lookup has drifted',()=>{
 assert.match(sql,/v_hits <> 1/);
 assert.match(sql,/audited lookup drift/);
 assert.match(sql,/pg_get_functiondef/);
 assert.match(sql,/to_regprocedure/);
 assert.match(sql,/EXECUTE v_src/);
});
test('V244 demonstrates foreign existing and foreign missing are indistinguishable for both wrappers',()=>{
 for(const name of ['apply_legacy_import_batch_v2','apply_legacy_import_batch_v3']){
  const relevant=e.after.filter(t=>t.rpc===name);
  assert.equal(relevant.length,3);
  assert.equal(relevant.find(t=>t.scenario==='foreign_real_anulacion').result,'generic_not_found');
  assert.equal(relevant.find(t=>t.scenario==='foreign_absent_batch').result,'generic_not_found');
  assert.equal(relevant.find(t=>t.scenario==='authorized_real_anulacion').result,'purposeful_chancery_restriction');
 }
 assert.equal(e.preserved_authorized_behavior,true);
});
test('V244 152 privileged functions pinned to independent real QA fingerprint',()=>{
 assert.equal(e.catalogue_functions,152);
 assert.equal(e.catalogue_md5_after,'d10ec9b11e3726fc8427dd983400028e'); // historical verified QA V244
 const historic=JSON.parse(fs.readFileSync('AUDITORIA_CANCILLERIA_HISTORICA_V243.json','utf8'));
 assert.equal(historic.privileged_catalogue_after,e.catalogue_md5_before);
 assert.notEqual(e.catalogue_md5_before,e.catalogue_md5_after);
});
test('V244 only adds reviewed DDL migration, preserving quarantined historical data writes',()=>{
 const inv=report();
 assert.equal(inv.migrationCount,184);
 assert.equal(CLEAN_REPLAY_HISTORICAL_MIGRATIONS,166);
 assert.equal(inv.directWriteMigrationCount,14);
 assert.equal(inv.directWriteStatementCount,45);
 const row=inv.checks.filter(x=>x.file.endsWith('authorize_legacy_batch_before_profile_v244.sql'));
 assert.equal(row.length,1);
 assert.equal(row[0].directWrites,0);
 assert.equal(crypto.createHash('sha256').update(JSON.stringify(inv.checks.slice(0,CLEAN_REPLAY_HISTORICAL_MIGRATIONS))).digest('hex'),HISTORICAL_MIGRATION_MANIFEST_SHA256);
});
test('V244 evidence explicitly cannot be used to claim official authorization or complete semantic audit',()=>{
 assert.equal(e.environment,'SUPABASE_QA_ONLY_NOT_OFFICIAL');
 assert.equal(e.official_operations_authorized,false);
 assert.equal(e.semantically_certified_152_functions,undefined);
 assert.equal(e.semantic_reviews_formally_signed,0);
 assert.match(e.limitations,/do not prove all 152/i);
});
test('V244 is mandatory in local master suite and GitHub CI workflow',()=>{
 for(const filename of ['scripts/audit-gate-v90.mjs','.github/workflows/sacramentum-auditoria-v90.yml'])
  assert.match(fs.readFileSync(filename,'utf8'),/scripts\/test-private-legacy-batch-authorization-v244\.mjs/);
});
