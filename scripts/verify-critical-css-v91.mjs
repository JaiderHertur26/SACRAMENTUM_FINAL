// Garantía mínima de diseño V91: utilidades usadas por pantallas críticas.
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import parser from 'postcss-selector-parser';
const folder=path.resolve('dist/assets');
const files=fs.readdirSync(folder).filter(f=>f.endsWith('.css'));
if(files.length!==1)throw new Error('Se esperaba exactamente un CSS de producción, encontrados '+files.length);
const bytes=fs.readFileSync(path.join(folder,files[0]),'utf8');
const classes=new Set();
postcss.parse(bytes,{from:files[0]}).walkRules(rule=>{
 parser(selector=>selector.walkClasses(c=>classes.add(c.value))).processSync(rule.selector);
});
const critical=['bg-opacity-10','size-3','size-3.5'];
const missing=critical.filter(s=>!classes.has(s));
console.log('CSS '+files[0]+' bytes='+Buffer.byteLength(bytes)+' classes='+classes.size);
console.log('UTILIDADES CRÍTICAS '+critical.map(s=>s+':'+(classes.has(s)?'OK':'AUSENTE')).join(' | '));
if(missing.length)throw new Error('Regresión de diseño: utilidades ausentes '+missing.join(', '));
