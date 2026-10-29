import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file,'utf8');
const main = read('src/pages/chancery/SacramentalDecreesCenterPage.jsx');
const header = read('src/components/chancery/DecreeCenterHeader.jsx');
const advanced = read('src/pages/chancery/ChanceryDecreeInstitutionalManagementPage.jsx');
const app = read('src/App.jsx');
const sidebar = read('src/components/Sidebar.jsx');

const specialized = [
 'ChanceryDecreeIssueV280',
 'ChanceryDecreeSeatReceiptsV280',
 'NewSupplementaryDecreePanelV271',
 'NullityInstitutionalPreflightPanel',
 'HistoricalDecreeReconciliationPanel'
];

test('V300 Centro muestra únicamente la tarjeta de Gobierno Documental',()=>{
 assert.match(main,/<DecreeCenterHeader showCenterButton=\{false\} selectionOnly\s*\/>/);
 assert.equal((main.match(/<DecreeCenterHeader\b/g)||[]).length,1);
 assert.doesNotMatch(main,/<section|<form|<article|<button|<input|<textarea/i);
 for(const block of specialized)assert.doesNotMatch(main,new RegExp(block));
 for(const duplicate of ['Matriz de actuación','Seleccione el sacramento y la operación',
 'Recuperar decreto antiguo','Decreto documental nuevo'])assert.ok(!main.includes(duplicate),duplicate);
});

test('V300 sus tres operaciones y cuatro sacramentos conservan rutas institucionales',()=>{
 for(const x of ['correction','reposition','archive'])assert.match(header,new RegExp('\\b'+x+':'));
 for(const x of ['bautismo','confirmacion','matrimonio','exequias'])assert.match(header,new RegExp('\\b'+x+':'));
 for(const x of ['/chancery/decree-correction/new','/chancery/decree-replacement/new',
  '/chancery/decretos/archivo','/chancery/matrimonio/decretos','/chancery/exequias/decretos'])
  assert.ok(header.includes(x),x);
 assert.match(header,/if \(selectionOnly\)/);
 assert.match(header,/setHomeSacrament\(nextSacrament\)/);
 assert.match(header,/selectedSacrament \|\| 'bautismo'/);
 assert.match(header,/!text-white/);
});

test('V300 especialidades intactas, en otra pantalla protegida y accesible desde menú',()=>{
 for(const block of specialized){
   assert.match(advanced,new RegExp('import '+block));
   assert.match(advanced,new RegExp('<'+block+'\\b'));
 }
 assert.match(advanced,/Decreto documental nuevo/);
 assert.match(advanced,/Recuperar decreto antiguo/);
 assert.match(main,/if \(view === 'gestion-institucional'\) return <ChanceryDecreeInstitutionalManagementPage/);
 assert.match(main,/useSearchParams/);
 assert.doesNotMatch(app,/path="\/chancery\/decretos\/gestion-institucional"/);
 assert.match(app,/path="\/chancery\/decretos" element=\{<ProtectedRoute requiredRole=\{ROLE_TYPES.CHANCERY\}>/);
 assert.doesNotMatch(sidebar,/label: 'Gestión institucional'/);
 assert.doesNotMatch(sidebar,/path: '\/chancery\/decretos\?view=gestion-institucional'/);
 assert.match(sidebar,/label: 'Centro de Decretos'/);
});

test('V300 Parroquia no recibe cambios en su Centro de Decretos',()=>{
 const parish=read('src/pages/parish/ParishSacramentalDecreesCenterPage.jsx');
 assert.match(parish,/DecreeCenterHeader/);
 assert.match(app,/path="\/parroquia\/decretos"/);
});
