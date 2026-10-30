import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(x)=>fs.readFileSync(x,'utf8').replace(/\r\n/g,'\n');
const scenarios=[
 ['notificación entre tres parroquias','scripts/qa-rollback-multiparroquial-notificacion-v319.sql'],
 ['Repetición entre tres parroquias','scripts/qa-rollback-multiparroquial-repeticion-v319.sql'],
 ['Repetición con cuarta parroquia externa','scripts/qa-rollback-multiparroquial-repeticion-externa-v319.sql'],
];
for(const [description,file] of scenarios){
 test('V319 fixture seguro y reversible: '+description,()=>{
  const sql=read(file);
  assert.match(sql,/^BEGIN;$/m);
  assert.match(sql,/^ROLLBACK;\s*$/m);
  assert.doesNotMatch(sql,/^\s*COMMIT\s*;/im);
  assert.doesNotMatch(sql,/\bdblink_exec\s*\(|\bpg_notify\s*\(/i);
  assert.match(sql,/INSERT INTO public\.parishes/);
  assert.match(sql,/INSERT INTO auth\.users/);
  assert.match(sql,/INSERT INTO public\.user_profiles/);
  assert.match(sql,/set_config\('request\.jwt\.claim\.sub'/);
  assert.match(sql,/is_operational/);
 });
}
test('V319 notificaciones se ejecutan en dos parroquias con acuses, sin notas duplicadas',()=>{
 const sql=read(scenarios[0][1]);
 for(const token of [
 'issue_sacramental_case_v277','process_matrimonial_notification_recipient',
 'marginal_notes','foreign_processing_denied','idempotent_replay',
 'early_closure_denied','duplicate_issuance_denied'
 ])assert.ok(sql.includes(token),token);
});
test('V319 decreto de Repetición real en Cancillería y dos custodios parroquiales',()=>{
 const sql=read(scenarios[1][1]);
 for(const token of [
 'issue_repetition_case_v314','register_repetition_entry_marginal_v315',
 'resolve_repetition_parish_v314','without_effect','retain','decree_notifications',
 'certificate_blocked','original_entries_preserved'
 ])assert.ok(sql.includes(token),token);
 assert.doesNotMatch(sql,/\b(?:UPDATE|DELETE FROM)\s+public\.baptisms\b/i);
});
test('V319 una cuarta parroquia externa requiere constancia de Cancillería',()=>{
 const sql=read(scenarios[2][1]);
 assert.match(sql,/register_external_repetition_constancy_v314/);
 assert.match(sql,/external-4/);
 assert.match(sql,/externalJurisdiction/);
 assert.match(sql,/No cerró tras constancia externa/);
 assert.match(sql,/No se admiten dos constancias externas iguales/);
});
test('V319 la puerta local y GitHub incluyen este contrato, no solo pruebas antiguas',()=>{
 const gate=read('scripts/audit-gate-v90.mjs');
 const workflow=read('.github/workflows/sacramentum-auditoria-v90.yml');
 assert.match(gate,/scripts\/test-v319-pruebas-prolongadas\.mjs/);
 assert.match(workflow,/scripts\/test-v319-pruebas-prolongadas\.mjs/);
});
