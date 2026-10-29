import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildChanceryArchiveHierarchy} from '../src/utils/chanceryArchiveHierarchy.mjs';

const vicaries=[{id:'v1',name:'María Reina'},{id:'v2',name:'Padre Misericordioso'}];
const deaneries=[{id:'d1',name:'Jesús Señor de la Vida',vicaria_id:'v1'}];
const parishes=[
{id:'p1',name:'Parroquia Padre Misericordioso',vicary_id:'v1',decanate_id:'d1'},
{id:'p2',name:'Parroquia Santa Cruz',vicary_id:'v1',decanate_id:null},
{id:'p3',name:'Parroquia San José',vicary_id:'v2',decanate_id:null}
];
const rows=[
{id:'c1',parish_id:'p1',decree_number:'C-010'},
{id:'c2',parish_id:'p1',decree_number:'C-001'},
{id:'c3',parish_id:'p1',decree_number:'0357'},
{id:'c4',parish_id:'p1',decree_number:'2263'},
{id:'c5',parish_id:'p2',decree_number:'0001'},
{id:'c6',parish_id:'p3',decree_number:'0002'},
{id:'legacy',parish_id:null,payload:{parishName:'No atribuida',parishId:'p1'}},
{id:'unknown',parish_id:'deleted-parish'}
];
const source=p=>fs.readFileSync(p,'utf8');
test('V306 jerarquía Vicaría/Decanato/Parroquia/Decretos como modelo adjunto',()=>{
 const tree=buildChanceryArchiveHierarchy(rows,parishes,vicaries,deaneries);
 assert.equal(tree.total,8);
 assert.equal(tree.vicaries.length,2);
 const maria=tree.vicaries.find(v=>v.id==='v1');
 assert.equal(maria.count,5);
 assert.equal(maria.deaneries[0].count,4);
 assert.deepEqual(maria.deaneries[0].parishes[0].rows.map(r=>r.decree_number),['C-010','C-001','0357','2263']);
 assert.equal(maria.direct.length,1);
 assert.equal(maria.direct[0].rows.length,1);
 assert.equal(tree.unassigned.length,2);
 assert.equal(tree.visibleCount,tree.total);
 assert.equal(new Set([...tree.vicaries.flatMap(v=>[
  ...v.direct.flatMap(p=>p.rows.map(r=>r.id)),
  ...v.deaneries.flatMap(d=>d.parishes.flatMap(p=>p.rows.map(r=>r.id)))]),
  ...tree.unassigned.map(r=>r.id)]).size,rows.length);
});
test('V306 consulta únicamente referencial; no atribuye histórico por nombre o payload ambiguo',()=>{
 const tree=buildChanceryArchiveHierarchy(rows,parishes,vicaries,deaneries);
 assert.equal(tree.unassigned.some(r=>r.id==='legacy'),true);
 assert.equal(tree.unassigned.some(r=>r.id==='unknown'),true);
});
test('V306 pantalla de archivo centrada en jerarquía sin selectores y tarjetas duplicadas',()=>{
 const page=source('src/pages/chancery/SacramentalDecreeArchivePage.jsx');
 const panel=source('src/components/chancery/ChanceryDecreeHierarchy.jsx');
 assert.match(page,/ChanceryDecreeHierarchy rows=\{filtered\}/);
 assert.doesNotMatch(page,/<DecreeTerritoryNavigator/);
 assert.match(page,/typeFilter === 'tribunal' &&/);
 assert.match(panel,/Vicaría/);
 assert.match(panel,/Decanato/);
 assert.match(panel,/Parroquias adscritas directamente/);
 for(const heading of ['N.º Decreto','Fecha','Titular corregido','Ubicación original','Concepto','Acciones']) assert.ok(panel.includes(heading),heading);
 assert.match(panel,/decreeCorrectedTargetName/);
 assert.match(panel,/decreeCanReverse\(row\)/);
 assert.match(panel,/onView\(row\)/);
 assert.match(panel,/onReverse\(row\)/);
 assert.match(panel,/Ver detalles del expediente/);
 assert.doesNotMatch(panel,/>Eliminar decreto</);
});
test('V306 alta diocesana permite crear parroquia sin decanato con verificaciones de seguridad',()=>{
 const screen=source('src/pages/diocese/DioceseEcclesiasticalPage.jsx');
 const edge=source('supabase/functions/activate-environment/index.ts');
 assert.match(screen,/type === 'PARISH' && !envFormData\.vicaryId/);
 assert.match(screen,/Sin decanato · dependencia directa de la Vicaría/);
 assert.match(screen,/disabled=\{!realVicaries\.length\}/);
 assert.match(screen,/selectedDeanery\.vicaria_id \|\| selectedDeanery\.vicaryId/);
 assert.match(edge,/if \(!verifiedVicaryId\)/);
 assert.match(edge,/if \(requestedDeaneryId\)/);
 assert.match(edge,/dioceseId !== creatorProfile\.diocese_id/);
 assert.match(edge,/creatorRole !== 'diocese'/);
 assert.match(edge,/deanery\.vicaria_id !== verifiedVicaryId/);
 assert.match(edge,/decanate_id: requestedDeaneryId/);
});
