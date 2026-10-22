import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(f,'utf8');
const m125=read('supabase/migrations/20261022140436_scope_matrimonial_note_reconciliation_v125.sql');
const m126=read('supabase/migrations/20261022140953_disable_legacy_anulacion_execution_v126.sql');
const service=read('src/services/legacyMigrationService.js');
const cases=[
 'scripts/qa-rollback-matrimonial-notes-global-scope-v125.sql',
 'scripts/qa-rollback-matrimonial-notes-parish-authority-v125.sql',
 'scripts/qa-rollback-block-legacy-anulacion-v126.sql'
].map(read);

test('V125 requiere identidad y parroquia explícita',()=>{
 assert.match(m125,/if auth\.uid\(\) is null then/);
 assert.match(m125,/if p_parish_id is null then/);
 assert.match(m125,/if not public\.can_manage_legacy_import/);
 assert.match(m125,/errcode='42501'/);
});
test('V125 nunca recorre todas las parroquias si id es null',()=>{
 assert.match(m125,/p_parish_id is null then[\s\S]*?raise exception/);
 assert.match(m125,/p_parish_id is null or parish_id=p_parish_id/);
 assert.match(m125,/if not public\.can_manage_legacy_import\(/);
});
test('V125 las notas propias quedan en la parroquia y se preservan las ajenas',()=>{
 assert.match(cases[1],/v_owned_after IS NOT DISTINCT FROM v_owned_before/);
 assert.match(cases[1],/v_foreign_after IS DISTINCT FROM v_foreign_before/);
 assert.match(cases[1],/v_denied<>3/);
});
test('V126 cierra cuatro entradas de importación ejecutora',()=>{
 for(const name of [
 'apply_legacy_import_batch','apply_legacy_import_batch_v2',
 'apply_legacy_import_batch_v3','reconcile_legacy_anulacion_batch']){
  assert.match(m126,new RegExp('CREATE OR REPLACE FUNCTION public\\.'+name+'\\('));
 }
 assert.equal((m126.match(/no ejecutar efectos registrales mediante importación legacy/g)||[]).length,4);
});
test('V126 define únicamente cuerpos de funciones, sin DML fuera de ellas',()=>{
 assert.equal((m126.match(/CREATE OR REPLACE FUNCTION public\./g)||[]).length,4);
 assert.equal((m126.match(/\$function\$\s*;/g)||[]).length,4);
 assert.doesNotMatch(m126,/^\s*(?:TRUNCATE|DROP TABLE|ALTER TABLE)\b/im);
});
test('V126 conserva el rechazo de ANULACION por cada punto de entrada',()=>{
 assert.match(m126,/if v_profile='ANULACION' then[\s\S]*?raise exception/);
 assert.match(m126,/if upper\(coalesce\(v_batch\.profile_key,''\)\)='ANULACION'/);
 assert.match(m126,/errcode='42501'/);
});
test('El Centro de Migración rechaza ANULACION antes de toda llamada al RPC',()=>{
 const source=service.slice(service.indexOf('export async function applyLegacyBatch'));
 const guardPos=source.indexOf("effectiveProfile === 'ANULACION'");
 const rpcPos=source.indexOf("const { data, error } = isPendingSacramentalProfile");
 assert.ok(guardPos>=0&&rpcPos>=0&&guardPos<rpcPos);
 assert.match(source,/Cancillería, en el Centro de Decretos y con origen verificado/);
});
for(let i=0;i<cases.length;i++){
 test('Laboratorio V125-V126 '+(i+1)+' conserva ROLLBACK',()=>{
  assert.match(cases[i],/\bBEGIN;/);
  assert.match(cases[i],/ROLLBACK;\s*$/);
  assert.doesNotMatch(cases[i],/^\s*COMMIT\b/im);
 });
}
test('La prueba V126 intenta las cuatro RPC con lote preparado',()=>{
 for(const call of ['apply_legacy_import_batch(','apply_legacy_import_batch_v2(','apply_legacy_import_batch_v3(','reconcile_legacy_anulacion_batch(']){
  assert.ok(cases[2].includes(call));
 }
 assert.match(cases[2],/v_denied<>4/);
 assert.match(cases[2],/v_status_after IS DISTINCT FROM v_status/);
});
test('Las pruebas V125 abarcan rol real y bloqueo de global',()=>{
 assert.match(cases[0],/SET LOCAL ROLE authenticated/);
 assert.match(cases[0],/reconcile_legacy_matrimonial_notes\(NULL\)/);
 assert.match(cases[1],/reconcile_legacy_matrimonial_notes\(v_own\)/);
});
