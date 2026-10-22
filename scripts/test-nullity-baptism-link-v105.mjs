import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const sql=fs.readFileSync(path.join(process.cwd(),
 'supabase/migrations/20261022002722_verify_nullity_baptism_identity_v105.sql'),'utf8');

test('El validador de vínculos es una función interna SECURITY INVOKER',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION private\.assert_nullity_baptism_link_v105/);
 assert.match(sql,/RETURNS void LANGUAGE plpgsql SECURITY INVOKER/);
});
test('La función solo se invoca tras comprobar que la partida está vigente y en jurisdicción',()=>{
 assert.match(sql,/v_branch\s+text\s*:=\s*'      if v_baptism_parish=v_marriage.parish_id then'/);
 assert.match(sql,/perform private\.assert_nullity_baptism_link_v105\(p_marriage_id,v_baptism_id\)/);
});
test('Nombre y apellidos del novio presentes y cotejados',()=>{
 assert.match(sql,/ARRAY\['novio','novia'\]/);
 assert.match(sql,/v_party\|\|'Nombres'/);
 assert.match(sql,/v_party\|\|'Apellidos'/);
 assert.match(sql,/person_name_normalized_v105\(v_first\)=private\.person_name_normalized_v105\(v_baptism\.nombres\)/);
 assert.match(sql,/person_name_normalized_v105\(v_last\)=private\.person_name_normalized_v105\(v_baptism\.apellidos\)/);
});
test('Libro, folio y número tienen que existir en ambas fuentes',()=>{
 for(const f of ['BautismoLibro','BautismoFolio','BautismoNumero'])assert.ok(sql.includes(f));
 assert.match(sql,/v_book IS NOT NULL AND v_folio IS NOT NULL AND v_number IS NOT NULL/);
});
test('Coordenadas exactas con normalización numérica de ceros',()=>{
 assert.match(sql,/ltrim\(btrim\(p_text\),'0'\)/);
 for(const field of ['book_number','folio','number']){
   assert.ok(sql.includes('private.registry_ref_normalized_v105(v_baptism.'+field+')'));
 }
});
test('Nombres con tildes y espacios normalizados sin aceptar vacío',()=>{
 assert.match(sql,/translate\(lower\(btrim\(coalesce\(p_text,''\)\)\)/);
 assert.match(sql,/\[\[:space:\]\]\+/);
 assert.match(sql,/nullif\(/);
});
test('Un enlace sin información suficiente se rechaza antes de escribir nota',()=>{
 assert.match(sql,/IF NOT v_verified THEN/);
 assert.match(sql,/USING ERRCODE='23514'/);
});
test('No admite más de dos partidas de Bautismo',()=>{
 assert.match(sql,/cardinality\(p_baptism_ids\)>2/);
});
test('El array de vínculos rechaza duplicados y nulos',()=>{
 assert.match(sql,/count\(distinct t.id\).*unnest\(p_baptism_ids\)/);
 assert.match(sql,/<> cardinality\(p_baptism_ids\)/);
});
test('La actualización de la RPC original falla cerrada ante una deriva de versión',()=>{
 assert.match(sql,/strpos\(v_src,v_loop\)=0 OR strpos\(v_src,v_branch\)=0/);
 assert.match(sql,/strpos\(v_src,'private.assert_nullity_baptism_link_v105'\)>0/);
});
test('No modifica directamente expedientes históricos ni notificaciones',()=>{
 assert.doesNotMatch(sql,/^\s*(?:DELETE\s+FROM|UPDATE\s+public\.|INSERT\s+INTO|TRUNCATE)\b/im);
});
test('Los helpers no están disponibles para usuarios anónimos/autenticados',()=>{
 const grants=(sql.match(/REVOKE EXECUTE ON FUNCTION private\./g)||[]).length;
 assert.equal(grants,3);
 assert.equal((sql.match(/FROM PUBLIC,anon,authenticated;/g)||[]).length,3);
});
