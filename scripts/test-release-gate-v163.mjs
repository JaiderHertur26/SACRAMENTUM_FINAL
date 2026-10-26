import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  resolveReleaseTarget,evaluateWorkflowRuns,waitForApprovedWorkflow,main
} from '../release-gate-v163.mjs';

const goodSha='1375467e17716c8f1c552fc9fa76c4adacdcfdab';
const badSha='ed37375ddc27b7bff3a390b680cc3c5dd34bbfc5';
const prod={
 VERCEL_ENV:'production',VERCEL_GIT_PROVIDER:'github',
 VERCEL_GIT_REPO_OWNER:'JaiderHertur26',
 VERCEL_GIT_REPO_SLUG:'SACRAMENTUM_FINAL',
 VERCEL_GIT_COMMIT_REF:'main',VERCEL_GIT_COMMIT_SHA:goodSha
};
const run=(status='completed',conclusion='success',sha=goodSha,id=10,extra={})=>({
 status,conclusion,head_sha:sha,head_branch:'main',event:'push',
 path:'.github/workflows/sacramentum-auditoria-v90.yml',
 id,run_attempt:1,created_at:'2026-10-23T13:00:00Z',...extra
});
const response=(runs,status=200)=>({
 ok:status===200,status,async json(){return {workflow_runs:runs};}
});
const fetchSequence=(responses,seen=[])=>async(url,opts)=>{
 seen.push({url,opts});
 return responses[Math.min(seen.length-1,responses.length-1)];
};
const fast={pause:async()=>{},maxChecks:3,intervalMs:0};

test('V163 production requires all Git provenance dimensions',()=>{
 assert.deepEqual(resolveReleaseTarget(prod),{production:true,sha:goodSha});
 for(const [key,val] of [
  ['VERCEL_GIT_PROVIDER','gitlab'],['VERCEL_GIT_REPO_OWNER','another'],
  ['VERCEL_GIT_REPO_SLUG','another'],['VERCEL_GIT_COMMIT_REF','feature/preview']]){
  assert.throws(()=>resolveReleaseTarget({...prod,[key]:val}),/PRODUCTION BLOCKED/);
 }
});
test('V163 production invalid SHA fails closed',()=>{
 for(const sha of [undefined,'','main','abc',goodSha.slice(0,39)]){
  assert.throws(()=>resolveReleaseTarget({...prod,VERCEL_GIT_COMMIT_SHA:sha}),/PRODUCTION BLOCKED/);
 }
});
test('V163 local and preview bypass production publishing only',()=>{
 assert.deepEqual(resolveReleaseTarget({}),{production:false});
 assert.deepEqual(resolveReleaseTarget({VERCEL_ENV:'preview'}),{production:false});
 assert.deepEqual(resolveReleaseTarget({VERCEL_ENV:'development'}),{production:false});
});
test('V163 TARGET production cannot be disguised as preview',()=>{
 assert.throws(()=>resolveReleaseTarget({...prod,VERCEL_ENV:'preview',VERCEL_TARGET_ENV:'production',VERCEL_GIT_COMMIT_SHA:''}),/PRODUCTION BLOCKED/);
});
test('V163 exact approved workflow permits build',()=>{
 assert.deepEqual(evaluateWorkflowRuns({workflow_runs:[run()]},goodSha),{status:'approved',runId:10});
});
test('V163 mismatched SHA, workflow, branch and event never authorize',()=>{
 const variants=[
  run('completed','success',badSha),
  run('completed','success',goodSha,10,{event:'workflow_dispatch'}),
  run('completed','success',goodSha,10,{head_branch:'feature'}),
  run('completed','success',goodSha,10,{path:'.github/workflows/other.yml'})
 ];
 for(const x of variants){
  assert.equal(evaluateWorkflowRuns({workflow_runs:[x]},goodSha).status,'waiting');
 }
});
test('V163 pending or queued CI does not authorize',()=>{
 for(const status of ['queued','in_progress','requested','waiting']){
  assert.equal(evaluateWorkflowRuns({workflow_runs:[run(status,null)]},goodSha).status,'waiting');
 }
});
test('V163 failing, cancelled, timed out and skipped CI never authorize',()=>{
 for(const conclusion of ['failure','cancelled','timed_out','action_required','skipped']){
  assert.deepEqual(evaluateWorkflowRuns({workflow_runs:[run('completed',conclusion)]},goodSha),{
   status:'rejected',conclusion,runId:10
  });
 }
});
test('V163 latest workflow attempt governs result, not historic success',()=>{
 const old=run('completed','success',goodSha,10,{run_attempt:1});
 const retry=run('in_progress',null,goodSha,10,{run_attempt:2});
 assert.equal(evaluateWorkflowRuns({workflow_runs:[old,retry]},goodSha).status,'waiting');
 const failed=run('completed','failure',goodSha,10,{run_attempt:2});
 assert.equal(evaluateWorkflowRuns({workflow_runs:[old,failed]},goodSha).status,'rejected');
});
test('V163 invalid GitHub API payload rejected',()=>{
 assert.throws(()=>evaluateWorkflowRuns({},goodSha),/PRODUCTION BLOCKED/);
});
test('V163 success after wait only if matching SHA finishes',async()=>{
 const seen=[];
 const verdict=await waitForApprovedWorkflow({
  sha:goodSha,
  request:fetchSequence([response([]),response([run('in_progress',null)]),response([run()])],seen),
  ...fast
 });
 assert.deepEqual(verdict,{approved:true,sha:goodSha,runId:10,attempts:3});
 assert.equal(seen.length,3);
 for(const {url,opts} of seen){
  const u=new URL(url);
  assert.equal(u.hostname,'api.github.com');
  assert.ok(u.pathname.endsWith('/actions/workflows/sacramentum-auditoria-v90.yml/runs'));
  assert.equal(u.searchParams.get('head_sha'),goodSha);
  assert.equal(u.searchParams.get('branch'),'main');
  assert.equal(u.searchParams.get('event'),'push');
  assert.ok(opts.headers['User-Agent']);
 }
});
test('V163 completed failure stops before waiting again',async()=>{
 const seen=[];
 await assert.rejects(waitForApprovedWorkflow({sha:goodSha,
  request:fetchSequence([response([run('completed','failure')])],seen),
  ...fast
 }),/PRODUCTION BLOCKED: CI ended as failure/);
 assert.equal(seen.length,1);
});
test('V163 refuses success for another commit even when it is latest',async()=>{
 const seen=[];
 await assert.rejects(waitForApprovedWorkflow({sha:goodSha,
  request:fetchSequence([response([run('completed','success',badSha)])],seen),
  ...fast
 }),/deadline exceeded/);
 assert.equal(seen.length,3);
});
test('V163 GitHub rate limiting or outage fails closed',async()=>{
 await assert.rejects(waitForApprovedWorkflow({sha:goodSha,
  request:async()=>response([],403),...fast
 }),/GitHub CI API unavailable/);
});
test('V163 invalid max attempts fail closed',async()=>{
 await assert.rejects(waitForApprovedWorkflow({sha:goodSha,
  request:async()=>response([run()]),maxChecks:0
 }),/Invalid CI gate attempt limit/);
});
test('V163 preview build does not call external network',async()=>{
 let fetched=0;
 const result=await main({VERCEL_ENV:'preview'},{
  request:async()=>{fetched++;throw Error('must not fetch');}
 });
 assert.deepEqual(result,{approved:false,preview:true});
 assert.equal(fetched,0);
});
test('V163 real build command preserves Vite build after the gate',()=>{
 const vercel=JSON.parse(fs.readFileSync('vercel.json','utf8'));
 assert.equal(vercel.buildCommand,'node release-gate-v163.mjs && npm run build');
 assert.deepEqual(vercel.rewrites,[{source:'/(.*)',destination:'/index.html'}]);
 const ignore=fs.readFileSync('.vercelignore','utf8');
 assert.doesNotMatch(ignore,/^release-gate-v163\.mjs\s*$/m);
});
test('V213 production delegates required CI to GitHub protected main, never to unauthenticated Vercel API',async()=>{
 const policy=JSON.parse(fs.readFileSync('AUDITORIA_PROTECCION_MAIN_V213.json','utf8'));
 assert.equal(policy.required_status_checks.strict,true);
 assert.equal(policy.enforce_admins,true);
 assert.deepEqual(policy.required_status_checks.contexts,['pruebas-funcionales','seguridad-dependencias']);
 const release=await main(prod);
 assert.deepEqual(release.checks,policy.required_status_checks.contexts);
 assert.equal(release.guard,'github-protected-main');
});
