import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n');
const picker=read('src/components/CelebratedSacramentSearchV291.jsx');
const service=read('src/services/sacramentalCasesV277.js');
const wizard=read('src/pages/parish/SacramentalCaseWizardV277.jsx');
const sql=read('supabase/migrations/20261029031120_sacramentum_v291_search_celebrated_sources_paged.sql');
test('V291 no descarga los primeros 300 registros ni utiliza una lista interminable',()=>{
  assert.doesNotMatch(service,/\.limit\(300\)/);
  assert.doesNotMatch(wizard,/sources\.map\(x=><option/);
  assert.match(wizard,/CelebratedSacramentSearchV291/);
});
test('V291 búsqueda realmente paginada en servidor con 15 resultados',()=>{
  assert.match(service,/search_celebrated_sacramental_records_v291/);
  assert.match(service,/p_offset:page\*limit,p_limit:limit/);
  assert.match(picker,/PAGE_SIZE=15/);
  assert.match(picker,/Siguiente/);
  assert.match(picker,/Anterior/);
  assert.match(sql,/LIMIT v_limit\+1 OFFSET v_offset/);
  assert.match(sql,/v_offset\+jsonb_array_length\(v_rows\)<v_total/);
});
test('V291 busca ambos contrayentes y persona confirmada',()=>{
  assert.match(sql,/novioNombres/);
  assert.match(sql,/noviaNombres/);
  assert.match(sql,/nombr1/);
  assert.match(sql,/nombr2/);
  assert.match(sql,/c\.nombres/);
  assert.match(sql,/c\.apellidos/);
  assert.match(picker,/cualquiera de los contrayentes/);
});
test('V291 filtra libro, folio, número y fecha sin asignar correlativos',()=>{
  for(const x of ['book','folio','number','date'])assert.match(picker,new RegExp("'"+x+"'"));
  assert.match(sql,/regexp_replace\(r\.book_number/);
  assert.match(sql,/r\.celebration_date=p_date/);
  assert.doesNotMatch(sql,/INSERT INTO public\.(?:marriages|confirmations)/);
});
test('V291 servidor usa exclusivamente parroquia de auth.uid() y rol activo',()=>{
  assert.match(sql,/up\.auth_user_id=auth\.uid\(\)/);
  assert.match(sql,/up\.role='parish'/);
  assert.match(sql,/up\.is_active IS TRUE/);
  assert.match(sql,/p\.is_operational IS TRUE/);
  assert.match(sql,/m\.parish_id=v_parish/);
  assert.match(sql,/c\.parish_id=v_parish/);
  assert.match(sql,/FROM PUBLIC,anon/);
  assert.match(sql,/TO authenticated/);
});
test('V291 impide seleccionar partidas sin coordenadas o anuladas',()=>{
  assert.match(sql,/r\.celebration_date<=current_date/);
  assert.match(sql,/r\.book_number/);
  assert.match(sql,/r\.folio/);
  assert.match(sql,/r\.number/);
  assert.match(sql,/cancelled','replaced/);
});
test('V291 selección conserva identificador y origen verificados',()=>{
  assert.match(wizard,/setSource\(record\)/);
  assert.match(wizard,/sourceRecordId:source\.id/);
  assert.match(wizard,/ceremonyPeopleV277\(record,sacrament\)/);
  assert.match(picker,/Partida identificada/);
});
test('V291 evita respuestas obsoletas, filtra con debounce y limpia selección',()=>{
  assert.match(picker,/let active=true/);
  assert.match(picker,/if\(!active\)return/);
  assert.match(picker,/clearTimeout\(timer\)/);
  assert.match(picker,/300:70/);
  assert.match(picker,/if\(selected\)onSelect\(null\)/);
  assert.match(wizard,/key={parishId\+':'\+sacrament}/);
});
