import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(p)=>fs.readFileSync(p,'utf8');
const roles=read('scripts/qa-rollback-four-role-read-matrix-v197.sql');
const parish=read('scripts/qa-rollback-parish-isolation-v197.sql');

test('V197 validates four institutional actor roles on 11 protected tables and reverses all changes',()=>{
 for(const role of ['admin_general','diocese','chancery','parish'])assert.ok(roles.includes("'"+role+"'"));
 for(const tbl of ['baptisms','confirmations','marriages','funerals','pending_baptisms','pending_confirmations','pending_marriages','pending_funerals','registry_print_events','marginal_notes','decretos'])assert.ok(roles.includes("'"+tbl+"'"));
 assert.match(roles,/successes<>44/);
 assert.match(roles,/blocked<>44/);
 assert.match(roles,/current_app_role\(\) IS NOT NULL/);
 assert.match(roles,/SET LOCAL ROLE authenticated/);
 assert.ok(roles.trimEnd().endsWith('ROLLBACK;'));
});
test('V197 creates and verifies four synthetic boletas before attempted cross-parish access',()=>{
 for(const rpc of ['create_pending_baptism','create_pending_confirmation','create_pending_marriage','create_pending_funeral'])assert.ok(parish.includes("'"+rpc+"'"));
 assert.ok(parish.includes('created<>4'));
 assert.ok(parish.includes('QA197 original boleta damaged'));
 assert.match(parish,/SET LOCAL ROLE authenticated/);
 assert.match(parish,/UPDATE public\.user_profiles SET parish_id=/);
});
test('V197 rejects foreign parish read and privileged RPC of all four sacraments',()=>{
 for(const text of ['foreign boleta visible','RPC bypass','parroquia propietaria','blocked_rpc<>4','checked_read<>4'])assert.ok(parish.includes(text));
 assert.ok(parish.trimEnd().endsWith('ROLLBACK;'));
});
test('V197 rejects or denies direct cross-parish insert update and delete, preserving owners',()=>{
 for(const s of ['blocked_update<>4','blocked_delete<>4','blocked_insert<>4','insufficient_privilege','has_table_privilege'])assert.ok(parish.includes(s));
 assert.match(parish,/affected<>0/);
 assert.match(parish,/GET DIAGNOSTICS affected=ROW_COUNT/);
 assert.doesNotMatch(parish,/COMMIT\s*;/);
});
