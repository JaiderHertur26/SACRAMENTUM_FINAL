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
 'scripts/test-court-decision-receipt-v109.mjs',
 'scripts/test-dual-control-court-receipts-v110.mjs',
 'scripts/test-migration-provenance-v112.mjs',
 'scripts/test-complete-fictional-decree-matrix-v114.mjs',
 'scripts/test-register-effects-migrations-v116.mjs',
 'scripts/test-legacy-decrees-v118.mjs',
 'scripts/test-browser-and-historical-rls-v120.mjs',
 'scripts/test-physical-provenance-rls-v121.mjs',
 'scripts/test-rpc-hardening-v123.mjs',
 'scripts/test-shadow-role-authority-v124.mjs',
 'scripts/test-matrimonial-scope-and-historical-import-v126.mjs',
 'scripts/test-tailwind4-dependency-remediation-v127.mjs',
 'scripts/test-nullity-institutional-preflight-v130.mjs',
 'scripts/test-nullity-browser-v131.mjs',
 'scripts/test-marginal-receipt-authority-v133.mjs',
 'scripts/test-physical-notification-guard-v134.mjs',
 'scripts/test-stale-registral-reversals-v135.mjs',
 'scripts/test-stale-baptism-confirmation-v136.mjs',
 'scripts/test-later-linked-decree-v137.mjs',
 'scripts/test-unique-reversal-audit-snapshot-v138.mjs',
 'scripts/test-official-notification-and-print-v139.mjs',
 'scripts/test-registry-print-marginal-integrity-v140.mjs',
 'scripts/test-print-receipt-consistency-v142.mjs',
 'scripts/test-stale-print-coordinates-v143.mjs',
 'scripts/test-print-request-lineage-v146.mjs',
 'scripts/test-monotonic-sacrament-version-v148.mjs',
 'scripts/test-registry-version-microseconds-v149.mjs',
 'scripts/test-parish-authorization-fail-closed-v150.mjs',
 'scripts/test-legacy-materializer-role-scope-v151.mjs',
 'scripts/test-rpc-inventory-reconciliation-v151.mjs',
 'scripts/test-documentary-decree-lifecycle-v152.mjs',
 'scripts/test-baptism-confirmation-decree-integrity-v153.mjs',
 'scripts/test-independent-marginal-note-chain-v154.mjs',
 'scripts/test-marriage-funeral-independent-notes-v155.mjs',
 'scripts/test-later-note-institutional-reconciliation-v156.mjs',
 'scripts/test-later-note-rejection-revocation-v157.mjs',
 'scripts/test-chancery-picker-rls-v158.mjs',
 'scripts/test-reconciliation-all-sacraments-v159.mjs',
 'scripts/test-browser-reconciliation-v160.mjs',
 'scripts/test-reconciliation-keyset-v161.mjs',
 'scripts/test-session-isolation-v162.mjs',
 'scripts/test-release-gate-v163.mjs',
 'scripts/test-chat-session-isolation-v164.mjs',
 'scripts/test-chat-message-order-lifecycle-v165.mjs',
 'scripts/test-chat-history-keyset-v166.mjs',
 'scripts/test-reconciliation-conflicting-transitions-v167.mjs',
 'scripts/test-multinote-batch-v168.mjs',
 'scripts/test-reconciliation-session-guards-v169.mjs',
 'scripts/test-reconciliation-sensitive-ui-v170.mjs',
 'scripts/test-notification-archive-active-profile-v171.mjs',
 'scripts/test-bishop-tenure-jurisdiction-v172.mjs',
 'scripts/test-historical-active-parish-v173.mjs',
 'scripts/test-complete-sql-inventory-v174.mjs',
 'scripts/test-anonymous-perimeter-v175.mjs',
 'scripts/test-fail-closed-institutional-identity-v176.mjs',
 'scripts/test-pending-sacrament-authorization-v177.mjs',
 'scripts/test-seating-scope-v178.mjs',
 'scripts/test-chancery-decree-fail-closed-v179.mjs',
 'scripts/test-chat-notification-fail-closed-v180.mjs',
 'scripts/test-managed-access-physical-params-v181.mjs',
 'scripts/test-juridical-reconciliation-identity-v182.mjs',
 'scripts/test-production-secrets-v183.mjs',
 'scripts/test-authorization-metadata-v184.mjs',
 'scripts/test-foreign-key-contract-v185.mjs',
 'scripts/test-institutional-branding-v186.mjs',
 'scripts/test-numbering-integrity-v188.mjs']);
const scripts=fs.readdirSync(path.join(root,'scripts')).filter(x=>/^verify-.*\.mjs$/.test(x)).sort();
for(const file of scripts)exec('legacy/'+file,node,['scripts/'+file]);
const npmOnWindows=process.platform==='win32';
const command=npmOnWindows?'cmd.exe':'npm';
const npmArgs=cmd=>npmOnWindows?['/d','/s','/c',cmd]:cmd.split(' ').slice(1);
exec('build-produccion',command,npmArgs('npm run build'));
exec('frontera-secretos-build-v183',node,['scripts/audit-production-secrets-v183.mjs']);
exec('css-critico',node,['scripts/check-critical-css-v91.mjs']);
if(strict){
  // Exige cero vulnerabilidades en runtime Y herramientas de desarrollo.
  // Los reportes contienen evidencia de conteos y paquetes, nunca credenciales.
  for(const [name,cmd] of [
    ['dependencias-produccion','npm audit --omit=dev --json'],
    ['dependencias-completas','npm audit --json']
  ]){
    const r=exec(name,command,npmArgs(cmd));
    try{
      const text=r.combined.slice(r.combined.indexOf('{'));
      const audit=JSON.parse(text);
      const v=audit.metadata?.vulnerabilities||{};
      const flagged=Object.keys(audit.vulnerabilities||{});
      r.task.findingCounts={
        critical:v.critical||0,high:v.high||0,moderate:v.moderate||0,
        low:v.low||0,info:v.info||0,total:v.total||0
      };
      r.task.packages=flagged;
      r.task.ok=!audit.error&&r.task.exitCode===0&&r.task.findingCounts.total===0;
      if(!r.task.ok)console.log('BLOQUEO seguridad '+name+': '+JSON.stringify(r.task.findingCounts));
    }catch(e){r.task.ok=false;r.task.error='No se pudo interpretar npm audit: '+e.message;}
  }
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
