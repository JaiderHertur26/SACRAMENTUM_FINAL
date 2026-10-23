import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const migration=read('supabase/migrations/20261023032715_later_note_rejection_and_revocation_v157.sql');
const qa=read('scripts/qa-rollback-later-note-rejection-v157.sql');
const ui=read('src/pages/chancery/LaterNoteReconciliationPage.jsx');
const service=read('src/services/laterNoteReconciliationService.js');
const previous=read('supabase/migrations/20261023030534_later_note_institutional_reconciliation_v156.sql');

test('V157 closes the existing rejected status rather than modifying it',()=>{
 assert.match(previous,/CHECK \(status IN \('pending','authorized','executed','rejected'\)\)/);
 assert.match(migration,/SET status='rejected'/);
});
test('V157 rejection never updates sacrament or note tables',()=>{
 assert.doesNotMatch(migration,/UPDATE\s+public\.(marginal_notes|decretos|baptisms|confirmations|marriages|funerals)\b/i);
});
test('V157 does not add table grants, drops or bypasses',()=>{
 assert.doesNotMatch(migration,/\bDROP TABLE\b|\bDROP FUNCTION\b|\bALTER TABLE[^;]+DISABLE ROW LEVEL SECURITY|\bGRANT\s+SELECT\s+ON\s+public\./i);
});
test('V157 only active Diocese can reject',()=>{
 assert.match(migration,/v_role IS DISTINCT FROM 'diocese'/);
 assert.match(migration,/coalesce\(u\.is_active,true\)/);
 assert.match(migration,/lower\(coalesce\(u\.status,'active'\)\)='active'/);
});
test('V157 requires documentary reference and detailed reason',()=>{
 assert.match(migration,/p_rejection_reference,''\)\)\)<8/);
 assert.match(migration,/p_rejection_reason,''\)\)\)<20/);
});
test('V157 rejects other diocese and self approval conflicts',()=>{
 assert.match(migration,/v_case\.diocese_id IS DISTINCT FROM v_diocese/);
 assert.match(migration,/v_case\.requested_by=auth\.uid\(\)/);
});
test('V157 rejects only pending and authorized cases, never executed',()=>{
 assert.match(migration,/v_case\.status NOT IN \('pending','authorized'\)/);
});
test('V157 row lock serializes final execution and rejection',()=>{
 assert.match(migration,/WHERE id=p_case_id FOR UPDATE/);
 assert.match(previous,/WHERE id=p_case_id FOR UPDATE/);
});
test('V157 snapshots which authorization was revoked',()=>{
 assert.match(migration,/v_case\.status='authorized'/);
 assert.match(migration,/reconciliation_authorization_revoked/);
 assert.match(migration,/reconciliation_rejected/);
});
test('V157 captures rejection identity reference and reason',()=>{
 for(const f of ['rejected_by','rejection_reference','rejection_reason','rejected_at'])
  assert.ok(migration.includes(f),f);
});
test('V157 list RPC stays scoped to authenticated diocese/chancery',()=>{
 assert.match(migration,/public\.current_app_role\(\) NOT IN \('chancery','diocese'\)/);
 assert.match(migration,/public\.current_app_diocese_id\(\) IS DISTINCT FROM p_diocese_id/);
 assert.match(migration,/LIMIT 300/);
});
test('V157 list returns rejection metadata in a distinct versioned RPC',()=>{
 assert.match(migration,/list_later_note_reconciliations_v157/);
 assert.match(migration,/r\.rejection_reference,r\.rejection_reason,r\.rejected_at/);
});
test('V157 auth grants RPC only, no anonymous execution',()=>{
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.reject_later_note_reconciliation_v157.*FROM PUBLIC,anon/);
 assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.reject_later_note_reconciliation_v157.*TO authenticated/);
});
test('V157 real SQL QA runs as authenticated role',()=>{
 assert.match(qa,/SET LOCAL ROLE authenticated/);
 assert.match(qa,/RESET ROLE/);
});
test('V157 QA allows new request after rejection',()=>{
 assert.match(qa,/NUEVA FUENTE QA V157 TERCERA/);
 assert.match(qa,/v_case3/);
});
test('V157 QA tests refusal to execute revoked approval',()=>{
 assert.match(qa,/executed revoked authorization/);
 assert.match(qa,/EXCEPTION WHEN insufficient_privilege/);
});
test('V157 QA tests redundant rejection and unprofiled actors',()=>{
 assert.match(qa,/double rejection/);
 assert.match(qa,/unprofiled actor listed/);
});
test('V157 QA checks two audit events without changing note or decree',()=>{
 assert.match(qa,/reconciliation_authorization_revoked/);
 assert.match(qa,/reconciliation_rejected/);
 assert.match(qa,/reject mutated decree or marginal note/);
});
test('V157 QA is rollback-only',()=>{
 assert.match(qa,/^BEGIN;$/m);
 assert.match(qa,/ROLLBACK;\s*$/);
 assert.doesNotMatch(qa,/^\s*COMMIT\b/im);
});
test('V157 frontend service uses versioned read and rejection RPC',()=>{
 assert.match(service,/list_later_note_reconciliations_v157|list_later_note_reconciliations_v161/);
 assert.match(service,/reject_later_note_reconciliation_v157/);
 assert.doesNotMatch(service,/\.from\('later_note_reconciliations_v156'\)/);
});
test('V157 UI gives separate reject and approval controls to diocese',()=>{
 assert.match(ui,/const doReject=async/);
 assert.match(ui,/dioceseRole && \(x\.status==='pending' \|\| x\.status==='authorized'\)/);
 assert.match(ui,/Autorizar expediente/);
});
test('V157 UI shows rejection grounds and stats without altering the note',()=>{
 assert.match(ui,/x\.rejection_reason/);
 // V170 security refinement: old raw totals must not be shown across identities.
 assert.match(ui,/visibleTotals\.rejected/);
 assert.match(ui,/rejectLaterNoteReconciliation/);
 assert.doesNotMatch(ui,/\.from\('marginal_notes'\)[\s\S]*?\.update\(/);
});
test('V157 decision requires explicit independent confirmation',()=>{
 assert.match(ui,/institutionalConfirm/);
 assert.match(ui,/Revocar autorización antes de ejecutar/);
 assert.match(ui,/Registrar rechazo/);
});
test('V157 decree change invalidates stale note selections',()=>{
 assert.match(ui,/decreeId:e\.target\.value,noteId:''/);
 assert.match(ui,/setAvailableNotes\(\[\]\)/);
});
