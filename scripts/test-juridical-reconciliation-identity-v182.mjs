import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const migration=fs.readFileSync('supabase/migrations/20261024011824_juridical_reconciliation_identity_v182.sql','utf8');
const baseline=fs.readFileSync('scripts/qa-rollback-juridical-reconciliation-prepatch-v182.sql','utf8');
const qa=fs.readFileSync('scripts/qa-rollback-juridical-reconciliation-identity-v182.sql','utf8');
const rpcs=['approve_later_note_reconciliation_v156','get_court_clarifications_v113','get_court_receipt_dual_control_summary_v111'];
for(const rpc of rpcs){
 test('V182 migration preserves exact SECURITY DEFINER signature '+rpc,()=>assert.ok(migration.includes("'public."+rpc+"(")));
 test('V182 real PostgreSQL scenario exercises '+rpc,()=>{
  assert.ok(baseline.includes('public.'+rpc+'('));
  assert.ok(qa.includes('public.'+rpc+'('));
 });
}
test('V182 mandates explicitly true active profile',()=>{
 assert.match(migration,/u\.is_active IS TRUE/);
 assert.match(migration,/coalesce\[\[:space:\]\]\*/);
});
test('V182 mandates explicit ACTIVE state and no implicit defaults',()=>{
 assert.match(migration,/upper\(u\.status\)='ACTIVE'/);
 assert.match(migration,/status_pat/);
});
test('V182 denies missing institutional role in dual-control summary',()=>{
 assert.match(migration,/v_role IS NULL OR v_role NOT IN/);
 assert.match(migration,/nullable role check changed/);
});
test('V182 aborts on missing or changed function definitions',()=>{
 assert.match(migration,/to_regprocedure\(spec\)/);
 assert.match(migration,/regexp_count\(src,active_pat,1,'i'\)<>1/);
 assert.match(migration,/regexp_count\(src,status_pat,1,'i'\)<>1/);
 assert.match(migration,/patched_count<>3/);
});
test('V182 preserves judicial review logic, notes, case status and signatures',()=>{
 assert.match(migration,/pg_get_functiondef\(oid_f\)/);
 assert.match(migration,/EXECUTE updated/);
 const executable=migration.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
 assert.doesNotMatch(executable,/\bALTER TABLE\b|\bDROP TABLE\b|\bGRANT\b|\bREVOKE\b|\bTRUNCATE\b|\bINSERT INTO\s+public\./i);
});
test('V182 old suspended/NULL status accessed three legal business gates',()=>{
 assert.match(baseline,/V182_NULL_STATUS_PASSED_3_JURIDICAL_PRIVILEGED_GATES/);
 assert.match(baseline,/current_app_role\(\) IS NOT NULL/);
 assert.match(baseline,/n<>3/);
});
test('V182 real SQL matrix checks 5 allowed and 24 rejected scenarios',()=>{
 assert.match(qa,/positive<>5 OR negative<>24/);
 assert.match(qa,/msg IS DISTINCT FROM expected/);
});
test('V182 fail-closed matrix includes missing profile, inactive and wrong roles',()=>{
 for(const state of ['SUSPENDED','NULL_STATUS','NULL_ACTIVE','DISABLED','PENDING','BLANK_STATUS','WRONG_ROLE','PROFILELESS'])
  assert.ok(qa.includes("'"+state+"'"),state);
 assert.match(qa,/DELETE FROM public\.user_profiles WHERE auth_user_id=ghost/);
});
test('V182 preserves dual access for active diocese/chancery to court receipts',()=>{
 assert.match(qa,/scenario='CHANCERY' AND fn.kind='approve'/);
 assert.match(qa,/Recepción ajena o inexistente/);
 assert.match(qa,/Recepción no localizada en la jurisdicción/);
});
test('V182 preserves independent diocesan authorization of marginal note reconciliation',()=>{
 assert.match(qa,/Sólo Diócesis puede autorizar, desde cuenta distinta de Cancillería/);
 assert.match(qa,/Referencia de autorización y motivación episcopal obligatorias/);
});
test('V182 tests use fictitious people only and rollback every database modification',()=>{
 for(const sql of [qa,baseline]){
  assert.match(sql,/^BEGIN;$/m);assert.match(sql,/ROLLBACK;\s*$/);
  assert.match(sql,/@example\.invalid/);assert.doesNotMatch(sql,/^\s*COMMIT\s*;/mi);
 }
});
test('V182 returned evidence does not expose real judicial documents',()=>{
 assert.match(qa,/aggregate_counts_only/);
 assert.doesNotMatch(qa,/SELECT\s+request_text\s+FROM|SELECT\s+response_text\s+FROM/i);
});
test('V182 uses expected errors rather than treating any SQL error as a pass',()=>{
 assert.match(qa,/IF msg IS DISTINCT FROM expected/);
 assert.match(qa,/Sólo Diócesis puede autorizar/);
 assert.match(qa,/Acceso institucional denegado/);
 assert.match(qa,/Consulta limitada a Cancillería y Diócesis/);
});