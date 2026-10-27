import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {EXPECTED_PRIVILEGED_RPC_CATALOG_MD5_V236} from '../release-security-guard-v224.mjs';
import {HISTORICAL_MIGRATION_MANIFEST_SHA256,CLEAN_REPLAY_HISTORICAL_MIGRATIONS} from '../release-migration-provenance-v231.mjs';
import {report} from './audit-production-migration-safety-v231.mjs';
const sql=fs.readFileSync('supabase/migrations/20261027133000_harden_materialize_chancery_v243.sql','utf8');
const e=JSON.parse(fs.readFileSync('AUDITORIA_CANCILLERIA_HISTORICA_V243.json','utf8'));

test('V243 targets only historical Chancery decree materializer and no data modification',()=>{
 assert.match(sql,/materialize_legacy_decrees_v68\(uuid,integer\)/);
 assert.match(sql,/pg_get_functiondef/);
 assert.match(sql,/to_regprocedure/);
 assert.match(sql,/EXECUTE v_ddl/);
 assert.doesNotMatch(sql,/^\s*(?:INSERT INTO|UPDATE\s+public\.|DELETE FROM|TRUNCATE TABLE|DROP TABLE)\b/gmi);
 assert.equal(e.qa_mutations,0);
});
test('V243 source patch refuses unexpected differences before privileged execution',()=>{
 assert.match(sql,/safety failure: role or profile checks have changed/);
 assert.match(sql,/length\(v_ddl\)-length\(replace\(v_ddl,v_old_role/);
 assert.match(sql,/length\(v_ddl\)-length\(replace\(v_ddl,v_old_tail/);
 assert.equal(e.pre_original_role_guard_hits,1);
 assert.equal(e.pre_original_lookup_block_hits,1);
 assert.equal(e.pre_original_active_guard_hits,1);
});
test('V243 requires Chancery role, active identity, valid institutional relation and same diocese',()=>{
 for(const part of ['v_role IS DISTINCT FROM','up.is_active IS TRUE','upper(coalesce(up.status','lower(coalesce(up.role','up.diocese_id=v_user_diocese','v243_ch.id=up.chancery_id','v243_ch.diocese_id=up.diocese_id','v_chancery IS NULL']) assert.ok(sql.includes(part),part);
 for(const key of ['post_strict_role','post_strict_active','post_strict_status','post_verified_chancery_same_diocese','post_null_chancery_denied'])assert.equal(e[key],true,key);
 assert.equal(e.post_old_active_bypass_remaining,false);
});
test('V243 role comparisons were executed live in QA under authenticated role',()=>{
 assert.equal(e.role_tests.length,4);
 assert.deepEqual(e.role_tests.map(x=>x.role).sort(),['admin_general','chancery','diocese','parish']);
 assert.equal(e.role_tests.filter(x=>x.actual==='denied').length,3);
 assert.equal(e.role_tests.filter(x=>x.actual==='missing_origin_rejected').length,1);
 assert.equal(e.qa_applied,true);
});
test('V243 PostgreSQL fingerprint was independently observed and previously published V242 evidence retained',()=>{
 assert.equal(e.procedures_with_privileged_execute,152);
 assert.equal(e.privileged_catalogue_after,'f1efe81bc94e1163ce611d54ba8575fb'); // historical QA V243 snapshot
 const prev=JSON.parse(fs.readFileSync('AUDITORIA_ACTIVIDAD_DOCUMENTOS_CHAT_V242.json','utf8'));
 assert.equal(prev.new_callable_catalogue_md5,e.privileged_catalogue_before);
 assert.notEqual(e.privileged_catalogue_before,e.privileged_catalogue_after);
});
test('V243 inventory is schema-only and historical direct data writes still blocked',()=>{
 const inv=report();
 assert.equal(inv.migrationCount,165);
 assert.equal(CLEAN_REPLAY_HISTORICAL_MIGRATIONS,165);
 assert.equal(inv.directWriteMigrationCount,14);
 assert.equal(inv.directWriteStatementCount,45);
 const entries=inv.checks.filter(x=>x.file.endsWith('harden_materialize_chancery_v243.sql'));
 assert.equal(entries.length,1);
 assert.equal(entries[0].directWrites,0);
 assert.equal(crypto.createHash('sha256').update(JSON.stringify(inv.checks)).digest('hex'),HISTORICAL_MIGRATION_MANIFEST_SHA256);
});
test('V243 is not a declaration of full RPC review, true restored backup or official operation',()=>{
 assert.equal(e.environment,'QA_NONOFFICIAL_FICTITIOUS_ONLY');
 assert.equal(e.semantically_certified_152_functions,0);
 assert.equal(e.official_launch_authorized,false);
 assert.match(e.scope_limit,/do not certify successful/);
});
test('V243 added to GitHub workflow and local master suite',()=>{
 for(const file of ['.github/workflows/sacramentum-auditoria-v90.yml','scripts/audit-gate-v90.mjs']) assert.match(fs.readFileSync(file,'utf8'),/scripts\/test-harden-historical-chancery-v243\.mjs/);
});
