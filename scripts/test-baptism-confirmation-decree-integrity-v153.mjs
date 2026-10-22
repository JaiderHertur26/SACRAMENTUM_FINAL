import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const integrity=read('scripts/qa-rollback-baptism-confirmation-integrity-v153.sql');
const matrix=read('scripts/qa-rollback-decree-role-matrix-v115.sql');
const baseline=read('scripts/qa-rollback-baptism-confirmation-v115.sql');

test('V153 includes both correction and replacement for baptism and confirmation',()=>{
 assert.match(integrity,/ARRAY\['bautismo','confirmacion'\]/);
 assert.match(integrity,/ARRAY\['correccion','reposicion'\]/);
 for(const fn of ['apply_baptism_correction','apply_confirmation_correction','apply_baptism_replacement','apply_confirmation_replacement'])
  assert.ok(integrity.includes('public.'+fn),fn);
});
test('V153 retains original baseline assertions about new, annulled and reversed entries',()=>{
 assert.match(integrity,/v_new_status<>'seated'/);
 assert.match(integrity,/v_old_status<>'anulada'/);
 assert.match(integrity,/v_old_status<>'seated'/);
 assert.match(integrity,/v_new_status<>'reversed'/);
});
test('V153 uses active Chancery and operational parish',()=>{
 assert.match(integrity,/role='chancery' AND is_active/);
 assert.match(integrity,/diocese_id=v_dio AND is_operational/);
});
test('V153 supplies fake supplement coordinates within a rollback transaction',()=>{
 assert.match(integrity,/'\{suplementarioLibro\}','9900'::jsonb/);
 assert.match(integrity,/'\{suplementarioFolio\}','1'::jsonb/);
 assert.match(integrity,/'\{suplementarioNumero\}','1'::jsonb/);
});
test('V153 verifies decree is linked to same parish and diocese',()=>{
 assert.match(integrity,/v_decree_row->>'parish_id'/);
 assert.match(integrity,/v_decree_row->>'diocese_id'/);
});
test('V153 verifies decree is issued by corresponding chancery',()=>{
 assert.match(integrity,/v_decree_row->>'chancery_id'/);
 assert.match(integrity,/v_chancery_id/);
});
test('V153 verifies original and new record are correctly linked',()=>{
 assert.match(integrity,/v_decree_row->>'original_record_id'/);
 assert.match(integrity,/v_decree_row->>'replacement_record_id'/);
 assert.match(integrity,/v_original::text/);
});
test('V153 verifies active decree with matching sacrament and unique number',()=>{
 assert.match(integrity,/lower\(v_decree_row->>'status'\) IS DISTINCT FROM 'active'/);
 assert.match(integrity,/lower\(v_decree_row->>'sacrament_type'\) IS DISTINCT FROM v_s/);
 assert.match(integrity,/v_duplicate_numbers<>1/);
});
test('V153 verifies physical book, folio, entry coordinates in replacement rows',()=>{
 for(const key of ['book_number','folio','number']) assert.ok(integrity.includes("v_new_row->>'"+key+"'"));
});
test('V153 verifies advance of supplement cursor after every deed',()=>{
 assert.match(integrity,/v_next_params->>'suplementarioLibro'/);
 assert.match(integrity,/v_next_params->>'suplementarioFolio'/);
 assert.match(integrity,/v_next_params->>'suplementarioNumero'/);
});
test('V153 requires marginal notes to belong to matching parish, sacrament and linked entry',()=>{
 assert.match(integrity,/mn.parish_id IS DISTINCT FROM v_parish/);
 assert.match(integrity,/mn.sacrament_type IS DISTINCT FROM v_s/);
 assert.match(integrity,/mn.sacrament_id IS DISTINCT FROM v_new/);
 assert.match(integrity,/mn.sacrament_id IS DISTINCT FROM v_original/);
});
test('V153 note check avoids SQL NOT IN NULL bypass for pure replacement',()=>{
 assert.match(integrity,/v_original IS NULL OR mn.sacrament_id IS DISTINCT FROM v_original/);
 assert.doesNotMatch(integrity,/mn.sacrament_id NOT IN/);
});
test('V153 requires audit event associated with exact deed and parish',()=>{
 assert.match(integrity,/ra.entity_type='decree' AND ra.entity_id=v_decree AND ra.parish_id=v_parish/);
 assert.match(integrity,/v_audit_count<1/);
});
test('V153 requires marginal notes and official notifications for all cases',()=>{
 assert.match(integrity,/v_note_count<1 OR v_notice_count<1/);
 assert.match(integrity,/FROM public.official_notifications WHERE decree_id=v_decree/);
});
test('V153 keeps unauthorized parish reversals rejected',()=>{
 assert.match(integrity,/v_parish_actor::text/);
 assert.match(integrity,/Parroquia revirtió decreto/);
});
test('V153 preserves chancery reversals, reversal notes, and idempotence protections',()=>{
 assert.match(integrity,/v_chancery::text/);
 assert.match(integrity,/falta nota marginal de reversión/);
 assert.match(integrity,/ya fue revertido/);
 assert.match(integrity,/doble reversión insertó una nota marginal/);
});
test('V153 completes exactly four lifecycle paths',()=>{
 assert.match(integrity,/v_count<>4/);
});
test('V153 separately denies 24 unauthorized issuance calls across 8 RPC',()=>{
 assert.match(matrix,/ARRAY\['parish','diocese','admin_general'\]/);
 assert.match(matrix,/v_denied<>24/);
 for(const kind of ['baptism_correction','baptism_reposition','confirmation_correction','confirmation_reposition','marriage_correction','marriage_reposition','funeral_correction','funeral_reposition']) assert.ok(matrix.includes("'"+kind+"'"),kind);
});
test('V153 extends V115 instead of dropping baseline reverse checks',()=>{
 for(const text of ["'correccion','reposicion'","'bautismo','confirmacion'","'INTENTO DUPLICADO QA'"]) {
  assert.ok(baseline.includes(text));
  assert.ok(integrity.includes(text));
 }
});
for(const [label,sql] of [['enhanced integrity',integrity],['role denial matrix',matrix]]){
 test('V153 '+label+' always uses ROLLBACK and no COMMIT',()=>{
  assert.match(sql,/^BEGIN;$/m);
  assert.match(sql,/ROLLBACK;\s*$/);
  assert.doesNotMatch(sql,/^\s*COMMIT\b/im);
 });
}
