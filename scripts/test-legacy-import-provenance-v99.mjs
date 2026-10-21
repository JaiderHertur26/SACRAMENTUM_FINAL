import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const sql=fs.readFileSync(path.join(process.cwd(),
 'supabase/migrations/20261021202136_preserve_legacy_import_concept_source_v99.sql'),'utf8');
test('La función institucional de importación conserva firma exacta',()=>{
 assert.match(sql,/public\.apply_legacy_import_batch\(uuid,integer\)/);
});
test('El parche es atómico y falla cerrado en versiones distintas',()=>{
 assert.match(sql,/IF\s+v_start=0\s+OR\s+v_end<=v_start/i);
 assert.match(sql,/IF\s+strpos\(v_section,v_header\)=0\s+OR\s+strpos\(v_section,v_tail\)=0/i);
 assert.match(sql,/RAISE\s+EXCEPTION/i);
});
test('Solo se reemplaza la rama annulment_concept',()=>{
 assert.match(sql,/elsif r\.target_entity=''annulment_concept'' then/i);
 assert.match(sql,/elsif r\.target_entity=''decree_link'' then/i);
 assert.match(sql,/substring\(v_original\s+FROM\s+1\s+FOR\s+v_start-1\)/i);
});
test('La importación histórica no se guarda como manual',()=>{
 assert.match(sql,/codigo,source_kind,source_reference\)/);
 assert.match(sql,/,''legacy_catalog''/);
});
test('Procedencia inequívoca: lote y fila',()=>{
 assert.match(sql,/v_batch\.id::text/);
 assert.match(sql,/r\.id::text/);
 assert.match(sql,/legacy_batch:/);
});
test('No se introduce alteración de privilegios ni bypass de autenticación',()=>{
 assert.doesNotMatch(sql,/^\s*(?:GRANT|REVOKE)\b/im);
});
test('No existen escrituras directas de partidas en migración',()=>{
 assert.doesNotMatch(sql,/\b(?:INSERT\s+INTO\s+public\.(?:baptisms|confirmations|marriages|funerals)|TRUNCATE|DELETE\s+FROM\s+public\.)\b/i);
});
