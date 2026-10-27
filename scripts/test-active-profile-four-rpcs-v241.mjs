import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {EXPECTED_PRIVILEGED_RPC_CATALOG_MD5_V236} from '../release-security-guard-v224.mjs';
import {HISTORICAL_MIGRATION_MANIFEST_SHA256,CLEAN_REPLAY_HISTORICAL_MIGRATIONS} from '../release-migration-provenance-v231.mjs';
import {report} from './audit-production-migration-safety-v231.mjs';
import crypto from 'node:crypto';

const e=JSON.parse(fs.readFileSync('AUDITORIA_PERFILES_ACTIVOS_RPC_V241.json','utf8'));
const sql=fs.readFileSync('supabase/migrations/20261027114000_harden_four_active_profile_rpcs_v241.sql','utf8');
test('V241 hardens exactly four sensitive RPCs with canonical ACTIVE profile guard',()=>{
 for(const proc of [
  'save_funeral_parameters','save_marriage_parameters',
  'search_baptisms_for_matrimonial_notification','void_document_issuance'
 ]) assert.match(sql,new RegExp('public\\.'+proc+'\\('));
 assert.equal(e.affected_routines.length,4);
 assert.equal(e.four_rpc_code_guards_verified,4);
 assert.equal(e.four_old_active_bypasses_remaining,0);
 assert.match(sql,/IS TRUE/);
 assert.match(sql,/upper\(coalesce\(/);
});
test('V241 refuses unreviewed source changes rather than silently patching a different RPC',()=>{
 assert.match(sql,/audited active-profile guard changed/);
 assert.match(sql,/to_regprocedure/);
 assert.match(sql,/pg_get_functiondef/);
 assert.match(sql,/EXECUTE v_ddl/);
 assert.match(sql,/length\(v_ddl\)-length\(replace\(v_ddl,v_old_active/);
 assert.match(sql,/v_has_old_status/);
});
test('V241 safeguards old historical V240 and V236 catalogue attestations but pins current SQL',()=>{
 assert.equal(e.catalogue_md5_after,'2271708267b8e801367bc282d146d49e'); // historical QA V241 at time of test
 assert.equal(e.catalogue_md5_before,'d68b18810533c368d26f2c43e2ea9711');
 assert.notEqual(e.catalogue_md5_before,e.catalogue_md5_after);
 assert.equal(e.privileged_rpc_count,152);
 const old=JSON.parse(fs.readFileSync('AUDITORIA_REVERSOS_CANCILLERIA_V240.json','utf8'));
 assert.equal(old.catalogue_current_md5,e.catalogue_md5_before);
});
test('V241 live QA confirms role denials, argument validation, harmless read, document-not-found',()=>{
 assert.equal(e.qa_live_tests.length,7);
 assert.equal(e.qa_live_tests.filter(x=>x.observed==='denied').length,4);
 assert.equal(e.qa_live_tests.filter(x=>x.observed==='rejected').length,2);
 assert.equal(e.qa_live_tests.filter(x=>x.observed==='zero').length,1);
 assert.equal(e.qa_business_rows_changed,false);
 assert.equal(e.positive_valid_write_tests,0);
});
test('V241 adds one schema-only migration; old data mutation blocklist untouched',()=>{
 const inv=report();
 assert.equal(inv.migrationCount,162); // Current inventory includes subsequent V242 migration.
 assert.equal(CLEAN_REPLAY_HISTORICAL_MIGRATIONS,162);
 assert.equal(inv.directWriteMigrationCount,14);
 assert.equal(inv.directWriteStatementCount,45);
 const file=inv.checks.filter(x=>x.file.endsWith('harden_four_active_profile_rpcs_v241.sql'));
 assert.equal(file.length,1);
 assert.equal(file[0].directWrites,0);
 const actualDigest=crypto.createHash('sha256').update(JSON.stringify(inv.checks)).digest('hex');
 assert.equal(actualDigest,HISTORICAL_MIGRATION_MANIFEST_SHA256);
});
test('V241 is not official authority or full semantic security audit of 152 functions',()=>{
 assert.equal(e.environment,'QA_NONOFFICIAL_TEST_DATA_ONLY');
 assert.equal(e.full_privileged_rpc_semantic_approvals,0);
 assert.equal(e.official_launch_authorized,false);
 assert.match(e.limitations,/not certified/);
});
test('V241 audit suite is mandatory in local and GitHub gates',()=>{
 for(const f of ['scripts/audit-gate-v90.mjs','.github/workflows/sacramentum-auditoria-v90.yml'])
  assert.match(fs.readFileSync(f,'utf8'),/scripts\/test-active-profile-four-rpcs-v241\.mjs/);
});
