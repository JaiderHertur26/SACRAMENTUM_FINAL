import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = name => fs.readFileSync(name,'utf8');
const migration = read('supabase/migrations/20261022194003_fail_closed_can_access_parish_v150.sql');
const fake = read('scripts/qa-rollback-fail-closed-parish-access-v150.sql');
const roles = read('scripts/qa-rollback-valid-parish-roles-v150.sql');
const prev = read('supabase/migrations/20261022182523_lock_registry_print_and_track_request_lineage_v144.sql');

test('V150 patches exactly the original public can_access_parish signature', () => {
 assert.match(migration,/create or replace function public\.can_access_parish\(target_parish_id uuid\)/i);
 assert.match(migration,/returns boolean/i);
 assert.match(migration,/stable\s+security definer/i);
 assert.match(migration,/set search_path to 'public'/i);
});
test('V150 fails closed when Boolean permissions are NULL',()=>{
 assert.match(migration,/select coalesce\(/i);
 assert.match(migration,/\), false\s*\)/i);
});
test('V150 always denies absent JWT and missing target parish',()=>{
 assert.match(migration,/auth\.uid\(\) is not null/i);
 assert.match(migration,/target_parish_id is not null/i);
});
test('V150 preserves the admin general access predicate',()=>assert.match(migration,/public\.is_app_admin\(\)/i));
test('V150 preserves parish ownership',()=>{
 assert.match(migration,/public\.current_app_role\(\) = 'parish'/i);
 assert.match(migration,/public\.current_app_parish_id\(\) = target_parish_id/i);
});
test('V150 preserves diocesan and chancery boundaries',()=>{
 assert.match(migration,/public\.current_app_role\(\) in \('diocese', 'chancery'\)/i);
 assert.match(migration,/p\.diocese_id = public\.current_app_diocese_id\(\)/i);
});
test('V150 does not add new privileges or any writes to sacramental tables',()=>{
 assert.doesNotMatch(migration,/\bgrant\b|\bupdate\s+public\.|\binsert\s+into\s+public\.|\bdelete\s+from\s+public\./i);
});
test('V150 covers the privileged print RPC that delegates parish authorization',()=>{
 assert.match(prev,/if not public\.can_access_parish\(p_parish_id\)/i);
 assert.match(fake,/public\.register_registry_print/);
 assert.match(fake,/jurisdicci%n/);
});
test('V150 QA rejects null and an unprofiled actor using real RPC behavior',()=>{
 assert.match(fake,/is distinct from false/i);
 assert.match(fake,/00000000-0000-0000-0000-000000000150/i);
 assert.match(fake,/V150-FAIL unauthorized print accepted/i);
});
test('V150 QA checks that unauthorized correction cannot bypass Chancery',()=>{
 assert.match(fake,/public\.apply_baptism_correction/);
 assert.match(fake,/V150-FAIL unauthorized correction accepted/);
});
test('V150 QA preserves parish own access and blocks other parish',()=>{
 assert.match(roles,/public\.can_access_parish\(v_own\) is distinct from true/i);
 assert.match(roles,/public\.can_access_parish\(v_other\) is distinct from false/i);
});
test('V150 QA preserves valid Chancery and general admin permissions',()=>{
 assert.match(roles,/qa\.chancery_uid/);
 assert.match(roles,/qa\.admin_uid/);
});
test('V150 QA does not store or print actual user IDs',()=>{
 assert.doesNotMatch(roles,/raise notice|select\s+\*\s+from\s+public\.user_profiles/i);
 assert.match(roles,/current_setting\('qa\.parish_uid'\)/);
});
for(const [name,sql] of [['fake-user QA',fake],['role QA',roles]]){
 test('V150 '+name+' operates in a ROLLBACK-only transaction',()=>{
  assert.match(sql,/^BEGIN;$/m);
  assert.match(sql,/ROLLBACK;\s*$/);
  assert.doesNotMatch(sql,/^\s*COMMIT\b/im);
 });
}
