import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildDecreeTerritory,matchesDecreeTerritory} from '../src/utils/decreeTerritory.mjs';
const source=p=>fs.readFileSync(p,'utf8');
const parishes=[
 {id:'p1',name:'Santa Cruz',vicary_id:'v1',decanate_id:'d1'},
 {id:'p2',name:'Nuestra Señora',vicary_id:'v1',decanate_id:null},
 {id:'p3',name:'San Rafael',vicary_id:'v2',decanate_id:null},
 {id:'p4',name:'San Marcos',vicary_id:'v2',decanate_id:null,deanery_id:'legacy'}
];
const vicaries=[{id:'v1',name:'Norte'},{id:'v2',name:'Sur'}];
const deaneries=[{id:'d1',name:'San José',vicaria_id:'v1'}];
const decrees=[
{id:'a',parish_id:'p1'},{id:'b',parish_id:'p1'},{id:'c',parish_id:'p2'},
{id:'d',parish_id:'p3'},{id:'e',parish_id:'p4'},
{id:'f',parish_id:null,payload:{parishId:'p2',parishName:'No confirmada'}},
{id:'g',parish_id:'bad'}
];
const index=buildDecreeTerritory(decrees,parishes,vicaries,deaneries);
test('V305A contadores canónicos: vicaria, decanato, parroquia e historicos no vinculados',()=>{
 assert.equal(index.total,7);assert.equal(index.byVicary.v1,3);assert.equal(index.byVicary.v2,2);
 assert.equal(index.byDeanery.d1,2);assert.equal(index.byParish.p1,2);
 assert.equal(index.unassigned,2);
 assert.equal(Object.values(index.byVicary).reduce((a,b)=>a+b,0)+index.unassigned,index.total);
 assert.equal(index.entries.get('e').deaneryId,'');
 assert.equal(index.entries.get('f').linked,false);
});
test('V305A clasifica y filtra sin duplicar el decreto',()=>{
 const filter=s=>decrees.filter(d=>matchesDecreeTerritory(d,index,s)).map(d=>d.id);
 assert.deepEqual(filter({vicaryId:'v1'}),['a','b','c']);
 assert.deepEqual(filter({vicaryId:'v1',deaneryId:'d1'}),['a','b']);
 assert.deepEqual(filter({vicaryId:'v1',parishId:'p2'}),['c']);
 assert.deepEqual(filter({vicaryId:'v2'}),['d','e']);
 assert.deepEqual(filter({unassigned:true}),['f','g']);
});
test('V305A archivo Diócesis y Cancillería consulta ámbito y muestra árbol',()=>{
 const ch=source('src/pages/chancery/SacramentalDecreeArchivePage.jsx');
 const dioc=source('src/pages/diocese/DiocesanDecreeOversightPage.jsx');
 const tree=source('src/components/chancery/DecreeTerritoryNavigator.jsx');
 const org=source('src/pages/diocese/DioceseEcclesiasticalPage.jsx');
 for(const s of [ch,dioc]){
  assert.match(s,/DecreeTerritoryNavigator|ChanceryDecreeHierarchy/);
  assert.match(s,/matchesDecreeTerritory|ChanceryDecreeHierarchy/);
  assert.match(s,/from\('vicarias'\)/);assert.match(s,/from\('decanatos'\)/);
  assert.match(s,/\.eq\('diocese_id',dioceseId\)/);
 }
 assert.match(tree,/Sin parroquia vinculada/);
 assert.match(tree,/Parroquias directamente adscritas/);
 assert.match(tree,/Decanato \(opcional\)/);
 assert.match(org,/counter\('byParish',parish\.id\)/);
 assert.match(org,/counter\('byDeanery',deanery\.id\)/);
 assert.match(org,/counter\('byVicary',vicary\.id\)/);
 assert.match(dioc,/searchParams\.get\('parish'\)/);
 assert.match(ch,/listDecrees\(\{ dioceseId \}\)/);
 assert.match(dioc,/listDecrees\(\{dioceseId\}\)/);
});
test('V306 reglas de alta: vicaría obligatoria, decanato opcional y validación en la función Edge',()=>{
 const org=source('src/pages/diocese/DioceseEcclesiasticalPage.jsx');
 const edge=source('supabase/functions/activate-environment/index.ts');
 const edit=source('src/components/modals/EditParishModal.jsx');
 assert.match(org,/disabled=\{!realVicaries.length\}/);
 assert.match(org,/type === 'PARISH' && !envFormData.vicaryId/);
 assert.match(edge,/if \(!verifiedVicaryId\)/);
 assert.match(edge,/if \(requestedDeaneryId\)/);
 // La validación de alta exige vicaría y la función Edge permite decanato opcional.
 assert.match(edit,/!formData.vicaryId/);
});
