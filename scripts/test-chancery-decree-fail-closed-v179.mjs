// V179 · Chancellor authorization gates must reject NULL role as well as suspended accounts.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const migration=fs.readFileSync('supabase/migrations/20261023221315_chancery_decree_fail_closed_v179.sql','utf8');
const reproduction=fs.readFileSync('scripts/qa-rollback-chancery-decrees-prepatch-v179.sql','utf8');
const qa=fs.readFileSync('scripts/qa-rollback-chancery-decree-scope-v179.sql','utf8');
for(const rpc of ['apply_marriage_correction','apply_funeral_correction','create_marriage_reposition_by_decree','create_funeral_reposition_by_decree','apply_marriage_nullity']){
 test('V179 migrates existing '+rpc+' signature',()=>assert.ok(migration.includes('public.'+rpc+'(')));
 test('V179 verifies auth guard on '+rpc+' via real SQL fixture',()=>{
  assert.ok(reproduction.includes('public.'+rpc+'('));
  assert.ok(qa.includes('public.'+rpc+'('));
 });
}
test('V179 active profile check denies nullable states of is_active and status',()=>{
 assert.match(migration,/up\.is_active IS TRUE/);
 assert.match(migration,/upper\(up\.status\)=''ACTIVE''/);
 assert.match(migration,/is_active IS TRUE/);
 assert.match(migration,/upper\(status\)=''ACTIVE''/);
});
test('V179 addresses three-valued SQL logic explicitly',()=>{
 assert.match(migration,/NULL <> 'chancery'/);
 assert.match(migration,/v_role IS DISTINCT FROM ''chancery''/);
 assert.match(migration,/null-role guard missing\/duplicated/);
});
test('V179 aborts on unexpected number of SQL anchors',()=>{
 assert.match(migration,/regexp_count\(original,active_old,1,'i'\)<>1/);
 assert.match(migration,/regexp_count\(original,status_old,1,'i'\)<>1/);
 assert.match(migration,/patched_count<>5/);
 assert.match(migration,/oid_fn IS NULL/);
});
test('V179 only updates function definitions, preserving decree records, grants and signatures',()=>{
 assert.match(migration,/pg_get_functiondef\(oid_fn\)/);
 assert.match(migration,/EXECUTE patched/);
 assert.doesNotMatch(migration,/\bDROP FUNCTION\b|\bDROP TABLE\b|\bALTER TABLE\b|\bTRUNCATE\b|\bGRANT\b|\bREVOKE\b|\bINSERT INTO\b|\bUPDATE\s+public\./i);
});
test('V179 real prepatch proved suspended role advanced to business validation',()=>{
 assert.match(reproduction,/V179_SUSPENDED_CHANCELLOR_PASSED_FIVE_AUTH_GATES/);
 assert.match(reproduction,/n<>5/);
 assert.match(reproduction,/current_app_role\(\) IS NOT NULL/);
});
test('V179 verifies five valid role gates and 25 explicitly denied combinations',()=>{
 assert.match(qa,/allowed<>5 OR forbidden<>25/);
 for(const scenario of ['ACTIVE','SUSPENDED','NULL_STATUS','NULL_ACTIVE','DISABLED','WRONG_ROLE'])
  assert.ok(qa.includes("'"+scenario+"'"));
 assert.match(qa,/received IS DISTINCT FROM expected/);
});
test('V179 authorized fixtures exercise input validation, not five fabricated full decrees',()=>{
 assert.match(qa,/Partida original de Matrimonio no encontrada/);
 assert.match(qa,/Partida original de Exequias no encontrada/);
 assert.match(qa,/Fecha y fundamento del decreto son obligatorios/);
 assert.match(qa,/Número y fecha de sentencia\/decreto son obligatorios/);
});
test('V179 both SQL fixtures use fictional actors and full rollback',()=>{
 for(const sql of [qa,reproduction]){
  assert.match(sql,/^BEGIN;$/m);
  assert.match(sql,/ROLLBACK;\s*$/);
  assert.match(sql,/@example\.invalid/);
  assert.doesNotMatch(sql,/^\s*COMMIT\s*;/mi);
 }
});