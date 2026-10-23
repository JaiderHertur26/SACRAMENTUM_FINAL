// SACRAMENTUM V179 · evidence ledger for qualified, reversible scope checks.
import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const gate=read('AUDITORIA_PUERTA_CALIDAD_V179.json');
const n=Number(gate.tasks.find(t=>t.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
if(gate.checks!==28||gate.passed!==28||gate.failed!==0||n!==1362||gate.tasks.some(t=>!t.ok))
 throw Error('V179 quality not fully passed');
const masterFile='AUDITORIA_MAESTRA_CONTROLES_V90.json',master=read(masterFile);
const evidence={
 '06.06':'V179: simulated SUSPENDED Chancellor passed five definer decree/correction/nullity role guards into business validation. SQL NULL <> role bypass also exposed after first hardening; patched via IS DISTINCT FROM. Fully reversible synthetic SQL test.',
 '06.07':'V179: temporary PostgreSQL patch proved 5 ACTIVE Chancellor RPC calls reached business input validation and 25 forbidden profile combinations rejected; includes explicit null-role fail-close, no full decree issuance claimed.',
 '30.06':'V179: marriage nullity Chancellor authorization now rejects SUSPENDED, NULL status, NULL is_active, disabled and wrong-role actors before documentary preauthorization; existing tribunal and nullity constraints preserved.',
 '32.03':'V179: 18 new Node identity/scope tests, 1362/1362 synthetic tests and 28/28 strict quality gates (production build and dependencies).',
 '32.07':'V179: migration modifies existing five privileged function bodies only, preserving records, constraints, signature and grants; actual SQL temporary patch succeeded in BEGIN/ROLLBACK.'
};
for(const [id,note] of Object.entries(evidence)){
 const control=master.controls.find(x=>x.id===id);
 if(!control)throw Error('V179 missing master control '+id);
 control.evidence??=[];if(!control.evidence.includes(note)){control.evidence.push(note);control.updated_at=new Date().toISOString();}
}
const counts={};for(const control of master.controls)counts[control.status]=(counts[control.status]||0)+1;
if(master.controls.length!==325||counts.APROBADO!==10||counts.EN_PROGRESO!==117||counts.PENDIENTE!==198)
 throw Error('V179 unexpected status advancement '+JSON.stringify(counts));
fs.writeFileSync(masterFile,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const manifest={
 version:'V179',date:'2026-10-23',localMigration:'20261023220844_chancery_decree_fail_closed_v179.sql',
 reproduced:'SUSPENDED Chancellor reaches business validation in 5 definer RPCs. When status removed, NULL role comparison failed open unless IS DISTINCT FROM used.',
 rpcNames:['apply_marriage_correction','apply_funeral_correction','create_marriage_reposition_by_decree','create_funeral_reposition_by_decree','apply_marriage_nullity'],
 preliminaryPatch:{fiveActiveAuthorizationPasses:5,twentyFiveInvalidRolesDenied:25,transactions:'BEGIN/ROLLBACK',fullyExecutedDecrees:0},
 software:{nodeSyntheticPassed:n,qualityGatesPassed:28},
 mustVerifyAfterInstall:['Repeat 5/25 SQL QA on installed migration','Repeat existing marriage/funeral corrections and repositions SQL QA','Retest no fake records persisted'],
 scopeRestrictions:['No physical independent cross-diocese sessions','No simultaneous PostgreSQL transactions','No claim of 5 completed decree business operations'],
 masterCounts:counts
};
fs.writeFileSync('AUDITORIA_RESULTADOS_CANCILLERIA_V179.json',JSON.stringify(manifest,null,2)+'\n');
const lines=[
 '# SACRAMENTUM FINAL — V179 · Cancillería: autorización de decretos y correcciones',
 '',
 '23 de octubre de 2026 · C:\\SACRAMENTUM\\SACRAMENTUM_FINAL',
 '',
 '## Hallazgo reproducido',
 'Seis vías anteriores de asiento fueron cerradas en V178. En V179, la auditoría descubrió cinco nuevas vías institucionales débiles: corrección de Matrimonio, corrección de Exequias, reposición de Matrimonio, reposición de Exequias y nulidad matrimonial.',
 'Un usuario Canciller ficticio con status=SUSPENDED e is_active=true superaba el filtro de rol y alcanzaba las siguientes comprobaciones de negocio. Se reproducen cinco comportamientos en una transacción PostgreSQL revertida; no se demuestra aquí que completara el decreto.',
 'La primera variante del parche mostró un fallo adicional de lógica SQL de tres valores: si el filtro del perfil devuelve cero filas, v_role queda NULL y una comprobación IF v_role <> chancery THEN no da TRUE. Se corrigió de manera explícita con IS DISTINCT FROM, y se volvió a ejecutar toda la prueba.',
 '',
 '## Corrección V179',
 'Migración 20261023220844_chancery_decree_fail_closed_v179.sql: en cinco funciones SECURITY DEFINER se exige is_active IS TRUE, upper(status)=ACTIVE y se cierra explícitamente la ausencia de rol. Los anclajes esperados se verifican antes de redefinir, sin cambiar firmas, permisos, registros, numeración, documentos ni controles documentales previos.',
 '',
 '## Evidencia',
 '5 de 5 llamadas ACTIVE atravesaron correctamente la autorización y alcanzaron validación funcional con entradas incompletas. 25 de 25 combinaciones incorrectas (SUSPENDED, NULL_STATUS, NULL_ACTIVE, DISABLED y WRONG_ROLE en cada una de cinco funciones) fueron denegadas explícitamente.',
 '18 pruebas contractuales nuevas. Total 1.362/1.362 pruebas Node y 28/28 verificaciones estrictas, compilación y dependencias satisfactorias.',
 'Todos los datos de prueba (auth.users y user_profiles) fueron ficticios dentro de BEGIN/ROLLBACK.',
 '',
 '## Límites',
 'No se equipara una comprobación positiva de autorización con una corrección, reposición o nulidad completa. Tampoco se certifican dos sesiones autónomas autenticadas, concurrencia física PostgreSQL ni rendimiento. La certificación E2E íntegra sigue pendiente.',
 'El plan maestro mantiene 325 controles: 10 APROBADO, 117 EN_PROGRESO, 198 PENDIENTE.',
 '',
 'Pendiente para cierre: aplicar migración oficial, repetir SQL postinstalación, probar regresiones reales de matrimonio/exequias, alinear versión SQL en GitHub, fusionar PR tras CI y verificar Vercel.'
];
fs.writeFileSync('AUDITORIA_CANCILLERIA_DECRETOS_V179_2026-10-23.md',lines.join('\n')+'\n');
console.log('V179 EVIDENCE '+n+'/1362 28/28; '+JSON.stringify(counts));
