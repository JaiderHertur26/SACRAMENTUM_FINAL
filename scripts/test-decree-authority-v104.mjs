import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const src=fs.readFileSync(path.join(process.cwd(),
 'supabase/migrations/20261022000352_reserve_marriage_funeral_decrees_to_chancery_v104.sql'),'utf8');
const names=[
 'apply_funeral_correction(uuid,date,text,jsonb,text)',
 'apply_marriage_correction(uuid,date,text,jsonb,text)',
 'apply_marriage_nullity(uuid,text,date,text,jsonb,uuid[])',
 'create_funeral_reposition_by_decree(uuid,date,text,jsonb,jsonb,text)',
 'create_marriage_reposition_by_decree(uuid,date,text,jsonb,jsonb,text)',
 'reverse_funeral_decree(uuid,text)',
 'reverse_marriage_decree(uuid,text)'
];
for(const name of names){
 test('V104 preserva explícitamente la firma de '+name,()=>{
  assert.ok(src.includes('public.'+name));
 });
}
test('Las siete funciones contienen solo una guarda institucional común',()=>{
 assert.match(src,/v_old_guard\s+text\s*:=\s*'if v_role not in/);
 assert.match(src,/v_new_guard\s+text\s*:=\s*'if v_role <> ''chancery'' then'/);
 assert.match(src,/replace\(v_source,v_old_guard,v_new_guard\)/);
});
test('La migración elimina la excepción de Administrador General a jurisdicción',()=>{
 assert.match(src,/v_role\[\[:space:\]\]\*<>\[\[:space:\]\]\*''admin_general''/);
 assert.match(src,/regexp_replace\(/);
});
test('No modifica datos físicos ni partes sacramentales directamente',()=>{
 assert.doesNotMatch(src,/^\s*(?:UPDATE|DELETE|INSERT|TRUNCATE|ALTER\s+TABLE)\s+/im);
});
test('Preserva auth, jurisdicción, rol y aborta sobre definiciones inesperadas',()=>{
 assert.match(src,/strpos\(v_source,'auth.uid\(\)'\)/);
 assert.match(src,/strpos\(v_source,'v_user_diocese'\)/);
 assert.match(src,/v_count <> 1/);
 assert.match(src,/RAISE EXCEPTION 'V104:/);
});
test('Normaliza las fuentes CRLF antes de reemplazar',()=>{
 assert.match(src,/replace\(v_source,\s*E'\\r\\n',\s*E'\\n'\)/);
});
test('Ninguna función recibe un EXECUTE adicional ni acceso global',()=>{
 assert.doesNotMatch(src,/^\s*(?:GRANT|REVOKE|CREATE\s+POLICY)\b/im);
});
