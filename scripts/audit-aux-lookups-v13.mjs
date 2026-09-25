
import fs from 'node:fs';
const files = [
  'src/pages/parish/BaptismNewPage.jsx',
  'src/pages/parish/BaptismCelebratedPage.jsx',
  'src/pages/parish/ConfirmationNewPage.jsx',
  'src/pages/parish/ConfirmationCelebratedPage.jsx',
  'src/pages/parish/MatrimonioNewPage.jsx',
  'src/pages/parish/MatrimonioCelebratedPage.jsx',
  'src/pages/parish/FuneralRegistryPage.jsx'
];
const patterns = [
  /<datalist\b/gi,
  /\blist=/gi,
  /name=["']ministro["']/gi,
  /name=["']daFe["']/gi,
  /name=["']da_fe["']/gi,
  /name=["']presencia["']/gi,
  /lugarNacimiento/gi,
  /lugar_nacimiento/gi,
  /Lugar Nac/gi
];
for (const file of files) {
  const text = fs.readFileSync(file,'utf8');
  console.log('\n## '+file);
  for (const re of patterns) {
    const matches = [...text.matchAll(re)];
    if (matches.length) console.log(re.toString(), matches.length);
  }
}
