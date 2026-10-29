import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {EXPECTED_PRIVILEGED_RPC_CATALOG_MD5_V236} from '../release-security-guard-v224.mjs';
import {HISTORICAL_MIGRATION_MANIFEST_SHA256,CLEAN_REPLAY_HISTORICAL_MIGRATIONS} from '../release-migration-provenance-v231.mjs';
import {report} from './audit-production-migration-safety-v231.mjs';

const sql=fs.readFileSync('supabase/migrations/20261027152000_close_original_legacy_batch_enumeration_v245.sql','utf8');
const e=JSON.parse(fs.readFileSync('AUDITORIA_IMPORTACION_ORIGINAL_ENCLAVE_V245.json','utf8'));
test('V245 verified the actual pre-migration cross-diocese data disclosure in both original RPCs',()=>{
 assert.equal(e.before.foreign_existing_batch_leaked_anulacion_in_both,true);
 assert.equal(e.before.foreign_uuid_missing_different_error,true);
 assert.equal(e.routines.length,2);
 assert.equal(e.qa_live_regression_cases,6);
 assert.equal(e.qa_live_regression_passed,6);
});
test('V245 moves the permission guard into first lookup before processing the ANULACION batch',()=>{
 assert.match(sql,/apply_legacy_import_batch\(uuid,integer\)/);
 assert.match(sql,/reconcile_legacy_anulacion_batch\(uuid,integer\)/);
 assert.match(sql,/where id=p_batch_id and public[.]can_manage_legacy_import\(parish_id,diocese_id\) for update/);
 assert.match(sql,/where id = p_batch_id/);
 assert.match(sql,/and public[.]can_manage_legacy_import\(parish_id,diocese_id\)/);
 assert.match(sql,/for update/);
 assert.equal((sql.match(/EXECUTE v_ddl;/g)||[]).length,1);
});
test('V245 fails closed if both audited initial lookups do not occur exactly once',()=>{
 assert.match(sql,/v_hits <> 1/);
 assert.match(sql,/audited initial batch lookup drift/);
 assert.match(sql,/pg_get_functiondef/);
 assert.match(sql,/to_regprocedure/);
});
test('V245 real QA tests: foreign existing indistinguishable from nonexistent, authorized preserves safe denial',()=>{
 for(const rpc of ['apply_legacy_import_batch','reconcile_legacy_anulacion_batch']){
  const cases=e.after.filter(x=>x.rpc===rpc);
  assert.equal(cases.length,3);
  for(const sc of ['foreign-existing','foreign-missing']){
   const row=cases.find(x=>x.scenario===sc);
   assert.equal(row.expected,'Lote no encontrado');
   assert.equal(row.passed,true);
  }
  assert.equal(cases.find(x=>x.scenario==='authorized-anulacion').passed,true);
 }
 assert.equal(e.qa_business_rows_mutated,false);
 assert.equal(e.schema_migration_applied,true);
});
test('V245 evidence proves four known import paths now share early scoped lookup',()=>{
 assert.deepEqual(e.canonical_legacy_import_paths_now_guarded,[
  'apply_legacy_import_batch','apply_legacy_import_batch_v2','apply_legacy_import_batch_v3','reconcile_legacy_anulacion_batch'
 ]);
 const old=fs.readFileSync('supabase/migrations/20261027143000_authorize_legacy_batch_before_profile_v244.sql','utf8');
 assert.match(old,/apply_legacy_import_batch_v2/);
 assert.match(old,/apply_legacy_import_batch_v3/);
});
test('V245 current live PostgreSQL fingerprint remains exact in release guard, old evidence preserved',()=>{
 assert.equal(e.count_privileged_rpcs,152);
 assert.equal(e.catalogue_hash_after,'91f3bb1bf8a50fd85d066d86fd79da2b'); // immutable prior V245 evidence
 assert.equal(e.catalogue_hash_after,'91f3bb1bf8a50fd85d066d86fd79da2b');
 const prior=JSON.parse(fs.readFileSync('AUDITORIA_ACL_IMPORTACIONES_LIVE_V244.json','utf8'));
 assert.equal(e.catalogue_hash_before,prior.catalogue_md5_after);
});
test('V245 only adds a schema-function patch; 45 historical data mutations stay forbidden',()=>{
 const inv=report();
 assert.equal(inv.migrationCount,192);
 assert.equal(CLEAN_REPLAY_HISTORICAL_MIGRATIONS,166);
 assert.equal(inv.directWriteMigrationCount,15);
 assert.equal(inv.directWriteStatementCount,46);
 const row=inv.checks.filter(x=>x.file.endsWith('close_original_legacy_batch_enumeration_v245.sql'));
 assert.equal(row.length,1);
 assert.equal(row[0].directWrites,0);
 assert.equal(crypto.createHash('sha256').update(JSON.stringify(inv.checks.slice(0,CLEAN_REPLAY_HISTORICAL_MIGRATIONS))).digest('hex'),HISTORICAL_MIGRATION_MANIFEST_SHA256);
});
test('V245 is not an official certification or complete privileged RPC review',()=>{
 assert.equal(e.environment,'SUPABASE_QA_ONLY_NOT_OFFICIAL');
 assert.equal(e.official_mode_authorized,false);
 assert.equal(e.semantic_certs,0);
 assert.match(e.limitations,/do not certify positive record imports/);
});
test('V245 regression test mandatory on local and GitHub security workflows',()=>{
 for(const path of ['scripts/audit-gate-v90.mjs','.github/workflows/sacramentum-auditoria-v90.yml']){
  assert.match(fs.readFileSync(path,'utf8'),/scripts\/test-original-legacy-batch-isolation-v245\.mjs/);
 }
});
