import fs from 'node:fs';
const files=[
'src/pages/parish/BaptismNewPage.jsx',
'src/pages/parish/BaptismCelebratedPage.jsx',
'src/pages/parish/ConfirmationNewPage.jsx',
'src/pages/parish/ConfirmationCelebratedPage.jsx',
'src/pages/parish/MatrimonioNewPage.jsx',
'src/pages/parish/MatrimonioCelebratedPage.jsx',
'src/pages/parish/FuneralRegistryPage.jsx'
];
for(const f of files){
 const s=fs.readFileSync(f,'utf8');
 console.log('\n## '+f);
 for(const key of ['currentPriest','priestAtDate','bishopAtDate','AuxiliaryAutocomplete','ChurchLocationAutocomplete']){
   console.log(key, (s.match(new RegExp(key,'g'))||[]).length);
 }
}