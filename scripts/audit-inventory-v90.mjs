// V90 - Inventario objetivo de código y rutas; no consulta datos sacramentales.
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
const root=process.cwd(),src=path.join(root,'src');
const walk=(dir)=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(ent=>{
 const p=path.join(dir,ent.name);return ent.isDirectory()?walk(p):/\.(jsx|js|mjs)$/.test(ent.name)?[p]:[];
});
const files=walk(src);
const rel=(p)=>path.relative(root,p).replaceAll('\\','/');
const source=(p)=>fs.readFileSync(p,'utf8');
const modules=new Set(files.map(p=>path.resolve(p)));
const routes=[];
const unresolved=[];
const parsedErrors=[];
const imports=[];
const writes=[];
const pages=files.filter(p=>rel(p).startsWith('src/pages/'));
const roleKeywords=['ADMIN_GENERAL','DIOCESE','CHANCERY','PARISH'];
for(const file of files){
 const body=source(file),f=rel(file);
 try{
  const ast=parse(body,{sourceType:'unambiguous',plugins:['jsx','typescript','importAttributes']});
  // Static dependency scan; dynamic imports are captured by regex separately.
  for(const node of ast.program.body){
   if(node.type==='ImportDeclaration' || node.type==='ExportNamedDeclaration' && node.source){
     if(node.source?.value)imports.push({from:f,specifier:node.source.value});
   }
  }
 }catch(e){parsedErrors.push({file:f,error:String(e.message).slice(0,220)});}
 for(const m of body.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)){
   imports.push({from:f,specifier:m[1],dynamic:true});
 }
 for(const m of body.matchAll(/\b(?:supabase\.)?from\(\s*['"]([^'"]+)['"]\s*\)\s*\.(insert|update|upsert|delete)\b/g)){
   writes.push({from:f,table:m[1],operation:m[2]});
 }
 for(const m of body.matchAll(/\.rpc\(\s*['"]([^'"]+)['"]/g)){
   writes.push({from:f,procedure:m[1],operation:'RPC'});
 }
}
for(const i of imports){
 const s=i.specifier;
 if(!s.startsWith('@/')&&!s.startsWith('./')&&!s.startsWith('../'))continue;
 const base=s.startsWith('@/')?path.join(src,s.slice(2)):path.resolve(path.dirname(path.join(root,i.from)),s);
 const resolved=[base,base+'.jsx',base+'.js',base+'.mjs',path.join(base,'index.jsx'),path.join(base,'index.js')]
  .some(p=>fs.existsSync(p));
 if(!resolved)unresolved.push(i);
}
const app=source(path.join(src,'App.jsx'));
const appLines=app.split(/\r?\n/);
appLines.forEach((line,ix)=>{
 for(const m of line.matchAll(/<Route\s+path=['"]([^'"]+)['"]/g)){
  routes.push({path:m[1],line:ix+1,roles:roleKeywords.filter(r=>line.includes('ROLE_TYPES.'+r)),
   protected:line.includes('ProtectedRoute') || line.includes('Navigate'),
   public:line.includes('PublicSearchPage') || line.includes('Public')});
 }
});
const out={
 generatedAt:'2026-10-21',version:'V90',gitBaseline:'2ef4f3c',
 files:files.length,jsxPages:pages.length,
 routes:routes.length,routeEntries:routes,
 explicitUnprotected:routes.filter(x=>!x.protected),
 unresolvedImports:unresolved,parseErrors:parsedErrors,
 imports:imports.length,dbOperations:writes,
 pageFiles:pages.map(rel)
};
fs.writeFileSync('AUDITORIA_INVENTARIO_CODIGO_V90.json',JSON.stringify(out,null,2)+'\n');
const byRole=Object.fromEntries(roleKeywords.map(k=>[k,routes.filter(r=>r.roles.includes(k)).length]));
const byOp=Object.fromEntries(['RPC','insert','update','delete','upsert'].map(k=>[k,writes.filter(w=>w.operation===k).length]));
const sample=out.explicitUnprotected.map(r=>' - '+r.path+' (línea '+r.line+')');
const md=[
 '# SACRAMENTUM V90 · Inventario estático y mapa de puntos de entrada','',
 'Esta es una exploración del código, NO una certificación de autorización del servidor. Una ruta puede ser pública deliberadamente.',
 '',
 'Versión de referencia: V89 / 2ef4f3c','',
 'Total de módulos JS/JSX/MJS en src: '+out.files,
 'Páginas JSX activas y potencialmente inactivas: '+out.jsxPages,
 'Rutas JSX enumeradas: '+out.routes,
 'Referencias de importación examinadas: '+out.imports,
 'Errores de parseo Babel: '+out.parseErrors.length,
 'Importaciones locales no resueltas: '+out.unresolvedImports.length,
 'Rutas sin envoltorio explícito de protección en su línea: '+out.explicitUnprotected.length,
 'Rutas por rol de línea: '+JSON.stringify(byRole),
 'Operaciones de acceso a datos identificadas: '+JSON.stringify(byOp),
 '',
 '## Rutas sin protección explícita en la misma línea',
 ...(sample.length?sample:['- Ninguna según el escáner estático.']),
 '',
 '## Importaciones que requieren revisión',
 ...unresolved.map(m=>'- '+m.from+' -> '+m.specifier),
 '',
 '## Errores de parseo',
 ...parsedErrors.map(x=>'- '+x.file+': '+x.error),
 '',
 '## Limitaciones',
 '- El analizador infiere rutas a partir de líneas de App.jsx; puede omitir rutas construidas fuera del componente.',
 '- Un RPC enumerado no se considera seguro por sí mismo; debe validarse en SQL con actor y jurisdicción.',
 '- Que una ruta responda HTTP 200 no demuestra que permita leer o ejecutar su contenido con una sesión real.',
 '- Los módulos sin ruta pueden ser componentes auxiliares válidos, no necesariamente código muerto.',
 '',
 'Archivos de evidencia: AUDITORIA_INVENTARIO_CODIGO_V90.json y AUDITORIA_MAESTRA_CONTROLES_V90.json.'
];
fs.writeFileSync('AUDITORIA_INVENTARIO_CODIGO_V90.md',md.join('\n')+'\n');
console.log(JSON.stringify({files:out.files,pages:out.jsxPages,routes:out.routes,parseErrors:parsedErrors.length,unresolved:unresolved.length,unprotected:out.explicitUnprotected,roleRoutes:byRole,dbOperations:byOp},null,2));
if(parsedErrors.length||unresolved.length)process.exitCode=2;
