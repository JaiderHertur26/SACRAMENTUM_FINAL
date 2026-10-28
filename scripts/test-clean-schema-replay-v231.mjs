import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {topLevelStatements,report} from './audit-production-migration-safety-v231.mjs';
import {assessCleanReplayEvidenceV231,HISTORICAL_MIGRATION_MANIFEST_SHA256,
 CLEAN_REPLAY_HISTORICAL_MIGRATIONS,CLEAN_REPLAY_MUTATIONS_TO_EXCLUDE,
 CLEAN_REPLAY_REFERENCE_CATALOGS_TO_REVIEW} from '../release-migration-provenance-v231.mjs';
import {syntheticCleanMigrationReviewV231} from './release-test-fixture-v231.mjs';
import {assessOfficialBuild} from '../release-guard-core-v223.mjs';

const inv=JSON.parse(fs.readFileSync('AUDITORIA_MIGRACIONES_DATOS_V232.json','utf8'));
const policy=JSON.parse(fs.readFileSync('AUDITORIA_MIGRACIONES_LANZAMIENTO_LIMPIO_V232.json','utf8'));
const digest=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');

test('V231 SQL lexer ignores DML inside comments, strings and dollar-quoted privileged code',()=>{
 const sql=String.raw`
 -- INSERT INTO public.qa_values VALUES('person');
 create or replace function public.test_function() returns void
 language plpgsql as $FUNC$
 begin
  insert into public.baptisms(id) values (null);
  perform 'text; DELETE FROM public.baptisms';
 end
 $FUNC$;
 insert into public.document_templates(code) values ('a;--x');
 /* UPDATE public.qa; */
 update public.legacy_import_rows set status='x' where 1=2;`;
 const s=topLevelStatements(sql);
 assert.equal(s.length,3);
 assert.match(s[0],/^create or replace function/i);
 assert.match(s[1],/^insert into public.document_templates/i);
 assert.match(s[2],/^update public.legacy_import_rows/i);
});
test('V231 detects all 180 versioned migrations with SHA256 fingerprints and full source coverage',()=>{
 const scan=report();
 assert.equal(scan.migrationCount,184);
 assert.equal(inv.migrationCount,184);
 assert.deepEqual(scan.checks,inv.checks);
 assert.deepEqual(scan.findings,inv.findings);
 assert.equal(inv.checks.length,184);
 assert.equal(new Set(inv.checks.map(x=>x.file)).size,184);
 assert.ok(inv.checks.every(x=>/^[a-f0-9]{64}$/.test(x.sha256)));
});
test('V231 pinned history manifest digest matches the independent Vercel release guard',()=>{
 assert.equal(digest(inv.checks.slice(0,CLEAN_REPLAY_HISTORICAL_MIGRATIONS)),HISTORICAL_MIGRATION_MANIFEST_SHA256);
 assert.equal(CLEAN_REPLAY_HISTORICAL_MIGRATIONS,166);
 assert.equal(CLEAN_REPLAY_MUTATIONS_TO_EXCLUDE,39);
 assert.equal(CLEAN_REPLAY_REFERENCE_CATALOGS_TO_REVIEW,6);
});
test('V231 inventory confirms 45 direct-data statements spanning fourteen distinct QA migration files',()=>{
 assert.equal(inv.directWriteMigrationCount,14);
 assert.equal(inv.directWriteStatementCount,45);
 assert.equal(inv.findings.length,14);
 assert.equal(policy.entries.length,45);
 assert.equal(policy.summary.migrationsWithDirectDataStatements,14);
});
test('V231 six catalog/template seed statements need content review but are not user data approvals',()=>{
 const reference=policy.entries.filter(x=>x.launchPolicy==='REFERENCE_TEMPLATE_CANDIDATE_REQUIRES_REVIEW');
 assert.equal(reference.length,6);
 assert.ok(reference.every(x=>x.kind==='INSERT INTO'));
 const names=reference.map(x=>x.destination);
 for(const name of ['public.legacy_import_profiles','public.marginal_note_templates',
  'public.marginal_note_template_clauses','public.document_templates','_v74_document_rewrites'])
 assert.ok(names.includes(name),name);
 assert.equal(policy.fullyCertifiedForCleanProductionReplay,false);
});
test('V231 39 old data mutation statements must not be replayed indiscriminately in new official database',()=>{
 assert.equal(policy.summary.blockedDataStatements,39);
 const blocked=policy.entries.filter(x=>x.launchPolicy!=='REFERENCE_TEMPLATE_CANDIDATE_REQUIRES_REVIEW');
 assert.equal(blocked.length,39);
 assert.equal(blocked.filter(x=>x.kind==='UPDATE').length,30);
 assert.equal(blocked.filter(x=>x.kind==='DELETE FROM').length,5);
 assert.equal(blocked.filter(x=>x.kind==='WITH').length,1);
 assert.equal(blocked.filter(x=>x.kind==='INSERT INTO').length,3);
});
test('V231 previous QA diocese legacy DBF concept catalog is a positive, explicit release blocker',()=>{
 const a=policy.entries.filter(x=>x.launchPolicy==='QA_LEGACY_CATALOG_DIocese_ANCHOR_MUST_EXCLUDE');
 assert.equal(a.length,1);
 assert.match(a[0].file,/20260927233000_v83_decree_concepts/);
 assert.equal(a[0].destination,'public.conceptos_anulacion');
 const original=fs.readFileSync(a[0].file,'utf8');
 assert.match(original,/CPTOANULA\.DBF/);
 assert.match(original,/'452d50bc-ff3e-448e-9b93-1e97f8d321e2'::uuid/i);
});
test('V231 classification report contains no personal account identifiers, passwords or sacrament contents',()=>{
 const raw=JSON.stringify(policy);
 assert.doesNotMatch(raw,/[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}/i);
 assert.doesNotMatch(raw,/"(?:email|password|access_token|refresh_token|apiKey|service_role_key)"\s*:/i);
 assert.equal(policy.canCopyExistingQaDatabase,false);
 assert.equal(policy.approvedForOfficialMode,false);
 assert.equal(policy.summary.hiddenMigrationSideEffectsNotStaticallyCertified,true);
});
test('V231 synthetic clean-schema evidence passes only in unit fixture; no live DB is thereby certified',()=>{
 assert.deepEqual(assessCleanReplayEvidenceV231(syntheticCleanMigrationReviewV231),[]);
 assert.equal(policy.fullyCertifiedForCleanProductionReplay,false);
});
for(const [field,value] of [
 ['status','NOT_VERIFIED'],['migration_manifest_sha256','0'.repeat(64)],
 ['historical_migrations_reviewed',157],['historical_data_mutations_excluded',0],
 ['reference_catalog_statements_vetted',5],['qa_records_imported',1],['qa_users_imported',1],
 ['independent_new_database_verified',false],['schema_only_replay_verified',false]
]){
 test('V231 clean replay release rejects '+field+' invalid',()=>{
  const bad={...syntheticCleanMigrationReviewV231,[field]:value};
  assert.ok(assessCleanReplayEvidenceV231(bad).length>0);
 });
}
test('V231 missing schema certification or outdated V230 attestation fail closed',()=>{
 assert.ok(assessCleanReplayEvidenceV231(undefined).length>0);
 assert.ok(assessCleanReplayEvidenceV231(null).length>0);
 const report={protocol:'V230',migration_review:syntheticCleanMigrationReviewV231};
 const q=assessOfficialBuild({mode:'official',supabaseUrl:'https://foczofcmwampjvlfbsqn.supabase.co',report});
 assert.equal(q.ok,false);
 assert.ok(q.problems.some(x=>x.includes('proyecto de pruebas')));
});
test('V231 local CI and GitHub gates fail on unreviewed migration changes',()=>{
 for(const p of ['scripts/audit-gate-v90.mjs','.github/workflows/sacramentum-auditoria-v90.yml']){
  const txt=fs.readFileSync(p,'utf8');
  assert.match(txt,/scripts\/test-clean-schema-replay-v231\.mjs/);
 }
 assert.match(fs.readFileSync('scripts/audit-production-migration-safety-v231.mjs','utf8'),/Migration code changed since classification/);
});
test('V231 Vercel packaging keeps actual QA migrations out of runtime while retaining a fixed hash guard',()=>{
 const ig=fs.readFileSync('.vercelignore','utf8');
 assert.match(ig,/^supabase\/$/m);
 assert.match(ig,/^scripts\/$/m);
 assert.doesNotMatch(ig,/^release-migration-provenance-v231\.mjs$/m);
 assert.match(fs.readFileSync('release-guard-core-v223.mjs','utf8'),/assessCleanReplayEvidenceV231/);
});

test('V231 real privileged QA preflight sees four legacy DBF concepts and will not mistake QA for clean official',()=>{
 const live=JSON.parse(fs.readFileSync('AUDITORIA_PRELAUNCH_DATOS_QA_V231.json','utf8'));
 assert.equal(live.project_ref,'foczofcmwampjvlfbsqn');
 assert.equal(live.safeForOfficialLaunch,false);
 assert.equal(live.rows.qa_legacy_dbf_concept_rows,4);
 assert.equal(live.rows.qa_legacy_template_snapshot_rows,0);
 assert.equal(live.security.authenticatedSecurityDefiners,152);
 assert.equal(live.security.public_tables,82);
 assert.equal(live.qaOnlyPopulationUnchanged.authUsers,12);
});
test('V231 new preflight catalog SQL checks actual legacy-origin columns without modifying QA',()=>{
 const sql=fs.readFileSync('scripts/release-security-preflight-v231.sql','utf8');
 assert.match(sql,/qa_legacy_dbf_concept_rows/);
 assert.match(sql,/qa_legacy_template_snapshot_rows/);
 assert.match(sql,/CPTOANULA[.]DBF/);
 assert.match(sql,/from public[.]legacy_marginal_template_snapshots/i);
 const executable=sql.replace(/--[^\n]*/g,'');
 assert.doesNotMatch(executable,/^\s*(?:CREATE|ALTER|INSERT|UPDATE|DELETE|TRUNCATE|DROP|GRANT|REVOKE|DO)\b/gim);
});
test('V231 security guard refuses inherited QA concepts or shadow template snapshots even with a synthetic clean review',()=>{
 const source=fs.readFileSync('release-security-guard-v224.mjs','utf8');
 assert.match(source,/qa_legacy_dbf_concept_rows/);
 assert.match(source,/qa_legacy_template_snapshot_rows/);
 assert.match(source,/security.protocol!=='V236'/);
});

test('V231 real legacy-DBF rows and missing catalog count fail the actual release security evaluator',async()=>{
 const {assessSecurityPreflightV224}=await import('../release-security-guard-v224.mjs');
 const qa=JSON.parse(fs.readFileSync('AUDITORIA_PRELAUNCH_DATOS_QA_V231.json','utf8'));
 const safe={
 protocol:'V236',public_tables:82,rls_disabled:0,auth_truncate_tables:0,
 anon_truncate_tables:0,unvalidated_foreign_keys:0,
 dangerous_default_table_grants:0,open_default_function_grants:0,
 future_user_table_grants:0,future_user_sequence_grants:0,
 future_user_function_grants:0,creators_missing_global_function_revoke:0,
 insecure_public_only_definers:0,unused_pg_graphql_enabled:0,
 qa_legacy_dbf_concept_rows:0,qa_legacy_template_snapshot_rows:0,postgres_future_table_grants:0,postgres_future_sequence_grants:0,postgres_future_function_grants:0,postgres_missing_global_function_revoke:0,postgres_global_table_grants:0,postgres_global_sequence_grants:0,admin_risk_extensions_in_public:0,admin_owned_public_relations:0,admin_owned_public_functions:0,admin_owned_exposed_truncate_tables:0,privileged_rpc_without_auth_identity_path:0,privileged_rpc_using_delegated_identity:15,
 public_functions:244,security_definers:207,
 anonymous_definer_functions:0,authenticated_definer_functions:151,
 definer_missing_search_path:0,reviewed_security_definers:207,
 reviewed_authenticated_definers:151,manual_privileged_rpc_review:true,privileged_rpc_catalog_count:151,privileged_rpc_catalog_md5:'60019131a532a623a91c6128b9ab8daa'
 };
 assert.deepEqual(assessSecurityPreflightV224(safe),[]);
 const denied=assessSecurityPreflightV224({...safe,qa_legacy_dbf_concept_rows:qa.rows.qa_legacy_dbf_concept_rows});
 assert.ok(denied.some(x=>x.includes('qa_legacy_dbf_concept_rows')));
 const {qa_legacy_template_snapshot_rows,...unmeasured}=safe;
 assert.ok(assessSecurityPreflightV224(unmeasured).some(x=>x.includes('qa_legacy_template_snapshot_rows')));
});
