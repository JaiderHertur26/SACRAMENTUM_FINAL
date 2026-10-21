import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261021200915_lock_legacy_concept_provenance_v98.sql'),'utf8');
const ui=fs.readFileSync(path.join(root,'src/pages/chancery/decree-annulment/AnnulmentConceptsTab.jsx'),'utf8');
test('La guarda de procedencia es invoker, no un bypass RLS',()=>{
 assert.match(sql,/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+private\.guard_legacy_concept_identity_v98\(\)/i);
 assert.match(sql,/SECURITY\s+INVOKER/i);
});
test('Un trigger comprueba TODAS las ediciones y no solo el frontend',()=>{
 assert.match(sql,/CREATE\s+TRIGGER\s+guard_legacy_concept_identity_v98\s+BEFORE\s+UPDATE\s+ON\s+public\.conceptos_anulacion/i);
 assert.match(sql,/FOR\s+EACH\s+ROW/i);
});
test('El concepto histórico preserva contenido y procedencia originales',()=>{
 assert.match(sql,/OLD\.source_kind\s+IS\s+DISTINCT\s+FROM\s+'manual'/i);
 assert.match(sql,/to_jsonb\(NEW\)\s*-\s*'is_active'\s*-\s*'updated_at'/i);
 assert.match(sql,/to_jsonb\(OLD\)\s*-\s*'is_active'\s*-\s*'updated_at'/i);
});
test('Desactivar conceptualmente histórico se permite',()=>{
 assert.match(sql,/-\s*'is_active'\s*-\s*'updated_at'/i);
 assert.match(ui,/onClick=\{\(event\)\s*=>\s*deactivate\(row\.id,\s*event\)\}/);
});
test('El concepto manual tampoco puede adoptar procedencia histórica arbitraria',()=>{
 assert.match(sql,/NEW\.source_kind\s+IS\s+DISTINCT\s+FROM\s+OLD\.source_kind/);
 assert.match(sql,/NEW\.source_reference\s+IS\s+DISTINCT\s+FROM\s+OLD\.source_reference/);
});
test('Las nuevas altas desde la API no pueden fingir ser históricas',()=>{
 assert.match(sql,/ALTER\s+POLICY\s+conceptos_insert_authority/);
 assert.match(sql,/source_kind\s*=\s*'manual'/);
 assert.match(sql,/source_reference\s+IS\s+NULL/);
});
test('UI oculta edición de históricos y conserva edición manual',()=>{
 assert.match(ui,/row\.source_kind\s*===\s*'manual'\s*\?/);
 assert.match(ui,/Histórico protegido/);
 assert.match(ui,/title="Editar concepto manual"/);
});
test('La migración no actualiza ni elimina material histórico',()=>{
 assert.doesNotMatch(sql,/\b(?:INSERT\s+INTO|DELETE\s+FROM|TRUNCATE|UPDATE\s+public\.conceptos_anulacion)\b/i);
});
