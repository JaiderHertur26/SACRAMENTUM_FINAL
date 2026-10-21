// V95 - regresión estática de 15 políticas parroquiales
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const source=fs.readFileSync(path.join(process.cwd(),
 'supabase/migrations/20261021194014_restrict_parish_auxiliary_catalogs_v95.sql'),'utf8');
const groups=[
  {table:'ciudades',prefix:'ciudades',scope:'context_id'},
  {table:'diocesis',prefix:'diocesis_aux',scope:'parish_id'},
  {table:'iglesias',prefix:'iglesias',scope:'parish_id'},
  {table:'obispos',prefix:'obispos',scope:'parish_id'},
  {table:'parrocos',prefix:'parrocos',scope:'parish_id'}
];
for(const {table,prefix,scope} of groups){
 const rx=s=>new RegExp(s,'i');
 const owner="public\\.current_app_role\\(\\)\\s*=\\s*'parish'\\s+AND\\s+"+
   scope+"\\s*=\\s*public\\.current_app_parish_id\\(\\)";
 test(table+' INSERT solo para titular parroquial',()=>{
  assert.match(source,rx('ALTER\\s+POLICY\\s+'+prefix+'_insert_owner\\s+ON\\s+public\\.'+table+
   '\\s+WITH\\s+CHECK\\s*\\(\\s*'+owner+'\\s*\\)\\s*;'));
 });
 test(table+' UPDATE USING y WITH CHECK de titularidad',()=>{
  assert.match(source,rx('ALTER\\s+POLICY\\s+'+prefix+'_update_owner\\s+ON\\s+public\\.'+table+
   '\\s+USING\\s*\\(\\s*'+owner+'\\s*\\)\\s+WITH\\s+CHECK\\s*\\(\\s*'+owner+'\\s*\\)\\s*;'));
 });
 test(table+' DELETE solo para titular parroquial',()=>{
  assert.match(source,rx('ALTER\\s+POLICY\\s+'+prefix+'_delete_owner\\s+ON\\s+public\\.'+table+
   '\\s+USING\\s*\\(\\s*'+owner+'\\s*\\)\\s*;'));
 });
}
test('Sin privilegio is_app_admin en las cinco tablas',()=>assert.doesNotMatch(source,/is_app_admin\s*\(/i));
test('No cambia datos históricos, SELECT ni la estructura de tablas',()=>{
 assert.doesNotMatch(source,/\b(?:insert\s+into|delete\s+from|update\s+public\.|truncate|drop\s+table|alter\s+table|create\s+policy)\b/i);
 assert.doesNotMatch(source,/ALTER\s+POLICY\s+\w+_select_/i);
});
