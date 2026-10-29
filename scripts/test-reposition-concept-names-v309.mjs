import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {filterDecreeConcepts,decreeConceptSacramentLabel} from '../src/utils/decreeConceptPolicy.js';

const read=p=>fs.readFileSync(p,'utf8');
const sql=read('supabase/deployment/v309_renombrar_decretos_reposicion_barranquilla.sql');
const view=read('src/pages/chancery/decree-annulment/AnnulmentConceptsTab.jsx');
const expected=[
 ['005','bautismo','DECRETO DE REPOSICIÓN DE BAUTISMO'],
 ['006','confirmacion','DECRETO DE REPOSICIÓN DE CONFIRMACIÓN'],
 ['007','matrimonio','DECRETO DE REPOSICIÓN DE MATRIMONIO'],
 ['008','exequias','DECRETO DE REPOSICIÓN DE ACTA DE DEFUNCIÓN']
];

test('V309 usa los cuatro nombres exactos y conserva clasificación sacramental',()=>{
 for(const [code,type,name] of expected){
  assert.ok(sql.includes("('"+code+"','"+type+"','"+name+"')"),code);
  const actual={codigo:code,concepto:name,tipo:'porReposicion',sacrament_type:type,is_active:true};
  assert.equal(filterDecreeConcepts([actual],{decreeType:'porReposicion',sacramentType:type}).length,1);
  assert.notEqual(decreeConceptSacramentLabel(type),'General');
 }
});

test('V309 la actualización acotada protege histórico 001 y no cambia el sacramento',()=>{
 assert.match(sql,/c\.source_kind='manual' AND c\.is_active=true/);
 assert.match(sql,/c\.codigo='001' AND c\.tipo='porRepeticion'/);
 assert.match(sql,/c\.sacrament_type='general' AND c\.source_kind='legacy_catalog'/);
 assert.match(sql,/SET concepto=e\.titulo, updated_at=clock_timestamp\(\)/);
 assert.doesNotMatch(sql,/SET sacrament_type\s*=/);
 assert.doesNotMatch(sql,/DELETE FROM/i);
 assert.doesNotMatch(sql,/INSERT INTO public\.conceptos_anulacion/i);
});

test('V309 interfaz distingue General histórico e impide Reposición nueva genérica',()=>{
 assert.match(view,/General · histórico/);
 assert.match(view,/row\.source_kind === 'legacy_catalog' && row\.sacrament_type === 'general'/);
 assert.match(view,/form\.tipo === 'porReposicion' && form\.sacrament_type === 'general'/);
 assert.match(view,/disabled=\{form\.tipo === 'porReposicion'\}/);
 assert.match(view,/Para Reposición seleccione un sacramento concreto/);
});
