import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=x=>JSON.parse(fs.readFileSync(x,'utf8'));
const gate=read('AUDITORIA_PUERTA_CALIDAD_V133.json');
const synthetic=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests ([0-9]+)/)?.[1]||0);
const tasks=gate.tasks.filter(x=>x.name.startsWith('dependencias-'));
if(gate.checks!==28||gate.passed!==28||gate.failed!==0||synthetic!==621||tasks.length!==2||tasks.some(x=>!x.ok||x.findingCounts?.total!==0))throw Error('Auditoría estricta incompleta '+synthetic);
const rpcPath='AUDITORIA_RPC_PRIVILEGIADAS_V132.json',rpc=read(rpcPath);
const reviewed=new Set(['create_manual_marginal_note','mark_official_notification_read','archive_official_notification']);
let marked=0;
for(const fn of rpc.functions){
 if(!reviewed.has(fn.function_name))continue;
 if(fn.review_status!=='PENDING_MANUAL_AUTHORIZATION_REVIEW')throw Error('Estado inesperado '+fn.function_name+': '+fn.review_status);
 fn.review_status='PARTIAL_TESTED_MARGINAL_NOTE_AND_RECEIPT_ROLES';
 fn.tested_in_this_turn=true;
 fn.test_evidence=[
  'scripts/qa-rollback-marginal-note-notification-matrix-v133.sql',
  'scripts/qa-rollback-cross-parish-notes-receipts-v133.sql',
  'supabase/migrations/20261022155208_separate_marginal_note_and_notification_receipt_authority_v133.sql',
  'scripts/test-marginal-receipt-authority-v133.mjs'
 ];
 marked++;
}
rpc.updated_at=new Date().toISOString();
rpc.partial_reviewed=rpc.functions.filter(x=>x.review_status.startsWith('PARTIAL_TESTED')).length;
rpc.not_fully_reviewed=rpc.functions.filter(x=>x.review_status==='PENDING_MANUAL_AUTHORIZATION_REVIEW').length;
if(marked!==3||rpc.partial_reviewed!==13||rpc.not_fully_reviewed!==123||rpc.total!==136)throw Error('Inventario RPC incompleto');
rpc.protocol='V133';
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V133.json',JSON.stringify(rpc,null,2)+'\n');
const planPath='AUDITORIA_MAESTRA_CONTROLES_V90.json',plan=read(planPath);
const evidence={
 '06.06':'V133: tres RPC SECDEF (notas marginales manuales, lectura y archivo de avisos oficiales) pasaron de pendientes a parcialmente probadas; 13/136 con evidencia acotada, 123 aún sin revisión individual.',
 '06.07':'V133: funciones de modificaciones marginales y acuses ahora comprueban rol custodial; 8 intentos indebidos entre cuatro roles rechazados y 3 cruces de parroquia bloqueados.',
 '12.07':'V133: ninguna lectura/archivo de comunicación oficial dirigida a Parroquia puede ser realizada por Cancillería, Diócesis o Administrador General; sólo la destinataria crea constancia.',
 '14.06':'V133: notas manuales creadas sólo por parroquia titular y Cancillería de su diócesis, con políticas de impresión obligatoria aún reservadas a Cancillería.',
 '16.06':'V133: QA de libro matrimonial falso vinculada a una parroquia concreta, dos asientos legítimos y denegación horizontal sobre libro ajeno.',
 '27.01':'V133: Admin General perdió capacidad directa de asentar notas marginales y gestionar estados de recepción de comunicaciones, sin afectar lectura de supervisión.',
 '27.02':'V133: QA de 3 pruebas de aislamiento horizontal: una parroquia no inserta notas ni marca/archiva aviso de otra parroquia misma diócesis.',
 '27.04':'V133: autoridad diocesana/cancillería no puede fabricar lectura del destinatario; roles legítimos pueden consultar pero acuse pertenece a receptor parroquial.',
 '27.05':'V133: no hay alternativa directa INSERT en marginal_notes ni UPDATE en official_notifications desde rol authenticated; permisos tabla comprobados.',
 '27.12':'V133: snapshot de 136 SECURITY DEFINER, 13 parcialmente probadas en SQL, 123 pendientes. Este resultado NO certifica toda la superficie RPC.',
 '31.07':'V133: matriz transaccional 4 roles, 8 denegaciones y 4 operaciones legítimas (2 notas, lectura y archivo) además de 3 denegaciones horizontales.',
 '31.10':'V133: 0 QA marriages, notas, avisos y parroquias tras ROLLBACK; archivo ANULACION sigue con 5 pendientes y 2 vinculados.',
 '32.03':'V133: 4 laboratorios SQL históricos/actuales, 13 pruebas de contrato añadidas, 621/621 sintéticas y 28/28 verificaciones estrictas.',
 '32.05':'V133: dos fallos reproducidos antes de modificar Supabase: Admin General insertaba nota marginal y Diócesis marcaba leído un mensaje parroquial.',
 '32.06':'V133: se reprodujo el defecto antes y se comprobó después: matriz post-fix positiva/negativa, ausencia de acuse falso y ROLLBACK.',
 '32.07':'V133: gate 28/28 y 621/621 tests sintéticos; npm audit completo y producción sin vulnerabilidades.',
 '32.08':'V133: no se persistió información de pruebas; migración aplicada en Supabase con versión real 20261022155208; frontend sin cambios funcionales.'
};
let touched=0;
for(const c of plan.controls){
 if(!evidence[c.id])continue;
 c.evidence??=[];if(!c.evidence.includes(evidence[c.id]))c.evidence.push(evidence[c.id]);
 if(c.status==='PENDIENTE')c.status='EN_PROGRESO';
 c.updated_at=new Date().toISOString();touched++;
}
fs.writeFileSync(planPath,JSON.stringify(plan,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const tally={};for(const c of plan.controls)tally[c.status]=(tally[c.status]||0)+1;
if(tally.APROBADO!==10||(tally.FALLIDO||0)!==0)throw Error('Estado incorrecto de plan maestro');
const markdown=[
 '# SACRAMENTUM · AUTORIDAD DE NOTAS MARGINALES Y ACUSES OFICIALES · V133',
 '',
 '## Fallos reales reproducidos con ROLLBACK antes de la corrección',
 '- Administrador General ejecutó create_manual_marginal_note sobre un Matrimonio ficticio, a pesar de que el rol no puede alterar los libros sacramentales.',
 '- Diócesis ejecutó mark_official_notification_read sobre una comunicación ficticia destinada a Parroquia y generó status=read/read_at indebidamente.',
 '- Las dos reproducciones finalizaron con excepción intencional y ROLLBACK, sin alterar libros reales.',
 '',
 '## Corrección aplicada en Supabase',
 '- Migración: supabase/migrations/20261022155208_separate_marginal_note_and_notification_receipt_authority_v133.sql, registrada con la misma versión en el proyecto.',
 '- create_manual_marginal_note: solo Parroquia de su propio archivo o Cancillería dentro de su diócesis; no se permitió al Administrador General ni Diócesis. print_policy=required sigue prohibida a Parroquia.',
 '- mark_official_notification_read: únicamente Parroquia receptora puede transformar una comunicación en leída. Cancillería, Diócesis y Administrador General no suplantan recepción.',
 '- archive_official_notification: únicamente Parroquia destinataria puede archivar el aviso; se elimina la excepción heredada para Administrador General.',
 '- No se alteraron permisos generales de lectura ni las políticas RLS de supervisión, que son distintas de la potestad de modificar el estado de recepción.',
 '',
 '## Matrices ejecutadas y reversibles',
 '- scripts/qa-rollback-marginal-note-notification-matrix-v133.sql: 4 roles, 8 denegaciones, 2 notas legítimas y 2 transiciones legítimas de aviso (lectura y archivo). PASS.',
 '- scripts/qa-rollback-cross-parish-notes-receipts-v133.sql: una parroquia contra otra parroquia falsa en la misma diócesis; 3 denegaciones, ningún aviso ni nota ajena cambiados. PASS.',
 '- Se verificó que el cliente authenticated carece de INSERT directo en marginal_notes y UPDATE directo en official_notifications.',
 '- Resultado de residuo SQL: 0 matrimonios QA, 0 avisos oficiales QA, 0 notas QA, 0 parroquias QA. Archivo ANULACION 5 pending y 2 linked sin alterar.',
 '',
 '## Regresión continua y auditoría',
 '- scripts/test-marginal-receipt-authority-v133.mjs: 13 pruebas estáticas/contractuales añadidas al gate y GitHub Actions.',
 '- AUDITORIA_PUERTA_CALIDAD_V133.json: '+synthetic+' tests sintéticos aprobados, 28/28 verificaciones, build, CSS y npm audit runtime/completo 0 vulnerabilidades.',
 '- AUDITORIA_RPC_PRIVILEGIADAS_V133.json: 136 RPC SECURITY DEFINER ejecutables por authenticated, 13 parcialmente verificadas y 123 pendientes sin revisión individual exhaustiva.',
 '',
 '## Límites de evidencia',
 '- Se usaron actores existentes y entidades enteramente falsas sólo dentro de BEGIN/ROLLBACK. No se inició sesión interactiva real en Chrome.',
 '- No se publicaron cambios de frontend ni se implementó prueba real de impresión o de tratamiento de archivos auténticos.',
 '- Las RPC con pruebas parciales no son equivalentes a aprobación completa de la seguridad del sistema.',
 '',
 '## Plan maestro',
 '- Se agregaron evidencias específicas a '+touched+' controles. Estado de 325: '+JSON.stringify(tally)+'.',
 '',
 '**Dictamen:** cerrada la suplantación del acto de lectura parroquial y el asiento manual no autorizado por Administrador General. Auditoría integral continúa.',
 ''
].join('\n');
fs.writeFileSync('AUDITORIA_NOTAS_Y_ACUSES_V133_2026-10-22.md',markdown);
console.log('V133 '+JSON.stringify(tally)+' RPC='+rpc.total+' verified='+rpc.partial_reviewed+' pending='+rpc.not_fully_reviewed+' gate='+gate.passed+'/'+gate.checks+' synthetic='+synthetic);
