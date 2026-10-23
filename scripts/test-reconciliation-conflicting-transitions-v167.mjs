import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const qa=fs.readFileSync('scripts/qa-rollback-reconciliation-conflicting-transitions-v167.sql','utf8');
const locks=fs.readFileSync('scripts/qa-readonly-reconciliation-lock-contract-v167.sql','utf8');
const old=fs.readFileSync('scripts/qa-rollback-reconciliation-all-sacraments-v159.sql','utf8');
const inv=JSON.parse(fs.readFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V166.json','utf8'));

test('V167 retains all four sacramental paths under the institutional matrix',()=>{
 for(const label of ["'bautismo'","'confirmacion'","'matrimonio'","'exequias'"])
  assert.ok(qa.includes(label),label);
});
test('V167 builds fictional sacramental records from reversible source fixture',()=>{
 for(const expr of ['apply_baptism_replacement','apply_confirmation_replacement',
 'create_marriage_reposition_by_decree','create_funeral_reposition_by_decree',
 'create_manual_marginal_note'])
 assert.ok(qa.includes(expr),expr);
});
test('V167 enters Postgres authenticated role for access and transitions',()=>{
 assert.match(qa,/SET LOCAL ROLE authenticated/);
 assert.match(qa,/request\.jwt\.claim\.sub/);
 assert.match(qa,/role='chancery'/);
 assert.match(qa,/role='diocese'/);
});
test('V167 duplicate open case rejected by database uniqueness, not UI checks',()=>{
 assert.match(qa,/V167 duplicate OPEN reconciliation accepted/);
 assert.match(qa,/EXCEPTION WHEN unique_violation THEN NULL/);
});
test('V167 execution without independent approval rejected',()=>{
 assert.match(qa,/V167 execution WITHOUT independent authorization/);
 assert.match(qa,/EXCEPTION WHEN insufficient_privilege THEN NULL/);
});
test('V167 duplicate execution rejected for terminal status',()=>{
 assert.match(qa,/V167 double execution accepted/);
});
test('V167 cannot reopen after reversing decree',()=>{
 assert.match(qa,/V167 reopened executed decree/);
 assert.match(qa,/EXCEPTION WHEN check_violation THEN NULL/);
});
test('V167 executed case cannot be authorized twice',()=>{
 assert.match(qa,/V167 reauthorized executed case/);
 assert.match(qa,/approve_later_note_reconciliation_v156/);
});
test('V167 executed case cannot be rejected after finishing',()=>{
 assert.match(qa,/V167 rejected executed case/);
 assert.match(qa,/reject_later_note_reconciliation_v157/);
});
test('V167 checks all four terminal decree and marginal note states',()=>{
 assert.match(qa,/v_new IS DISTINCT FROM 'reversed'/);
 assert.match(qa,/status FROM public\.decretos/);
 assert.match(qa,/status FROM public\.marginal_notes/);
 assert.match(qa,/status FROM public\.later_note_reconciliations_v156/);
 assert.match(qa,/IF v_checked<>4/);
});
test('V167 every fictitious case has exactly three audit events',()=>{
 assert.match(qa,/IF v_audits<>3 THEN/);
});
test('V167 each case gets exactly one official notification despite retries',()=>{
 assert.match(qa,/category='decree_reconciliation'/);
 assert.match(qa,/IF v_notices<>1 THEN/);
});
test('V167 fixture always rolls back and never commits',()=>{
 assert.match(qa,/^BEGIN;$/m);
 assert.match(qa,/ROLLBACK;\s*$/);
 assert.doesNotMatch(qa,/^\s*COMMIT\b/im);
});
test('V167 original v159 happy-path regression stays unchanged',()=>{
 assert.match(old,/IF v_seen<>4/);
 assert.match(old,/IF v_audits<>3/);
});
test('V167 lock contract uses explicit PostgreSQL read-only transaction',()=>{
 assert.match(locks,/^BEGIN READ ONLY;$/m);
 assert.match(locks,/ROLLBACK;\s*$/);
 assert.doesNotMatch(locks,/^\s*(INSERT|UPDATE|DELETE|COMMIT|CREATE EXTENSION)\b/im);
});
test('V167 static guards inspect all 4 real privileged RPC definitions',()=>{
 for(const fn of ['request_later_note_reconciliation_v156',
 'approve_later_note_reconciliation_v156','reject_later_note_reconciliation_v157',
 'execute_later_note_reconciliation_v156'])
 assert.ok(locks.includes(fn),fn);
 assert.match(locks,/pg_get_functiondef\(p\.oid\)/);
 assert.match(locks,/FOR UPDATE/);
});
test('V167 uniqueness index is partial and includes terminal executed protection',()=>{
 assert.match(locks,/uq_later_note_open_decree_v156/);
 assert.match(locks,/indexdef LIKE '%pending%'/);
 assert.match(locks,/indexdef LIKE '%authorized%'/);
});
test('V167 QA must not be represented as a true 2-session concurrency test',()=>{
 assert.match(qa,/not two physical connections/);
 assert.match(locks,/NOT proof of two parallel sessions/);
});
test('V167 privileged RPC catalog had already partially tested all 4 operations',()=>{
 for(const fn of ['request_later_note_reconciliation_v156',
 'approve_later_note_reconciliation_v156','reject_later_note_reconciliation_v157',
 'execute_later_note_reconciliation_v156']){
  const f=inv.functions.find(x=>x.schema==='public'&&x.function_name===fn);
  assert.ok(f);
  assert.ok(f.review_status.startsWith('PARTIAL_TESTED'));
 }
});
