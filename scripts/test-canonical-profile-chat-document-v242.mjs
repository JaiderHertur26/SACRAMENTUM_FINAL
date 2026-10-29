import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {EXPECTED_PRIVILEGED_RPC_CATALOG_MD5_V236} from '../release-security-guard-v224.mjs';
import {HISTORICAL_MIGRATION_MANIFEST_SHA256,CLEAN_REPLAY_HISTORICAL_MIGRATIONS} from '../release-migration-provenance-v231.mjs';
import {report} from './audit-production-migration-safety-v231.mjs';

const e=JSON.parse(fs.readFileSync('AUDITORIA_ACTIVIDAD_DOCUMENTOS_CHAT_V242.json','utf8'));
const sql=fs.readFileSync('supabase/migrations/20261027121500_harden_context_chat_matrimonial_identity_v242.sql','utf8');

test('V242 only touches the three targeted privileged exposed routines',()=>{
 assert.deepEqual(e.routines,['search_document_context','start_direct_chat','resolve_manual_matrimonial_notification_recipient']);
 for(const r of e.routines) assert.ok(sql.includes('public.'+r+'('));
 assert.equal((sql.match(/pg_get_functiondef\(/g)||[]).length,1);
});
test('V242 guarantees exactly one actor guard in search, one in matrimonial, two in chat',()=>{
 assert.deepEqual(e.pre_migration_exact_clause_occurrences.map(x=>[x.activity,x.status]),[[1,1],[2,2],[1,1]]);
 assert.match(sql,/matches_active <> required_occurrences OR matches_status <> required_occurrences/);
 assert.match(sql,/guard drift/);
 assert.match(sql,/EXECUTE ddl/);
});
test('V242 canonical active state and null-safe document role replaces permissive conditions',()=>{
 assert.match(sql,/is_active IS TRUE/);
 assert.match(sql,/upper\(coalesce\(status/);
 assert.match(sql,/upper\(coalesce\(up.status/);
 assert.match(sql,/v_role is null or v_role not in/);
 assert.equal(e.all_three_strict_active,true);
 assert.equal(e.all_three_strict_status,true);
 assert.equal(e.document_search_null_role_rejected,true);
 assert.equal(e.legacy_is_active_coalesce_remaining_in_three,false);
});
test('V242 live QA evidence includes four role/validation denials and two harmless searches',()=>{
 assert.equal(e.live_qa_negatives_and_harmless_reads.length,6);
 assert.equal(e.live_qa_negatives_and_harmless_reads.filter(x=>x.result.includes('zero matches')).length,2);
 assert.equal(e.live_qa_negatives_and_harmless_reads.filter(x=>x.result.includes('rejected')||x.result.includes('denied')).length,4);
 assert.equal(e.qa_actual_data_mutations,0);
 assert.equal(e.migration_applied_qa,true);
});
test('V242 catalogue hash is current and previous V241 document remains unaltered',()=>{
 assert.equal(e.new_callable_catalogue_md5,'f5f6d63ed04cb647d96f7175a054f39a'); // historical verified V242
 assert.equal(EXPECTED_PRIVILEGED_RPC_CATALOG_MD5_V236,'60019131a532a623a91c6128b9ab8daa'); // Current guard after V244, historical QA unchanged.
 const prev=JSON.parse(fs.readFileSync('AUDITORIA_PERFILES_ACTIVOS_RPC_V241.json','utf8'));
 assert.equal(prev.catalogue_md5_after,e.old_callable_catalogue_md5);
 assert.equal(e.callable_security_definer_functions,152);
});
test('V242 schema-only migration count and digest match frozen release inventory',()=>{
 const inv=report();
 assert.equal(inv.migrationCount,191);
 assert.equal(CLEAN_REPLAY_HISTORICAL_MIGRATIONS,166);
 assert.equal(inv.directWriteMigrationCount,15);
 assert.equal(inv.directWriteStatementCount,46);
 const entry=inv.checks.filter(c=>c.file.endsWith('harden_context_chat_matrimonial_identity_v242.sql'));
 assert.equal(entry.length,1);
 assert.equal(entry[0].directWrites,0);
 const actual=crypto.createHash('sha256').update(JSON.stringify(inv.checks.slice(0,CLEAN_REPLAY_HISTORICAL_MIGRATIONS))).digest('hex');
 assert.equal(actual,HISTORICAL_MIGRATION_MANIFEST_SHA256);
});
test('V242 is not a production certificate or full write-flow approval',()=>{
 assert.equal(e.environment,'QA_NONOFFICIAL_TEST_DATA_ONLY');
 assert.equal(e.semantic_approved_rpc_count,0);
 assert.equal(e.official_launch_allowed,false);
 assert.match(e.limit,/not full writing transactions/);
});
test('V242 included in both local quality checks and GitHub CI',()=>{
 for(const f of ['scripts/audit-gate-v90.mjs','.github/workflows/sacramentum-auditoria-v90.yml'])
  assert.match(fs.readFileSync(f,'utf8'),/scripts\/test-canonical-profile-chat-document-v242\.mjs/);
});
