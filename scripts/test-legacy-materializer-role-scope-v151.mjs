import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const migration=read('supabase/migrations/20261022200026_enforce_legacy_materializer_authorization_v151.sql');
const qa=read('scripts/qa-rollback-legacy-materializer-roles-v151.sql');
const front=read('src/services/legacyMigrationService.js');

test('V151 revisa exactamente dos materializadores privados',()=>{
 for(const n of ['materialize_pending_legacy_marriages','materialize_pending_legacy_sacramental_records']) assert.match(migration,new RegExp(n));
 assert.match(migration,/FOREACH v_name/);
});
test('V151 cambia can_access_parish por can_manage_legacy_import en ambos',()=>{
 assert.match(migration,/v_old constant text := 'if not public\.can_access_parish\(v_batch\.parish_id\) then'/i);
 assert.match(migration,/v_new constant text := 'if not public\.can_manage_legacy_import\(v_batch\.parish_id,v_batch\.diocese_id\) then'/i);
 assert.match(migration,/EXECUTE replace\(v_ddl,v_old,v_new\)/);
});
test('V151 migración fallará ante cambios imprevistos y no romperá versiones de RPC',()=>{
 assert.match(migration,/to_regprocedure\(format\('private\.%I\(uuid,integer\)'/);
 assert.match(migration,/unexpected definition; manual review required/);
 assert.doesNotMatch(migration,/\bDROP FUNCTION\b|\bGRANT\b|\bREVOKE\b/i);
});
test('V151 conserva funciones publicas que utiliza importador',()=>{
 assert.match(front,/supabase\.rpc\('materialize_pending_legacy_sacramental_records'/);
 assert.match(front,/supabase\.rpc\('materialize_pending_legacy_marriages'/);
});
test('V151 QA rechaza a Cancillería y Administrador General en ambos tipos',()=>{
 assert.match(qa,/array\['chancery','admin'\]/);
 assert.match(qa,/public\.materialize_pending_legacy_marriages/);
 assert.match(qa,/public\.materialize_pending_legacy_sacramental_records/);
 assert.match(qa,/v_rejected<>4 OR v_accepted<>2/);
});
test('V151 QA mantiene permisos limitados a parroquia y diócesis',()=>{
 assert.match(qa,/array\['diocese','parish'\]/);
 assert.match(qa,/v_result IS NULL OR \(v_result->>'imported'\)/);
});
test('V151 QA utiliza perfiles activos como JWT sin exponer UUIDs',()=>{
 assert.match(qa,/SET LOCAL ROLE authenticated/);
 assert.match(qa,/request\.jwt\.claim\.sub/);
 assert.doesNotMatch(qa,/RAISE NOTICE|SELECT \* FROM public\.user_profiles/i);
});
test('V151 QA es reversible y no incluye COMMIT',()=>{
 assert.match(qa,/^BEGIN;$/m);
 assert.match(qa,/ROLLBACK;\s*$/);
 assert.doesNotMatch(qa,/^\s*COMMIT\b/im);
});
