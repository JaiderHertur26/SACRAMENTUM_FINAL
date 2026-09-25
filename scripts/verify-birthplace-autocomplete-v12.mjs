import fs from 'node:fs';

const base = 'C:/SACRAMENTUM/SACRAMENTUM_FINAL/src/pages/parish';
const checks = [
  ['BaptismNewPage.jsx', ['name="lugarNacimiento"']],
  ['BaptismCelebratedPage.jsx', ['name="lugarNacimiento"']],
  ['ConfirmationNewPage.jsx', ['name="lugarNacimiento"']],
  ['ConfirmationCelebratedPage.jsx', ['name="lugarNacimiento"']],
  ['MatrimonioNewPage.jsx', ['name="novioLugarNac"', 'name="noviaLugarNac"']],
  ['MatrimonioCelebratedPage.jsx', ['name="esposoLugarNac"', 'name="esposaLugarNac"']],
  ['FuneralRegistryPage.jsx', ['name="lugar_nacimiento"', 'name="historical_lugar_nacimiento"']]
];

let issues = [];
for (const [file, names] of checks) {
  const text = fs.readFileSync(base + '/' + file, 'utf8');
  for (const name of names) {
    const idx = text.indexOf(name);
    if (idx < 0) {
      issues.push(file + ': falta ' + name);
      continue;
    }
    const start = Math.max(0, idx - 300);
    const end = Math.min(text.length, idx + 500);
    const nearby = text.slice(start, end);
    if (!nearby.includes('<AuxiliaryAutocomplete')) {
      issues.push(file + ': ' + name + ' no usa AuxiliaryAutocomplete');
    }
    if (!nearby.includes('options=')) {
      issues.push(file + ': ' + name + ' no usa options de ciudades');
    }
  }
}

if (issues.length) {
  console.error('LUGAR DE NACIMIENTO: FALLÓ');
  issues.forEach(x => console.error(' - ' + x));
  process.exit(1);
}
console.log('LUGAR DE NACIMIENTO: OK · 10 campos usan el patrón canónico de Confirmación.');
