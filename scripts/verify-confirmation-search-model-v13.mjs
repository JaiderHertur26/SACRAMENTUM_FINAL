import fs from 'node:fs';
import path from 'node:path';
const files=[
  'src/pages/parish/BaptismNewPage.jsx',
  'src/pages/parish/BaptismCelebratedPage.jsx',
  'src/pages/parish/ConfirmationNewPage.jsx',
  'src/pages/parish/ConfirmationCelebratedPage.jsx',
  'src/pages/parish/MatrimonioNewPage.jsx',
  'src/pages/parish/MatrimonioCelebratedPage.jsx',
  'src/pages/parish/FuneralRegistryPage.jsx'
];
let issues=[];
for(const f of files){
  const s=fs.readFileSync(f,'utf8');
  if(/<datalist\b/i.test(s)) issues.push(f+': datalist');
  if(/\blist\s*=/i.test(s)) issues.push(f+': list=');
}
console.log('TARGET_ISSUES='+issues.length);
for(const i of issues) console.log(i);

function walk(dir){
  let out=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory()) out=out.concat(walk(p));
    else if(/\.(jsx|tsx|js|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}
for(const f of walk('src/pages/parish')){
  const s=fs.readFileSync(f,'utf8');
  if(/<datalist\b/i.test(s)||/\blist\s*=/.test(s)){
    console.log('GLOBAL_RESIDUAL',f.replaceAll('\\','/'));
  }
}
