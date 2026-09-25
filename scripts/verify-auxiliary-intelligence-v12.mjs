import fs from 'node:fs';

const root='C:/SACRAMENTUM/SACRAMENTUM_FINAL';
const read=(p)=>fs.readFileSync(root+'/'+p,'utf8');
const issues=[];

const parishPages=[
  'src/pages/parish/BaptismNewPage.jsx',
  'src/pages/parish/BaptismCelebratedPage.jsx',
  'src/pages/parish/ConfirmationNewPage.jsx',
  'src/pages/parish/ConfirmationCelebratedPage.jsx',
  'src/pages/parish/MatrimonioNewPage.jsx',
  'src/pages/parish/MatrimonioCelebratedPage.jsx',
  'src/pages/parish/FuneralRegistryPage.jsx'
];

for(const p of parishPages){
  const s=read(p);
  if(!s.includes('useSacramentalAuxiliaries')) issues.push(p+': no usa motor auxiliar común');
}

const settings=read('src/pages/parish/ParroquiaAjustesPage.jsx');
if(/Importar JSON|Importar Catálogos y Registros/i.test(settings)) issues.push('Ajustes conserva importador viejo');

for(const p of [
  'src/pages/parish/auxiliary/ParrocosList.jsx',
  'src/pages/parish/auxiliary/ObisposList.jsx',
  'src/pages/parish/auxiliary/CiudadesList.jsx',
  'src/pages/parish/auxiliary/DiocesisList.jsx',
  'src/pages/parish/auxiliary/IglesiasList.jsx',
  'src/pages/parish/auxiliary/MisDatosList.jsx'
]){
  if(/Importar JSON/i.test(read(p))) issues.push(p+': conserva Importar JSON');
}

const aux=read('src/hooks/useSacramentalAuxiliaries.js');
for(const token of ['currentPriest','priestAtDate','bishopAtDate','cityOptions','churchOptions','bishopOptions']){
  if(!aux.includes(token)) issues.push('motor auxiliar: falta '+token);
}

const datos=read('src/pages/parish/DatosAuxiliaresPage.jsx');
if(!datos.includes('BishopTenuresList') || !datos.includes('Obispos Titulares')) issues.push('Datos Auxiliares: falta Obispos Titulares');

const migration=read('src/services/legacyMigrationService.js');
for(const rpc of ['materialize_auxiliary_catalog_batch','materialize_diocesis_catalog_batch']){
  if(!migration.includes(rpc)) issues.push('Centro de Migración: falta '+rpc);
}

const marriageHistorical=read('src/pages/parish/MatrimonioCelebratedPage.jsx');
if(marriageHistorical.includes('Da Fe (Código)')) issues.push('Matrimonio histórico conserva selector artificial de código Da Fe');

const currentForms=[
  ['src/pages/parish/BaptismNewPage.jsx','readOnly','Párroco que Da Fe'],
  ['src/pages/parish/ConfirmationNewPage.jsx','readOnly','Párroco que Da Fe'],
  ['src/pages/parish/MatrimonioNewPage.jsx','readOnly','Párroco que Da Fe'],
  ['src/pages/parish/FuneralRegistryPage.jsx','readOnly','Da fe']
];
for(const [p,token,label] of currentForms){
  const s=read(p);
  if(!s.includes(token) || !s.toLowerCase().includes(label.toLowerCase())) issues.push(p+': Da Fe actual no está protegido');
}

if(issues.length){
  console.error('AUXILIARY INTELLIGENCE: FALLÓ');
  issues.forEach(x=>console.error(' - '+x));
  process.exit(1);
}
console.log('AUXILIARY INTELLIGENCE: OK · importaciones centralizadas + catálogos + autoridades + obispos titulares.');
