import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { filterDecreeConcepts, decreeConceptBookLabel, normalizeDecreeConceptPolicy } from '../src/utils/decreeConceptPolicy.js';
const source = path => fs.readFileSync(path,'utf8');
const sql = source('supabase/deployment/v308_reposicion_conceptos_barranquilla.sql');
const form = source('src/pages/chancery/decree-annulment/AnnulmentConceptsTab.jsx');

const cases = [
 ['005','bautismo'],
 ['006','confirmacion'],
 ['007','matrimonio'],
 ['008','exequias']
];

test('V308 cuatro conceptos nuevos y distintos de la Repetición histórica',()=>{
 for (const [code,sacrament] of cases) {
   assert.match(sql,new RegExp("\\('"+code+"','REPOSICIÓN DE PARTIDA DE .+?,'"+sacrament+"'\\)"));
 }
 assert.match(sql,/'porReposicion'/);
 assert.doesNotMatch(sql.split('\n').filter(line => !line.trim().startsWith('--')).join('\n'), /'porRepeticion'/);
 assert.match(sql,/source_reference,is_active/);
 assert.match(sql,/WHERE NOT EXISTS/);
 assert.match(sql,/diocese_id='452d50bc-ff3e-448e-9b93-1e97f8d321e2'/);
 assert.match(sql,/2,true,false,true/);
 assert.doesNotMatch(sql,/UPDATE public.conceptos_anulacion/i);
 assert.doesNotMatch(sql,/DELETE FROM public.conceptos_anulacion/i);
});

test('V308 los cuatro conceptos son elegibles y nunca confunden reposición con repetición',()=>{
 const concepts = cases.map(([codigo,sacrament_type])=>({
   codigo,tipo:'porReposicion',sacrament_type,enlibro:2,seinscribe:true,gennota:false,gendocum:true,is_active:true
 }));
 concepts.push({codigo:'001',tipo:'porRepeticion',sacrament_type:'general',is_active:true});
 for (const [code, sacrament] of cases) {
   const filtered=filterDecreeConcepts(concepts,{decreeType:'porReposicion',sacramentType:sacrament});
   assert.equal(filtered.length,1);
   assert.equal(filtered[0].codigo,code);
   assert.equal(normalizeDecreeConceptPolicy(filtered[0]).bookMode,2);
 }
 assert.equal(filterDecreeConcepts(concepts,{decreeType:'porReposicion',sacramentType:'general'}).length,0);
});

test('V308 el formulario configura reposición como asiento supletorio sin marginal de original inexistente',()=>{
 assert.match(form,/event\.target\.value === 'porReposicion'/);
 assert.match(form,/enlibro: 2, seinscribe: true, gennota: false, gendocum: true/);
 assert.match(form,/form\.tipo === 'porReposicion' && \(Number\(form\.enlibro\) !== 2/);
 assert.match(form,/Libro supletorio según sacramento/);
 assert.equal(decreeConceptBookLabel(2,'porReposicion'),'Libro supletorio según sacramento');
 assert.equal(decreeConceptBookLabel(2,'porCorreccion'),'Bautismo / Matrimonio');
});

test('V308 habilita los conceptos con las reglas efectivamente requeridas por la emisión',()=>{
 const server = source('supabase/migrations/20261029034915_sacramentum_v293_chancery_role_authorized_no_diocese_concept_gate.sql');
 assert.match(server,/c\.seinscribe IS DISTINCT FROM TRUE OR c\.enlibro<>2/);
 assert.match(server,/p_decree_type='reposicion' AND lower\(coalesce\(c\.tipo,''\)\) NOT IN\('porreposicion','reposicion'\)/);
 assert.match(server,/c\.sacrament_type,''\)\) NOT IN \('general',p_sacrament\)/);
});
