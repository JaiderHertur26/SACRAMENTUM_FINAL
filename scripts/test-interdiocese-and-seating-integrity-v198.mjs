import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(f,'utf8');
const migration=read('supabase/migrations/20261025002200_guard_pending_seated_direct_write_v198.sql');
const qa=read('scripts/qa-rollback-direct-seat-bypass-v198.sql');
const isolation=read('scripts/qa-rollback-interdiocesan-dml-v198.sql');
const scoped=read('scripts/qa-rollback-interdiocesan-scope-v198.sql');

test('V198 creates triggers on both pending sacrament tables before INSERT and UPDATE',()=>{
 for(const table of ['pending_baptisms','pending_confirmations']){
  assert.match(migration,new RegExp('BEFORE INSERT OR UPDATE ON public\\.'+table));
  assert.match(migration,/RETURN NEW/);
 }
 assert.match(migration,/SECURITY INVOKER SET search_path TO ''/);
 assert.match(migration,/current_user NOT IN \('authenticated','anon'\)/);
});
test('V198 protects status, reported, raw status and sealed-linked IDs against direct writes',()=>{
 for(const pattern of [/new_status='seated'/,/old_status='seated'/,/NEW\.reportado IS TRUE/,
  /boleta_archived/,/seated_baptism_id/,/seated_confirmation_id/,/new_json_estado/,
  /new_json_status/])assert.match(migration,pattern);
 assert.match(migration,/ERRCODE='42501'/);
 assert.doesNotMatch(migration,/UPDATE public\.pending_|DELETE FROM public\.pending_|TRUNCATE/i);
});
test('V198 trigger RPC EXECUTE is revoked from public/authenticated/anonymous roles',()=>{
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.sacramentum_guard_pending_seat_direct_v198\(\)/);
 assert.match(migration,/FROM PUBLIC, anon, authenticated/);
});
test('V198 creates fictitious boletas and tests 20 negative direct writes and 4 positive cases',()=>{
 for(const f of ['create_pending_baptism','create_pending_confirmation','seat_baptism_records','seat_confirmation_records'])
  assert.ok(qa.includes("'"+f+"'"));
 for(const scenario of ['status','reported','json_status','json_estado','archived','foreign_link',
  'insert_seated','insert_reported','insert_json_status']) assert.ok(qa.includes("'"+scenario+"'"));
 assert.match(qa,/denial_count<>20 OR allow_count<>4/);
 assert.match(qa,/status='seated'/);
 assert.ok(qa.trimEnd().endsWith('ROLLBACK;'));
});
test('V198 simulated second diocese has independent scope and blocked direct DML',()=>{
 for(const s of ['DIOCESIS FICTICIA QA V198','PARROQUIA FICTICIA QA V198','can_access_parish',
  'qa198.origin_checks','qa198.moved_checks'])assert.ok(scoped.includes(s));
 for(const s of ['blocked<>12','direct_ok<>3','UPDATE public.parishes','DELETE FROM public.parishes',
  'pending_baptisms','pending_confirmations'])assert.ok(isolation.includes(s));
 assert.ok(scoped.trimEnd().endsWith('ROLLBACK;')&&isolation.trimEnd().endsWith('ROLLBACK;'));
});
