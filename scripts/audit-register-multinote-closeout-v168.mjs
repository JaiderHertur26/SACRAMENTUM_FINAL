import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read=path=>JSON.parse(fs.readFileSync(path,'utf8'));
const gate=read('AUDITORIA_PUERTA_CALIDAD_V168.json');
const n=Number(gate.tasks.find(t=>t.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
const deps=gate.tasks.filter(t=>t.name.startsWith('dependencias-'));
if(n!==1217||gate.passed!==28||gate.checks!==28||gate.failed!==0||
 deps.length!==2||deps.some(t=>!t.ok||t.findingCounts?.total!==0))
 throw Error('V168 full local quality gate is not complete: '+JSON.stringify({tests:n,checks:gate.passed+'/'+gate.checks}));
const rpc=read('AUDITORIA_RPC_PRIVILEGIADAS_V168.json');
if(rpc.total_security_definer!==210||rpc.authenticated_directly_executable!==149||
 rpc.partially_tested!==46||rpc.pending_direct_authorization_review!==103)
 throw Error('V168 privileged RPC inventory does not reconcile');

const evidenceById={
 '02.02':'V168: nueva conciliación por lotes probada en Bautismo, Confirmación, Matrimonio y Exequias; cubre reversión de dos notas, no la certificación canónica integral de correcciones/reposiciones.',
 '06.06':'V168: SECURITY DEFINER nuevo con comprobación rol Cancillería/diocésis/parroquia, sin EXECUTE anon; inventario total 210, auth 149, evidencia parcial 46 y 103 revisiones pendientes.',
 '07.06':'V168: transacción única revierte 2 notas y 1 decreto y cierra 2 expedientes, o falla sin cambios; seis auditorías de expedientes y una notificación consolidada por caso.',
 '07.08':'V168: nueva RPC bloquea filas de expedientes, decreto y notas con FOR UPDATE; falta disputa de dos conexiones reales y medir deadlocks.',
 '08.11':'V168: dos notas independientes sobre reposición de Bautismo con autorizaciones episcopales individuales se concilian con una reversión; SQL BEGIN/ROLLBACK.',
 '09.11':'V168: dos notas independientes sobre reposición de Confirmación con autorizaciones episcopales individuales se concilian con una reversión; SQL BEGIN/ROLLBACK.',
 '10.09':'V168: reposición matrimonial con dos notas independientes se reconcilia en transacción única; siete solicitudes inválidas/inapropiadas rechazadas.',
 '11.09':'V168: exequias con dos notas independientes y dos autorizaciones diocesanas reconciliadas de manera atómica, con auditores/notificación.',
 '14.01':'V168: cuatro partidas de laboratorio con dos notas por partida y ninguna duplicación persistente; tipos obligatorios y asociaciones futuras requieren pruebas adicionales.',
 '14.09':'V168: por cada lote se trazan individualmente nota y expediente; resultado 6 eventos de expediente y una notificación consolidada por decreto.',
 '16.12':'V168: reproducción del bloqueo previo y QA posterior de lote ejecutadas con BEGIN/ROLLBACK sin residuo en base real.',
 '17.09':'V168: validaciones de lote de 2 a 30 IDs únicos, mismo decreto/parroquia/diócesis, snapshot coherente y cierre atómico sin doble ejecución.',
 '27.03':'V168: rol Cancillería ejecuta, Diócesis sólo autoriza y no ejecuta; no se concedieron privilegios directos a anon ni tablas privadas.',
 '31.07':'V168: matriz SQL reversible de 4 sacramentos, dos notas y aprobaciones independientes por cada decreto; un solo evento jurídico de reversión.',
 '31.08':'V168: reintento de lote ya ejecutado rechazado; faltan pruebas físicas de doble clic con red caída y dos transacciones simultáneas.',
 '31.10':'V168: 0 decretos/notas/casos/notificaciones QA-V168 residuales, 0 RPC temporal qa_v168_lock_probe; preservada información real.',
 '32.03':'V168: 22 tests contractuales nuevos, '+n+'/'+n+' tests totales (GitHub CI #39982084560 y puerta local), '+gate.passed+'/'+gate.checks+' verificadores.',
 '32.05':'V168: hallazgo P0 #12 de conciliación múltiple corregido con RPC versionada y UI Cancillería; dos notas autorizadas ya no bloquean reversión conjunta.',
 '32.06':'V168: migración Supabase aplicada 20261023154826; probado de nuevo contra la función instalada y Vercel publicó tras CI de commit 32dfdbb.',
 '32.07':'V168: 1217/1217 test sintéticos, 28/28 Quality Gate, CSS, Vite build y npm audit prod+completo sin vulnerabilidades reportadas.',
 '32.08':'V168: conteos verificados: 4 sacraments × 2 notas, 6 auditorías y 1 notificación por lote, cero QA después de ROLLBACK; concurrencia física no certificada.',
 '32.09':'V168: GitHub main commit 32dfdbb pasó CI #39982084560 y estado Vercel success en el mismo SHA.',
 '32.10':'V168: cierre parcial de bug multi-nota; no se declara certificación jurídica, transaccional concurrente ni E2E con dos diócesis reales.'
};

const file='AUDITORIA_MAESTRA_CONTROLES_V90.json',master=read(file);
const progressIds=new Set(['02.02','08.11','09.11','14.01']);
let touched=0,promoted=0;
for(const c of master.controls){
 const note=evidenceById[c.id];
 if(!note)continue;
 c.evidence??=[];
 if(!c.evidence.includes(note))c.evidence.push(note);
 if(progressIds.has(c.id)&&c.status==='PENDIENTE'){c.status='EN_PROGRESO';promoted++}
 c.updated_at=new Date().toISOString();touched++;
}
if(touched!==Object.keys(evidenceById).length)throw Error('Missing master controls '+touched);
if(promoted!==4 && promoted!==0)throw Error('Expected 4 newly reviewed control states (or idempotent 0)');
const counts={};for(const c of master.controls)counts[c.status]=(counts[c.status]||0)+1;
if(counts.APROBADO!==10||counts.EN_PROGRESO!==117||counts.PENDIENTE!==198||
 master.controls.length!==325)throw Error('Master control status drift '+JSON.stringify(counts));
fs.writeFileSync(file,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});

const reportFile='AUDITORIA_CONCILIACION_MULTINOTA_V168_2026-10-23.md';
let report=fs.readFileSync(reportFile,'utf8');
const closing=
 '## Verificación final y publicación V168\n\n'+
 '- GitHub PR #13 integrada en main, commit `32dfdbb94a856a811ea136d43e66b95a477f4e55`.\n'+
 '- GitHub Actions run #39982084560: 1217 pruebas, 0 fallos; funcional y dependencias success.\n'+
 '- Vercel registró success para ese commit; publicación protegida por el gate V163.\n'+
 '- Migración aplicada permanentemente en Supabase con versión `20261023154826` y ambas pruebas ejecutadas nuevamente contra la RPC instalada.\n'+
 '- Confirmados: auth EXECUTE true, anon EXECUTE false, SECURITY DEFINER true, sin residuos ficticios de decretos, notas, expedientes ni notificaciones, y sin RPC temporal.\n'+
 '- Gate local V168: 1217 pruebas sintéticas y 28/28 controles, dependencias sin vulnerabilidades reportadas.\n'+
 '- Plan maestro: 325 controles, 10 APROBADO, 117 EN_PROGRESO, 198 PENDIENTE. Cuatro controles adicionales elevados sólo a revisión parcial.\n'+
 '- Límites vigentes: falta prueba de concurrencia con dos transacciones Postgres superpuestas y E2E de roles realmente distintos.\n\n';
if(!report.includes('## Verificación final y publicación V168')){
 report=report.replace('## Seguridad, límites y publicación',closing+'## Seguridad, límites y publicación');
}
report=report.replace('- La aplicación no debe llegar a producción hasta que la rama supere compilación, pruebas contractuales y auditoría de dependencias en GitHub; la barrera V163 exige aprobación del mismo commit en Vercel.',
 '- Completado: GitHub Actions aprobó el mismo commit y Vercel confirmó publicación sucesiva protegida por V163.');
report=report.replace('**Dictamen:** defecto multinota reproducido y mecanismo de lote verificado reversiblemente en los cuatro sacramentos; el cierre definitivo requiere CI y despliegue verificados. La auditoría integral sigue abierta.',
 '**Dictamen V168:** defecto multinota reproducido y reparado; RPC migrada, comprobada en los cuatro sacramentos y publicada tras CI. Auditoría integral y concurrencia física permanecen abiertas.');
fs.writeFileSync(reportFile,report,'utf8');

const closure={
 protocol:'V168',
 date:'2026-10-23',
 sha:'32dfdbb94a856a811ea136d43e66b95a477f4e55',
 pull_request:'https://github.com/JaiderHertur26/SACRAMENTUM_FINAL/pull/13',
 github_ci:'https://github.com/JaiderHertur26/SACRAMENTUM_FINAL/actions/runs/39982084560',
 github_ci_result:'success',
 vercel_state_for_same_sha:'success',
 production_smoke:{canonical:'https://sacramentum-final.vercel.app/',http_status:200,html_title:'Sacramentum | Registro Sacramental',vite_assets_present:true,vercel_deployment:'https://sacramentum-final-31zdupozz-jaiderherreras-projects.vercel.app',deployment_target:'Production',deployment_status:'Ready'},
 vercel_project:'https://vercel.com/jaiderherreras-projects/sacramentum-final',
 supabase_migration:'20261023154826_batch_later_note_reconciliation_v168',
 database_tests:['scripts/qa-rollback-two-later-notes-repro-v168.sql',
 'scripts/qa-rollback-multinote-batch-v168.sql',
 'scripts/qa-rollback-multinote-four-sacraments-v168.sql'],
 database_tests_passed:true,
 post_qa_residue:{decrees:0,marginal_notes:0,reconciliation_cases:0,official_notifications:0,temporary_lock_probe:0},
 roles:'chancery executes; diocese independently authorizes',
 sacraments:['bautismo','confirmacion','matrimonio','exequias'],
 notes_per_case:2,
 audits_per_case:6,
 consolidated_notifications_per_decree:1,
 test_results:{synthetic_total:n,synthetic_failures:0,quality_gate_pass:gate.passed,quality_gate_total:gate.checks},
 plan:{approved:10,in_progress:117,pending:198,total:325},
 privileges:{security_definer:210,authenticated_executable:149,partially_tested:46,manual_pending:103},
 pending:[
  'two physically overlapping PostgreSQL sessions with NOWAIT/lock wait and one-winner semantics',
  'browser E2E with two genuine diocesan authenticated sessions',
  'full ecclesiastical legal and print-document certification'
 ]
};
fs.writeFileSync('AUDITORIA_CIERRE_PUBLICACION_V168.json',JSON.stringify(closure,null,2)+'\n');
console.log('V168 CIERRE: '+n+' tests; '+gate.passed+'/'+gate.checks+' gate; '+JSON.stringify(counts));
