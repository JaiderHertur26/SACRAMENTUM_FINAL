// V183 — escaneo de artefactos públicos efectivamente publicados en Vercel.
// GET sólo a archivos JS/CSS/HTML públicos, sin sesión ni datos privados.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {scanBuild} from './audit-production-secrets-v183.mjs';
const origin='https://sacramentum-final.vercel.app';
const root=process.cwd();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sacramentum-public-'));
const queued=new Set(['/']),done=new Set();
let bytes=0,errors=[];
function refs(content,current) {
  const matches=[];
  const re=/["']\s*((?:\/assets\/|\.\/|assets\/)[A-Za-z0-9_\-./]+\.(?:js|css))(?:[?#][^"']*)?["']/g;
  for (const m of content.matchAll(re)) {
    const raw=m[1];
    const url=new URL(raw,current);
    if(url.origin===origin && url.pathname.startsWith('/assets/') && !url.pathname.includes('..'))matches.push(url.pathname);
  }
  return matches;
}
async function get(route){
  const url=new URL(route,origin);
  const r=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{'Cache-Control':'no-cache'}});
  if (!r.ok) throw new Error('HTTP '+r.status+' en '+route);
  const buf=Buffer.from(await r.arrayBuffer());
  if(buf.length>12*1024*1024)throw Error('Archivo excesivo en '+route);
  bytes+=buf.length;
  const file=route==='/'?'index.html':path.join('assets',path.basename(route));
  const dest=path.join(tmp,file);fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest,buf);
  return buf.toString('utf8');
}
try{
  const html=await get('/');
  if(!html.includes('<title>Sacramentum')||!html.includes('/assets/'))throw Error('No se reconoce build SACRAMENTUM');
  for (const x of refs(html,origin+'/'))queued.add(x);
  done.add('/');
  while (queued.size>done.size && done.size<350) {
    const batch=[...queued].filter(x=>!done.has(x)).slice(0,8);
    if(!batch.length)break;
    await Promise.all(batch.map(async route=>{
      done.add(route);
      try {
        const body=await get(route);
        for(const next of refs(body,origin+route))queued.add(next);
      } catch(e) {errors.push({route,message:e.message});}
    }));
  }
  const envFiles=['.env','.env.local','.env.production','.env.production.local'].map(x=>path.join(root,x));
  const r=scanBuild({buildDir:tmp,envFiles});
  console.log('V183 PUBLIC RELEASE: assets='+done.size+'; bytes='+bytes+'; errors='+errors.length+'; secret_findings='+r.violations.length+'; envs='+r.environmentFilesChecked);
  if(done.size>=350 || errors.length || !r.passed) {
    for(const e of errors)console.error(e.route+': '+e.message);
    for(const v of r.violations)console.error('BLOQUEO '+v.code+' '+v.file);
    process.exitCode=1;
  }
} catch(e) {console.error('V183 PUBLIC RELEASE FAILED: '+e.message);process.exitCode=1;}
finally {fs.rmSync(tmp,{force:true,recursive:true});}
