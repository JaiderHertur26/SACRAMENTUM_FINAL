import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const migration=read('supabase/migrations/20261023030534_later_note_institutional_reconciliation_v156.sql');
const app=read('src/App.jsx');
const page=read('src/pages/chancery/LaterNoteReconciliationPage.jsx');
const svc=read('src/services/laterNoteReconciliationService.js');
const chanceryArchive=read('src/pages/chancery/SacramentalDecreeArchivePage.jsx');
const diocesanArchive=read('src/pages/diocese/DiocesanDecreeOversightPage.jsx');
const grantQA=read('scripts/qa-rollback-note-reconciliation-grants-v156.sql');

test('V156 has separate roles request, authorize, execute',()=>{
 for(const name of ['request_later_note_reconciliation_v156','approve_later_note_reconciliation_v156','execute_later_note_reconciliation_v156'])
 assert.ok(migration.includes(name),name);
});
test('V156 requires Chancery to request',()=>assert.match(migration,/Sólo Cancillería puede solicitar conciliación/));
test('V156 requires a Diocese representative to approve',()=>assert.match(migration,/v_role IS DISTINCT FROM 'diocese'/));
test('V156 cannot approve the same actor who requested',()=>assert.match(migration,/v_case\.requested_by=auth\.uid\(\)/));
test('V156 execute requires Chancery',()=>assert.match(migration,/Sólo Cancillería puede ejecutar una conciliación autorizada/));
test('V156 case cannot execute without approval',()=>assert.match(migration,/v_case\.status IS DISTINCT FROM 'authorized'/));
test('V156 allows only correction or replacement decrees',()=>assert.match(migration,/v_d\.tipo NOT IN \('correccion','reposicion'\)/));
test('V156 allows four sacraments',()=>assert.match(migration,/v_d\.sacrament_type NOT IN \('bautismo','confirmacion','matrimonio','exequias'\)/));
test('V156 requires exactly original decree replacement',()=>assert.match(migration,/v_n\.sacrament_id IS DISTINCT FROM v_d\.replacement_record_id/));
test('V156 excludes notes from another decree',()=>assert.match(migration,/v_n\.decree_id IS NOT NULL/));
test('V156 excludes locked notes and mandatory notes',()=>{
 assert.match(migration,/v_n\.is_locked IS DISTINCT FROM false/);
 assert.match(migration,/v_n\.print_policy IS DISTINCT FROM 'optional'/);
});
test('V156 requires documented source and grounded narrative',()=>{
 assert.match(migration,/length\(btrim\(coalesce\(p_reason,''\)\)\)<25/);
 assert.match(migration,/length\(btrim\(coalesce\(p_source_reference,''\)\)\)<8/);
});
test('V156 protects the exact note snapshot against changed state',()=>assert.ok((migration.match(/to_jsonb\(v_n\) IS DISTINCT FROM v_case\.note_snapshot/g)||[]).length>=2));
test('V156 locks case, decree and note to serialize approvals',()=>{
 assert.match(migration,/WHERE id=p_case_id FOR UPDATE/);
 assert.match(migration,/WHERE id=v_case\.decree_id FOR UPDATE/);
 assert.match(migration,/WHERE id=v_case\.note_id FOR UPDATE/);
});
test('V156 note reconciliation AND reversal are a single database function',()=>{
 assert.match(migration,/UPDATE public\.marginal_notes SET status='reversed'/);
 assert.match(migration,/PERFORM public\.reverse_correction_decree_with_reason/);
 assert.match(migration,/PERFORM public\.reverse_replacement_decree_with_reason/);
 assert.match(migration,/public\.reverse_marriage_decree/);
 assert.match(migration,/public\.reverse_funeral_decree/);
});
test('V156 checks decree final status',()=>assert.match(migration,/No se confirmó reversión íntegra del decreto/));
test('V156 records initial, approved and final audit events',()=>{
 for(const action of ['reconciliation_requested','reconciliation_authorized','reconciliation_executed','manual_note_reconciled_before_decree_reversal'])
 assert.ok(migration.includes(action),action);
});
test('V156 creates a distinct official parish notification category',()=>{
 assert.match(migration,/decree_reconciliation/);
 assert.match(migration,/reconciliation_case_id/);
});
test('V156 prevents direct updates by authenticated clients',()=>{
 assert.match(migration,/ENABLE ROW LEVEL SECURITY/);
 assert.match(migration,/REVOKE ALL ON public\.later_note_reconciliations_v156 FROM PUBLIC, anon, authenticated/);
});
test('V156 grant is RPC-only for authenticated and not anon',()=>{
 assert.ok((migration.match(/REVOKE ALL ON FUNCTION/g)||[]).length>=4);
 assert.ok((migration.match(/GRANT EXECUTE ON FUNCTION/g)||[]).length>=4);
});
test('V156 case statuses constrain transition states',()=>{
 assert.match(migration,/CHECK \(status IN \('pending','authorized','executed','rejected'\)\)/);
 assert.match(migration,/uq_later_note_open_decree_v156/);
});
test('V156 limits list to own diocese and authorized roles',()=>{
 assert.match(migration,/public\.current_app_diocese_id\(\) IS DISTINCT FROM p_diocese_id/);
 assert.match(migration,/LIMIT 300/);
});
test('V156 frontend uses RPC wrappers and no direct marginal note status mutation',()=>{
 for(const name of ['request_later_note_reconciliation_v156','approve_later_note_reconciliation_v156','execute_later_note_reconciliation_v156'])
 assert.ok(svc.includes(name),name);
 assert.ok(svc.includes('list_later_note_reconciliations_v156') || svc.includes('list_later_note_reconciliations_v157'), 'expected scoped versioned list RPC');
 assert.doesNotMatch(page,/\.from\('marginal_notes'\)[\s\S]*?\.update\(/);
});
test('V156 has distinct protected routes for chancery and diocese',()=>{
 assert.match(app,/\/chancery\/decretos\/conciliaciones/);
 assert.match(app,/\/diocese\/decretos\/conciliaciones/);
 assert.match(app,/requiredRole=\{ROLE_TYPES\.CHANCERY\}><LaterNoteReconciliationPage/);
 assert.match(app,/requiredRole=\{ROLE_TYPES\.DIOCESE\}><LaterNoteReconciliationPage/);
});
test('V156 link is visible in both decree archives',()=>{
 assert.match(chanceryArchive,/\/chancery\/decretos\/conciliaciones/);
 assert.match(diocesanArchive,/\/diocese\/decretos\/conciliaciones/);
});
test('V156 visual workflow requires explicit human confirmation',()=>{
 assert.match(page,/institutionalConfirm/);
 assert.match(page,/Autorizar expediente/);
 assert.match(page,/Ejecutar conciliación autorizada/);
});
test('V156 selectable manual notes must be independently active and optional',()=>{
 assert.match(page,/\.eq\('note_type','manual'\)/);
 assert.match(page,/\.eq\('status','active'\)/);
 assert.match(page,/\.is\('decree_id',null\)/);
 assert.match(page,/\.eq\('print_policy','optional'\)/);
});
test('V156 security QA checks private grants and is strictly reversible',()=>{
 assert.match(grantQA,/has_table_privilege\('authenticated'/);
 assert.match(grantQA,/has_function_privilege\('anon'/);
 assert.match(grantQA,/^BEGIN;$/m);
 assert.match(grantQA,/ROLLBACK;\s*$/);
 assert.doesNotMatch(grantQA,/^\s*COMMIT\b/im);
});
test('V156 no automatic attestation of ecclesiastical authenticity',()=>{
 assert.match(page,/sentencias, decretos ajenos/);
 assert.match(page,/Diócesis autoriza de forma independiente/);
});
