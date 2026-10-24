import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const mig=fs.readFileSync('supabase/migrations/20261024005811_fail_closed_management_and_sacrament_params_v181.sql','utf8');
const repro1=fs.readFileSync('scripts/qa-rollback-user-management-and-parameters-repro-v181.sql','utf8');
const repro2=fs.readFileSync('scripts/qa-rollback-profileless-manager-repro-v181.sql','utf8');
const qa=fs.readFileSync('scripts/qa-rollback-management-physical-params-v181.sql','utf8');
const names=['set_managed_user_active','update_managed_user_profile','save_baptism_parameters','save_confirmation_parameters'];
for(const name of names){
 test('V181 migration includes exact signature for '+name,()=>{
  assert.ok(mig.includes("'public."+name+"("));
 });
 test('V181 real QA checks '+name+' authorized and denied cases',()=>{
  assert.ok(qa.includes('public.'+name+'('));
 });
}
test('V181 no profile or stale status cannot administer another user',()=>{
 assert.match(mig,/v_actor_role IS NULL OR v_actor_role NOT IN/);
 assert.match(mig,/regexp_count\(fixed,actor_role_pat,1,'i'\)<>1/);
});
test('V181 all functions reject NULL is_active and non-ACTIVE statuses',()=>{
 assert.match(mig,/is_active IS TRUE/);
 assert.match(mig,/upper\(status\)='ACTIVE'/);
 assert.match(mig,/status_pat:=[\s\S]*?upper/);
});
test('V181 protects physical baptism and confirmation numbering endpoints',()=>{
 assert.match(mig,/save_baptism_parameters/);
 assert.match(mig,/save_confirmation_parameters/);
 assert.match(mig,/status_pat:=\$p\$coalesce/);
});
test('V181 preserves transactional numbering mechanics and institutional roles',()=>{
 assert.match(mig,/pg_get_functiondef/);assert.match(mig,/EXECUTE fixed/);
 const executable=mig.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
 assert.doesNotMatch(executable,/\bDROP\s+(?:TABLE|FUNCTION)\b|\bALTER TABLE\b|\bGRANT\b|\bREVOKE\b|\bTRUNCATE\b|\bINSERT INTO\s+public\./i);
});
test('V181 fails closed if any PostgreSQL function definition deviates',()=>{
 assert.match(mig,/to_regprocedure\(spec\)/);
 assert.match(mig,/regexp_count\(src,active_pat,1,'i'\)<>1/);
 assert.match(mig,/regexp_count\(fixed,status_pat,1,'i'\)<>1/);
 assert.match(mig,/count_modified<>4/);
});
test('V181 reproduced suspended diocese disabling a fake parish user',()=>{
 assert.match(repro1,/V181_PREPATCH_SUSPENDED_DIOCESE_DISABLED_FAKE_PARISH_USER/);
 assert.match(repro1,/set_managed_user_active\(target,false\)/);
});
test('V181 reproduced profileless authenticated actor disabling AND reassigning user',()=>{
 assert.match(repro2,/V181_PREPATCH_PROFILELESS_AUTH_USER_DISABLED_AND_REASSIGNED_FAKE_PARISH_PROFILE/);
 assert.match(repro2,/DELETE FROM public\.user_profiles WHERE auth_user_id=rogue/);
 assert.match(repro2,/update_managed_user_profile\(target/);
});
test('V181 reproduced suspended parish passing both book-number authorization checks',()=>{
 assert.match(repro1,/V181_PREPATCH_TWO_SUSPENDED_PARISH_PARAMETER_GUARDS_BYPASSED/);
 assert.match(repro1,/save_baptism_parameters/);
 assert.match(repro1,/save_confirmation_parameters/);
});
test('V181 SQL integration covers 4 positive and 28 negative operations',()=>{
 assert.match(qa,/positives<>4 OR denials<>28/);
 for(const mode of ['SUSPENDED','NULL_STATUS','NULL_ACTIVE','DISABLED','PENDING','WRONG_ROLE','PROFILELESS','BLANK_STATUS'])
 assert.ok(qa.includes("'"+mode+"'"),mode);
});
test('V181 correct manager actions still work on isolated fake target',()=>{
 assert.match(qa,/QA-V181-AUTHORIZED/);
 assert.match(qa,/legitimate diocesan access management failed/);
 assert.match(qa,/legitimate profile reassignment failed/);
 assert.match(qa,/forbidden call altered fictitious authorized target/);
});
test('V181 valid parish reaches book version conflict without real persistent changes',()=>{
 assert.match(qa,/legitimate % auth did not reach version validation/);
 assert.match(qa,/El Libro cambió/);
});
test('V181 compares explicit denial messages instead of counting unrelated errors',()=>{
 assert.match(qa,/err IS DISTINCT FROM t\.expected/);
 assert.match(qa,/Sólo la parroquia propietaria puede modificar sus parámetros de Bautismo/);
 assert.match(qa,/No autorizado para administrar accesos/);
});
test('V181 every real SQL fixture is fictional, with BEGIN and final ROLLBACK',()=>{
 for(const body of [repro1,repro2,qa]){
 assert.match(body,/^BEGIN;$/m);assert.match(body,/ROLLBACK;\s*$/);
 assert.match(body,/@example\.invalid/);assert.doesNotMatch(body,/^\s*COMMIT;/mi);
 }
});
test('V181 does not persist or reproduce private profile values in published evidence',()=>{
 assert.match(qa,/qa_aggregate_only/);
 assert.doesNotMatch(qa,/SELECT\s+email\s+FROM\s+public\./i);
});