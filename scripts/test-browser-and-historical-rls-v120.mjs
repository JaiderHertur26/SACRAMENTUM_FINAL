import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('supabase/migrations/20261022130415_isolate_historical_origins_by_diocese_v120.sql','utf8');
const qa=fs.readFileSync('scripts/qa-rollback-cross-diocese-rls-v120.sql','utf8');
const web=fs.readFileSync('scripts/audit-browser-anonymous-v119.mjs','utf8');
test('V120 refuerza RLS de orígenes históricos sin conceder acceso global',()=>{
  assert.match(source,/ALTER POLICY legacy_source_origins_select_v65/);
  assert.match(source,/TO authenticated/);
  assert.match(source,/can_access_parish\(legacy_source_origins\.mapped_parish_id\)/);
  assert.match(source,/s\.owner_diocese_id = public\.current_app_diocese_id\(\)/);
});
test('V120 rechaza archivos inconsistentes en jurisdicción doble',()=>{
  assert.match(source,/ALTER POLICY legacy_archive_records_select_scoped/);
  assert.match(source,/legacy_archive_records\.parish_id IS NULL\s+OR public\.can_access_parish/);
  assert.match(source,/legacy_archive_records\.diocese_id IS NULL\s+OR legacy_archive_records\.diocese_id = public\.current_app_diocese_id\(\)/);
  assert.match(source,/\bAND\b/);
});
test('V120 no desactiva ni resetea RLS de las tablas',()=>{
 assert.doesNotMatch(source,/DISABLE ROW LEVEL SECURITY|DROP POLICY|DROP TABLE|TRUNCATE|DELETE FROM/i);
});
test('V120 QA usa transacción reversible y no compromete tablas reales',()=>{
 assert.match(qa,/^BEGIN;$/m);assert.match(qa,/ROLLBACK;\s*$/);
 assert.doesNotMatch(qa,/^\s*COMMIT;/mi);
});
test('V120 QA cubre los tres roles que no deben ver otras jurisdicciones',()=>{
 for(const role of ["'chancery'","'diocese'","'parish'"])assert.ok(qa.includes(role));
 assert.match(qa,/SET LOCAL ROLE authenticated/);
 assert.match(qa,/foreign origin visible/);
});
test('V120 QA cubre coherencia entre parroquia y diócesis',()=>{
 for(const scenario of ['QA-V120-FOREIGN','QA-V120-MISMATCH-DIO','QA-V120-MISMATCH-PARISH','QA-V120-LOCAL'])assert.ok(qa.includes(scenario));
 assert.match(qa,/legitimate local row hidden/);
});
test('V120 QA mantiene al Administrador General en consulta estructural',()=>{
 assert.match(qa,/role='admin_general'/);
 assert.match(qa,/lost global structural visibility/);
});
test('V119 realiza navegación Chrome real, no sólo render sintético',()=>{
 assert.match(web,/Page\.navigate/);
 assert.match(web,/Page\.captureScreenshot/);
 assert.match(web,/Emulation\.setDeviceMetricsOverride/);
 assert.match(web,/Runtime\.exceptionThrown/);
 assert.match(web,/Page\.navigate/);
});
test('V119 navegación está aislada de credenciales y modificaciones',()=>{
 assert.doesNotMatch(web,/password\s*[:=]|signInWithPassword|update\(\{|insert\(\{|delete\(\)/);
 assert.match(web,/scope:'Chrome headless LOCAL, navegación sin autenticación real'/);
});
