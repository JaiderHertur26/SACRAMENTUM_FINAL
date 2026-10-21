// V93: regresión estática de privilegios de boletas en RLS.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const sql=fs.readFileSync(path.join(process.cwd(),'supabase/migrations/20261021180054_restrict_pending_sacrament_writes_to_parish_v93.sql'),'utf8');
const tables=['pending_baptisms','pending_confirmations'];
for(const table of tables){
 test(table+': INSERT sólo en parroquia propia',()=>{
  const r=new RegExp('ALTER\\s+POLICY\\s+'+table+'_insert_owner\\s+ON\\s+public\\.'+table+'\\s+WITH\\s+CHECK\\s*\\([\\s\\S]*?current_app_role\\(\\)\\s*=\\s*\\x27parish\\x27[\\s\\S]*?parish_id\\s*=\\s*public\\.current_app_parish_id\\(\\)','i');
  assert.match(sql,r);
 });
 test(table+': UPDATE exige titularidad antes y después',()=>{
  const r=new RegExp('ALTER\\s+POLICY\\s+'+table+'_update_owner\\s+ON\\s+public\\.'+table+'\\s+USING\\s*\\([\\s\\S]*?parish_id\\s*=\\s*public\\.current_app_parish_id\\(\\)\\s*\\)\\s+WITH\\s+CHECK\\s*\\([\\s\\S]*?parish_id\\s*=\\s*public\\.current_app_parish_id\\(\\)','i');
  assert.match(sql,r);
 });
 test(table+': DELETE sólo para titular parroquial',()=>{
  const r=new RegExp('ALTER\\s+POLICY\\s+'+table+'_delete_owner\\s+ON\\s+public\\.'+table+'\\s+USING\\s*\\([\\s\\S]*?current_app_role\\(\\)\\s*=\\s*\\x27parish\\x27[\\s\\S]*?parish_id\\s*=\\s*public\\.current_app_parish_id\\(\\)','i');
  assert.match(sql,r);
 });
}
test('No restablecer vía is_app_admin la escritura a nivel general',()=>{
 assert.doesNotMatch(sql,/\bis_app_admin\s*\(/i);
});
test('La migración no cambia los datos sacramentales',()=>{
 assert.doesNotMatch(sql,/\b(?:delete\s+from|truncate|drop\s+table|insert\s+into|update\s+public\.)\b/i);
});
