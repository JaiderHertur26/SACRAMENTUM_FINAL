// V175 — Audit registration based strictly on completed browser, REST and CI-local results.
import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const gate=read('AUDITORIA_PUERTA_CALIDAD_V175.json');
const local=read('AUDITORIA_RUTAS_ANONIMAS_V175.json');
const prod=read('AUDITORIA_RUTAS_PRODUCCION_V175.json');
const api=read('AUDITORIA_DATA_API_ANONIMA_V175.json');
const n=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
if(n!==1292||gate.passed!==28||gate.checks!==28||gate.failed!==0||gate.tasks.some(x=>!x.ok)||
 local.passed!==107||prod.passed!==107||local.failed||prod.failed||api.checks!==15||api.privateRowsSeen||api.unverified)
 throw Error('V175 audit gates incomplete, cannot register');
const masterFile='AUDITORIA_MAESTRA_CONTROLES_V90.json';
const master=read(masterFile);
const evidence={
 '03.07':'V175: Chrome with a completely fresh anonymous profile tested 107 actual React routes on production Vercel and local Vite. 58 protected and 49 aliases all redirected to login without browser exceptions. Does NOT cover authenticated UI.',
 '06.07':'V175: fifteen real HTTPS PostgREST anonymous requests against private tables returned HTTP 401 / SQL 42501, zero private rows; the published client key was recognized. RLS with real sessions across two dioceses still pending.',
 '20.02':'V175: no-session navigation of 107 routes redirected correctly in browser. Authenticated role switching and token revocation were not physically re-certified.',
 '32.03':'V175: new 7-case regression test validates live-browser snapshots and anonymous Data API evidence, 1292/1292 synthetic suite, all 28 quality gates.',
 '32.07':'V175: local build and production 107/107 route check; performance/security advisors identified pending remediation, not falsely claimed as 0 vulnerabilities.'
};
for(const [id,note] of Object.entries(evidence)){
 const c=master.controls.find(x=>x.id===id);if(!c)throw Error('Unknown master control '+id);
 c.evidence??=[];if(!c.evidence.includes(note)){c.evidence.push(note);c.updated_at=new Date().toISOString();}
}
const counts={};for(const c of master.controls)counts[c.status]=(counts[c.status]||0)+1;
if(master.controls.length!==325||counts.APROBADO!==10||counts.EN_PROGRESO!==117||counts.PENDIENTE!==198)
 throw Error('Master drift '+JSON.stringify(counts));
fs.writeFileSync(masterFile,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const ledger={
 protocol:'V175',date:'2026-10-23',path:'C:\\SACRAMENTUM\\SACRAMENTUM_FINAL',
 localBrowser:{routes:107,passed:107,protected:58,aliases:49,exceptions:0},
 productionBrowser:{routes:107,passed:107,protected:58,aliases:49,exceptions:0,environment:'https://sacramentum-final.vercel.app'},
 realAnonymousRest:{resources:15,permissionDenied:15,unexpectedPrivateRows:0,expectedSqlCode:'42501'},
 automaticTests:{synthetic:n,strictGates:gate.passed},
 priorV174ActiveSqlRegressions:75,
 physicalConcurrency:{
  attemptedWithDistinctManagedSqlCalls:true,
  overlapObserved:false,
  result:'NO_PHYSICAL_OVERLAP; no evidence of race tested',
  directCliAttempt:'Supabase db query --linked was rejected by management API (403), did not obtain two physical direct connections'
 },
 securityAdvisorsCurrent:{
  rlsTablesIntentionallyWithoutPolicies:3,
  graphqlObjectsVisibleToAuthenticatedRole:64,
  definerFunctionsCallableByAuthenticated:146,
  leakedPasswordProtectionConfigurationWarnings:1,
  unindexedForeignKeys:26,
  unusedIndexes:93
 },
 limitations:['No actual login of two independent diocesan users','No real browser CRUD across all roles and sacraments','No overlapping transactions on two independent PostgreSQL connections','Advisors are broad warnings, not proof of 146 exploitable vulnerabilities','No high load/performance or disaster recovery benchmark']
};
fs.writeFileSync('AUDITORIA_CONSOLIDADO_V175.json',JSON.stringify(ledger,null,2)+'\n');
const doc=[
 '# SACRAMENTUM — Auditoría extrema V175: perímetro real y rutas privadas',
 '',
 'Fecha: 23 de octubre de 2026. Ruta: C:\\SACRAMENTUM\\SACRAMENTUM_FINAL.',
 '',
 '## Pruebas ejecutadas por la auditoría',
 '',
 '**Local:** 107 de 107 rutas React navegadas con Chrome real sin sesión, 58 protegidas y 49 redirecciones, todas terminaron en el login. Cero excepciones JS observadas y sin desbordamiento horizontal en los viewports ensayados.',
 '**Producción Vercel:** el mismo barrido de 107 de 107 rutas directamente sobre https://sacramentum-final.vercel.app, sin sesión ni cookies previas; resultado aprobado.',
 '**API real Supabase:** 15 endpoints privados consultados con la clave pública y sin sesión; todos denegados HTTP 401 código PostgreSQL 42501 (no clave inválida), sin obtener filas sacramentales ni institucionales.',
 '**Puerta de calidad:** 1.292/1.292 pruebas sintéticas y 28/28 verificaciones estrictas, build, CSS y auditorías de dependencias.',
 '**Cobertura SQL acumulada anterior:** 75 de 75 regresiones actuales vigentes, documentadas en V174.',
 '',
 '## Hallazgos y riesgos que permanecen abiertos',
 '',
 'La CLI Supabase del computador devolvió HTTP 403 al intentar conexión directa. Dos consultas SQL concurrentes a través de Management API no demostraron un mismo bloqueo transaccional observado en dos backends. NO se certifica todavía la concurrencia física.',
 'La versión publicada aún necesita auditoría E2E con inicios de sesión separados de dos diócesis y revisión funcional autenticada en todas las pantallas y formularios. La prueba de rutas anónimas no sustituye esas comprobaciones.',
 'El asesor oficial de Supabase devolvió: 3 tablas RLS intencionalmente sin políticas (INFO); 64 objetos detectados como visibles en esquema GraphQL para authenticated (WARN); 146 funciones SECURITY DEFINER ejecutables por authenticated (WARN); una advertencia de protección ante contraseñas filtradas; 26 claves foráneas sin índice y 93 índices marcados sin uso. Son ALERTAS A REVISAR por caso, no evidencia de que todos los objetos sean vulnerables o que los índices puedan eliminarse indiscriminadamente.',
 'Se priorizan la configuración de contraseñas filtradas, la revisión individual de funciones privilegiadas y el análisis medido de índices. No se cambiaron credenciales ni datos de producción.',
 '',
 '## Metodología y límites',
 '',
 'Se usaron Chrome con perfil anónimo nuevo, el build local de producción y el despliegue público Vercel. El examen REST usó únicamente la clave pública sin revelar su valor. No se copiaron tokens reales de usuario; la información privada no se exportó.',
 'Los resultados están en AUDITORIA_RUTAS_ANONIMAS_V175.json, AUDITORIA_RUTAS_PRODUCCION_V175.json, AUDITORIA_DATA_API_ANONIMA_V175.json, AUDITORIA_CONSOLIDADO_V175.json y AUDITORIA_PUERTA_CALIDAD_V175.json.',
 '',
 'El plan maestro conserva 325 controles: 10 aprobados, 117 en progreso y 198 pendientes. La certificación total de la aplicación sigue abierta.'
];
fs.writeFileSync('AUDITORIA_PERIMETRO_V175_2026-10-23.md',doc.join('\n\n')+'\n');
console.log('V175 registered: '+n+'/1292 Node, 28/28 gates, 107/107 local, 107/107 live, 15/15 deny, '+JSON.stringify(counts));
