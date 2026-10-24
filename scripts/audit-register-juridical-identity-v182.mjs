import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const gate=read('AUDITORIA_PUERTA_CALIDAD_V182.json');
const count=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
if(count!==1434||gate.checks!==28||gate.passed!==28||gate.failed!==0||gate.tasks.some(x=>!x.ok))
 throw Error('V182 quality gate not complete');
const path='AUDITORIA_MAESTRA_CONTROLES_V90.json',master=read(path);
const notes={
 '06.06':'V182 reproducible profile authorization weakness in 3 SECURITY DEFINER juridical RPCs: NULL status diocesan actor passed business guards. New fail-closed guards require is_active true and status ACTIVE.',
 '06.07':'V182 PostgreSQL reversible QA: 5 active-role court and authorization business gates reachable, 24 invalid profile/role cases denied, no court records read or persisted.',
 '30.06':'V182 strengthened diocesan independent approval for marginal note reconciliation and two nullity court receipt read-only functions. Documentary and separation-of-functions business protections preserved.',
 '32.03':'V182: 19 new Node tests, 1434/1434 synthetic tests, 28/28 quality checks and real 29-case SQL scope matrix.',
 '32.07':'V182 targeted and anchored replacement in 3 privileged RPCs, preserving signatures/grants, with JWT-fictitious actors and BEGIN/ROLLBACK SQL proof.'
};
for(const [id,note] of Object.entries(notes)){
 const c=master.controls.find(x=>x.id===id);if(!c)throw Error('Control not found '+id);
 c.evidence??=[];if(!c.evidence.includes(note)){c.evidence.push(note);c.updated_at=new Date().toISOString();}
}
const counts={};for(const c of master.controls)counts[c.status]=(counts[c.status]||0)+1;
if(master.controls.length!==325||counts.APROBADO!==10||counts.EN_PROGRESO!==117||counts.PENDIENTE!==198)
 throw Error('Master count drift: '+JSON.stringify(counts));
fs.writeFileSync(path,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const record={
 version:'V182',date:'2026-10-23',migration:'20261024011824_juridical_reconciliation_identity_v182.sql',
 finding:'Profile with NULL status and is_active=true reached business validation in three privileged reconciliation and nullity court receipt functions while current_app_role() returned NULL.',
 functions:['approve_later_note_reconciliation_v156','get_court_clarifications_v113','get_court_receipt_dual_control_summary_v111'],
 realSqlTemporary:{positiveAuthorizationGates:5,denied:24,rollbacks:true},
 syntheticNodePassed:count,qualityChecks:28,masterCounts:counts,
 scopeLimits:['Positive cases reached input validation using fictional unknown receipt IDs, not full legal reconciliation or court reading','No two independent authenticated browser sessions','No physically overlapping PostgreSQL transactions'],
 noPrivateCourtDataExported:true
};
fs.writeFileSync('AUDITORIA_IDENTIDAD_JURIDICA_V182.json',JSON.stringify(record,null,2)+'\n');
const doc=[
 '# SACRAMENTUM FINAL | V182 · Identidad jurídica y consultas de nulidad',
 '',
 'Fecha: 23 de octubre de 2026 (Colombia). Ruta C:\\SACRAMENTUM\\SACRAMENTUM_FINAL.',
 '',
 '## Hallazgo reproducido',
 'Un usuario ficticio diocesano con is_active=true pero status=NULL pudo ejecutar tres RPC SECURITY DEFINER hasta alcanzar la validación de negocio, aunque current_app_role devolvía NULL. La reproducción no demostró una aprobación documental indebida ni abrió expedientes reales. Toda la evidencia SQL usa BEGIN/ROLLBACK.',
 '',
 '## Protección',
 'La migración 20261024011824_juridical_reconciliation_identity_v182.sql modifica los tres controles institucionales para exigir u.is_active IS TRUE y upper(u.status)=ACTIVE: aprobación diocesana de conciliación posterior de notas, consulta de aclaraciones del tribunal y resumen de doble verificación de recepción judicial. En el resumen se rechaza expresamente v_role NULL. Se preservan requisitos jurídicos, validaciones de jurisdicción, documentación, firma, separación de funciones y contratos RPC.',
 '',
 '## Prueba real y regresión',
 'Con cuentas ficticias: cinco puertas permitidas con roles legítimos de Diócesis y Cancillería alcanzaron validaciones de entrada; 24 combinaciones no permitidas (SUSPENDED, NULL_STATUS, NULL_ACTIVE, DISABLED, PENDING, BLANK_STATUS, WRONG_ROLE y PROFILELESS en cada función) fueron rechazadas con mensajes exactos.',
 '19 nuevas pruebas contractuales Node. Total 1434/1434 pruebas sintéticas, 28/28 controles completos, Vite build, CSS y dependencias aprobadas.',
 '',
 '## Límites',
 'No son pruebas de aprobación completa de conciliación o lectura de expedientes legítimos; éstas requieren recorridos funcionales adicionales. No se usaron datos judiciales reales como material de prueba. Siguen abiertos el E2E con sesiones reales independientes y las conexiones SQL simultáneas. El plan maestro conserva 325 controles, 10 APROBADO, 117 EN_PROGRESO y 198 PENDIENTE.',
 '',
 'Antes de declarar publicación: CI de PR, migración Supabase permanente, matriz posterior, regresiones judiciales, conciliación de versión de migración, merge y comprobación SHA Vercel.'
];
fs.writeFileSync('AUDITORIA_SEGURIDAD_JURIDICA_V182_2026-10-23.md',doc.join('\n')+'\n');
console.log('V182 '+count+' tests, 28 quality, 5 active, 24 denied');
