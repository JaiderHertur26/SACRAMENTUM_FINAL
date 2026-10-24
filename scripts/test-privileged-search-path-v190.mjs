import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const qa=read('scripts/qa-readonly-privileged-search-path-v190.sql');
const smoke=read('scripts/qa-rollback-privileged-search-path-v190.sql');
test('V190 inventory reads all privileged functions without changing data',()=>{
 assert.match(qa,/BEGIN READ ONLY;/);
 assert.ok(qa.trimEnd().endsWith('ROLLBACK;'));
 assert.match(qa,/pg_proc/);
 assert.match(qa,/p.prosecdef/);
});
test('V190 functions are guarded against anonymous invocation and unsafe paths',()=>{
 assert.match(qa,/has_function_privilege\('anon'/);
 assert.match(qa,/has_schema_privilege\('authenticated'/);
 assert.match(qa,/explicit_temp_path<>0/);
 assert.match(qa,/no_fixed_path<>0/);
});
test('V190 tests three sensitive functions with empty path and rolls it back',()=>{
 assert.match(smoke,/BEGIN;/);
 assert.ok(smoke.trimEnd().endsWith('ROLLBACK;'));
 assert.match(smoke,/get_decree_trace_v89\(decree\)/);
 assert.match(smoke,/issue_documentary_decree_v88\(/);
 assert.match(smoke,/register_historical_narrative\(/);
});
test('V190 inventories delegated authorization separately rather than assuming it is safe',()=>{
 assert.match(qa,/delegated_guards/);
 assert.match(qa,/functions_using_delegated_authorization_unverified/);
 assert.match(qa,/affected<>3/);
});
