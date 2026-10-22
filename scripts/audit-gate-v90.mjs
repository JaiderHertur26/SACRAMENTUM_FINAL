// Puerta de calidad V90. No crea usuarios, registros ni altera Supabase.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const now=()=>new Date().toISOString();
const strict=!process.argv.includes('--sin-auditoria-dependencias');
const root=process.cwd();
const outputFile=process.argv.find(a=>a.startsWith('--output='))?.slice('--output='.length) || 'AUDITORIA_PUERTA_CALIDAD_V90.json';
const version=process.argv.find(a=>a.startsWith('--protocol='))?.slice('--protocol='.length) || 'V90';
const gitRef=spawnSync('git',['rev-parse','--short','HEAD'],{cwd:root,encoding:'utf8'}).stdout?.trim() || '(desconocido)';
const started=now(),tasks=[];
const exec=(name,command,args)=>{
  const begin=Date.now();
  const result=spawnSync(command,args,{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024,timeout:120000,windowsHide:true});
  const combined=(result.stdout||'')+'\n'+(result.stderr||'');
  const task={name,exitCode:result.status,ok:result.status===0,
   durationMs:Date.now()-begin,
   stderrSnippet:(result.stderr||'').slice(-650),
   stdoutSnippet:(result.stdout||'').slice(-650)};
  if(result.error){task.ok=false;task.error=result.error.message;}
  tasks.push(task);
  console.log((task.ok?'OK':'FALLO')+' · '+name+' · '+task.durationMs+'ms');
  return {task,combined};
};
const node=process.execPath;
exec('pruebas-sinteticas',node,['--test',
 'scripts/test-sistema-integral-v89.mjs',
 'scripts/test-chancery-decrees-v88.mjs',
 'scripts/test-supplementary-preflight-v89.mjs',
 'scripts/test-privileged-sequences-v92.mjs',
 'scripts/test-pending-ownership-v93.mjs',
 'scripts/test-parish-book-ownership-v94.mjs',
 'scripts/test-parish-auxiliary-ownership-v95.mjs',
 'scripts/test-institutional-identity-v96.mjs',
 'scripts/test-decree-concept-authority-v97.mjs',
 'scripts/test-legacy-concept-provenance-v98.mjs',
 'scripts/test-legacy-import-provenance-v99.mjs',
 'scripts/test-legacy-role-scope-v100.mjs',
 'scripts/test-legacy-admin-unscoped-v101.mjs',
 'scripts/test-document-authority-v102.mjs',
 'scripts/test-historical-maintenance-privileges-v103.mjs',
 'scripts/test-decree-authority-v104.mjs',
 'scripts/test-nullity-baptism-link-v105.mjs',
 'scripts/test-nullity-receipt-authority-v106.mjs',
 'scripts/test-nullity-judicial-review-v107.mjs',
 'scripts/test-nullity-court-correspondence-v108.mjs',
 'scripts/test-court-decision-receipt-v109.mjs']);
const scripts=fs.readdirSync(path.join(root,'scripts')).filter(x=>/^verify-.*\.mjs$/.test(x)).sort();
for(const file of scripts)exec('legacy/'+file,node,['scripts/'+file]);
const npmOnWindows=process.platform==='win32';
const command=npmOnWindows?'cmd.exe':'npm';
const npmArgs=cmd=>npmOnWindows?['/d','/s','/c',cmd]:cmd.split(' ').slice(1);
exec('build-produccion',command,npmArgs('npm run build'));
if(strict){
  const r=exec('dependencias-externas',command,npmArgs('npm audit --omit=dev --json'));
  try{
    const text=r.combined.slice(r.combined.indexOf('{'));
    const audit=JSON.parse(text);
    const v=audit.metadata?.vulnerabilities||{};
    const flagged=Object.keys(audit.vulnerabilities||{});
    r.task.findingCounts={critical:v.critical||0,high:v.high||0,moderate:v.moderate||0,low:v.low||0,total:v.total||0};
    r.task.packages=flagged;
    r.task.ok=!audit.error&&r.task.findingCounts.critical===0&&r.task.findingCounts.high===0&&r.task.findingCounts.moderate===0;
    if(!r.task.ok) console.log('BLOQUEO seguridad: '+JSON.stringify(r.task.findingCounts));
  }catch(e){r.task.ok=false;r.task.error='No se pudo interpretar npm audit: '+e.message;}
}
const report={
 protocol:version,startedAt:started,completedAt:now(),gitRef,
 readOnly:true,strictDependencies:strict,checks:tasks.length,
 passed:tasks.filter(t=>t.ok).length,failed:tasks.filter(t=>!t.ok).length,
 tasks
};
fs.writeFileSync(outputFile,JSON.stringify(report,null,2)+'\n');
console.log('RESUMEN '+report.passed+'/'+report.checks+' verificaciones aprobadas');
if(report.failed)process.exitCode=1;
