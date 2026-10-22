import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const migration115=read('supabase/migrations/20261022033641_disambiguate_supplementary_notifications_v115.sql');
const migration116=read('supabase/migrations/20261022033737_qualify_confirmation_supplementary_coordinate_v116.sql');
const migration117=read('supabase/migrations/20261022034716_reversal_marginal_notes_baptism_confirmation_v117.sql');
const qaPaths=[
 'scripts/qa-rollback-repositions-v115.sql',
 'scripts/qa-rollback-corrections-v115.sql',
 'scripts/qa-rollback-baptism-confirmation-v115.sql',
 'scripts/qa-rollback-decree-role-matrix-v115.sql'
];
for(const file of qaPaths){
 test(file+' mantiene una transacción totalmente reversible',()=>{
  const source=read(file);
  assert.match(source,/\bBEGIN\s*;/i);
  assert.match(source,/\bDO\s+\$qa\$/i);
  assert.match(source,/\bROLLBACK\s*;\s*$/i);
  assert.doesNotMatch(source,/^\s*COMMIT\s*;/im);
 });
}
test('V115 corrige exactamente dos funciones de reposición',()=>{
 assert.match(migration115,/apply_baptism_replacement_internal/);
 assert.match(migration115,/apply_confirmation_replacement_internal/);
 assert.match(migration115,/v_hits<>1/);
 assert.match(migration115,/EXECUTE v_source/);
 assert.match(migration115,/on conflict do nothing/);
});
test('V115 verifica número exacto de funciones modificadas',()=>{
 assert.match(migration115,/v_done<>2/);
});
test('V116 corrige la coordenada ambigua de Confirmación',()=>{
 assert.match(migration116,/apply_confirmation_replacement_internal/);
 assert.match(migration116,/c\.parish_id/);
 assert.match(migration116,/c\.book_number/);
 assert.match(migration116,/c\.folio/);
 assert.match(migration116,/c\.number/);
 assert.match(migration116,/v_hits<>1/);
});
test('Prueba de correcciones cubre las dos partidas de Matrimonio y Exequias',()=>{
 const src=read(qaPaths[1]);
 for(const name of ['apply_marriage_correction','apply_funeral_correction','reverse_marriage_decree','reverse_funeral_decree'])assert.ok(src.includes(name));
 for(const status of ["'anulada'","'seated'","'reversed'"])assert.ok(src.includes(status));
 assert.match(src,/marginal_notes/);
 assert.match(src,/official_notifications/);
});
test('Prueba de reposiciones verifica documentos, constancias y reversión',()=>{
 const src=read(qaPaths[0]);
 for(const name of ['create_marriage_reposition_by_decree','create_funeral_reposition_by_decree','reverse_marriage_decree','reverse_funeral_decree'])assert.ok(src.includes(name));
 assert.match(src,/original_record_id IS NOT NULL/);
 assert.match(src,/official_notifications/);
});
test('Bautismo y Confirmación cubren corrección, reposición y dos actores',()=>{
 const src=read(qaPaths[2]);
 for(const name of ['apply_baptism_correction','apply_confirmation_correction','apply_baptism_replacement','apply_confirmation_replacement','reverse_correction_decree_with_reason','reverse_replacement_decree_with_reason'])assert.ok(src.includes(name));
 assert.match(src,/v_parish_actor/);
 assert.match(src,/suplementarioLibro/);
 assert.match(src,/marginal_notes/);
});
test('Las ocho RPC son atacadas desde los tres roles no emisores',()=>{
 const src=read(qaPaths[3]);
 for(const role of ['parish','diocese','admin_general']) assert.ok(src.includes(role));
 for(const action of ['baptism_correction','baptism_reposition','confirmation_correction','confirmation_reposition','marriage_correction','marriage_reposition','funeral_correction','funeral_reposition']) assert.ok(src.includes(action));
 assert.match(src,/v_denied<>24/);
});
test('V117 registra nueva nota sobre original y supletoria y bloquea dobles reversiones',()=>{
 assert.match(migration117,/reversion_correccion_original/);
 assert.match(migration117,/reversion_correccion_supletoria/);
 assert.match(migration117,/reversion_reposicion/);
 assert.match(migration117,/auth\.uid\(\),'active','required'/);
 assert.match(migration117,/El decreto ya fue revertido/);
 assert.match(migration117,/reverse_correction_decree_with_reason_internal/);
 assert.match(migration117,/reverse_replacement_decree_with_reason_internal/);
});
test('El SQL del laboratorio comprueba rechazo de una segunda reversión',()=>{
 const src=read(qaPaths[2]);
 assert.match(src,/INTENTO DUPLICADO QA/);
 assert.match(src,/ya fue revertido/);
 assert.match(src,/doble reversión insertó una nota marginal/);
});
test('No se confunde SQL rollback con verificación visual',()=>{
 const src=qaPaths.map(read).join('\n');
 assert.doesNotMatch(src,/playwright|screenshot|captura de pantalla/i);
});
