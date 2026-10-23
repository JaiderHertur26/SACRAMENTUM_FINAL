import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const qa=fs.readFileSync('scripts/qa-rollback-reconciliation-all-sacraments-v159.sql','utf8');
const svc=fs.readFileSync('src/services/laterNoteReconciliationService.js','utf8');
const view=fs.readFileSync('src/pages/chancery/LaterNoteReconciliationPage.jsx','utf8');
const schema=fs.readFileSync('supabase/migrations/20261023030534_later_note_institutional_reconciliation_v156.sql','utf8');

test('V159 tests four sacramental replacements',()=>{
 assert.match(qa,/ARRAY\['bautismo','confirmacion','matrimonio','exequias'\]/);
 for(const rpc of ['apply_baptism_replacement','apply_confirmation_replacement','create_marriage_reposition_by_decree','create_funeral_reposition_by_decree'])
  assert.ok(qa.includes(rpc),rpc);
});
test('V159 generates an independent manual note on each supplemental record',()=>{
 assert.match(qa,/public\.create_manual_marginal_note\(v_parish,v_s,v_rec/);
 assert.match(qa,/NOTA MANUAL INDEPENDIENTE FICTICIA V159/);
});
test('V159 tests each institutional role under authenticated SQL role',()=>{
 assert.match(qa,/SET LOCAL ROLE authenticated/);
 assert.match(qa,/v_chancery/);
 assert.match(qa,/v_dio_actor/);
});
test('V159 rejects unauthorized execution before independent approval',()=>{
 assert.match(qa,/executed without Diocese approval/);
 assert.match(qa,/EXCEPTION WHEN insufficient_privilege/);
});
test('V159 checks two-person approval for all four sacraments',()=>{
 assert.match(qa,/public\.request_later_note_reconciliation_v156/);
 assert.match(qa,/public\.approve_later_note_reconciliation_v156/);
 assert.match(qa,/public\.execute_later_note_reconciliation_v156/);
 assert.match(qa,/v_seen<>4/);
});
test('V159 checks final sacrament-specific active to reversed state',()=>{
 for(const t of ['baptisms','confirmations','marriages','funerals'])
  assert.ok(qa.includes('FROM public.'+t+' WHERE id=v_record'),t);
 assert.match(qa,/v_new IS DISTINCT FROM 'reversed'/);
});
test('V159 validates decree and manual note reversal',()=>{
 assert.match(qa,/FROM public\.decretos WHERE id=v_decree/);
 assert.match(qa,/FROM public\.marginal_notes WHERE id=v_note/);
});
test('V159 checks three audit events of the institutional case',()=>{
 assert.match(qa,/v_audits<>3/);
 assert.match(qa,/entity_type='marginal_note_reconciliation'/);
});
test('V159 checks one parish notification for each case',()=>{
 assert.match(qa,/category='decree_reconciliation'/);
 assert.match(qa,/v_notices<>1/);
});
test('V159 has rollback and no committed QA rows',()=>{
 assert.match(qa,/^BEGIN;$/m);
 assert.match(qa,/ROLLBACK;\s*$/);
 assert.doesNotMatch(qa,/^\s*COMMIT\b/im);
});
test('V159 service lists via the scoped institutional RPC',()=>{
 assert.match(svc,/list_later_note_reconciliations_v157/);
 assert.match(schema,/current_app_diocese_id\(\) IS DISTINCT FROM p_diocese_id/);
});
test('V159 UI supports both roles but does not directly alter sacramental records',()=>{
 assert.match(view,/const chancery = role === 'chancery'/);
 assert.match(view,/const dioceseRole = role === 'diocese'/);
 assert.doesNotMatch(view,/\.from\('decretos'\)[\s\S]*?\.update\(/);
});
// V159 · positive correction regression across all four sacramental registries.
const correction=fs.readFileSync('scripts/qa-rollback-corrections-reconciliation-all-sacraments-v159.sql','utf8');
test('V159 correction matrix covers four sacraments',()=>{
 assert.match(correction,/ARRAY\['bautismo','confirmacion','matrimonio','exequias'\]/);
 for(const name of ['apply_baptism_correction','apply_confirmation_correction','apply_marriage_correction','apply_funeral_correction'])
 assert.ok(correction.includes(name),name);
});
test('V159 correction matrix initializes real fictional originals',()=>{
 for(const table of ['baptisms','confirmations','marriages','funerals'])
 assert.ok(correction.includes('INSERT INTO public.'+table),table);
});
test('V159 correction matrix verifies independent authority',()=>{
 assert.match(correction,/SET LOCAL ROLE authenticated/);
 assert.match(correction,/executed without diocesan approval/);
 assert.match(correction,/public\.approve_later_note_reconciliation_v156/);
 assert.match(correction,/public\.execute_later_note_reconciliation_v156/);
});
test('V159 correction matrix requires original restored to seated and supplement reversed',()=>{
 assert.match(correction,/v_old_status IS DISTINCT FROM 'seated'/);
 assert.match(correction,/v_new_status IS DISTINCT FROM 'reversed'/);
});
test('V159 correction matrix requires all decrees and notes reversed',()=>{
 assert.match(correction,/FROM public\.decretos WHERE id=v_dec/);
 assert.match(correction,/FROM public\.marginal_notes WHERE id=v_note/);
 assert.match(correction,/FROM public\.later_note_reconciliations_v156 WHERE id=v_case/);
});
test('V159 correction matrix audits and parish notifies each case',()=>{
 assert.match(correction,/v_count<>3/);
 assert.match(correction,/category='decree_reconciliation'/);
 assert.match(correction,/v_checked<>4/);
});
test('V159 correction matrix makes no persistent QA changes',()=>{
 assert.match(correction,/^BEGIN;$/m);
 assert.match(correction,/ROLLBACK;\s*$/);
 assert.doesNotMatch(correction,/^\s*COMMIT\b/im);
});
