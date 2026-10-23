import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = p => fs.readFileSync(p,'utf8');
const migration=read('supabase/migrations/20261023023443_guard_marriage_funeral_independent_notes_v155.sql');
const baseline=read('scripts/qa-rollback-marriage-funeral-late-note-baseline-v155.sql');
const correction=read('scripts/qa-rollback-marriage-funeral-corrections-late-notes-v155.sql');
const replacement=read('scripts/qa-rollback-marriage-funeral-repositions-late-notes-v155.sql');
const deniedNote=read('scripts/qa-rollback-reversed-marriage-funeral-notes-v155.sql');

test('V155 patches exactly three privileged functions',()=>{
 for(const sig of [
  'public.create_manual_marginal_note(uuid,text,uuid,text,date,text,boolean,text,uuid,jsonb,jsonb)',
  'public.reverse_marriage_decree(uuid,text)',
  'public.reverse_funeral_decree(uuid,text)'
 ])assert.ok(migration.includes(sig),sig);
});
test('V155 requires V154 Baptism and Confirmation guards before replacement',()=>{
 assert.match(migration,/V155 requires V154 and V154b applied first/);
 assert.match(migration,/Bautismo inexistente o ya revertido/);
 assert.match(migration,/Confirmación inexistente o ya revertida/);
});
test('V155 ensures manual notes obtain row SHARE locks on marriages and funerals',()=>{
 assert.match(migration,/from public\.marriages where id=p_sacrament_id/);
 assert.match(migration,/from public\.funerals where id=p_sacrament_id/);
 assert.equal((migration.match(/for share; if not found/g)||[]).length,2);
});
test('V155 blocks new manual notes after supplemental reversal',()=>{
 assert.match(migration,/Matrimonio inexistente o ya revertido para nuevas notas/);
 assert.match(migration,/Exequias inexistentes o ya revertidas para nuevas notas/);
});
test('V155 uses both existing row lock and active dependent note checks',()=>{
 assert.match(migration,/v_decree\.replacement_record_id/);
 assert.match(migration,/mn\.parish_id=v_decree\.parish_id/);
 assert.match(migration,/mn\.decree_id is distinct from v_decree\.id/);
 assert.match(migration,/mn\.status,'active'\)\) in \('active','vigente'\)/);
});
test('V155 blocks reversal with a check violation and reconciliation message',()=>{
 assert.match(migration,/conciliación documental obligatoria/);
 assert.match(migration,/using errcode='23514'/);
});
test('V155 restores no decree grants or drops',()=>{
 assert.doesNotMatch(migration,/\bGRANT EXECUTE\b|\bREVOKE EXECUTE\b|\bDROP FUNCTION\b/i);
});
test('V155 retains exact function definitions and checks uniqueness of anchors',()=>{
 assert.match(migration,/pg_get_functiondef\(to_regprocedure\(v_signature\)\)/);
 assert.ok((migration.match(/<>1/g)||[]).length>=6);
 assert.match(migration,/EXECUTE v_ddl/);
});
test('V155 is anchored AFTER record UPDATE-lock preconditions in correction branch',()=>{
 assert.match(migration,/v_original_status :=/);
 assert.match(migration,/v_decree\.payload->>''originalStatus''/);
});
test('V155 is anchored AFTER record UPDATE-lock preconditions in replacement branch',()=>{
 assert.match(migration,/La partida supletoria de Exequias ya no está vigente/);
 assert.match(migration,/SE REVIERTE EL DECRETO DE REPOSICIÓN/);
});
test('V155 negative baseline reproduces two stale active notes',()=>{
 assert.match(baseline,/v_wrong<>2/);
 assert.match(baseline,/v_later_note/);
});
test('V155 verifies correction life cycle for both sacraments',()=>{
 assert.match(correction,/ARRAY\['matrimonio','exequias'\]/);
 assert.match(correction,/public\.apply_marriage_correction/);
 assert.match(correction,/public\.apply_funeral_correction/);
});
test('V155 verifies replacement life cycle for both sacraments',()=>{
 assert.match(replacement,/ARRAY\['matrimonio','exequias'\]/);
 assert.match(replacement,/public\.create_marriage_reposition_by_decree/);
 assert.match(replacement,/public\.create_funeral_reposition_by_decree/);
});
test('V155 negative correction test requires correct conflict reason',()=>{
 assert.match(correction,/EXCEPTION WHEN check_violation THEN/);
 assert.match(correction,/position\('conciliación' in v_msg\)=0/);
 assert.match(correction,/v_rejected<>2 OR v_reconciled<>2/);
});
test('V155 negative replacement test requires correct conflict reason',()=>{
 assert.match(replacement,/EXCEPTION WHEN check_violation THEN/);
 assert.match(replacement,/position\('conciliación' in v_message\)=0/);
 assert.match(replacement,/v_count<>2 OR v_denied<>2/);
});
test('V155 refused reversal leaves active decree, notes and supplemental status intact',()=>{
 assert.match(correction,/status FROM public\.decretos WHERE id=v_decree\) IS DISTINCT FROM 'active'/);
 assert.match(replacement,/status FROM public\.marginal_notes WHERE id=v_later\) IS DISTINCT FROM 'active'/);
});
test('V155 success after fictitious note reconciliation restores correct deed state',()=>{
 assert.match(correction,/UPDATE public\.marginal_notes SET status='reversed' WHERE id=v_later/);
 assert.match(correction,/v_old_st IS DISTINCT FROM 'seated' OR v_new_st IS DISTINCT FROM 'reversed'/);
 assert.match(replacement,/UPDATE public\.marginal_notes SET status='reversed' WHERE id=v_later/);
});
test('V155 forbids manual note on both reversed marriage and funeral',()=>{
 assert.match(deniedNote,/ARRAY\['matrimonio','exequias'\]/);
 assert.match(deniedNote,/v_denied<>2/);
});
test('V155 never represents fictitious manual note status change as public reconciliation',()=>{
 assert.match(correction,/QA emulates completed DOCUMENTARY reconciliation only/);
 assert.match(replacement,/Simulación de conciliación preexistente: SOLO EN TRANSACCIÓN QA/);
});
for(const [label,s] of [['reproduction',baseline],['corrections',correction],['repositions',replacement],['reversed-record notes',deniedNote]]){
 test('V155 '+label+' is always rolled back',()=>{
  assert.match(s,/^BEGIN;$/m);
  assert.match(s,/ROLLBACK;\s*$/);
  assert.doesNotMatch(s,/^\s*COMMIT\b/im);
 });
}
