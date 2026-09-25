import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const src = path.join(root, 'src');
const required = [
  'pages/parish/BaptismCelebratedPage.jsx',
  'pages/parish/BaptismSentarRegistrosPage.jsx',
  'pages/parish/BaptismPartidasPage.jsx',
  'pages/parish/BaptismIndexPage.jsx',
  'pages/BaptismDetailPage.jsx',
  'components/BaptismPrintTemplate.jsx',
  'components/modals/ViewBaptismPartidaModal.jsx',
  'components/modals/SearchBaptismPartidaModal.jsx',
  'services/sacramentsService.js',
  'services/marginalNotesV2Service.js',
  'services/historicalRegistryService.js'
];

const issues = [];
for (const rel of required) if (!fs.existsSync(path.join(src, rel))) issues.push(`Falta ${rel}`);
const read = rel => fs.readFileSync(path.join(src, rel), 'utf8');
const critical = required.filter(r => /Baptism|baptism|Bautismo|bautismo/.test(r));
for (const rel of critical) {
  const s = read(rel);
  if (/PÁRROCO ENCARGADO/i.test(s)) issues.push(`${rel}: fallback PÁRROCO ENCARGADO`);
  if (/header\.canciller/.test(s)) issues.push(`${rel}: Canciller usado como párroco`);
  if (/new Date\(\)\.toISOString\(\)\.slice\(0\s*,\s*10\)/.test(s)) issues.push(`${rel}: fecha civil UTC insegura`);
}
const detail = read('pages/BaptismDetailPage.jsx');
if (!/import React, \{ useEffect, useState \} from 'react';/.test(detail)) issues.push('BaptismDetailPage: hooks React no importados');
if (/record\.notaMarginal/.test(detail)) issues.push('BaptismDetailPage: nota marginal cruda visible');
if (!/listMarginalNotesForRecord/.test(detail)) issues.push('BaptismDetailPage: no usa notas marginales canónicas');

const search = fs.readFileSync(path.join(src, 'components/BusquedaPartidaBautismo.jsx'), 'utf8');
if (/Todas las diócesis/i.test(search) || /searchScope/.test(search)) issues.push('Búsqueda matrimonial: alcance global residual');
if (!/p_diocese_id:\s*selectedDiocese/.test(search)) issues.push('Búsqueda matrimonial: no fija diócesis de sesión');

const historical = read('pages/parish/BaptismCelebratedPage.jsx');
if (!/Digitalizar partida existente/i.test(historical)) issues.push('Digitalización histórica: semántica UI incorrecta');
if (/ordinarioLibro|ordinarioFolio|ordinarioNumero/.test(historical)) issues.push('Digitalización histórica: referencia al consecutivo ordinario');

console.log(`SACRAMENTUM Bautismo · archivos críticos: ${required.length}`);
if (issues.length) {
  console.error(`FALLO · ${issues.length} incidencia(s):`);
  issues.forEach(i => console.error(` - ${i}`));
  process.exit(2);
}
console.log('OK · invariantes estáticos de Bautismo verificados.');
