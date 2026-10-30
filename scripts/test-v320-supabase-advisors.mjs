import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const p1=read('supabase/deployment/v320_rls_policy_security_and_initplan.sql');
const p2=read('supabase/deployment/v320b_restrictive_notification_policy_fix.sql');
const p3=read('supabase/deployment/v320c_foreign_key_indexes.sql');
const qa=read('scripts/qa-rollback-notifications-rls-v320.sql');
test('V320 identity initplan caches auth.uid without changing parish/chancery scope',()=>{
 assert.match(p1,/ALTER POLICY pending_tokens_insert_owner/);
 assert.match(p1,/ALTER POLICY decretos_select_scope/);
 assert.match(p1,/\(SELECT auth\.uid\(\)\)/);
 assert.doesNotMatch(p1,/DROP POLICY|DISABLE ROW LEVEL SECURITY/i);
});
test('V320 restrictive policy never blocks nondecree notifications',()=>{
 assert.match(p2,/ALTER POLICY decree_notification_private_v312/);
 assert.match(p2,/category <> 'decree' OR/);
 assert.match(p2,/ALTER POLICY official_notifications_select_scoped/);
 assert.match(p2,/current_app_role\(\) IN \('diocese','chancery'\)/);
});
test('V320 bishop cannot bypass restrictive decree policy',()=>{
 assert.match(p2,/current_app_role\(\)='chancery'/);
 assert.match(p2,/current_app_role\(\)='parish'/);
 assert.doesNotMatch(p2,/current_app_role\(\)='diocese' AND receiver_parish_id/);
});
test('V320 adds the 35 missing foreign-key indexes without dropping any existing index',()=>{
 const indexes=p3.match(/CREATE INDEX IF NOT EXISTS/g)||[];
 assert.equal(indexes.length,35);
 assert.doesNotMatch(p3,/DROP INDEX|TRUNCATE|DELETE FROM/i);
});
test('V320 database role QA is a rollback-only scope matrix with four user roles',()=>{
 assert.match(qa,/SET LOCAL ROLE authenticated/);
 assert.match(qa,/bishop_no_decrees/);
 assert.match(qa,/bishop_general_notices/);
 assert.match(qa,/chancery_all_diocesan/);
 assert.match(qa,/parish_own_only/);
 assert.match(qa,/^ROLLBACK;\s*$/m);
 assert.doesNotMatch(qa,/^\s*COMMIT;/m);
});
test('V320 CI and local audit gate continue to run RLS regression',()=>{
 const gate=read('scripts/audit-gate-v90.mjs'),ci=read('.github/workflows/sacramentum-auditoria-v90.yml');
 assert.match(gate,/scripts\/test-v320-supabase-advisors\.mjs/);
 assert.match(ci,/scripts\/test-v320-supabase-advisors\.mjs/);
});
