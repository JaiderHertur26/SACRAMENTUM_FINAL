import { pathToFileURL } from 'node:url';

// SACRAMENTUM V163 — Fail-closed deployment gate, runs before Vercel production builds.
// Never prints tokens or environment values. Preview and local builds remain independent.
// GitHub workflow must complete successfully for the exact production commit.
const OWNER='JaiderHertur26';
const REPO='SACRAMENTUM_FINAL';
const WORKFLOW='sacramentum-auditoria-v90.yml';
const BRANCH='main';
const SHA_PATTERN=/^[0-9a-f]{40}$/i;

export function resolveReleaseTarget(env=process.env){
  const production=env.VERCEL_ENV==='production'||env.VERCEL_TARGET_ENV==='production';
  if(!production)return {production:false};
  const sha=env.VERCEL_GIT_COMMIT_SHA||'';
  if(!SHA_PATTERN.test(sha))throw Error('PRODUCTION BLOCKED: missing or invalid Git commit SHA.');
  if(env.VERCEL_GIT_PROVIDER!=='github'||
      env.VERCEL_GIT_REPO_OWNER!==OWNER||
      env.VERCEL_GIT_REPO_SLUG!==REPO||
      env.VERCEL_GIT_COMMIT_REF!==BRANCH){
    throw Error('PRODUCTION BLOCKED: Git provenance must match the approved main branch and repository.');
  }
  return {production:true,sha:sha.toLowerCase()};
}

export function evaluateWorkflowRuns(payload,expectedSha){
  if(!Array.isArray(payload?.workflow_runs))throw Error('PRODUCTION BLOCKED: invalid GitHub API response.');
  const match=payload.workflow_runs.filter(r=>
    r.head_sha?.toLowerCase()===expectedSha.toLowerCase() &&
    r.head_branch===BRANCH && r.event==='push' &&
    r.path?.endsWith('/'+WORKFLOW));
  if(!match.length)return {status:'waiting',message:'CI run not registered yet'};
  const latest=match.sort((a,b)=>
    Number(b.run_attempt||1)-Number(a.run_attempt||1)||
    String(b.created_at||'').localeCompare(String(a.created_at||'')))[0];
  if(latest.status!=='completed')return {status:'waiting',message:'CI still running'};
  if(latest.conclusion==='success')return {status:'approved',runId:latest.id};
  return {status:'rejected',conclusion:latest.conclusion||'unknown',runId:latest.id};
}

export async function waitForApprovedWorkflow({
 sha,request=globalThis.fetch,
 pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
 maxChecks=40,intervalMs=12000
}){
  if(!SHA_PATTERN.test(sha))throw Error('PRODUCTION BLOCKED: invalid commit SHA.');
  if(!Number.isInteger(maxChecks)||maxChecks<1||maxChecks>40)
    throw Error('Invalid CI gate attempt limit.');
  const endpoint=new URL(
    'https://api.github.com/repos/'+OWNER+'/'+REPO+
    '/actions/workflows/'+WORKFLOW+'/runs'
  );
  endpoint.searchParams.set('branch',BRANCH);
  endpoint.searchParams.set('head_sha',sha);
  endpoint.searchParams.set('event','push');
  endpoint.searchParams.set('per_page','20');
  let lastMessage='No matching CI runs.';
  for(let check=1;check<=maxChecks;check++){
    const response=await request(endpoint.toString(),{
      headers:{Accept:'application/vnd.github+json','User-Agent':'sacramentum-release-gate-v163','Cache-Control':'no-cache'},
      signal:AbortSignal.timeout(12000)
    });
    if(!response?.ok)throw Error('PRODUCTION BLOCKED: GitHub CI API unavailable (HTTP '+(response?.status||'unknown')+').');
    const data=await response.json();
    const result=evaluateWorkflowRuns(data,sha);
    if(result.status==='approved'){
      return {approved:true,sha,runId:result.runId,attempts:check};
    }
    if(result.status==='rejected'){
      throw Error('PRODUCTION BLOCKED: CI ended as '+result.conclusion+' for this commit.');
    }
    lastMessage=result.message;
    if(check<maxChecks)await pause(intervalMs);
  }
  throw Error('PRODUCTION BLOCKED: CI approval deadline exceeded. '+lastMessage);
}

export async function main(env=process.env,options={}){
  const target=resolveReleaseTarget(env);
  if(!target.production){
    process.stdout.write('[V163] Preview/local build: no production promotion attempted.\n');
    return {approved:false,preview:true};
  }
  process.stdout.write('[V163] Verifying required GitHub CI result for production commit '+target.sha.slice(0,12)+'...\n');
  const verdict=await waitForApprovedWorkflow({sha:target.sha,...options});
  process.stdout.write('[V163] APPROVED: CI '+verdict.runId+' succeeded on exact commit '+target.sha.slice(0,12)+'.\n');
  return verdict;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(error=>{
    process.stderr.write('[V163] '+String(error.message||error)+'\n');
    process.exitCode=1;
  });
}
