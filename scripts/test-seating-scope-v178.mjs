import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const migration=fs.readFileSync('supabase/migrations/20261023214651_seat_sacraments_scope_v178.sql','utf8');
const baseline=fs.readFileSync('scripts/qa-rollback-seating-privileges-prepatch-v178.sql','utf8');
const qa=fs.readFileSync('scripts/qa-rollback-seating-authorization-v178.sql','utf8');
const rpcs=['create_pending_baptism_with_confirmation_flow','seat_baptism_records','seat_confirmation_records','seat_pending_marriage','seat_funeral_record','process_matrimonial_notification_recipient'];
for(const rpc of rpcs){
 test('V178 applies the security migration to '+rpc,()=>assert.ok(migration.includes('public.'+rpc+'(')));
 test('V178 tests authenticated suspended baseline and changed grants for '+rpc,()=>{
  assert.ok(baseline.includes('public.'+rpc+'('));
  assert.ok(qa.includes('public.'+rpc+'('));
 });
}
test('V178 explicit ACTIVE status, true flag, and genuine parish/diocese concordance',()=>{
 assert.match(migration,/is_active IS TRUE/);assert.match(migration,/upper\(%s.status\)=''ACTIVE''/);
 assert.match(migration,/diocese_id IS NOT NULL/);assert.match(migration,/v178_parish\.diocese_id=%s\.diocese_id/);
});
test('V178 handles unaliased baptism seating profile carefully',()=>{
 assert.match(migration,/seat_baptism_records/);assert.match(migration,/public\.user_profiles/);
 assert.match(migration,/CASE WHEN spec LIKE/);
});
test('V178 fails fast if target functions changed, are absent, or have multiple anchors',()=>{
 assert.match(migration,/to_regprocedure\(spec\)/);
 assert.match(migration,/matched<>1/);assert.match(migration,/authorization anchor incompatible/);
 assert.match(migration,/changed<>6/);
});
test('V178 only replaces predicate, preserving data and function signatures',()=>{
 assert.match(migration,/pg_get_functiondef\(fn\)/);assert.match(migration,/EXECUTE updated/);
 assert.doesNotMatch(migration,/\bDROP\s+(?:TABLE|FUNCTION)\b|\bALTER TABLE\b|\bTRUNCATE\b|\bGRANT\b|\bREVOKE\b|\bINSERT INTO\b|\bUPDATE\s+public\./i);
});
test('V178 baseline proves suspended user passed six authorization gates',()=>{
 assert.match(baseline,/SUSPENDED/);assert.match(baseline,/V178_SUSPENDED_PASSED_AUTH_IN_SIX_PRIVILEGED_CALLS/);
 assert.match(baseline,/n<>6/);
});
test('V178 tests six authorized and 36 unauthorized authorization gates',()=>{
 assert.match(qa,/num_good<>6 OR num_denied<>36/);
 for(const name of ['ACTIVE','SUSPENDED','NULL_STATUS','NULL_ACTIVE','DISABLED','FOREIGN_DIOCESE','WRONG_ROLE'])
  assert.ok(qa.includes("'"+name+"'"),name);
 assert.match(qa,/msg IS DISTINCT FROM expected/);
});
test('V178 unit QA does not claim six full seating transactions',()=>{
 assert.match(qa,/No hay registros para asentar/);
 assert.match(qa,/Expediente matrimonial pendiente no encontrado/);
 assert.match(qa,/Notificación sacramental no encontrada/);
});
test('V178 fixtures are fictional, transactions reversible with no COMMIT',()=>{
 for(const sql of [baseline,qa]){
  assert.match(sql,/^BEGIN;$/m);
  assert.match(sql,/ROLLBACK;\s*$/);
  assert.match(sql,/@example\.invalid/);
  assert.doesNotMatch(sql,/^\s*COMMIT\s*;/mi);
 }
});