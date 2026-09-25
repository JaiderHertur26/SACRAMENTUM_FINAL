import fs from 'node:fs';
import path from 'node:path';

function walk(dir){
  let out=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory()) out=out.concat(walk(p));
    else if(/\.(jsx|tsx|js|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

const sacramental=[
  'src/pages/parish/BaptismNewPage.jsx',
  'src/pages/parish/BaptismCelebratedPage.jsx',
  'src/pages/parish/ConfirmationNewPage.jsx',
  'src/pages/parish/ConfirmationCelebratedPage.jsx',
  'src/pages/parish/MatrimonioNewPage.jsx',
  'src/pages/parish/MatrimonioCelebratedPage.jsx',
  'src/pages/parish/FuneralRegistryPage.jsx'
];

let issues=[];

for(const f of sacramental){
  const s=fs.readFileSync(f,'utf8');
  if(/<datalist\b/i.test(s)) issues.push(f+': datalist legacy');
  if(/\slist\s*=\s*(?:["']|\{)/i.test(s)) issues.push(f+': list= legacy');
  if(!s.includes('useSacramentalAuxiliaries')) issues.push(f+': sin motor auxiliar común');
}

const srcFiles=walk('src');
for(const f of srcFiles){
  const s=fs.readFileSync(f,'utf8');
  if(/Importar JSON|Importar Catálogos y Registros/i.test(s)){
    issues.push(f+': importador antiguo visible/referenciado');
  }
}

const auxPage=fs.readFileSync('src/pages/parish/DatosAuxiliaresPage.jsx','utf8');
if(!auxPage.includes('BishopTenuresList') || !auxPage.includes('Obispos Titulares')){
  issues.push('DatosAuxiliaresPage: falta Obispos Titulares');
}

const migration=fs.readFileSync('src/services/legacyMigrationService.js','utf8');
if(!migration.includes('materialize_auxiliary_catalog_batch')){
  issues.push('Centro de Migración: no materializa catálogos operativos');
}

const city=fs.readFileSync('src/components/CityAutocomplete.jsx','utf8');
const church=fs.readFileSync('src/components/ChurchLocationAutocomplete.jsx','utf8');
if(!city.includes('AuxiliaryAutocomplete')) issues.push('CityAutocomplete no usa modelo Confirmación');
if(!church.includes('AuxiliaryAutocomplete')) issues.push('ChurchLocationAutocomplete no usa modelo Confirmación');

console.log('ISSUES='+issues.length);
issues.forEach(x=>console.log('ISSUE',x));
if(issues.length) process.exit(1);
console.log('OK · búsquedas auxiliares y migración unificadas.');
