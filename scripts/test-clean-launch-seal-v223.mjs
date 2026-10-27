import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { projectRefFromUrl, isKnownTestRegistryProject, resolveRegistryTestMode } from '../src/utils/registryDataMode.mjs';
import { assessOfficialBuild } from '../release-guard-core-v223.mjs';

const QA_REF='foczofcmwampjvlfbsqn';
const PROD_REF='bbbbbbbbbbbbbbbbbbbb';
const url=id=>`https://${id}.supabase.co`;
const now=Date.parse('2026-10-27T01:40:00.000Z');
const cleanReport={
 protocol:'V229',environment:'CLEAN_PRODUCTION',approved_for_official_mode:true,
 project_ref:PROD_REF,verified_at:'2026-10-27T01:35:00.000Z',
 verification_source:'privileged-read-only:manual-sql-editor',
 counts:{business_rows:0,auth_users:0,storage_objects:0,unexpected_public_tables:0,missing_public_tables:0,tracked_public_tables:82,current_public_tables:82},
 security:{protocol:'V229',public_tables:82,rls_disabled:0,auth_truncate_tables:0,anon_truncate_tables:0,unvalidated_foreign_keys:0,dangerous_default_table_grants:0,open_default_function_grants:0,future_user_table_grants:0,future_user_sequence_grants:0,future_user_function_grants:0,creators_missing_global_function_revoke:0,insecure_public_only_definers:0,public_functions:244,security_definers:207,anonymous_definer_functions:0,authenticated_definer_functions:152,definer_missing_search_path:0,reviewed_security_definers:207,reviewed_authenticated_definers:152,manual_privileged_rpc_review:true}
};
const check=(config={})=>assessOfficialBuild({mode:'official',supabaseUrl:url(PROD_REF),report:cleanReport,now,...config});

test('V223 only exact HTTPS Supabase project hosts qualify as projects',()=>{
 assert.equal(projectRefFromUrl(url(QA_REF)),QA_REF);
 for(const malicious of ['https://'+QA_REF+'.supabase.co.evil.example','http://'+QA_REF+'.supabase.co','https://supabase.co','https://'+QA_REF+'.supabase.co@evil.test','bad url','https://x.supabase.co']) {
  assert.equal(projectRefFromUrl(malicious),null,malicious);
 }
});
test('V223 known QA project permanently remains test mode EVEN WITH official environment flag',()=>{
 assert.equal(isKnownTestRegistryProject(url(QA_REF)),true);
 assert.equal(resolveRegistryTestMode({mode:'official',url:url(QA_REF)}),true);
 assert.equal(resolveRegistryTestMode({mode:'official',url:url(PROD_REF)}),false);
 assert.equal(resolveRegistryTestMode({mode:'test',url:url(PROD_REF)}),true);
 assert.equal(resolveRegistryTestMode({}),true);
});
test('V223 non-official build requires no manifest, preserving CI and development',()=>{
 assert.deepEqual(assessOfficialBuild({mode:'test',supabaseUrl:url(QA_REF),now}),{ok:true,mode:'test',problems:[]});
 assert.equal(assessOfficialBuild({mode:undefined,now}).ok,true);
});
test('V223 fixture documents all possible strict official prerequisites',()=>{
 assert.deepEqual(check(),{ok:true,mode:'official',problems:[]});
});
for(const [reason,change] of [
 ['QA project forbidden',{supabaseUrl:url(QA_REF),report:{...cleanReport,project_ref:QA_REF}}],
 ['missing manifest',{report:null}],
 ['unknown environment',{report:{...cleanReport,environment:'STAGING'}}],
 ['approval missing',{report:{...cleanReport,approved_for_official_mode:false}}],
 ['different certified project',{report:{...cleanReport,project_ref:'cccccccccccccccccccc'}}],
 ['no privileged verification',{report:{...cleanReport,verification_source:'anonymous:rest'}}],
 ['wrong protocol',{report:{...cleanReport,protocol:'V222'}}],
 ['business data present',{report:{...cleanReport,counts:{...cleanReport.counts,business_rows:1}}}],
 ['auth user from QA present',{report:{...cleanReport,counts:{...cleanReport.counts,auth_users:1}}}],
 ['storage object present',{report:{...cleanReport,counts:{...cleanReport.counts,storage_objects:1}}}],
 ['unexpected table',{report:{...cleanReport,counts:{...cleanReport.counts,unexpected_public_tables:1}}}],
 ['missing table',{report:{...cleanReport,counts:{...cleanReport.counts,missing_public_tables:1}}}],
 ['unknown business count',{report:{...cleanReport,counts:{...cleanReport.counts,business_rows:null}}}],
 ['table count lower',{report:{...cleanReport,counts:{...cleanReport.counts,tracked_public_tables:81}}}],
 ['stale report',{now:now+25*60*60*1000}],
 ['report from future',{now:now-30*60*1000}],
 ['untrusted HTTP endpoint',{supabaseUrl:'http://'+PROD_REF+'.supabase.co'}]
]){
 test('V223 official release fail-closed: '+reason,()=>{
  const result=check(change);
  assert.equal(result.ok,false);
  assert.equal(result.mode,'test');
  assert.ok(result.problems.length>0);
 });
}
test('V223 inventory covers declared public tables with no write statements',()=>{
 const sql=fs.readFileSync('scripts/release-inventory-readonly-v223.sql','utf8');
 const m=JSON.parse(fs.readFileSync('scripts/release-inventory-manifest-v223.json','utf8'));
 assert.equal(m.knownTables,82);
 assert.equal(m.tables.length,82);
 assert.equal(new Set(m.tables).size,82);
 assert.equal((sql.match(/AS object_name, \(SELECT count\(\*\)::bigint FROM public\./g)||[]).length,82);
 assert.match(sql,/unexpected_table_count/);
 assert.match(sql,/missing_table_count/);
 const executable=sql.replace(/--[^\n]*/g,'');
 assert.doesNotMatch(executable,/\b(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT|ALTER|GRANT|REVOKE|EXECUTE|DO)\b/i);
 assert.match(executable,/auth\.users/);
 assert.match(executable,/storage\.objects/);
});
test('V223 source always stamps known QA even if official flag accidentally set',()=>{
 const stamp=fs.readFileSync('src/utils/testDocumentStamp.mjs','utf8');
 const login=fs.readFileSync('src/pages/PublicSearchPage.jsx','utf8');
 const dashboard=fs.readFileSync('src/components/DashboardLayout.jsx','utf8');
 for(const source of [stamp,login,dashboard]){
  assert.match(source,/isKnownTestRegistryProject/);
  assert.match(source,/VITE_SUPABASE_URL/);
 }
});
test('V223 official release guard runs before Vite build in CI and Vercel',()=>{
 const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
 assert.match(pkg.scripts.build,/^node guard-official-build-v223\.mjs && vite build$/);
 const ci=fs.readFileSync('.github/workflows/sacramentum-auditoria-v90.yml','utf8');
 const gate=fs.readFileSync('scripts/audit-gate-v90.mjs','utf8');
 assert.match(ci,/scripts\/test-clean-launch-seal-v223\.mjs/);
 assert.match(gate,/scripts\/test-clean-launch-seal-v223\.mjs/);
 assert.match(ci,/npm run build/);
});
test('V223 QA report is immutable read-only evidence, not an approval',()=>{
 const evidence=JSON.parse(fs.readFileSync('AUDITORIA_BASE_PRUEBAS_SOLO_LECTURA_V223.json','utf8'));
 assert.equal(evidence.project_ref,QA_REF);
 assert.equal(evidence.approved_for_official_mode,false);
 assert.equal(evidence.counts.tracked_public_tables,82);
 assert.ok(evidence.counts.public_rows>90000);
 assert.ok(evidence.counts.auth_users>0);
 assert.equal(check({report:evidence,supabaseUrl:url(QA_REF)}).ok,false);
});

test('V223 independently evaluates 82-table clean install without authorizing official use', async()=>{
 const {evaluateEmptyLaunchInventory,SYSTEM_REFERENCE_TABLES}=await import('./release-inventory-evaluator-v223.mjs');
 const manifest=JSON.parse(fs.readFileSync('scripts/release-inventory-manifest-v223.json','utf8'));
 const rows=manifest.tables.map(table=>({object_name:'public.'+table,rows_count:0}));
 rows.push({object_name:'auth.users',rows_count:0},{object_name:'storage.objects',rows_count:0},{object_name:'storage.buckets',rows_count:1});
 const clean=evaluateEmptyLaunchInventory(rows,manifest);
 assert.equal(clean.clearForNewEmptyInstallation,true);
 assert.equal(clean.approvedForOfficialUse,false);
 assert.equal(clean.expectedPublicTables,82);
 assert.equal(clean.businessRows,0);
 assert.equal(clean.authUsers,0);
 assert.equal(clean.storageObjects,0);
 const seeded=rows.map(x=>SYSTEM_REFERENCE_TABLES.includes(x.object_name)?{...x,rows_count:4}:x);
 const withCatalog=evaluateEmptyLaunchInventory(seeded,manifest);
 assert.equal(withCatalog.clearForNewEmptyInstallation,true);
 assert.equal(withCatalog.referenceRows,16);
 assert.equal(withCatalog.approvedForOfficialUse,false);
});
test('V223 every kind of residual test data is a release blocker',async()=>{
 const {evaluateEmptyLaunchInventory}=await import('./release-inventory-evaluator-v223.mjs');
 const manifest=JSON.parse(fs.readFileSync('scripts/release-inventory-manifest-v223.json','utf8'));
 const baseline=[...manifest.tables.map(t=>({object_name:'public.'+t,rows_count:0})),
  {object_name:'auth.users',rows_count:0},{object_name:'storage.objects',rows_count:0},{object_name:'storage.buckets',rows_count:0}];
 for(const key of ['public.baptisms','public.pending_confirmations','public.registry_audit_log','public.legacy_import_rows','public.legacy_record_links','public.user_profiles','public.chat_messages','public.document_sequences','auth.users','storage.objects']){
  const altered=baseline.map(row=>row.object_name===key?{...row,rows_count:1}:row);
  assert.equal(evaluateEmptyLaunchInventory(altered,manifest).clearForNewEmptyInstallation,false,key);
 }
 for(const incomplete of [baseline.slice(1),[...baseline,{object_name:'public.not_inventory',rows_count:2}],baseline.map((x,i)=>i===0?{...x,rows_count:-1}:x)]){
  try{assert.equal(evaluateEmptyLaunchInventory(incomplete,manifest).clearForNewEmptyInstallation,false);}
  catch(e){assert.match(e.message,/Dato incompleto/);}
 }
});

test('V223 production root build guard survives the Vercel QA-files ignore boundary',()=>{
 const ignore=fs.readFileSync('.vercelignore','utf8');
 assert.match(ignore,/^scripts\/$/m);
 for(const guard of ['guard-official-build-v223.mjs','release-guard-core-v223.mjs']) {
  assert.ok(fs.existsSync(guard),'missing Vercel-safe root guard: '+guard);
  assert.doesNotMatch(ignore,new RegExp('^'+guard.replace(/\./g,'\\.')+'$','m'));
 }
 const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
 assert.match(pkg.scripts.build,/^node guard-official-build-v223\.mjs && vite build$/);
});
