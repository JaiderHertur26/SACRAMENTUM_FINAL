import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildDecreeTerritory,matchesDecreeTerritory} from '../src/utils/decreeTerritory.mjs';
const read = p => fs.readFileSync(p,'utf8');
const vicaries=[{id:'v1',name:'Vicaría Norte'},{id:'v2',name:'Vicaría Sur'}];
const deaneries=[{id:'d1',name:'Decanato San José',vicaria_id:'v1'}];
const parishes=[
 {id:'p1',name:'Santa Cruz',vicary_id:'v1',decanate_id:'d1'},
 {id:'p2',name:'Padre Misericordioso',vicary_id:'v1',decanate_id:null},
 {id:'p3',name:'San Rafael',vicary_id:'v2',decanate_id:null},
 {id:'p4',name:'Parroquia sin decanato con campo legacy',vicary_id:'v2',decanate_id:null,deanery_id:'legacy-old'}
];
const decrees=[
 {id:'a',parish_id:'p1',tipo:'correccion'},
 {id:'b',parish_id:'p1',tipo:'reposicion'},
 {id:'c',parish_id:'p2',tipo:'documental'},
 {id:'d',parish_id:'p3',tipo:'correccion'},
 {id:'e',parish_id:'p4',tipo:'reposicion'},
 {id:'f',parish_id:null,payload:{parishName:'Sin identificar',parishId:'p2'},tipo:'historico'},
 {id:'g',parish_id:'inexistente',tipo:'historico'}
];
const index=buildDecreeTerritory(decrees,parishes,vicaries,deaneries);

test('V305 conteos diocesanos por vicaria, decanato y parroquia; sin duplicados',()=>{
 assert.equal(index.total,7);
 assert.equal(index.byVicary.v1,3);
 assert.equal(index.byVicary.v2,2);
 assert.equal(index.byDeanery.d1,2);
 assert.equal(index.byParish.p1,2);
 assert.equal(index.byParish.p2,1);
 assert.equal(index.byParish.p4,1);
 assert.equal(index.unassigned,2);
 assert.equal(Object.values(index.byVicary).reduce((a,b)=>a+b,0)+index.unassigned,index.total);
});

test('V305 navegación por vicaria / decanato opcional / parroquia',()=>{
 const filter=state=>decrees.filter(row=>matchesDecreeTerritory(row,index,state)).map(row=>row.id);
 assert.deepEqual(filter({vicaryId:'v1'}),['a','b','c']);
 assert.deepEqual(filter({vicaryId:'v1',deaneryId:'d1'}),['a','b']);
 assert.deepEqual(filter({vicaryId:'v1',parishId:'p2'}),['c']);
 assert.deepEqual(filter({vicaryId:'v2'}),['d','e']);
 assert.deepEqual(filter({unassigned:true}),['f','g']);
 assert.equal(index.entries.get('e').deaneryId,''); // legacy no implica decanato
});

test('V305 no reasigna históricos por nombre de parroquia ambiguo',()=>{
 assert.equal(index.entries.get('f').linked,false);
 assert.equal(index.entries.get('f').parishName,'Sin identificar');
 assert.equal(index.entries.get('g').linked,false);
});

test('V305 permite parroquias directas sin decanato en pantalla, edición, activación y PostgreSQL',()=>{
 const screen=read('src/pages/diocese/DioceseEcclesiasticalPage.jsx');
 const edit=read('src/components/modals/EditParishModal.jsx');
 const edge=read('supabase/functions/activate-environment/index.ts');
 const migration=read('supabase/migrations/20261029190000_v305_optional_deanery_for_parish.sql');
 assert.match(screen,/disabled=\{!realVicaries\.length\}/);
 assert.doesNotMatch(screen,/disabled=\{!realVicaries\.length \|\| !realDeaneries\.length\}/);
 assert.match(screen,/type === 'PARISH' && !envFormData\.vicaryId/);
 assert.match(screen,/Sin decanato · dependencia directa/);
 assert.match(edit,/if \(!formData\.vicaryId\)/);
 assert.match(edit,/Decanato \(opcional\)/);
 assert.match(edge,/if \(!verifiedVicaryId\)/);
 assert.match(edge,/if \(requestedDeaneryId\)/);
 assert.match(migration,/elsif new\.vicary_id is null then/);
 assert.match(migration,/current_app_role\(\)='diocese'/);
 assert.match(migration,/created_by=auth\.uid\(\)/);
 assert.match(migration,/upper\(type\)='CHANCERY' or coalesce\(payload->>'vicaryId',''\)<>''/);
 assert.match(migration,/El Decanato seleccionado no pertenece a la Vicaría indicada/);
});

test('V305 archivos de Cancillería y Diócesis conservan los decretos y sus filtros',()=>{
 const chancery=read('src/pages/chancery/SacramentalDecreeArchivePage.jsx');
 const diocese=read('src/pages/diocese/DiocesanDecreeOversightPage.jsx');
 const organization=read('src/pages/diocese/DioceseEcclesiasticalPage.jsx');
 const navigator=read('src/components/chancery/DecreeTerritoryNavigator.jsx');
 for(const source of [chancery,diocese]){
  assert.match(source,/DecreeTerritoryNavigator/);
  assert.match(source,/buildDecreeTerritory/);
  assert.match(source,/matchesDecreeTerritory/);
  assert.match(source,/from\('vicarias'\)/);
  assert.match(source,/from\('decanatos'\)/);
  assert.match(source,/\.eq\('diocese_id',\s*dioceseId\)/);
 }
 assert.match(navigator,/Sin parroquia vinculada/);
 assert.match(navigator,/Parroquias directamente adscritas a la vicaría/);
 assert.match(navigator,/Decanato \(opcional\)/);
 assert.match(organization,/counter\('byParish',parish\.id\)/);
 assert.match(organization,/counter\('byDeanery',deanery\.id\)/);
 assert.match(organization,/counter\('byVicary',vicary\.id\)/);
 assert.match(diocese,/useSearchParams/);
 assert.match(diocese,/searchParams\.get\('parish'\)/);
 assert.match(chancery,/listDecrees\(\{ dioceseId \}\)/);
 assert.match(diocese,/listDecrees\(\{dioceseId\}\)/);
});
