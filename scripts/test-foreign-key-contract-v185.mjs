// V185: guarantees that the reproducible live foreign-key auditor remains read-only.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=fs.readFileSync(new URL('./qa-readonly-foreign-keys-v185.sql',import.meta.url),'utf8');

test('V185 real relational integrity QA is strictly read only',()=>{
  assert.match(sql,/BEGIN READ ONLY;/i);
  assert.match(sql,/ROLLBACK;\s*$/i);
  const noComments=sql.replace(/--[^\n]*/g,'');
  assert.doesNotMatch(noComments,/\b(?:INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE)\b/i);
});
test('V185 checks each declared public foreign key with orphan anti-join',()=>{
  assert.match(sql,/pg_constraint/i);
  assert.match(sql,/connamespace\s*=\s*'public'::regnamespace/i);
  assert.match(sql,/FOR fk IN/i);
  assert.match(sql,/NOT EXISTS\s*\(SELECT 1 FROM %s p/i);
  assert.match(sql,/orphan_found/i);
});
test('V185 refuses invalid constraints and disabled enforcement',()=>{
  assert.match(sql,/NOT fk.convalidated/i);
  assert.match(sql,/pg_trigger/i);
  assert.match(sql,/tgenabled NOT IN/i);
  assert.match(sql,/checked<160/i);
});
