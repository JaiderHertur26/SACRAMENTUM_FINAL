// V173: evidence for historic sacramental digitization privilege hardening.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const gate=read('AUDITORIA_PUERTA_CALIDAD_V173.json');
const n=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
if(gate.failed!==0||gate.passed!==28||gate.checks!==28||n!==1277||gate.tasks.some(x=>!x.ok))
 throw Error('V173 strict quality gate incomplete');
const masterfile='AUDITORIA_MAESTRA_CONTROLES_V90.json',master=read(masterfile);
const evidence={
 '06.06':'V173: reproducción real con rol authenticated, usuario parroquial ficticio status=SUSPENDED que digitalizó un Bautismo histórico; tras parche transaccional, rechazado. Otros cuatro tipos y wrapper Confirmación protegidos por estado ACTIVE y diócesis real.',
 '06.07':'V173: funciones SECURITY DEFINER de Bautismo, Confirmación, Matrimonio, Exequias y narrativos fueron acotadas; pruebas con cuenta suspendida y diócesis falsa denegaron las acciones. E2E autenticado físico aún pendiente.',
 '12.07':'V173: seis funciones de digitalización histórica exigen rol parroquial legítimo, is_active=true, status ACTIVE y pertenencia diocesana de la parroquia. Falta probar cada acción legítima de los otros cuatro flujos con navegador real.',
 '32.03':'V173: 15 pruebas contractuales nuevas, 1277/1277 sintéticas y 28/28 strict gates, QA PostgreSQL sintética reversible de casos de denegación y positivo Bautismo.',
 '32.07':'V173: Vite producción, verificación CSS, auditoría de dependencias de producción y completa sin vulnerabilidades; pruebas de permisos en PostgreSQL ejecutadas con BEGIN/ROLLBACK.'
};
for(const [id,note] of Object.entries(evidence)){
 const control=master.controls.find(c=>c.id===id);if(!control)throw Error('Unknown master control '+id);
 control.evidence??=[];if(!control.evidence.includes(note)){control.evidence.push(note);control.updated_at=new Date().toISOString();}
}
const count={};for(const c of master.controls)count[c.status]=(count[c.status]||0)+1;
if(master.controls.length!==325||count.APROBADO!==10||count.EN_PROGRESO!==117||count.PENDIENTE!==198)
 throw Error('Status drift '+JSON.stringify(count));
fs.writeFileSync(masterfile,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const ledger={
 protocol:'V173',generated_at:'2026-10-23',scope:'Backend PostgreSQL functions and existing Node gates; NOT full physical/browser application certification.',
 prepatchConfirmed:{
  function:'register_historical_baptism(uuid,jsonb)',
  actor:'Fictional parish account is_active=true / status=SUSPENDED',
  outcome:'Fictional historic baptism inserted and audit created; entire transaction rolled back.'
 },
 sqlFunctionsHardened:[
 'register_historical_baptism_internal(uuid,jsonb)',
 'register_historical_confirmation_internal(uuid,jsonb,uuid,text)',
 'register_historical_marriage(uuid,jsonb)',
 'register_historical_funeral(uuid,jsonb)',
 'register_historical_narrative(uuid,text,jsonb)',
 'register_historical_confirmation(uuid,jsonb,uuid,text)'
 ],
 temporaryPostPatchQa:{
  historicalBaptism:'SUSPENDED denied; foreign diocese denied; legitimate ACTIVE parish inserted one fictitious baptism and exactly one audit. Transaction rolled back.',
  otherFour:'Confirmation, Marriage, Funeral and Narrative RPC entry points rejected SUSPENDED and foreign diocese (8 denials). Transaction rolled back.',
  actualOtherFourLegitimateInsertTests:'Not exercised during V173.'
 },
 priorPassingSqlThisTurn:[
 'qa-rollback-note-reconciliation-grants-v156.sql',
 'qa-rollback-shadow-role-matrix-v124.sql',
 'qa-rollback-documentary-v114.sql',
 'qa-rollback-print-request-lineage-v144.sql',
 'qa-rollback-physical-confirmation-source-v134.sql',
 'qa-rollback-manual-note-admin-role-v133.sql'
 ],
 strictGates:28,syntheticTests:n,securityGateFailed:0,
 status:'Validated reversible patch; permanent deployment tracked via migration and GitHub PR.',
 unresolved:['Two independent authenticated dioceses in separate browser sessions','Two independent PostgreSQL concurrent transactions','Remaining unexecuted reversible SQL scripts from V172']
};
fs.writeFileSync('AUDITORIA_SQL_REAL_V173.json',JSON.stringify(ledger,null,2)+'\n');
const report=`# SACRAMENTUM · V173 — Aislamiento de la digitalización histórica

Fecha: 23 de octubre de 2026. Ruta principal: C:\\SACRAMENTUM\\SACRAMENTUM_FINAL.

## Hallazgo de seguridad reproducido
La función interna de registro histórico de Bautismo comprobaba que el actor fuera parroquial y perteneciera a la parroquia, pero aceptaba \`status=SUSPENDED\` cuando \`is_active=true\`; su lista de tres estados denegados no incluía suspensión. Una cuenta ficticia con esta configuración digitalizó una partida ficticia y dejó un evento de auditoría dentro de la transacción, revertidos con \`ROLLBACK\`.

La misma cláusula débil existía en los registros históricos de Confirmación, Matrimonio, Exequias, asientos narrativos y en la función pública de Confirmación. No afirmamos que se explotaran físicamente las otras cinco funciones antes del parche: quedaron acreditadas por examen directo del SQL.

## Reparación integral
Migración \`20261023192627_guard_historical_baptism_active_parish_v173.sql\`:
- Afecta exclusivamente seis funciones SQL preexistentes (cinco flujos históricos, incluida entrada de Confirmación).
- Requiere \`is_active IS TRUE\`, \`status=ACTIVE\` y asociación comprobada entre la diócesis del perfil y la parroquia objetivo; conserva el filtro parroquial existente.
- Preserva coordenadas físicas Libro/Folio/Número, autorización diferenciada, firma RPC, auditoría y permisos. Aborta si cambian las firmas o las cláusulas esperadas.

## Evidencia
- \`scripts/qa-rollback-historical-baptism-suspended-repro-v173.sql\`: defecto Bautismo confirmado antes de parche, todo ficticio y revertido.
- \`scripts/qa-rollback-historical-baptism-active-parish-v173.sql\`: parche temporal rechazó SUSPENDED, rechazó diócesis incorrecta y permitió un registro Bautismo legítimo de ficción con exactamente un evento de auditoría.
- \`scripts/qa-rollback-historical-four-workflows-v173.sql\`: ocho rechazos correctos de perfiles suspendidos o interdiocesanos en Confirmación, Matrimonio, Exequias y asientos narrativos.
- Otros seis guiones históricos de permisos y documentación, seleccionados en esta pasada, aprobaron en SQL real con transacciones reversibles.
- 15 pruebas contractuales nuevas en Node; ${n}/${n} sintéticas y 28/28 comprobaciones generales aprobadas.

## Límites
No certifica el alta legítima a través del navegador en todos los módulos, ni dos sesiones Supabase reales separadas, ni concurrencia simultánea PostgreSQL. Los datos QA no se persistieron. Se conserva el plan maestro: ${JSON.stringify(count)}.

**Dictamen:** autorización histórica vulnerable confirmada; las seis funciones quedaron verificadas transaccionalmente con la corrección propuesta. Confirmar aplicación permanente, verificación posterior y despliegue del mismo SHA antes de afirmar publicación.
`;
fs.writeFileSync('AUDITORIA_AUTORIZACION_HISTORICA_V173_2026-10-23.md',report);
console.log('V173 EVIDENCE '+n+'/'+n+', 28/28, master '+JSON.stringify(count));
