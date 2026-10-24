import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const gate=read('AUDITORIA_PUERTA_CALIDAD_V181.json');
const tests=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
if(tests!==1415||gate.checks!==28||gate.passed!==28||gate.failed!==0||gate.tasks.some(x=>!x.ok))
 throw Error('V181 quality gate incomplete');
const masterFile='AUDITORIA_MAESTRA_CONTROLES_V90.json',master=read(masterFile);
const evidence={
 '06.06':'V181 P0: authenticated actor WITHOUT user_profiles called set_managed_user_active and update_managed_user_profile on another fictional parish profile due NULL NOT IN manager guard. Suspended diocese actor disabled fake parish target. Full rollback.',
 '06.07':'V181: four SQL privileged functions hardened to require explicitly ACTIVE profile, real PostgreSQL 4 legitimate actor flows and 28 negative cases PASSED in BEGIN/ROLLBACK.',
 '20.02':'V181: profileless authenticated actor could deactivate and reassign another fictitious parish account; a SUSPENDED diocese actor also bypassed admin guard. Now actor role NULL denied. Real session-revocation E2E remains open.',
 '32.03':'V181: 22 new test contracts, 1415/1415 synthetic tests and 28/28 strict quality gates with production build, CSS and full dependency audits.',
 '32.07':'V181: baptism and confirmation physical book settings now require is_active TRUE/status ACTIVE and ownership. Anchored SQL migration preserves sequencing and existing audit. Real 4 positives/28 negatives verified.'
};
for(const [id,note] of Object.entries(evidence)){
 const c=master.controls.find(x=>x.id===id);if(!c)throw Error('Missing control '+id);
 c.evidence??=[];if(!c.evidence.includes(note)){c.evidence.push(note);c.updated_at=new Date().toISOString();}
}
const counts={};for(const c of master.controls)counts[c.status]=(counts[c.status]||0)+1;
if(master.controls.length!==325||counts.APROBADO!==10||counts.EN_PROGRESO!==117||counts.PENDIENTE!==198)
 throw Error('Master status drift '+JSON.stringify(counts));
fs.writeFileSync(masterFile,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const results={
 protocol:'V181',dateColombia:'2026-10-23',
 migration:'20261024010301_fail_closed_management_and_sacrament_params_v181.sql',
 priority:'P0',finding:'Profileless authenticated actor could disable and reassign another fictional parish account due to NULL NOT IN manager guard. SUSPENDED diocese and SUSPENDED parish also bypassed selected privileged guards.',
 functions:['set_managed_user_active','update_managed_user_profile','save_baptism_parameters','save_confirmation_parameters'],
 realPostgresTemporary:{positive:4,denied:28,rollback:true},
 realPostgresPermanent:{migrationInstalled:true,positive:4,denied:28,rollback:true,guardedFunctions:4,nullSafeManagerFunctions:2,zeroQaUsers:true,zeroQaProfiles:true},
 legacyRegressionScriptsPassed:['qa-rollback-shadow-role-matrix-v124.sql','qa-rollback-physical-confirmation-source-v134.sql','qa-rollback-manual-note-admin-role-v133.sql','qa-rollback-documentary-v114.sql'],
 synthetic:tests,qualityGates:28,qaPermanentData:false,masterCounts:counts,
 limits:['No independent authenticated browser sessions between dioceses','No two physically concurrent PostgreSQL sessions','No full application authenticated E2E']
};
fs.writeFileSync('AUDITORIA_PERMISOS_USUARIOS_V181.json',JSON.stringify(results,null,2)+'\n');
const doc=[
 '# SACRAMENTUM FINAL · V181 | Administración de cuentas y libros',
 '',
 'Fecha Colombia: 23 de octubre de 2026. Carpeta: C:\\SACRAMENTUM\\SACRAMENTUM_FINAL.',
 '',
 '## P0 reproducido',
 'Una sesión autenticada ficticia SIN perfil institucional desactivó y reasignó otra cuenta parroquial ficticia mediante set_managed_user_active y update_managed_user_profile. La causa fue SQL NULL NOT IN que no hace verdadero el IF de denegación.',
 'Una cuenta diocesana SUSPENDED también desactivó otro usuario ficticio. Una parroquia SUSPENDED alcanzó el control de versión de numeración física en save_baptism_parameters y save_confirmation_parameters.',
 'Todos los casos fueron realizados con actores y objetivos ficticios dentro de BEGIN/ROLLBACK, sin efecto persistente sobre personas, partidas o libros reales.',
 '',
 '## Corrección',
 'La migración oficial 20261024010301_fail_closed_management_and_sacrament_params_v181.sql, instalada en Supabase, modifica de forma estricta el control de is_active IS TRUE y upper(status)=ACTIVE en cuatro funciones privilegiadas, y en las dos administrativas exige explícitamente v_actor_role IS NULL como error de autorización.',
 'No toca registros existentes, nombres, relaciones, consecutivos, auditoría o reglas de negocio de los mismos procedimientos.',
 '',
 '## QA',
 'Postpatch reversible: 4 operaciones autorizadas (dos acciones efectivas en un perfil falso y dos verificaciones positivas del acceso a la validación de versión de libros). 28/28 operaciones de identidad/rol no autorizados expresamente rechazadas. Las denegaciones no alteraron los cambios autorizados sobre el perfil ficticio.',
 'Tras instalar la migración definitiva en Supabase, volvió a aprobar 4/4 operaciones legítimas y 28/28 denegaciones. Cuatro funciones y dos controles especiales de rol NULL quedaron verificados. Se detectaron cero usuarios/perfiles ficticios residuales y cero estados ambiguos existentes.',
 'Aprobaron además cuatro regresiones SQL reales reversibles: matriz de roles, Confirmación física, nota administrativa y documentación.',
 '22 pruebas de contrato nuevas. 1415/1415 pruebas sintéticas y 28/28 controles de calidad, build CSS y dependencias.',
 '',
 '## Límites',
 'No equivale a E2E autenticado de sesiones independientes de dos diócesis ni a dos transacciones PostgreSQL concurrentes físicas. Estos riesgos continúan abiertos.',
 'Plan maestro de 325 controles: 10 APROBADO, 117 EN_PROGRESO, 198 PENDIENTE.',
 '',
 'La migración y las regresiones postinstalación ya se verificaron. Pendiente: aprobar CI definitivo de la PR, fusionar en main y comprobar mismo commit publicado por Vercel.'
];
fs.writeFileSync('AUDITORIA_SEGURIDAD_USUARIOS_V181_2026-10-23.md',doc.join('\n')+'\n');
console.log('V181 recorded '+tests+' Node tests, 28 gates, 4 positive 28 blocked; '+JSON.stringify(counts));
