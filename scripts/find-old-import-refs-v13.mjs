import fs from 'node:fs';
import path from 'node:path';
const names=['ImportCiudadesForm','ImportObisposForm','ImportParrocosForm','ImportIglesiasForm','ImportDiocesisForm','ImportMisDatosForm'];
function walk(dir){
 let out=[];
 for(const e of fs.readdirSync(dir,{withFileTypes:true})){
  const p=path.join(dir,e.name);
  if(e.isDirectory()) out=out.concat(walk(p));
  else if(/\.(jsx|tsx|js|ts)$/.test(e.name)) out.push(p);
 }
 return out;
}
for(const f of walk('src')){
 const s=fs.readFileSync(f,'utf8');
 for(const n of names) if(s.includes(n)) console.log(n,'=>',f.replaceAll('\\','/'));
}