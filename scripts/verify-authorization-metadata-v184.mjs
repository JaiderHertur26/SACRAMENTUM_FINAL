// SACRAMENTUM V184 — build-time prohibition on mutable user metadata in client authorization source.
// This is a static control; real current PostgreSQL authorization is audited separately in SQL.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const EXTENSIONS = new Set(['.js','.jsx','.ts','.tsx','.mjs']);
const RE = /\b(?:raw_user_meta_data|user_metadata)\b/i;

export function scanAuthSource(root) {
  if(!fs.existsSync(root)) throw Error('Carpeta fuente inexistente');
  const hits=[],names=[];
  const walk=dir=>{
    for (const ent of fs.readdirSync(dir,{withFileTypes:true})) {
      const full=path.join(dir,ent.name);
      if(ent.isDirectory()) walk(full);
      else if(ent.isFile() && EXTENSIONS.has(path.extname(ent.name).toLowerCase())) {
        names.push(path.relative(root,full).replaceAll('\\','/'));
        if (RE.test(fs.readFileSync(full,'utf8'))) hits.push(path.relative(root,full).replaceAll('\\','/'));
      }
    }
  };
  walk(root);
  return {filesScanned:names.length, hits};
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const r=scanAuthSource(path.join(process.cwd(),'src'));
    console.log('V184 CLIENT ROLE INPUTS '+(r.hits.length?'FAIL':'PASS')+'; archivos='+r.filesScanned+'; referencias_editables='+r.hits.length);
    for (const p of r.hits) console.error('AUTH BOUNDARY VIOLATION '+p);
    if(r.hits.length)process.exitCode=1;
  } catch(e) {console.error('V184 FAILED: '+e.message);process.exitCode=1;}
}
