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
const files=walk('src');
let datalist=[];
let imports=[];
for(const f of files){
 const s=fs.readFileSync(f,'utf8');
 if(/<datalist\b/i.test(s) || /\slist\s*=\s*["'{]/i.test(s)) datalist.push(f);
 if(/Importar JSON|Importar Catálogos y Registros/i.test(s)) imports.push(f);
}
console.log('DATALIST_OR_LIST_ATTR='+datalist.length);
datalist.forEach(x=>console.log('AUX_UI_RESIDUAL',x.replaceAll('\\','/')));
console.log('IMPORT_UI_REFERENCES='+imports.length);
imports.forEach(x=>console.log('IMPORT_REF',x.replaceAll('\\','/')));
