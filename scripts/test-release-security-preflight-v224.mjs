import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syntheticCleanMigrationReviewV231 } from './release-test-fixture-v231.mjs';
import {assessSecurityPreflightV224} from '../release-security-guard-v224.mjs';
import {assessOfficialBuild} from '../release-guard-core-v223.mjs';

const qaRef='foczofcmwampjvlfbsqn',dummy='bbbbbbbbbbbbbbbbbbbb';
const now=Date.parse('2026-10-27T03:00:00.000Z');
const goodSecurity={
 protocol:'V236',public_tables:82,rls_disabled:0,auth_truncate_tables:0,
 anon_truncate_tables:0,unvalidated_foreign_keys:0,
 dangerous_default_table_grants:0,open_default_function_grants:0,
 future_user_table_grants:0,future_user_sequence_grants:0,future_user_function_grants:0,creators_missing_global_function_revoke:0,insecure_public_only_definers:0,unused_pg_graphql_enabled:0,qa_legacy_dbf_concept_rows:0,qa_legacy_template_snapshot_rows:0,postgres_future_table_grants:0,postgres_future_sequence_grants:0,postgres_future_function_grants:0,postgres_missing_global_function_revoke:0,postgres_global_table_grants:0,postgres_global_sequence_grants:0,admin_risk_extensions_in_public:0,admin_owned_public_relations:0,admin_owned_public_functions:0,admin_owned_exposed_truncate_tables:0,privileged_rpc_without_auth_identity_path:0,privileged_rpc_using_delegated_identity:15,
 public_functions:244,security_definers:207,anonymous_definer_functions:0,
 authenticated_definer_functions:151,definer_missing_search_path:0,
 reviewed_security_definers:207,reviewed_authenticated_definers:151,
 manual_privileged_rpc_review:true,privileged_rpc_catalog_count:151,privileged_rpc_catalog_md5:'60019131a532a623a91c6128b9ab8daa'
};
const goodAct={
 migration_review:syntheticCleanMigrationReviewV231,
 protocol:'V236',environment:'CLEAN_PRODUCTION',approved_for_official_mode:true,
 project_ref:dummy,verified_at:'2026-10-27T02:50:00.000Z',
 verification_source:'privileged-read-only:verified-SQL-editor',
 counts:{business_rows:0,auth_users:0,storage_objects:0,unexpected_public_tables:0,missing_public_tables:0,tracked_public_tables:82,current_public_tables:82},
 security:goodSecurity
};
const check=(report=goodAct,supabaseUrl='https://'+dummy+'.supabase.co')=>
 assessOfficialBuild({mode:'official',supabaseUrl,report,now});

test('V224 clean project attestation meets stringent data and security checks (synthetic fixture only)',()=>{
 assert.deepEqual(check(),{ok:true,mode:'official',problems:[]});
});
test('V224 actual QA project must NEVER meet official release requirements',()=>{
 const qa=JSON.parse(fs.readFileSync('AUDITORIA_SEGURIDAD_LIVE_QA_V224.json','utf8'));
 assert.equal(qa.project_ref,qaRef);
 assert.equal(qa.approved_for_official_mode,false);
 assert.equal(qa.security.dangerous_default_table_grants,8);
 assert.equal(qa.security.open_default_function_grants,3);
 assert.equal(qa.security.anonymous_definer_functions,0);
 assert.ok(check({...qa,project_ref:dummy,approved_for_official_mode:true}).problems.length>0);
 assert.equal(check(qa,'https://'+qaRef+'.supabase.co').ok,false);
});
for(const field of [
 'rls_disabled','auth_truncate_tables','anon_truncate_tables','unvalidated_foreign_keys',
 'postgres_future_table_grants','admin_owned_public_relations',
 'anonymous_definer_functions','definer_missing_search_path'
]){
 test('V224 official publication denied on unresolved '+field,()=>{
  const report={...goodAct,security:{...goodSecurity,[field]:1}};
  const result=check(report);
  assert.equal(result.ok,false);
  assert.ok(result.problems.some(x=>x.includes(field)));
 });
 test('V224 official publication denied when '+field+' was not measured',()=>{
  const report={...goodAct,security:{...goodSecurity,[field]:undefined}};
  assert.equal(check(report).ok,false);
 });
}
for(const [name,change] of [
 ['missing report',undefined],
 ['old V223 release protocol',{...goodSecurity,protocol:'V223'}],
 ['missing review attestation',{...goodSecurity,manual_privileged_rpc_review:false}],
 ['not all security definers reviewed',{...goodSecurity,reviewed_security_definers:206}],
 ['not all callable definer functions reviewed',{...goodSecurity,reviewed_authenticated_definers:150}],
 ['untrusted function count',{...goodSecurity,public_functions:-1}],
 ['inconsistent definer counts',{...goodSecurity,public_functions:10}],
 ['auth definer count larger than all definer',{...goodSecurity,authenticated_definer_functions:220}],
 ['not all tables audited',{...goodSecurity,public_tables:81}]
]){
 test('V224 requires governance: '+name,()=>{
  assert.notEqual(assessSecurityPreflightV224(change).length,0);
 });
}
test('V224 explicit missing security on otherwise clean V223 attestation fails closed',()=>{
 const report={...goodAct,security:undefined};
 assert.equal(check(report).ok,false);
 assert.ok(check({...goodAct,protocol:'V223'}).problems.some(x=>x.includes('protocolo')));
});
test('V224 security preflight SQL is SELECT only over catalogs, not sacramental records',()=>{
 const sql=fs.readFileSync('scripts/release-security-preflight-v224.sql','utf8');
 const executable=sql.replace(/--[^\n]*/g,'');
 assert.match(sql,/pg_default_acl/);
 assert.match(sql,/aclexplode/);
 assert.match(sql,/pg_class/);
 assert.match(sql,/pg_proc/);
 assert.match(sql,/pg_constraint/);
 assert.match(sql,/has_table_privilege/);
 assert.match(sql,/has_function_privilege/);
 assert.doesNotMatch(executable,/^\s*(?:UPDATE|DELETE|INSERT|TRUNCATE|ALTER|GRANT|REVOKE|DROP|CREATE|DO)\b/gim);
 assert.doesNotMatch(executable,/\bFROM\s+public\.(?:baptisms|confirmations|marriages|funerals|user_profiles)\b/i);
});
test('V224 Vercel root guard is not excluded by .vercelignore and is used by official build',()=>{
 const ignore=fs.readFileSync('.vercelignore','utf8');
 for(const file of ['release-guard-core-v223.mjs','release-security-guard-v224.mjs','guard-official-build-v223.mjs']){
  assert.ok(fs.existsSync(file),file);
  assert.ok(!ignore.split(/\r?\n/).some(line=>line.trim()===file),file);
 }
 assert.match(fs.readFileSync('release-guard-core-v223.mjs','utf8'),/assessSecurityPreflightV224/);
});
test('V224 security regression runs in GitHub CI and local master gate',()=>{
 const ci=fs.readFileSync('.github/workflows/sacramentum-auditoria-v90.yml','utf8');
 const gate=fs.readFileSync('scripts/audit-gate-v90.mjs','utf8');
 assert.match(ci,/scripts\/test-release-security-preflight-v224\.mjs/);
 assert.match(gate,/scripts\/test-release-security-preflight-v224\.mjs/);
});
