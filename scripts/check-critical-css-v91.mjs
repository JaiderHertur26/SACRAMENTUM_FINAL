// V249: las pantallas institucionales lazy-loaded pueden crear un CSS adicional.
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import parser from 'postcss-selector-parser';

const folder=path.resolve('dist/assets');
const files=fs.readdirSync(folder).filter(f=>f.endsWith('.css'));
if(!files.length)throw new Error('Falta CSS en el build');
const classes=new Set();
let bytes=0;
for(const file of files){
 const text=fs.readFileSync(path.join(folder,file),'utf8');
 bytes+=Buffer.byteLength(text);
 postcss.parse(text,{from:file}).walkRules(rule=>{
  parser(selector=>selector.walkClasses(c=>classes.add(c.value))).processSync(rule.selector);
 });
}
const common=['size-3','size-3.5'];
const institutional=['ecclesial-workspace','ecclesial-header','ecclesial-sidebar','ecclesial-scope-hero'];
const missing=[...common,...institutional].filter(c=>!classes.has(c));
console.log('CSS activos '+files.join(', ')+' bytes='+bytes+' clases='+classes.size);
console.log('COMPONENTES CRÍTICOS '+[...common,...institutional].map(s=>s+':'+(classes.has(s)?'OK':'FALTA')).join(' | '));
if(missing.length)throw new Error('Regresión de diseño: CSS requerido ausente '+missing.join(', '));
