import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = name => fs.readFileSync(name, 'utf8');
const sidebar = read('src/components/Sidebar.jsx');
const app = read('src/App.jsx');
const header = read('src/components/chancery/DecreeCenterHeader.jsx');
const archive = read('src/pages/chancery/SacramentalDecreeArchivePage.jsx');

test('V303 no muestra Plantillas Documentales en ningún rol', () => {
  assert.doesNotMatch(sidebar,/label:\s*['"]Plantillas Documentales['"]/);
  assert.doesNotMatch(sidebar,/path:\s*['"]\/documentos\/plantillas['"]/);
  for (const role of ['ADMIN_GENERAL','DIOCESE','PARISH','CHANCERY']) {
    assert.ok(sidebar.includes('safeRole === ROLE_TYPES.' + role), role);
  }
});

test('V303 elimina Decretos documentales duplicados del menú de parroquia y cancillería', () => {
  assert.doesNotMatch(sidebar,/label:\s*['"]Decretos documentales(?: recibidos)?['"]/i);
  assert.doesNotMatch(sidebar,/type=documental&sacrament=bautismo/);
  assert.doesNotMatch(sidebar,/Gestión institucional/);
});

test('V303 el archivo de decretos y el centro conservan sus accesos', () => {
  assert.match(sidebar,/label:\s*'Centro de Decretos', path:\s*'\/chancery\/decretos'/);
  assert.match(sidebar,/label:\s*'Centro de Decretos', path:\s*'\/parroquia\/decretos'/);
  assert.match(sidebar,/label:\s*'Correcciones recibidas'/);
  assert.match(sidebar,/label:\s*'Reposiciones recibidas'/);
  assert.match(sidebar,/label:\s*'Conceptos de Decreto'/);
  assert.match(header,/\/chancery\/decretos\/archivo/);
  assert.match(archive,/buildDecreeDocumentHtml/);
});

test('V303 no elimina las rutas protegidas ni documentos conservados', () => {
  assert.match(app,/DocumentTemplateLibraryPage/);
  assert.match(app,/\/documentos\/plantillas/);
  assert.match(app,/SacramentalDecreeArchivePage/);
  assert.match(app,/\/chancery\/decretos\/archivo/);
  assert.ok(fs.existsSync('src/pages/DocumentTemplateLibraryPage.jsx'));
});
