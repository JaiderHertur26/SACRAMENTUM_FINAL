import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = name => fs.readFileSync(name, 'utf8');
const sidebar = read('src/components/Sidebar.jsx');
const app = read('src/App.jsx');
const header = read('src/components/chancery/DecreeCenterHeader.jsx');
const archive = read('src/pages/chancery/SacramentalDecreeArchivePage.jsx');

test('V304 Plantillas Documentales solo aparece en el rol Parroquia', () => {
  const beforeParish = sidebar.split('if (safeRole === ROLE_TYPES.PARISH)')[0];
  const parish = sidebar.split('if (safeRole === ROLE_TYPES.PARISH)')[1]
    .split('if (safeRole === ROLE_TYPES.CHANCERY)')[0];
  const afterParish = sidebar.split('if (safeRole === ROLE_TYPES.CHANCERY)')[1];
  assert.doesNotMatch(beforeParish,/label:\s*['"]Plantillas Documentales['"]/);
  assert.match(parish,/label:\s*['"]Plantillas Documentales['"]/);
  assert.match(parish,/path:\s*['"]\/documentos\/plantillas['"]/);
  assert.doesNotMatch(afterParish,/label:\s*['"]Plantillas Documentales['"]/);
  assert.equal((sidebar.match(/label:\s*['"]Plantillas Documentales['"]/g)||[]).length,1);
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
