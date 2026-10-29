import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(p, 'utf8');

const migration = read('supabase/migrations/20261022040505_scope_and_archive_historical_decrees_v118.sql');
const positive = read('scripts/qa-rollback-historical-decrees-v118.sql');
const adversarial = read('scripts/qa-rollback-historical-adversarial-v118.sql');
const service = read('src/services/legacyDecreeReconciliationService.js');
const component = read('src/components/chancery/HistoricalDecreeReconciliationPanel.jsx');
const center = read('src/pages/chancery/ChanceryDecreeInstitutionalManagementPage.jsx');

test('V118 sólo permite a Cancillería y exige origen explícito y verificado', () => {
  assert.match(migration, /v_role <> 'chancery'/);
  assert.match(migration, /p_origin_id is null/);
  assert.match(migration, /identity_status='verified'/);
  assert.match(migration, /v_diocese is distinct from v_user_diocese/);
  assert.match(migration, /lar.source_origin_id=p_origin_id/);
});
test('V118 no permite conciliar un archivo de otra parroquia y no cruza conceptos', () => {
  assert.match(migration, /source_parish_or_diocese_mismatch/);
  assert.match(migration, /c.source_origin_id=v_row.source_origin_id/);
  assert.match(migration, /original_match_not_unique/);
  assert.match(migration, /replacement_match_not_unique/);
  assert.match(migration, /original_equals_replacement/);
});
test('V118 protege unicidad de decreto histórico y bloquea fuente sin número', () => {
  assert.match(migration, /missing_historical_decree_reference/);
  assert.match(migration, /decree_number_collision/);
  assert.match(migration, /legacyArchiveRecordId'=v_row.id::text/);
  assert.match(migration, /for update skip locked/i);
});
test('El documento es archivo histórico y no nueva emisión', () => {
  assert.match(migration, /'recordOrigin','historical_archive'/);
  assert.match(migration, /'registersEffect',false/);
  assert.match(migration, /'affectsSacramentalRecord',false/);
  assert.match(migration, /'archived',null,v_payload/);
  assert.match(migration, /'legacyRaw',v_row.original_data/);
  assert.match(migration, /'legacySourceSha256',v_row.source_sha256/);
});
test('Hay constancia de Cancillería y aviso a la misma parroquia', () => {
  assert.match(migration, /insert into public.decretos/);
  assert.match(migration, /insert into public.official_notifications/);
  assert.match(migration, /receiver_parish_id/);
  assert.match(migration, /v_diocese,v_chancery,v_parish,v_decree_id/);
  assert.match(migration, /insert into public.marginal_notes/);
});
for(const [name,sql] of [['integración',positive],['adversarial',adversarial]]){
 test(name+' trabaja en transacción reversible sin COMMIT',()=>{
  assert.match(sql,/^BEGIN;$/m);
  assert.match(sql,/\bROLLBACK;\s*$/);
  assert.doesNotMatch(sql,/^\s*COMMIT\b/m);
  assert.match(sql,/QA-/);
 });
}
test('La matriz V118 comprueba doble ejecución y que una partida no cambia',()=>{
 assert.match(positive,/segunda ejecución creó duplicado/);
 assert.match(positive,/alteró la vigencia/);
 assert.match(positive,/decree_number_collision/);
 assert.match(positive,/missing_historical_decree_reference/);
 assert.match(positive,/source_parish_or_diocese_mismatch/);
});
test('La matriz adversarial verifica otras diócesis y orígenes no verificados',()=>{
 assert.match(adversarial,/acceso a otra diócesis/);
 assert.match(adversarial,/origen pendiente/);
 assert.match(adversarial,/original/);
 assert.match(adversarial,/reposición no encontrada/);
 assert.match(adversarial,/historia sin fecha/);
});
test('La pantalla histórica está conectada al Centro de Decretos',()=>{
 assert.match(center,/import HistoricalDecreeReconciliationPanel/);
 assert.match(center,/<HistoricalDecreeReconciliationPanel\s*\/>/);
 assert.match(component,/role === 'chancery'/);
 assert.match(component,/institutionalPrompt/);
 assert.match(component,/CONCILIAR/);
 assert.match(component,/group.origin.identity_status !== 'verified'/);
});
test('La consulta de origen no trunca datos ni hace conciliación automática',()=>{
 assert.match(service,/\.eq\('profile_key', 'ANULACION'\)/);
 assert.match(service,/\.range\(page \* PAGE_SIZE, \(page \+ 1\) \* PAGE_SIZE - 1\)/);
 assert.match(service,/No se truncaron resultados en silencio/);
 assert.match(service,/p_origin_id: originId/);
 assert.match(component,/onClick=\{\(\) => void reconcile\(group\)\}/);
 assert.doesNotMatch(component,/useEffect\([\s\S]*?materialize_legacy_decrees_v68/);
});
