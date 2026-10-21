import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const sql=fs.readFileSync(path.join(process.cwd(),'supabase/migrations/20261021200248_reserve_decree_concepts_to_chancery_v97.sql'),'utf8');
test('El INSERT de conceptos exige Cancillería',()=>{
 assert.match(sql,/ALTER\s+POLICY\s+conceptos_insert_authority\s+ON\s+public\.conceptos_anulacion\s+WITH\s+CHECK\s*\(/i);
 assert.match(sql,/current_app_role\(\)\s*=\s*'chancery'/i);
});
test('El INSERT de conceptos exige diócesis actual',()=>{
 assert.match(sql,/diocese_id\s*=\s*public\.current_effective_diocese_id\(\)/i);
});
test('El UPDATE valida ámbito anterior y nuevo',()=>{
 assert.match(sql,/ALTER\s+POLICY\s+conceptos_update_authority\s+ON\s+public\.conceptos_anulacion\s+USING\s*\(/i);
 assert.match(sql,/\)\s+WITH\s+CHECK\s*\(/i);
 assert.equal((sql.match(/diocese_id\s*=\s*public\.current_effective_diocese_id\(\)/g)||[]).length,3);
});
test('No se concede escritura a gobierno general o rol diocesano',()=>{
 assert.doesNotMatch(sql,/\bis_app_admin\s*\(|'admin_general'|'diocese'\s*\)/i);
});
test('Conserva la lectura de conceptos sin alterar políticas SELECT',()=>{
 assert.doesNotMatch(sql,/ALTER\s+POLICY\s+conceptos_select_diocese|DROP\s+POLICY|CREATE\s+POLICY/i);
});
test('No manipula decretos, conceptos históricos o partidas',()=>{
 assert.doesNotMatch(sql,/\b(?:DELETE\s+FROM|UPDATE\s+public\.|INSERT\s+INTO|TRUNCATE|DROP\s+TABLE|ALTER\s+TABLE)\b/i);
});
