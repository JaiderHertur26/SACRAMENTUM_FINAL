import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const sql=fs.readFileSync(path.join(process.cwd(),'supabase/migrations/20261021203322_scope_legacy_migration_roles_v100.sql'),'utf8');
test('Parroquia puede gestionar únicamente lotes de su parroquia',()=>{
 assert.match(sql,/IF\s+v_role='parish'\s+THEN/);
 assert.match(sql,/p_parish_id\s*=\s*public\.current_app_parish_id\(\)/);
 assert.match(sql,/p_diocese_id\s+IS\s+NULL\s+OR\s+p_diocese_id\s*=\s*v_diocese/);
});
test('Diócesis permanece dentro de su jurisdicción',()=>{
 assert.match(sql,/IF\s+v_role='diocese'\s+THEN/);
 assert.match(sql,/p_diocese_id\s+IS\s+NOT\s+NULL\s+AND\s+p_diocese_id\s+IS\s+DISTINCT\s+FROM\s+v_diocese/);
 assert.match(sql,/p\.diocese_id\s*=\s*v_diocese/);
});
test('Administrador General no puede gestionar lotes sin ámbito',()=>{
 assert.doesNotMatch(sql,/v_role='admin_general'|is_app_admin\(/);
 assert.match(sql,/RETURN\s+false;/i);
});
test('Lectura de lotes usa ámbitos y evita el bypass administrador',()=>{
 assert.match(sql,/ALTER\s+POLICY\s+legacy_batches_read/i);
 assert.match(sql,/can_manage_legacy_import\(parish_id,diocese_id\)/);
});
test('Lectura de filas usa lote y ámbitos',()=>{
 assert.match(sql,/ALTER\s+POLICY\s+legacy_rows_read/i);
 assert.match(sql,/b\.id=legacy_import_rows\.batch_id/);
});
test('Lectura de vínculos preserva la titularidad del lote',()=>{
 assert.match(sql,/ALTER\s+POLICY\s+legacy_links_read/i);
 assert.match(sql,/b\.id=legacy_record_links\.batch_id/);
});
test('Cancillería puede consultar su diócesis sin administrar archivos',()=>{
 assert.equal((sql.match(/current_app_role\(\)='chancery'/g)||[]).length,3);
});
test('Políticas de escritura y registros existentes sin modificaciones',()=>{
 assert.doesNotMatch(sql,/\b(?:INSERT\s+INTO|DELETE\s+FROM|TRUNCATE|UPDATE\s+public\.)\b/i);
 assert.doesNotMatch(sql,/ALTER\s+POLICY\s+\S+_(?:insert|update|delete)/i);
});
