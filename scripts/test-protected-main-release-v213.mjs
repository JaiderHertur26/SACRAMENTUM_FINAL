import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {main,resolveReleaseTarget,waitForApprovedWorkflow} from '../release-gate-v163.mjs';
const sha='483a0abde2fee02ea561bafc0c20fdcb89c69230';
const valid={VERCEL_ENV:'production',VERCEL_GIT_PROVIDER:'github',VERCEL_GIT_REPO_OWNER:'JaiderHertur26',VERCEL_GIT_REPO_SLUG:'SACRAMENTUM_FINAL',VERCEL_GIT_COMMIT_REF:'main',VERCEL_GIT_COMMIT_SHA:sha};
test('V213b release gate accepts only exact protected-main repository provenance',async()=>{
 assert.deepEqual(resolveReleaseTarget(valid),{production:true,sha});
 const a=await main(valid);
 assert.equal(a.approved,true);assert.equal(a.guard,'github-protected-main');
 assert.deepEqual(a.checks,['pruebas-funcionales','seguridad-dependencias']);
});
for(const [name,override] of [
 ['wrong branch',{VERCEL_GIT_COMMIT_REF:'test'}],
 ['wrong owner',{VERCEL_GIT_REPO_OWNER:'foreign'}],
 ['wrong repository',{VERCEL_GIT_REPO_SLUG:'another'}],
 ['wrong provider',{VERCEL_GIT_PROVIDER:'gitlab'}],
 ['missing SHA',{VERCEL_GIT_COMMIT_SHA:''}]
])test('V213b '+name+' cannot be promoted to production',async()=>await assert.rejects(main({...valid,...override}),/PRODUCTION BLOCKED/));
test('V213b preview build is never classified as a production promotion',async()=>{
 const s=await main({...valid,VERCEL_ENV:'preview'});
 assert.deepEqual(s,{approved:false,preview:true});
});
test('V213b out-of-band GitHub branch protection evidence is strict and includes administrators',()=>{
 const cfg=JSON.parse(fs.readFileSync('AUDITORIA_PROTECCION_MAIN_V213.json','utf8'));
 assert.equal(cfg.branch,'main');assert.equal(cfg.enforce_admins,true);
 assert.equal(cfg.required_status_checks.strict,true);
 assert.deepEqual(cfg.required_status_checks.contexts,['pruebas-funcionales','seguridad-dependencias']);
 assert.equal(cfg.allow_force_pushes,false);assert.equal(cfg.allow_deletions,false);
});
test('V213b the protected branch workflow actually defines required checks',()=>{
 const workflow=fs.readFileSync('.github/workflows/sacramentum-auditoria-v90.yml','utf8');
 for(const name of ['pruebas-funcionales','seguridad-dependencias'])assert.ok(workflow.includes(name+':'));
 assert.match(workflow,/pull_request:/);assert.match(workflow,/branches: \[main\]/);
});
test('V213b Vercel still executes provenance guard before Vite build',()=>{
 const vercel=JSON.parse(fs.readFileSync('vercel.json','utf8'));
 assert.match(vercel.buildCommand,/^node release-gate-v163\.mjs && npm run build$/);
});
test('V213b no personal tokens added to Vercel build or client bundle',()=>{
 const gate=fs.readFileSync('release-gate-v163.mjs','utf8');
 assert.doesNotMatch(gate,/SACRAMENTUM_GITHUB_CI_TOKEN|Authorization.*Bearer/);
 const workflow=fs.readFileSync('.github/workflows/sacramentum-auditoria-v90.yml','utf8');
 assert.doesNotMatch(workflow,/SACRAMENTUM_GITHUB_CI_TOKEN/);
});
test('V213b archived GitHub API validator continues failing closed on mismatches',async()=>{
 const sha2='a'.repeat(40);
 await assert.rejects(waitForApprovedWorkflow({sha:sha2,request:async()=>({ok:false,status:403}),maxChecks:1}),/GitHub CI API unavailable/);
});
test('V213b local migration filename matches server migration history version',()=>{
 const name='20261026040729_isolate_legacy_source_links_parish_v213.sql';
 assert.equal(fs.existsSync('supabase/migrations/'+name),true);
 assert.equal(fs.existsSync('supabase/migrations/20261026035359_isolate_legacy_source_links_parish_v213.sql'),false);
 const sql=fs.readFileSync('supabase/migrations/'+name,'utf8');
 assert.match(sql,/Clave histórica vinculada a otra parroquia/);
});
