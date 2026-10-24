import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(f)=>fs.readFileSync(f,'utf8');
const migration=read('supabase/migrations/20261024205559_chancery_active_uniqueness_replacement_v192.sql');
const b=read('scripts/qa-rollback-four-boleta-consecutives-v192.sql');
const c=read('scripts/qa-rollback-chancery-unique-active-v192.sql');
test('V192 Canciller uniqueness only applies to explicit ACTIVE users',()=>{
 assert.match(migration,/is_active IS TRUE/);
 assert.match(migration,/upper\(coalesce\(status,''\)\)='ACTIVE'/);
 assert.match(migration,/CREATE UNIQUE INDEX/);
 assert.match(migration,/RENAME TO uq_active_chancery_user/);
});
test('V192 migration makes atomic change without altering user records',()=>{
 assert.doesNotMatch(migration,/\bUPDATE public\.user_profiles\b|\bDELETE FROM\b|\bINSERT INTO\b/i);
 assert.match(migration,/lock_timeout/);
});
test('V192 active successor and collision are verified with reversible records',()=>{
 assert.ok(c.includes('ROLLBACK;'));
 assert.ok(c.includes("status='SUSPENDED'"));
 assert.ok(c.includes('denials<>3'));
});
test('V192 boleta RPC creates 2 consecutive records each for all 4 sacraments',()=>{
 for(const rpc of ['create_pending_baptism','create_pending_confirmation','create_pending_marriage','create_pending_funeral'])
  assert.ok(b.includes('public.'+rpc+'('));
 assert.match(b,/second_no<>first_no\+1/);
 assert.match(b,/kind_count<>4/);
 assert.match(b,/RESET ROLE/);
 assert.ok(b.trimEnd().endsWith('ROLLBACK;'));
});
