import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const m=fs.readFileSync('supabase/migrations/20261024201212_validate_decree_check_constraints_v189.sql','utf8');
const q=fs.readFileSync('scripts/qa-readonly-decree-check-validation-v189.sql','utf8');
test('V189 validates exactly the two preexisting decree constraints',()=>{
 const statements=m.match(/ALTER TABLE public\.decretos VALIDATE CONSTRAINT \w+;/g)||[];
 assert.equal(statements.length,2);
 assert.ok(statements.some(x=>x.includes('chk_decretos_sacrament_type')));
 assert.ok(statements.some(x=>x.includes('chk_decretos_status')));
});
test('V189 migration neither drops constraints nor modifies records or grants access',()=>{
 assert.doesNotMatch(m,/\b(?:INSERT|UPDATE|DELETE|DROP|TRUNCATE|GRANT|REVOKE|DISABLE|CREATE TABLE)\b/i);
 assert.match(m,/lock_timeout/);
 assert.match(m,/statement_timeout/);
});
test('V189 live regression QA remains READ ONLY with rollback',()=>{
 assert.match(q,/BEGIN READ ONLY;/i);
 assert.match(q,/ROLLBACK;\s*$/i);
 assert.match(q,/connamespace='public'::regnamespace AND NOT convalidated/);
});
test('V189 captures status / type violations and null types distinctly',()=>{
 for(const clause of ['v_bad_types','v_bad_status','v_null_type','v_decrees']) assert.ok(q.includes(clause));
});
test('V189 live invalid decree status QA is transaction scoped and preserves canonical row',()=>{
 const q2=fs.readFileSync('scripts/qa-rollback-decree-status-v189.sql','utf8');
 assert.match(q2,/BEGIN;/);
 assert.match(q2,/ROLLBACK;\s*$/);
 assert.match(q2,/EXCEPTION WHEN check_violation/);
 assert.match(q2,/chk_decretos_status/);
 assert.match(q2,/original_record_unchanged/);
 assert.match(q2,/invalid_sacrament_denied/);
});
