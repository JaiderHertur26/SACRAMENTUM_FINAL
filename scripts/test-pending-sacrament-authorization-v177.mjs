// V177: four pending-sacrament privileged RPCs, fail-closed account and diocese scope.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const mig=fs.readFileSync('supabase/migrations/20261023205143_pending_sacraments_active_parish_v177.sql','utf8');
const pre=fs.readFileSync('scripts/qa-rollback-four-pending-prepatch-v177.sql','utf8');
const post=fs.readFileSync('scripts/qa-rollback-four-pending-authorization-v177.sql','utf8');
const baptism=fs.readFileSync('scripts/qa-rollback-suspended-parish-pending-repro-v177.sql','utf8');
const names=['baptism','confirmation','marriage','funeral'];
for(const name of names){
 test('V177 migration retains signature of create_pending_'+name,()=>{
  assert.ok(mig.includes("'public.create_pending_"+name+"(uuid,jsonb)'"));
 });
 test('V177 PostgreSQL verified both positive and negative '+name+' RPC',()=>{
  assert.match(post,new RegExp("SELECT pending_id FROM public\\.create_pending_"+name+"\\(\\$1,\\$2::jsonb\\)"));
  assert.ok(post.includes("('"+name+"'"));
 });
}
test('V177 only grants pending-write scope to explicitly ACTIVE parish profile',()=>{
 assert.match(mig,/up\.is_active IS TRUE/);assert.match(mig,/upper\(up\.status\)='ACTIVE'/);
 assert.match(mig,/up\.diocese_id IS NOT NULL/);
 assert.match(mig,/v177_scope\.id=p_parish_id AND v177_scope\.diocese_id=up\.diocese_id/);
});
test('V177 aborts if any SQL function anchor/signature changed or repeated',()=>{
 assert.match(mig,/regexp_count\(src,pattern,1,'i'\)<>1/);
 assert.match(mig,/authorization anchor absent\/changed\/duplicated/);
 assert.match(mig,/changed<>4/);
 assert.match(mig,/oid_found IS NULL/);
});
test('V177 does not mutate sacramental data, role grants or table schemas by migration',()=>{
 assert.doesNotMatch(mig,/\bTRUNCATE\b|\bDROP TABLE\b|\bALTER TABLE\b|\bGRANT\s+|\bREVOKE\s+|\bUPDATE\s+public\.|\bDELETE FROM\s+public\./i);
 assert.match(mig,/pg_get_functiondef/);assert.match(mig,/EXECUTE patched/);
});
test('V177 removes permissive funeral status predicate while retaining all business logic',()=>{
 assert.match(mig,/coalesce\(up\.status,''active''\) not in/);
 assert.match(mig,/upper\(up\.status\)=''ACTIVE''/);
 assert.match(mig,/funeral legacy status predicate changed/);
});
test('V177 reproduction verifies all four privileged calls were granted to SUSPENDED actor before patch',()=>{
 assert.match(pre,/status\)\s*VALUES\(a,'parish',p,di,true,'SUSPENDED'\)/);
 assert.match(pre,/V177_PREPATCH_ALL_FOUR_SUSPENDED_PENDING_CREATIONS_CONFIRMED/);
 assert.match(pre,/total<>4/);
});
test('V177 postpatch real QA verifies six disallowed institutional identity states',()=>{
 for(const state of ['SUSPENDED','NULL_STATUS','NULL_ACTIVE','DISABLED','FOREIGN_DIOCESE','DIOCESE_ROLE'])
  assert.ok(post.includes("'"+state+"'"),state);
 assert.match(post,/count_denied<>24/);
 assert.match(post,/err IS DISTINCT FROM spec\.expected/);
});
test('V177 postpatch QA verifies successful owner CRUD and no forbidden side effects',()=>{
 assert.match(post,/n<>4/);
 assert.match(post,/counts IS DISTINCT FROM ARRAY\[1,1,1,1\]/);
 assert.match(post,/SELECT count\(\*\) FROM public\.pending_baptisms/);
 assert.match(post,/SELECT count\(\*\) FROM public\.pending_confirmations/);
 assert.match(post,/SELECT count\(\*\) FROM public\.pending_marriages/);
 assert.match(post,/SELECT count\(\*\) FROM public\.pending_funerals/);
});
test('V177 prepatch and postpatch SQL use fictitious users, full ROLLBACK and no COMMIT',()=>{
 for(const sql of [pre,post,baptism]){
  assert.match(sql,/^BEGIN;$/m);assert.match(sql,/ROLLBACK;\s*$/);
  assert.match(sql,/@example\.invalid/);
  assert.doesNotMatch(sql,/^\s*COMMIT;/mi);
 }
});
