import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const gate=read('AUDITORIA_PUERTA_CALIDAD_V163.json');
const tests=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
const audits=gate.tasks.filter(x=>x.name.startsWith('dependencias-'));
if(gate.passed!==28||gate.checks!==28||gate.failed!==0||tests!==1125||
 audits.length!==2||audits.some(x=>!x.ok||x.findingCounts?.total!==0))
 throw Error('V163 gate evidence invalid');
const inv=read('AUDITORIA_RPC_PRIVILEGIADAS_V162.json');
if(inv.total_security_definer!==208||inv.authenticated_directly_executable!==147||
 inv.partially_tested!==37||inv.pending_direct_authorization_review!==110)
 throw Error('Baseline V162 privilege inventory drift');
inv.protocol='V163';
inv.source='V162 privileged RPC catalog without backend changes. V163 only changes publication build gate and CI integration.';
inv.review_context='GitHub CI status required for exact Git commit before Vercel production Vite build; not a sacramental functional certification.';
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V163.json',JSON.stringify(inv,null,2)+'\n');

const timeline={
 baseline_approved_ci:{sha:'1375467e17716c8f1c552fc9fa76c4adacdcfdab',run:39960724584,expected:'accepted',actual:'accepted'},
 baseline_failed_ci:{sha:'ed37375ddc27b7bff3a390b680cc3c5dd34bbfc5',run:39711206303,expected:'blocked',actual:'blocked'},
 pull_request:{number:4,url:'https://github.com/JaiderHertur26/SACRAMENTUM_FINAL/pull/4',
   preview_status:'Ready',functional_ci:'success',dependency_ci:'success',merged:true},
 negative_drill:{pr:5,sha:'29be675',run:39964277481,ci_result:'failure',
  functional_ci:'failure',dependency_ci:'success',
  preview:'https://sacramentum-final-ebllx47gw-jaiderherreras-projects.vercel.app',
  preview_status:'Ready',production_after_drill:'b0d6228563cd54dcfebf4a992d0367b590eea25c',
  merged:false,closed:true,temporary_remote_branch_deleted:true},
 production:{
  sha:'b0d6228563cd54dcfebf4a992d0367b590eea25c',
  ci_run:39963410615,ci_result:'success',
  deployment:'https://sacramentum-final-k4y86a6zh-jaiderherreras-projects.vercel.app',
  canonical_domain:'https://sacramentum-final.vercel.app/',
  deployment_target:'production',deployment_status:'Ready',
  vercel_started_ci_check_utc:'2026-10-23T13:42:19.871Z',
  vercel_approved_ci_utc:'2026-10-23T13:42:56.276Z',
  vercel_started_vite_build_utc:'2026-10-23T13:42:57.106Z',
  domain_http:200,domain_has_spa_root:true,domain_has_vite_assets:true
 },
 exceptions:[
  'No intentional failing CI deployment was triggered in production. Historical failed CI commit was rejected with exit code 1 in local GitHub API check.',
  'Native Vercel Deployment Checks are not claimed enabled; protection is an application buildCommand gate.',
  'A user with project admin permissions can bypass/alter build settings or manually promote another artifact; enforce protected main, review requirements and optionally native checks.',
  'Role-authenticated browser E2E and true PostgreSQL simultaneous transaction tests remain pending.'
 ]
};
fs.writeFileSync('AUDITORIA_EVIDENCIAS_RELEASE_V163.json',JSON.stringify(timeline,null,2)+'\n');

const masterPath='AUDITORIA_MAESTRA_CONTROLES_V90.json';
const master=read(masterPath);
const notes={
 '06.06':'V163: inventario de 208 SECURITY DEFINER inalterado; proceso de publicación no amplió grants ni alteró Supabase.',
 '06.08':'V163: build prod gate comprueba repo JaiderHertur26/SACRAMENTUM_FINAL, rama main y Git SHA íntegro antes de permitir construir.',
 '20.02':'V163: despliegue controlado desde GitHub PR #4 con CI y Preview aprobados previo a merge en main.',
 '24.12':'V163: trazabilidad de publicación con SHA exacto, GitHub workflow run 39963410615, deployment URL y tres marcas horarias del gate.',
 '27.12':'V163: 208 RPC privilegiadas heredadas, sin ascender cobertura SQL por una mejora de CI.',
 '31.07':'V163: prueba de control de despliegue: CI éxito antiguo SHA 1375467 aceptado, fallo histórico ed37375 bloqueado (exit 1), sin mutación sacramental.',
 '31.10':'V163: no se crearon usuarios ni registros ficticios en Supabase y no se aplicaron migraciones.',
 '32.03':'V163: 18 pruebas nuevas de CI gate para SHA/branch/repo, pending/failure/cancelled, API 403 y previews. Total 1125/1125, gate 28/28.',
 '32.05':'V163: riesgo de producción previa a terminar CI mitigado por buildCommand fail-closed. Previews no se bloquean por CI push de main.',
 '32.06':'V163: GitHub PR #4 aprobada e integrada, CI push 39963410615 success, Vercel esperó y sólo tras APPROVED compiló y publicó Ready.',
 '32.07':'V163: auditoría npm prod+desarrollo sin vulnerabilidades, Vite build y CI funcional superados en GitHub Actions.',
 '32.08':'V163: simulacro negativo PR #5 falló en CI (39964277481) y sólo creó Preview, sin modificar la producción aprobada. No se forzó despliegue fallido directo a producción ni se activaron checks nativos. Concurrencia y E2E autenticada pendientes.'
};
let touched=0;
for(const c of master.controls){const note=notes[c.id];if(!note)continue;c.evidence??=[];
 if(c.id==='32.08')c.evidence=c.evidence.filter(x=>!String(x).startsWith('V163: test de fallo CI de despliegue extremo a extremo'));
 if(!c.evidence.includes(note))c.evidence.push(note);c.updated_at=new Date().toISOString();touched++;
}
fs.writeFileSync(masterPath,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const count={};for(const c of master.controls)count[c.status]=(count[c.status]||0)+1;
if(count.APROBADO!==10||count.EN_PROGRESO!==102||count.PENDIENTE!==213||(count.FALLIDO||0)!==0)
 throw Error('Master plan changed without certification');
const report=[
 '# SACRAMENTUM — V163 · CONTROL DE CI ANTES DE COMPILAR PRODUCCIÓN',
 '',
 'Fecha 2026-10-23 · repositorio https://github.com/JaiderHertur26/SACRAMENTUM_FINAL · Vercel https://sacramentum-final.vercel.app/',
 '',
 '## Defecto de lanzamiento identificado',
 'La V162 había publicado en Vercel antes de que los trabajos GitHub Actions terminaran; por defecto, un build correcto puede promocionarse aunque CI todavía no haya finalizado.',
 '',
 '## Solución efectiva',
 '- release-gate-v163.mjs consulta el flujo GitHub Actions **sacramentum-auditoria-v90.yml** para el SHA íntegro del commit de producción. Comprueba rama main, propietario y repositorio, proveedor GitHub y evento push.',
 '- Si falta identidad Git, si GitHub falla o se bloquea su API, si el CI falla/se cancela, o si la aprobación no aparece en la ventana de espera, el proceso termina en error y no ejecuta Vite build.',
 '- vercel.json ejecuta **node release-gate-v163.mjs && npm run build** en todos los deploys. En Preview y local, el gate informa que no se está intentando promover producción y continúa.',
 '- No se añadieron secretos, migraciones Supabase o permisos de datos, y no se debilitó la protección de vistas previas.',
 '',
 '## Pruebas y evidencia local',
 '- 18 pruebas unitarias nuevas de roles de despliegue, SHA exacto, GitHub workflow, branch, event, pending/queued, fail, cancel, 403, API inválida, fallos por deadline y Preview local.',
 '- Control real sobre GitHub: SHA 1375467 con CI OK autorizó; SHA ed37375 con CI failure fue rechazado con exit code 1.',
 '- Puerta calidad V163: '+tests+'/'+tests+' pruebas sintéticas, '+gate.passed+'/'+gate.checks+' verificaciones, npm audit producción+total cero vulnerabilidades reportadas.',
 '',
 '## Prueba de Vercel con CI real',
 '- PR #4: vista previa Ready, pruebas funcionales y dependencias GitHub PASS; integrada a main.',
 '- Simulacro NEGATIVO PR #5: un único test falló a propósito en rama temporal; GitHub Actions #39964277481 terminó failure (funcionales failure; dependencias success). Vercel generó Preview Ready, pero ninguna promoción a producción. PR cerrada SIN merge y rama temporal local/remota borrada.',
 '- Nuevo merge SHA b0d6228563cd54dcfebf4a992d0367b590eea25c, CI push run 39963410615: success.',
 '- Vercel Production comenzó comprobación CI a 2026-10-23T13:42:19.871Z, confirmó APPROVED a 2026-10-23T13:42:56.276Z e inició Vite build a 2026-10-23T13:42:57.106Z. Deployment final Ready.',
 '- Sitio canónico https://sacramentum-final.vercel.app/ devuelve HTTP 200 y HTML con root SPA y assets Vite. Producción no fue degradada.',
 '',
 '## Estado administrativo y límites',
 '- Master '+JSON.stringify(count)+', evidencias añadidas a '+touched+' controles sin elevar calificaciones artificiales.',
 '- Inventario SECURITY DEFINER '+inv.total_security_definer+', autenticadas '+inv.authenticated_directly_executable+', parcialmente revisadas '+inv.partially_tested+', pendientes '+inv.pending_direct_authorization_review+'.',
 '- El mecanismo es un gate de **compilación** respaldado por GitHub, no una afirmación de que la opción nativa Vercel Deployment Checks esté habilitada.',
 '- No se lanzó un SHA fallido como producción real, para evitar impacto: la denegación del gate se probó contra SHA histórico fallido y el simulacro negativo PR #5 sólo originó Preview. No equivalen a un intento real de despliegue productivo de CI fallido.',
 '- Continúan pendientes pruebas E2E físicas con sesiones reales y concurrencia PostgreSQL con dos conexiones y barrera.',
 '',
 '**Dictamen:** control de producción aprobado en flujo real (espera de CI y compilación posterior), con límites residuales documentados.'
];
fs.writeFileSync('AUDITORIA_PUBLICACION_CONTROLADA_V163_2026-10-23.md',report.join('\n')+'\n');
console.log('V163 registered '+tests+' synthetics '+gate.passed+'/'+gate.checks+', master '+touched+' controls');
