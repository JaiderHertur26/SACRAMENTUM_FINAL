import fs from 'node:fs';
const files=[
['src/pages/parish/auxiliary/ParrocosList.jsx',/\s*<Button\s*\n\s*onClick=\{\(\) => setModals\(m => \(\{ \.\.\.m, import: true \}\)\)\}[\s\S]*?<\/Button>/],
['src/pages/parish/auxiliary/ObisposList.jsx',/\s*<Button\s*\n\s*onClick=\{\(\) => setIsImportOpen\(true\)\}[\s\S]*?<\/Button>/],
['src/pages/parish/auxiliary/CiudadesList.jsx',/\s*<Button\s*\n\s*onClick=\{\(\) => setIsImportOpen\(true\)\}[\s\S]*?<\/Button>/],
['src/pages/parish/auxiliary/DiocesisList.jsx',/\s*<Button\s*\n\s*onClick=\{\(\) => setIsImportOpen\(true\)\}[\s\S]*?<\/Button>/],
['src/pages/parish/auxiliary/IglesiasList.jsx',/\s*<Button\s*\n\s*onClick=\{\(\) => setModals\(prev => \(\{ \.\.\.prev, import: true \}\)\)\}[\s\S]*?<\/Button>/],
['src/pages/parish/auxiliary/MisDatosList.jsx',/\s*<Button\s*\n\s*onClick=\{\(\) => setModals\(m => \(\{ \.\.\.m, import: true \}\)\)\}[\s\S]*?<\/Button>/]
];
for(const [rel,re] of files){
 const f='C:/SACRAMENTUM/SACRAMENTUM_FINAL/'+rel;
 let x=fs.readFileSync(f,'utf8');
 const before=x;
 x=x.replace(re,'');
 if(x===before) console.log('NO_MATCH',rel); else {fs.writeFileSync(f,x); console.log('REMOVED',rel);}
}
