import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const sql=fs.readFileSync(path.join(process.cwd(),'supabase/migrations/20261021212613_block_unscoped_admin_legacy_batch_v101.sql'),'utf8');
test('Parche preserva firma exacta del creador de lotes',()=>{
 assert.match(sql,/public\.create_legacy_import_batch\(text,text,text,text,uuid,uuid,jsonb\)/);
});
test('Ubica y quita exclusivamente la rama admin_general',()=>{
 assert.match(sql,/v_role=''admin_general''/);
 assert.match(sql,/v_role=''diocese''/);
 assert.match(sql,/v_new\s+text\s*:=\s*'if v_role=''diocese'''/);
});
test('Abortar si no existe exactamente una sección esperada',()=>{
 assert.match(sql,/length\(v_src\)-length\(replace\(v_src,v_old,''\)\)\s*<>\s*length\(v_old\)/);
 assert.match(sql,/RAISE\s+EXCEPTION/i);
});
test('No reescribe importaciones ni crea lotes en la migración',()=>{
 assert.doesNotMatch(sql,/\b(?:INSERT\s+INTO|DELETE\s+FROM|TRUNCATE|UPDATE\s+public\.)\b/i);
});
test('No altera grants, propietario ni políticas RLS',()=>{
 assert.doesNotMatch(sql,/^\s*(?:GRANT|REVOKE|ALTER\s+POLICY|DROP\s+FUNCTION)\b/im);
});
