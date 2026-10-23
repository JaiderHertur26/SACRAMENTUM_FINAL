// V172 · Register verified observations from Oct 23 real database/CI runs.
// This ledger distinguishes real SQL success, blocked experiments and untested scopes.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const gate=read('AUDITORIA_PUERTA_CALIDAD_V172.json');
const synthetic=Number(gate.tasks.find(t=>t.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
if(synthetic!==1262||gate.checks!==28||gate.passed!==28||gate.failed!==0||gate.tasks.some(x=>!x.ok))
 throw Error('V172 quality gate incomplete');
const passed=[
 'qa-rollback-multinote-four-sacraments-v168.sql',
 'qa-rollback-chat-full-lifecycle-v165.sql',
 'qa-rollback-registry-print-four-sacraments-v141.sql',
 'qa-rollback-monotonic-version-all-sacraments-v148.sql',
 'qa-rollback-cross-diocese-rls-v120.sql',
 'qa-rollback-decree-role-matrix-v115.sql',
 'qa-rollback-legacy-materializer-roles-v151.sql',
 'qa-rollback-nullity-dual-authorization-v128.sql',
 'qa-rollback-physical-notification-scope-v134.sql',
 'qa-rollback-documentary-decree-lifecycle-v152.sql',
 'qa-rollback-chat-keyset-complete-v166.sql',
 'qa-rollback-baptism-confirmation-integrity-v153.sql',
 'qa-rollback-cross-parish-notes-receipts-v133.sql',
 'qa-rollback-nullity-preflight-cross-diocese-v130.sql',
 'qa-rollback-physical-provenance-rls-v121.sql',
 'qa-rollback-multinote-batch-v168.sql',
 'qa-rollback-chat-role-rls-v164.sql',
 'qa-rollback-physical-notification-source-status-v134.sql',
 'qa-rollback-reconciliation-keyset-v161.sql',
 'qa-rollback-historical-decrees-v118.sql',
 'qa-rollback-destructive-grants-v122.sql'
];
const blocked=[
 'qa-rollback-corrections-reconciliation-all-sacraments-v159.sql',
 'qa-rollback-registry-print-integrity-v140.sql'
];
const all=fs.readdirSync('scripts').filter(x=>/^qa-rollback-.*\.sql$/.test(x));
const separatelyVerified=['qa-rollback-bishop-tenure-cross-diocese-repro-v172.sql','qa-rollback-bishop-tenure-jurisdiction-v172.sql'];
if(new Set([...passed,...blocked]).size!==23||!passed.every(x=>all.includes(x))||
 !blocked.every(x=>all.includes(x))||!separatelyVerified.every(x=>all.includes(x))) throw Error('SQL evidence inventory drift');
const ledger={
 protocol:'V172',
 date:'2026-10-23',
 database:'REGISTRO SACRAMENTOS · Supabase',
 scope:'Tests actually executed via managed SQL connection, each with BEGIN/ROLLBACK; not full application acceptance.',
 staticSyntheticPassed:synthetic,strictGatesPassed:28,
 sqlRollbackScriptsAvailable:all.length,
 sqlRollbackPassed:passed.length,
 sqlRollbackBlockedBySafety:blocked.length,
 sqlRollbackVerifiedSeparately:separatelyVerified.length,
 sqlRollbackVerifiedSeparatelyFiles:separatelyVerified,
 sqlRollbackNotExecutedThisRun:all.length-passed.length-blocked.length-separatelyVerified.length,
 sqlRollbackPassedFiles:passed,
 sqlRollbackBlockedFiles:blocked,
 sqlRollbackFailuresConfirmed:0,
 bishopTenure:{
  originalPolicyExploit:'Reproduced with synthetic diocese A and synthetic episcopal tenure tied to a parish of another diocese; read and delete accepted under original RLS, rolled back.',
  temporaryMigrationQA:'Four cross-diocese actions denied; own parish CRUD, admin general visibility, and suspended profile denial verified in reversible transaction.',
  installedMigration:'20261023190421_isolate_bishop_tenures_by_diocese_v172',
  postDeploymentReversibleQA:'PASS: the same jurisdiction test ran successfully again after installing the migration permanently.',
  productProofLimit:'Not two independent real authenticated browser sessions. Does not prove SQL connection overlap.'
 },
 readOnlyConsistency:{
  checks:11,nonzero:0,
  categories:['four sacramental tables link to parishes','decree jurisdiction','note target and parish alignment by sacrament','legacy import batch jurisdiction','reconciliation jurisdiction','no duplicate active chancery per chancery']
 },
 originalRegistryCounts:{baptisms:5040,confirmations:2091,marriages:1261,funerals:1,decrees:2,marginalNotes:82},
 qaResidueBeforePermanentMigration:{users:0,dioceses:0,bishopTenures:0},
 unresolved:['P0: two independent physical Postgres transactions race test','P0: authenticated browser E2E across real separate dioceses','67 other rollback SQL scripts not executed in this run','two QA scripts blocked by platform safety'],
 certification:'Partial reproducible audit evidence, never 100% system-certified'
};
fs.writeFileSync('AUDITORIA_PRUEBAS_INTEGRALES_V172.json',JSON.stringify(ledger,null,2)+'\n');
const masterfile='AUDITORIA_MAESTRA_CONTROLES_V90.json';
const master=read(masterfile);
const notes={
 '06.06':'V172: original bishop_tenures RLS de las cuatro operaciones permitía acceso interdiocesano por rol; demostración con diocese A ficticia y tenure de parroquia B. Parche restringe select/insert/update/delete con scope real.',
 '06.07':'V172: prueba PostgreSQL reversible: diócesis extraña no puede leer, crear, actualizar ni eliminar tenure; parroquia titular CRUD válido, admin general lectura y cuenta suspendida bloqueada. No equivale a E2E navegador.',
 '12.07':'V172: aislamiento RLS de historial episcopal según parroquia, diócesis y estado activo; falta certificación con dos inicios de sesión Supabase separados.',
 '32.03':'V172: 1262/1262 pruebas sintéticas, 28/28 gate estricto, 21 SQL rollback de 90 disponibles aprobados; 2 no ejecutados por seguridad y 67 restantes de esta pasada.',
 '32.07':'V172: build/CSS/npm audit completos aprobados y 11 verificaciones de integridad de registros existentes con 0 incidencias en los indicadores consultados.'
};
for(const [id,note] of Object.entries(notes)){
 const x=master.controls.find(z=>z.id===id);if(!x)throw Error('Control not found '+id);
 x.evidence??=[];if(!x.evidence.includes(note)){x.evidence.push(note);x.updated_at=new Date().toISOString();}
}
const counts={};for(const c of master.controls)counts[c.status]=(counts[c.status]||0)+1;
if(master.controls.length!==325||counts.APROBADO!==10||counts.EN_PROGRESO!==117||counts.PENDIENTE!==198)
 throw Error('Unexpected master drift '+JSON.stringify(counts));
fs.writeFileSync(masterfile,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const report=`# SACRAMENTUM · V172 — Auditoría integral y aislamiento episcopal

**Fecha:** 23 de octubre de 2026. **Carpeta:** C:\\SACRAMENTUM\\SACRAMENTUM_FINAL.

## Estado de pruebas ejecutadas
- **${synthetic}/${synthetic} pruebas sintéticas Node**; **28/28 gates**, incluidas compilación, CSS, pruebas heredadas e informes de seguridad de dependencias.
- **${passed.length} guiones de PostgreSQL reales con BEGIN/ROLLBACK**, aprobados y sin cambios persistentes; cubren impresión de cuatro sacramentos, notas marginales, decretos, correcciones, nulidad, chat, procedencia histórica, permisos, importaciones y notificaciones.
- **${blocked.length} pruebas SQL** fueron bloqueadas por el sistema de seguridad antes de su ejecución; **no** se presentan como aprobadas ni como defectos de aplicación.
- **${all.length-passed.length-blocked.length-separatelyVerified.length} guiones adicionales del inventario** no se ejecutaron durante esta pasada.
- **2 ensayos V172 adicionales** (reproducción antes del parche y comprobación de jurisdicción después) fueron ejecutados con ROLLBACK.
- **11 verificaciones de integridad de datos en lectura**: ninguna inconsistencia en las condiciones consultadas (jurisdicciones, notas/partidas, relaciones de parroquia, claves activas de Cancillería). Esto no demuestra que todos los datos sean correctos.
- Conjunto consultado: 5.040 Bautismos, 2.091 Confirmaciones, 1.261 Matrimonios, 1 Exequia, 2 Decretos y 82 Notas marginales.

## Vulnerabilidad P0 reproducida y mitigada
La política RLS de \`public.bishop_tenures\` daba visibilidad y eliminación de cualquier registro a un usuario con rol \`diocese\` o \`archdiocese\`, sin comprobar que perteneciera a la diócesis del registro. Se reprodujo con una cuenta de diócesis A ficticia y un período episcopal ficticio asociado a una parroquia de otra jurisdicción; SELECT y DELETE fueron permitidos. Toda la operación terminó con ROLLBACK.

Migración \`supabase/migrations/20261023190421_isolate_bishop_tenures_by_diocese_v172.sql\` cierra las cuatro políticas de SELECT, INSERT, UPDATE, DELETE y exige un perfil institucional activo, pertenencia diocesana real, y limita a cada parroquia a sus períodos. Admin General mantiene alcance global autorizado.

Primero se verificó la migración dentro de una transacción reversible; después se instaló en Supabase con versión 20261023190421 y se repitió la prueba de autorización contra la política ya instalada. Resultado: ajenos no pueden leer, crear, modificar ni eliminar; propia parroquia puede operar y Administrador General consultar; usuario suspendido rechazado. Todas las pruebas con identidad ficticia y ROLLBACK.

## Trazabilidad y límites
- Inventario legible por máquina: \`AUDITORIA_PRUEBAS_INTEGRALES_V172.json\`; reproducibles disponibles como scripts SQL en \`scripts\`.
- Quedan pendientes autenticación E2E real entre diócesis, concurrencia física de dos conexiones PostgreSQL y verificación de los restantes guiones; **no declarar auditoría total certificada**.
- Plan maestro ${JSON.stringify(counts)}; ningún control P0 pendiente ha sido promovido a aprobado.
`;
fs.writeFileSync('AUDITORIA_INTEGRAL_V172_2026-10-23.md',report);
console.log('V172 REGISTERED: '+synthetic+' synthetic, '+passed.length+' SQL PASS, '+blocked.length+' blocked, '+counts.APROBADO+' approved controls');
