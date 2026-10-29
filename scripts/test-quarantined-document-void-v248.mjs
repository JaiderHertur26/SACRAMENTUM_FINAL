import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {EXPECTED_PRIVILEGED_RPC_CATALOG_MD5_V236,assessSecurityPreflightV224} from '../release-security-guard-v224.mjs';
import {HISTORICAL_MIGRATION_MANIFEST_SHA256,CLEAN_REPLAY_HISTORICAL_MIGRATIONS} from '../release-migration-provenance-v231.mjs';
import {report} from './audit-production-migration-safety-v231.mjs';
const e=JSON.parse(fs.readFileSync('AUDITORIA_CONTENCION_DOCUMENTOS_V248.json','utf8'));
const migration=fs.readFileSync('supabase/migrations/20261027170500_contain_document_void_exposure_v248.sql','utf8');

test('V248 actual QA function executes for neither anonymous nor authenticated',()=>{
 assert.equal(e.migration_applied_to_qa,true);
 assert.equal(e.authenticated_execute_after,false);
 assert.equal(e.anon_execute_after,false);
 assert.equal(e.service_role_execute_after,true);
 assert.equal(e.real_authenticated_sql_denied_code,'42501');
 assert.match(e.real_authenticated_sql_denied_text,/permission denied/);
});
test('V248 migration only revokes the single exposed vulnerable capability',()=>{
 assert.match(migration,/REVOKE EXECUTE ON FUNCTION public\.void_document_issuance\(uuid,text\) FROM authenticated;/);
 assert.doesNotMatch(migration,/^\s*(?:GRANT|DROP|TRUNCATE|INSERT|UPDATE|DELETE|ALTER)\b/gmi);
 assert.equal(e.sql_source_routine_modified,false);
 assert.equal(e.qa_rows_deleted_or_modified,false);
});
test('V248 denied callable surface contracts while retaining historical V245 evidence',()=>{
 assert.equal(e.rpc_exposed_before,152);
 assert.equal(e.rpc_exposed_after,151);
 assert.equal(e.catalogue_after,'60019131a532a623a91c6128b9ab8daa');
 assert.equal(e.catalogue_after,EXPECTED_PRIVILEGED_RPC_CATALOG_MD5_V236);
 const old=JSON.parse(fs.readFileSync('AUDITORIA_IMPORTACION_ORIGINAL_ENCLAVE_V245.json','utf8'));
 assert.equal(e.catalogue_before,old.catalogue_hash_after);
 assert.notEqual(e.catalogue_before,e.catalogue_after);
});
test('V248 block list prevents accidental reauthorization by normal authenticated grants',()=>{
 const guard=fs.readFileSync('release-security-guard-v224.mjs','utf8');
 assert.match(guard,/security\.privileged_rpc_catalog_count!==151/);
 assert.match(guard,/EXPECTED_PRIVILEGED_RPC_CATALOG_MD5_V236/);
 const sample=fs.readFileSync('scripts/test-privileged-rpc-catalog-v236.mjs','utf8');
 assert.match(sample,/privileged_rpc_catalog_count:151/);
});
test('V248 194 migrations remain fully enumerated without legacy data changes',()=>{
 const inv=report();
 assert.equal(inv.migrationCount,194);
 assert.equal(CLEAN_REPLAY_HISTORICAL_MIGRATIONS,166);
 assert.equal(inv.directWriteMigrationCount,15);
 assert.equal(inv.directWriteStatementCount,46);
 const rows=inv.checks.filter(x=>x.file.endsWith('contain_document_void_exposure_v248.sql'));
 assert.equal(rows.length,1);
 assert.equal(rows[0].directWrites,0);
 assert.equal(crypto.createHash('sha256').update(JSON.stringify(inv.checks.slice(0,CLEAN_REPLAY_HISTORICAL_MIGRATIONS))).digest('hex'),HISTORICAL_MIGRATION_MANIFEST_SHA256);
});
test('V248 is temporary containment, not SQL fix, not validation of documents and not official release',()=>{
 assert.equal(e.previous_source_change_v246_status,'BLOCKED_UNAPPLIED_DRAFT_PR_97');
 assert.equal(e.document_void_available_to_ordinary_users,false);
 assert.equal(e.approved_for_official_operations,false);
 assert.match(e.operational_limitations,/does not modify the vulnerable SQL body/);
 assert.match(e.operational_limitations,/Temporarily disables/);
});
test('V248 registered in mandatory quality gates',()=>{
 for(const f of ['scripts/audit-gate-v90.mjs','.github/workflows/sacramentum-auditoria-v90.yml'])
  assert.match(fs.readFileSync(f,'utf8'),/scripts\/test-quarantined-document-void-v248\.mjs/);
});
