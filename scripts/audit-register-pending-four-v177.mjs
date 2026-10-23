// V177 evidence ledger: exact expected quality gate and proven PostgreSQL QA.
import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const gate=read('AUDITORIA_PUERTA_CALIDAD_V177.json');
const n=Number(gate.tasks.find(t=>t.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
if(n!==1324||gate.checks!==28||gate.passed!==28||gate.failed!==0||gate.tasks.some(t=>!t.ok))
 throw Error('V177 strict QA gate not passed');
const masterFile='AUDITORIA_MAESTRA_CONTROLES_V90.json',master=read(masterFile);
const evidence={
 '06.06':'V177: reproduced real suspended-account create_pending_baptism/confirmation/marriage/funeral bypass through four privileged functions, fully fictitious records and BEGIN/ROLLBACK. All four RPCs required fail-closed account scope.',
 '06.07':'V177: 4 legitimate active parish pending sacrament calls PASS; 24 forbidden combinations (SUSPENDED, NULL_STATUS, NULL_ACTIVE, DISABLED, FOREIGN_DIOCESE, DIOCESE_ROLE) explicitly denied in real reversible PostgreSQL QA.',
 '12.07':'V177: four pending sacramental workflows now require account explicitly ACTIVE, is_active true and actual parish-diocese correspondence. This is PostgreSQL reversible integration, NOT full authenticated browser E2E.',
 '32.03':'V177: 16 additional Node contracts, total 1324/1324 synthetic tests and 28/28 quality checks, including build, CSS and npm audit.',
 '32.07':'V177: all four pending RPCs preserve their book sequencing and audit internals; 24 denied calls did not change 4 legitimate fictitious rows, and QA residue 0 across users, dioceses and all four pending tables.'
};
for(const [id,note] of Object.entries(evidence)){
 const c=master.controls.find(x=>x.id===id);if(!c)throw Error('Missing master control '+id);
 c.evidence??=[];if(!c.evidence.includes(note)){c.evidence.push(note);c.updated_at=new Date().toISOString();}
}
const statuses={};for(const c of master.controls)statuses[c.status]=(statuses[c.status]||0)+1;
if(master.controls.length!==325||statuses.APROBADO!==10||statuses.EN_PROGRESO!==117||statuses.PENDIENTE!==198)
 throw Error('Unexpected master control drift '+JSON.stringify(statuses));
fs.writeFileSync(masterFile,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const ledger={
 protocol:'V177',date:'2026-10-23',
 candidateMigration:'20261023205143_pending_sacraments_active_parish_v177.sql',
 prepatchRepro:'ALL FOUR suspended-account privileged pending sacrament creates succeeded with synthetic accounts in ROLLBACK',
 qasql:{
  temporaryMigrationWithinRollback:'PASS',
  legitimateActiveParish:4,
  denied:[
   'SUSPENDED','NULL_STATUS','NULL_ACTIVE','DISABLED','FOREIGN_DIOCESE','DIOCESE_ROLE'
  ],
  deniedCount:24,unexpectedMutations:0,allTransactionRollbacks:true,
  residues:{qaUsers:0,qaDioceses:0,qaBaptisms:0,qaConfirmations:0,qaMarriages:0,qaFunerals:0}
 },
 fourRpcNames:['create_pending_baptism','create_pending_confirmation','create_pending_marriage','create_pending_funeral'],
 qualityGatePassed:28,nodeTestsPassed:n,master:statuses,
 notCertified:['Independent authenticated browser E2E across dioceses','Two overlapping PostgreSQL transactions','Full UI functional workflow of all 4 sacraments','Production stress testing'],
 note:'The original rejected hypothesis about NULL bishop tenure visibility was not an exploit and was not included; only reproduced vulnerabilities and passing tests are reported.'
};
fs.writeFileSync('AUDITORIA_PRUEBAS_PENDIENTES_V177.json',JSON.stringify(ledger,null,2)+'\n');
const report=[
 '# SACRAMENTUM FINAL · V177 — Cuatro sacramentos: bloqueo de creación pendiente para cuentas suspendidas',
 '',
 'Fecha: 23 de octubre de 2026. Ruta principal: C:\\SACRAMENTUM\\SACRAMENTUM_FINAL.',
 '',
 '## Vulnerabilidad real',
 'El control de las funciones SECURITY DEFINER create_pending_baptism, create_pending_confirmation, create_pending_marriage y create_pending_funeral exigía pertenencia parroquial y en ciertas funciones is_active, pero no aseguraba estado ACTIVE. Se demostró directamente en Supabase que un perfil parroquial SUSPENDED podía crear cuatro registros pendientes ficticios, pese a carecer de permisos en la función central current_app_role de V176.',
 'Todas esas creaciones estaban en transacciones PostgreSQL BEGIN/ROLLBACK. No se modificaron permanentemente partidas, parámetros de numeración, perfiles ni logs.',
 '',
 '## Reparación V177',
 'Migración 20261023205143_pending_sacraments_active_parish_v177.sql cambia únicamente los filtros de autorización de cuatro funciones, exigiendo is_active IS TRUE, upper(status)=ACTIVE y coincidencia entre parroquia de destino y diócesis del perfil. Las coordenadas físicas Libro/Folio/Número, flujo de registro, auditoría y firmas RPC permanecen intactos.',
 'La migración usa anclajes de definiciones actuales y aborta si falta, se duplica o cambia el fragmento objetivo.',
 '',
 '## Resultado de QA real',
 '4/4 operaciones permitidas de usuario parroquial ACTIVE terminaron correctamente dentro de ROLLBACK.',
 '24/24 intentos no autorizados fueron rechazados con los errores institucionales correctos: SUSPENDED, NULL_STATUS, NULL_ACTIVE, DISABLED, FOREIGN_DIOCESE y DIOCESE_ROLE (cada escenario aplicado a los cuatro sacramentos). Los rechazos dejaron los cuatro registros ficticios legítimos intactos dentro de la transacción, confirmándose un registro por sacramento.',
 'Posteriormente se verificó ausencia de residuos en auth.users, dioceses, pending_baptisms, pending_confirmations, pending_marriages y pending_funerals.',
 '',
 '## Calidad de software y límites',
 '16 nuevos contratos permanentes, 1.324 de 1.324 pruebas sintéticas y 28 de 28 controles de calidad, incluyendo build, CSS y auditoría de dependencias.',
 'El control de RLS para bishop_tenures se examinó durante la exploración y NO fue reproducido como fuga de datos con status NULL; no se comunica como nueva vulnerabilidad.',
 'Persisten sin certificación las pruebas auténticas de dos sesiones diocesanas independientes, transacciones físicamente simultáneas, recorrido visual de todas las acciones autenticadas y carga.',
 'Plan maestro: 325 controles, 10 APROBADO, 117 EN_PROGRESO y 198 PENDIENTE. Ningún control se promueve sin prueba exhaustiva.'
];
fs.writeFileSync('AUDITORIA_AISLAMIENTO_PENDIENTES_V177_2026-10-23.md',report.join('\n\n')+'\n');
console.log('V177 evidence registered: '+n+' Node, 28/28 quality, 4 positives, 24 denials, '+JSON.stringify(statuses));
