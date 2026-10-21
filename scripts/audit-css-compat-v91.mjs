import fs from 'node:fs';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import path from 'node:path';
const a=process.argv[2], b=process.argv[3];
if(!a||!b)throw new Error('Uso: node scripts/audit-css-compat-v91.mjs <css_v3> <css_v4>');
const scan=p=>{
 const code=fs.readFileSync(p,'utf8'), classes=new Set(),rules=[],parseErrors=[];
 const css=postcss.parse(code,{from:path.basename(p)});
 css.walkRules(rule=>{
   rules.push(rule.selector);
   try{selectorParser(sel=>sel.walkClasses(c=>classes.add(c.value))).processSync(rule.selector)}
   catch(e){parseErrors.push(rule.selector.slice(0,100)+': '+e.message)}
 });
 return {file:p,bytes:Buffer.byteLength(code),classes,rules:rules.length,parseErrors};
};
const old=scan(a),next=scan(b);
const missing=[...old.classes].filter(x=>!next.classes.has(x)).sort();
const added=[...next.classes].filter(x=>!old.classes.has(x)).sort();
const report={
 date:'2026-10-21',scope:'Comparación de selectores compilados; NO sustituye capturas ni evaluación visual.',
 old:{file:old.file,bytes:old.bytes,classes:old.classes.size,rules:old.rules},
 next:{file:next.file,bytes:next.bytes,classes:next.classes.size,rules:next.rules},
 missingCount:missing.length,addedCount:added.length,
 missingExamples:missing.slice(0,100),
 addedExamples:added.slice(0,100),
 parseErrors:{old:old.parseErrors.slice(0,8),next:next.parseErrors.slice(0,8)}
};
fs.writeFileSync('AUDITORIA_COMPATIBILIDAD_CSS_V91.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
