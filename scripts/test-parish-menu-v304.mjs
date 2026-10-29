import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sidebar=fs.readFileSync('src/components/Sidebar.jsx','utf8');
const app=fs.readFileSync('src/App.jsx','utf8');
const section=(role)=>sidebar.split(`if (safeRole === ROLE_TYPES.${role})`)[1]?.split(/\n    \/\/ [1-5]\. /)[0]||'';
const parish=section('PARISH');

test('V304 restaura Plantillas Documentales exclusivamente para Parroquia',()=>{
 assert.match(parish,/label: 'Plantillas Documentales', path: '\/documentos\/plantillas', icon: FileText/);
 assert.equal((sidebar.match(/label: 'Plantillas Documentales'/g)||[]).length,1);
 for(const role of ['ADMIN_GENERAL','DIOCESE','CHANCERY'])
  assert.doesNotMatch(section(role),/label: 'Plantillas Documentales'/);
 assert.match(app,/DocumentTemplateLibraryPage/);
 assert.match(app,/\/documentos\/plantillas/);
});

test('V304 retira Control Operativo del menú parroquial sin borrar ni exponer rutas',()=>{
 assert.doesNotMatch(parish,/label: 'Control Operativo'/);
 assert.doesNotMatch(sidebar,/path: '\/parish\/operational-control'/);
 assert.match(app,/\/parish\/operational-control/);
 assert.match(app,/ProtectedRoute/);
});

test('V304 conserva operaciones parroquiales, decretos y notificaciones',()=>{
 for(const label of ['Notificaciones Cancillería','Notificaciones Sacramentales',
   'Libros Sacramentales','Centro de Decretos','Correcciones recibidas','Reposiciones recibidas']){
   assert.ok(parish.includes(label),label);
 }
 assert.doesNotMatch(sidebar,/label: 'Decretos documentales(?: recibidos)?'/);
 assert.doesNotMatch(sidebar,/label: 'Gestión institucional'/);
});
