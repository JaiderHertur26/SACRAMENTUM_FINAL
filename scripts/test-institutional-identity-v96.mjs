// V96: regresión del permiso de identidad institucional.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const src=fs.readFileSync(path.join(process.cwd(),
 'supabase/migrations/20261021195010_protect_institutional_identity_from_admin_v96.sql'),'utf8');
const policies=['insert','update','delete'];
for(const operation of policies){
 test('mis_datos: '+operation+' conserva competencias institucionales por rol',()=>{
  const start=src.indexOf('ALTER POLICY mis_datos_'+operation+'_owner');
  assert.ok(start>=0,'Falta política '+operation);
  const end=src.indexOf(';',start);
  assert.ok(end>start,'La política no termina');
  const body=src.slice(start,end);
  for(const name of ["'parish'","'diocese'","'chancery'"])assert.ok(body.includes(name),name);
  assert.match(body,/public\.current_app_role\(\)/);
  assert.match(body,/entity_id\s*=\s*public\.current_app_/);
  if(operation==='update'){
   assert.match(body,/\bUSING\s*\(/i);
   assert.match(body,/\bWITH\s+CHECK\s*\(/i);
  }
 });
}
test('No permite excepciones de Administrador General',()=>{
 assert.doesNotMatch(src,/is_app_admin\s*\(|'admin_general'/i);
});
test('Se preserva la política de SELECT',()=>{
 assert.doesNotMatch(src,/ALTER\s+POLICY\s+mis_datos_select_/i);
});
test('Sólo se modifica RLS, nunca identidades ni registros existentes',()=>{
 assert.doesNotMatch(src,/\b(?:update\s+public\.|insert\s+into|delete\s+from|truncate|drop\s+table|alter\s+table)\b/i);
 assert.equal((src.match(/ALTER\s+POLICY\s+mis_datos_\w+_owner/gi)||[]).length,3);
});
