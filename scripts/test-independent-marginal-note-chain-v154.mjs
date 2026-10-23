import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const primary=read('supabase/migrations/20261023012458_guard_independent_marginal_notes_before_decree_reversal_v154.sql');
const follow=read('supabase/migrations/20261023012719_fix_confirmation_manual_note_lock_v154b.sql');
const baseline=read('scripts/qa-rollback-late-manual-notes-baseline-v154.sql');
const chains=read('scripts/qa-rollback-independent-marginal-decree-guards-v154.sql');
const reversed=read('scripts/qa-rollback-reversed-record-manual-note-v154.sql');
const earlier=read('scripts/qa-rollback-later-active-decree-baptism-confirmation-v137.sql');

test('V154 guards both correction and reposition when newer active note exists',()=>{
 assert.match(primary,/v_correction_guard text/);
 assert.match(primary,/v_reposition_guard text/);
 assert.match(primary,/mn\.decree_id is distinct from v_decree\.id/);
 assert.match(primary,/mn\.status,'active'\)\) in \('active','vigente'\)/);
});
test('V154 scopes the extra note to its own supplemental record',()=>{
 assert.match(primary,/mn\.parish_id=v_decree\.parish_id/);
 assert.match(primary,/mn\.sacrament_id=v_decree\.replacement_record_id/);
 assert.match(primary,/mn\.sacrament_id=v_replacement/);
 assert.match(primary,/mn\.sacrament_type/);
});
test('V154 refuses reversal with reconciliation-specific check_violation',()=>{
 assert.match(primary,/notas marginales independientes posteriores: conciliación obligatoria/);
 assert.match(primary,/using errcode='23514'/);
});
test('V154 checks note dependencies only after locking record for update',()=>{
 assert.match(primary,/correction reversal has locked original and supplemental rows FOR UPDATE/);
 assert.match(primary,/Replacement reversal has locked supplemental row FOR UPDATE/);
 assert.match(primary,/v_correction_guard/);
 assert.match(primary,/v_reposition_guard/);
});
test('V154 blocks regular manual annotations after a record was reversed',()=>{
 assert.match(primary,/Bautismo inexistente o ya revertido para nuevas notas/);
 assert.match(follow,/Confirmación inexistente o ya revertida para nuevas notas/);
});
test('V154 uses FOR SHARE to serialize note creation against reversal updates',()=>{
 assert.match(primary,/for share; if not found/);
 assert.match(follow,/for share; if not found/);
});
test('V154 V154b hotfix is explicit and requires Baptism guard to be present',()=>{
 assert.match(follow,/prerequisite Baptism lock missing/);
 assert.match(follow,/v_ddl:=replace\(v_ddl,v_old,v_new\)/);
 assert.match(follow,/EXECUTE v_ddl/);
});
test('V154 never drops functions or changes database grants',()=>{
 for(const ddl of [primary,follow]){
 assert.doesNotMatch(ddl,/\bDROP FUNCTION\b|\bGRANT EXECUTE\b|\bREVOKE EXECUTE\b/i);
 assert.match(ddl,/pg_get_functiondef\(to_regprocedure\(v_signature\)\)/);
 }
});
test('V154 baseline reproducer used manual note on fresh supplemental record',()=>{
 assert.match(baseline,/create_manual_marginal_note\(/);
 assert.match(baseline,/REVERSIÓN FICTICIA/);
 assert.match(baseline,/ROLLBACK;/);
});
test('V154 QA covers the four correction and reposition routes',()=>{
 assert.match(chains,/ARRAY\['bautismo','confirmacion'\]/);
 assert.match(chains,/ARRAY\['correccion','reposicion'\]/);
 assert.match(chains,/v_count<>4 OR v_guarded<>4 OR v_reconciled<>4/);
});
test('V154 QA ensures four conflicting notes cause reversal rejection',()=>{
 assert.match(chains,/V154-FAIL reversal allowed despite independent active note/);
 assert.match(chains,/EXCEPTION WHEN check_violation THEN/);
 assert.match(chains,/v_guarded:=v_guarded\+1/);
});
test('V154 QA ensures rejected reversal leaves decree and new note active',()=>{
 assert.match(chains,/status FROM public.decretos WHERE id=v_decree\) IS DISTINCT FROM 'active'/);
 assert.match(chains,/status FROM public.marginal_notes WHERE id=v_manual_note\) IS DISTINCT FROM 'active'/);
 assert.match(chains,/V154-FAIL rejection invalidated supplemental record/);
});
test('V154 QA validates reversal only after fictitious note reconciliation',()=>{
 assert.match(chains,/UPDATE public\.marginal_notes SET status='reversed' WHERE id=v_manual_note/);
 assert.match(chains,/v_reconciled:=v_reconciled\+1/);
 assert.match(chains,/manual-reconciliation workflow/i);
});
test('V154 regression retains fresh reversal notes and duplicate reversal guard',()=>{
 assert.match(chains,/falta nota marginal de reversión/);
 assert.match(chains,/ya fue revertido/);
 assert.match(chains,/doble reversión insertó una nota marginal/);
});
test('V154 reversed-record QA probes both Baptism and Confirmation',()=>{
 assert.match(reversed,/ARRAY\['bautismo','confirmacion'\]/);
 assert.match(reversed,/v_rejected<>2/);
 assert.match(reversed,/create_manual_marginal_note/);
});
test('V154 regression of active later decrees is preserved',()=>{
 assert.match(earlier,/Otro decreto ficticio vigente vinculó la supletoria/);
 assert.match(earlier,/REVERSIÓN TARDÍA/);
});
for(const [label,sql] of [['baseline reproduction',baseline],['chains',chains],['reversed note',reversed],['later decree',earlier]]){
 test('V154 '+label+' uses transaction rollback, never commit',()=>{
  assert.match(sql,/^BEGIN;$/m);
  assert.match(sql,/ROLLBACK;\s*$/);
  assert.doesNotMatch(sql,/^\s*COMMIT\b/im);
 });
}
