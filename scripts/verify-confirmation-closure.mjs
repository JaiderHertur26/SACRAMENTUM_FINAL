import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const src = path.join(root, 'src');
const required = [
  'pages/parish/ConfirmationCelebratedPage.jsx',
  'pages/parish/ConfirmationSentarRegistrosPage.jsx',
  'pages/parish/ConfirmationPartidasPage.jsx',
  'pages/parish/ConfirmationIndexPage.jsx',
  'pages/parish/ConfirmationParametersPage.jsx',
  'components/ConfirmationPrintTemplate.jsx',
  'components/modals/ViewConfirmationPartidaModal.jsx',
  'services/sacramentsService.js',
  'services/historicalRegistryService.js',
  'pages/chancery/decree-correction/NewConfirmationCorrectionPage.jsx',
  'pages/chancery/decree-replacement/NewConfirmationReplacementPage.jsx',
  'components/PrintCorrectionDecreeConfirmations.jsx',
  'components/ConfirmationCorrectionPrintTemplate.jsx'
];
const issues = [];
for (const rel of required) if (!fs.existsSync(path.join(src, rel))) issues.push(`Falta ${rel}`);
const read = rel => fs.readFileSync(path.join(src, rel), 'utf8');const svc = read('services/sacramentsService.js');
if (!/export\s+function\s+purificarRegistroConfirmacion|export\s+const\s+purificarRegistroConfirmacion/.test(svc)) issues.push('Falta purificarRegistroConfirmacion canónico');
if (!/fetchConfirmationsFromSource/.test(svc)) issues.push('Falta fetchConfirmationsFromSource canónico');
if (!/legacy_dafe_resolved_name/.test(svc) || !/legacyDaFeCode/.test(svc)) issues.push('Confirmación legacy: Da Fe no conserva resolución + código original');
for (const rel of ['pages/parish/ConfirmationPartidasPage.jsx','pages/parish/ConfirmationIndexPage.jsx']) {
  const s = read(rel);
  if (!/fetchConfirmationsFromSource|purificarRegistroConfirmacion/.test(s)) issues.push(`${rel}: no consume lectura canónica`);
}
const hist = read('pages/parish/ConfirmationCelebratedPage.jsx');
if (!/Digitalizar partida existente/i.test(hist)) issues.push('Digitalización histórica: semántica UI incorrecta');
if (/ordinarioLibro|ordinarioFolio|ordinarioNumero/.test(hist)) issues.push('Digitalización histórica: usa consecutivo ordinario');

const sensitive = [
  'pages/chancery/decree-correction/NewConfirmationCorrectionPage.jsx',
  'pages/chancery/decree-replacement/NewConfirmationReplacementPage.jsx',
  'components/PrintCorrectionDecreeConfirmations.jsx',
  'components/ConfirmationCorrectionPrintTemplate.jsx'
];
for (const rel of sensitive) {
  const s = read(rel);
  if (/MÁQUINA DEL TIEMPO/i.test(s)) issues.push(`${rel}: reconstrucción temporal residual`);
  if (/PÁRROCO ENCARGADO/i.test(s)) issues.push(`${rel}: fallback PÁRROCO ENCARGADO`);
  if (/EL PÁRROCO/i.test(s)) issues.push(`${rel}: fallback EL PÁRROCO`);
}for (const rel of sensitive) {
  const s = read(rel);
  if (/\.from\(['\"]parrocos['\"]\)/.test(s)) issues.push(`${rel}: consulta sacerdotes para reconstrucción documental`);
}
const print = read('components/ConfirmationPrintTemplate.jsx');
if (/2024:\s*'DOS MIL VEINTICUATRO'/.test(print)) issues.push('ConfirmationPrintTemplate: fecha de expedición con tabla de años finita');
if (!/inactiveLabel/.test(print)) issues.push('ConfirmationPrintTemplate: no marca partidas no vigentes dentro de la impresión');
if (/raw\.lugarSacramento[^\n]+\|\|\s*parroquia/.test(print)) issues.push('ConfirmationPrintTemplate: inventa lugar de Confirmación desde parroquia actual');
const modal = read('components/modals/ViewConfirmationPartidaModal.jsx');
if (!/estaInactiva/.test(modal) || !/!estaInactiva\s*&&/.test(modal)) issues.push('ViewConfirmationPartidaModal: no bloquea notas manuales en partidas inactivas');
const histRequiredForbidden = [
  'name="sexo" required','name="fechaNacimiento" required','name="nombrePadre" required',
  'name="nombreMadre" required','name="lugarBautismo" required','name="ministro" required',
  'name="daFe" required','name="padrinos" required'
];
for (const token of histRequiredForbidden) if (hist.includes(token)) issues.push(`Digitalización histórica: obliga a inventar campo opcional (${token})`);

console.log(`SACRAMENTUM Confirmación · archivos críticos: ${required.length}`);
if (issues.length) {
  console.error(`FALLO · ${issues.length} incidencia(s):`);
  issues.forEach(i => console.error(` - ${i}`));
  process.exit(2);
}
console.log('OK · invariantes estáticos de Confirmación verificados.');