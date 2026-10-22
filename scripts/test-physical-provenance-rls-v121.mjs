import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(file)=>fs.readFileSync(file,'utf8');
const migration=read('supabase/migrations/20261022131752_isolate_physical_legacy_provenance_v121.sql');
const cross=read('scripts/qa-rollback-physical-provenance-rls-v121.sql');
const legitimate=read('scripts/qa-rollback-physical-provenance-legitimate-v121.sql');

test('V121 limita artefactos físicos al origen y a su instalación',()=>{
 assert.match(migration,/ALTER POLICY legacy_physical_artifacts_select_v70/);
 assert.match(migration,/s.owner_diocese_id = public.current_app_diocese_id\(\)/);
 assert.match(migration,/o.source_installation_id=s.id/);
 assert.match(migration,/can_access_parish\(o.mapped_parish_id\)/);
});
test('V121 no permite leer filas físicas sin acceder al artefacto padre',()=>{
 assert.match(migration,/ALTER POLICY legacy_physical_rows_select_v70/);
 assert.match(migration,/a.id=legacy_physical_source_rows.artifact_id/);
});
test('V121 no abre rutas alternativas mediante DBF o hashes',()=>{
 assert.match(migration,/ALTER POLICY legacy_source_files_select_scoped/);
 assert.match(migration,/legacy_source_files.source_origin_id/);
 assert.match(migration,/ALTER POLICY legacy_origin_hashes_select_v65/);
 assert.match(migration,/legacy_source_origin_hashes.origin_id/);
});
test('V121 es una migración de políticas de SELECT, sin cambios de datos',()=>{
 assert.doesNotMatch(migration,/\b(TRUNCATE|DROP TABLE|INSERT INTO|DELETE FROM|UPDATE)\b/i);
 assert.match(migration,/TO authenticated/g);
});
for(const [name,sql] of [['cross_diocese',cross],['legitimate',legitimate]]){
 test(name+' tiene laboratorio transaccional sin COMMIT',()=>{
  assert.match(sql,/\bBEGIN;/);
  assert.match(sql,/\bROLLBACK;\s*$/);
  assert.doesNotMatch(sql,/^\s*COMMIT;/im);
  assert.match(sql,/SET LOCAL ROLE authenticated/);
 });
}
test('El ataque V121 reproduce artefacto, fila, hash y archivo de origen',()=>{
 for(const s of ['legacy_physical_source_artifacts','legacy_physical_source_rows',
                 'legacy_source_origin_hashes','legacy_source_files']) assert.ok(cross.includes(s));
 assert.match(cross,/V121-EXPOSURE/);
});
test('El laboratorio legítimo valida cada uno de los cuatro recursos',()=>{
 for(const role of ["'diocese'","'chancery'","'admin_general'","'parish'"])
  assert.ok(legitimate.includes(role));
 for(const x of ['v_a<>1','v_r<>1','v_h<>1','v_f<>1'])
  assert.ok(legitimate.includes(x));
});
