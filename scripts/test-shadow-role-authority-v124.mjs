import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(f)=>fs.readFileSync(f,'utf8');
const migration=read('supabase/migrations/20261022134101_diocese_only_shadow_cleanup_v124.sql');
const lab=read('scripts/qa-rollback-shadow-role-matrix-v124.sql');
test('V124 conserva dos funciones concretas de limpieza de sombras',()=>{
 for(const name of ['reconcile_legacy_baptism_shadows_v73','reconcile_legacy_confirmation_shadows_v74'])assert.ok(migration.includes(name));
});
test('V124 sólo permite Diócesis de origen y destino',()=>{
 assert.equal((migration.match(/v_role IS DISTINCT FROM 'diocese'/g)||[]).length,2);
 assert.equal((migration.match(/v_diocese IS DISTINCT FROM v_shadow_diocese/g)||[]).length,2);
 assert.equal((migration.match(/errcode='42501'/g)||[]).length,2);
});
test('V124 elimina privilegio de Administrador General para borrar sombras',()=>{
 assert.doesNotMatch(migration,/v_role not in \('diocese','admin_general'\)/i);
});
test('V124 conserva el filtro que protege Confirmaciones manuales/vigentes',()=>{
 assert.match(migration,/s\.raw_data->>'source'='legacy_import'/);
 assert.match(migration,/lower\(coalesce\(s\.status,''\)\) in \('reverted','anulada','anulado','annulled'\)/);
});
test('V124 mantiene evidencia forense antes de cada eliminación',()=>{
 assert.ok(migration.includes("remove_reconciled_legacy_shadow_v73"));
 assert.ok(migration.includes("remove_reconciled_legacy_confirmation_shadow_v74"));
 assert.match(migration,/insert into public.registry_audit_log/);
});
test('Prueba multirrol V124 cubre cuatro actores y dos RPC',()=>{
 for(const role of ["'admin_general'","'diocese'","'chancery'","'parish'"])assert.ok(lab.includes(role));
 for(const name of ['reconcile_legacy_baptism_shadows_v73','reconcile_legacy_confirmation_shadows_v74'])assert.ok(lab.includes(name));
 assert.match(lab,/v_allowed<>2 OR v_denied<>6/);
});
test('Prueba V124 con dos parroquias ficticias no persiste datos',()=>{
 assert.match(lab,/QA-V124-SOMBRA-SIN-PARTIDAS/);
 assert.match(lab,/QA-V124-DESTINO-SIN-PARTIDAS/);
 assert.match(lab,/^BEGIN;$/m);
 assert.match(lab,/ROLLBACK;\s*$/);
 assert.doesNotMatch(lab,/^\s*COMMIT;/im);
});
test('V124 no modifica directamente esquemas ni políticas',()=>{
 assert.doesNotMatch(migration,/^\s*(?:ALTER TABLE|ALTER POLICY|TRUNCATE TABLE)/im);
 // DELETE está presente exclusivamente dentro de la función controlada; no se ejecuta durante la migración.
 assert.match(migration,/CREATE OR REPLACE FUNCTION public\.reconcile_legacy_confirmation_shadows_v74/);
});
