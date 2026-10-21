// V94: protege reglas parroquiales de configuración y libros.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const sql=fs.readFileSync(path.join(process.cwd(),'supabase/migrations/20261021180904_guard_parish_parameters_and_books_v94.sql'),'utf8');
for(const table of ['parish_parameters','sacrament_books']){
 test(table+': INSERT exclusivo de Parroquia propietaria',()=>{
  assert.match(sql,new RegExp('ALTER\\s+POLICY\\s+'+table+'_insert_owner\\s+ON\\s+public\\.'+table+'\\s+WITH\\s+CHECK\\s*\\([\\s\\S]*?current_app_role\\(\\)\\s*=\\s*\\x27parish\\x27[\\s\\S]*?parish_id\\s*=\\s*public\\.current_app_parish_id\\(\\)','i'));
 });
 test(table+': UPDATE exige titularidad original y destino',()=>{
  assert.match(sql,new RegExp('ALTER\\s+POLICY\\s+'+table+'_update_owner\\s+ON\\s+public\\.'+table+'\\s+USING\\s*\\([\\s\\S]*?current_app_role\\(\\)\\s*=\\s*\\x27parish\\x27[\\s\\S]*?parish_id\\s*=\\s*public\\.current_app_parish_id\\(\\)\\s*\\)\\s+WITH\\s+CHECK\\s*\\([\\s\\S]*?parish_id\\s*=\\s*public\\.current_app_parish_id\\(\\)','i'));
 });
 test(table+': DELETE exclusivo de Parroquia propietaria',()=>{
  assert.match(sql,new RegExp('ALTER\\s+POLICY\\s+'+table+'_delete_owner\\s+ON\\s+public\\.'+table+'\\s+USING\\s*\\([\\s\\S]*?current_app_role\\(\\)\\s*=\\s*\\x27parish\\x27[\\s\\S]*?parish_id\\s*=\\s*public\\.current_app_parish_id\\(\\)','i'));
 });
}
test('La migración no incorpora el bypass is_app_admin',()=>{
 assert.doesNotMatch(sql,/\bis_app_admin\s*\(/i);
});
test('La migración modifica sólo políticas, no los libros ni sus parámetros',()=>{
 assert.doesNotMatch(sql,/\b(?:drop\s+table|insert\s+into|delete\s+from|update\s+public\.|truncate)\b/i);
});
