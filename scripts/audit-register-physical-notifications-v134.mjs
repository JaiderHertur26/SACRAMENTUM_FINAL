import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const gate=load('AUDITORIA_PUERTA_CALIDAD_V134.json');
const tests=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests ([0-9]+)/)?.[1]||0);
const audits=gate.tasks.filter(x=>x.name.startsWith('dependencias-'));
if(gate.checks!==28||gate.passed!==28||gate.failed!==0||tests!==639||
 audits.length!==2||audits.some(x=>!x.ok||x.findingCounts?.total!==0))throw Error('Incomplete gate: '+tests);
const rpc=load('AUDITORIA_RPC_PRIVILEGIADAS_V133.json');
const target=new Set(['process_manual_matrimonial_notification_physical','process_matrimonial_notification_recipient']);
let touchedRPC=0;
for(const f of rpc.functions){
 if(!target.has(f.function_name))continue;
 if(f.review_status!=='PENDING_MANUAL_AUTHORIZATION_REVIEW')throw Error('Unexpected state '+f.function_name);
 f.review_status=f.function_name==='process_manual_matrimonial_notification_physical'
  ?'PARTIAL_TESTED_PHYSICAL_SOURCE_STATUS_SCOPE_AND_IDEMPOTENCE':'PARTIAL_TESTED_EXISTING_DIGITAL_TRIGGER_GUARD';
 f.tested_in_this_turn=true;
 f.test_evidence=f.function_name==='process_manual_matrimonial_notification_physical'
  ?['scripts/qa-rollback-physical-notification-source-status-v134.sql',
    'scripts/qa-rollback-physical-notification-scope-v134.sql',
    'scripts/qa-rollback-physical-confirmation-source-v134.sql',
    'supabase/migrations/20261022160304_guard_cancelled_physical_notifications_v134.sql']
  :['scripts/qa-rollback-digital-notification-unlinked-baseline-v135.sql'];
 touchedRPC++;
}
rpc.protocol='V134';rpc.updated_at=new Date().toISOString();
rpc.partial_reviewed=rpc.functions.filter(x=>x.review_status.startsWith('PARTIAL_TESTED')).length;
rpc.not_fully_reviewed=rpc.functions.filter(x=>x.review_status==='PENDING_MANUAL_AUTHORIZATION_REVIEW').length;
if(touchedRPC!==2||rpc.total!==136||rpc.partial_reviewed!==15||rpc.not_fully_reviewed!==121)throw Error('Inventory inconsistent');
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V134.json',JSON.stringify(rpc,null,2)+'\n');
const file='AUDITORIA_MAESTRA_CONTROLES_V90.json';
const master=load(file);
const annotations={
 '06.06':'V134: dos RPC notificadoras ahora con verificación parcial. 15/136 RPC con evidencia acotada, 121 aún sin revisión individual.',
 '06.07':'V134: matriz SQL confirma rol legítimo y control físico de estados del documento, del destinatario y jurisdicción.',
 '12.07':'V134: no puede asentarse certificación física de avisos matrimoniales cancelados/revertidos.',
 '14.04':'V134: control de efectos sobre Bautismo: certificación física respeta validez del documento originador.',
 '14.06':'V134: un aviso matrimonial físico vigente se procesa una sola vez sin duplicar bitácora.',
 '16.06':'V134: ensayos con avisos y destinatarios inventados, todos en ROLLBACK.',
 '27.02':'V134: documento de diócesis ajena y destinatario archived bloqueados; no se modifica estado.',
 '27.04':'V134: procesador físico rechaza seis estados inválidos de origen y sólo permite destinatario pending/read.',
 '27.05':'V134: documento de origen bloqueado FOR SHARE antes de certificar, concurrencia multiusuario aún pendiente de prueba.',
 '27.12':'V134: inventario de 136 RPC SECDEF, 15 parcialmente verificadas, 121 pendientes. Trigger digital existente confirmado.',
 '31.07':'V134: Matrimonio (5 negativas, 1 positiva, denegación diocese), Confirmación (una positiva, una negativa), jurisdicción y estado anómalo (2 negativas).',
 '31.10':'V134: 0 avisos QA, 0 destinatarios QA, 0 diócesis falsas tras ROLLBACK; históricos 5 pendientes, 2 vinculados.',
 '32.03':'V134: 18 nuevas pruebas de contrato, 639/639 sintéticas y 28/28 verificaciones estrictas.',
 '32.05':'V134: defecto confirmado antes del parche: se certificaba físicamente un aviso fuente cancelado como processed/note_applied. Corregido.',
 '32.06':'V134: laboratorio negativo inicial y pruebas positivas/negativas posteriores; protección digital preexistente validada, sin cambios innecesarios.',
 '32.07':'V134: build/CSS y npm audit completo+runtime 0 vulnerabilidades, gate 28/28.',
 '32.08':'V134: no persiste ninguna fila QA, migración real 20261022160304; frontend no desplegado.'
};
let annotated=0;
for(const c of master.controls){
 if(!annotations[c.id])continue;
 c.evidence??=[];if(!c.evidence.includes(annotations[c.id]))c.evidence.push(annotations[c.id]);
 if(c.status==='PENDIENTE')c.status='EN_PROGRESO';
 c.updated_at=new Date().toISOString();annotated++;
}
fs.writeFileSync(file,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const totals={};
for(const c of master.controls)totals[c.status]=(totals[c.status]||0)+1;
if(totals.APROBADO!==10||(totals.FALLIDO||0)!==0)throw Error('Master count inconsistent');
const report=[
 '# SACRAMENTUM · SEGURIDAD DE NOTIFICACIONES FÍSICAS V134 Y PRUEBA DIGITAL V135',
 '',
 '## Hallazgo real y protección aplicada',
 '- Se reprodujo en SQL que process_manual_matrimonial_notification_physical permitía certificar un aviso con documento original cancelled, marcando recipient processed y note_applied true. La transacción lanzó excepción intencional y ROLLBACK.',
 '- Supabase versión de migración 20261022160304: sólo destinatario pending/read, bloquea documento cancelled/reversed/revertida/archived/anulada/annulled, y exige diócesis de origen concordante.',
 '- El documento se lee FOR SHARE para validar su estado antes de afectar una recepción. No se proclama protección completa contra toda carrera concurrente.',
 '- Se mantienen funcionalidades correctas de Matrimonio y Confirmación física, con procesamiento idempotente y bitácora única.',
 '',
 '## Verificación de defensa digital existente',
 '- V135 no identificó otra vulnerabilidad. Un trigger anterior, sacramentum_guard_manual_recipient_processing, ya rechaza procesar digitalmente sin Bautismo vinculado ni certificación del asiento físico. Se añadió QA de no regresión, sin alterar función protegida.',
 '',
 '## Evidencia reversible',
 '- scripts/qa-rollback-physical-notification-cancelled-baseline-v134.sql: reproducción del defecto pre-migración.',
 '- scripts/qa-rollback-physical-notification-source-status-v134.sql: cinco estados inválidos, uno vigente, rechazo de rol diocesano, reintento idempotente.',
 '- scripts/qa-rollback-physical-notification-scope-v134.sql: origen de diócesis ajena y recipient archived rechazados.',
 '- scripts/qa-rollback-physical-confirmation-source-v134.sql: Confirmación física cancelada rechazada y vigente aceptada.',
 '- scripts/qa-rollback-digital-notification-unlinked-baseline-v135.sql: trigger digital preexistente rechaza acción sin vinculación ni certificación física.',
 '- Todas las pruebas insertaron filas exclusivamente en BEGIN/ROLLBACK. Consulta final: cero notificaciones QA, cero destinatarios QA y cero diócesis ficticias. ANULACION sigue cinco pendientes y dos vinculados.',
 '',
 '## Regresión y controles',
 '- scripts/test-physical-notification-guard-v134.mjs: 18 tests nuevos integrados en puerta de calidad y GitHub Actions.',
 '- AUDITORIA_PUERTA_CALIDAD_V134.json: '+tests+' tests sintéticos aprobados, 28/28 controles estrictos, npm audit completo y producción 0 vulnerabilidades.',
 '- AUDITORIA_RPC_PRIVILEGIADAS_V134.json: 136 RPC privilegiadas autorizadas para authenticated; '+rpc.partial_reviewed+' parcialmente comprobadas y '+rpc.not_fully_reviewed+' todavía sin revisión individual exhaustiva.',
 '- Plan maestro: '+annotated+' controles con evidencia nueva. Estado global '+JSON.stringify(totals)+'. No se certifican áreas enteras basándose en QA parcial.',
 '',
 '## Limitaciones',
 '- Pruebas de autorización con rol autenticado simulado en una transacción de Supabase; no son pruebas reales E2E de navegador con usuarios institucionales.',
 '- Falta ensayo multisesión de concurrencia, respaldo/impresión y verificación física de documentos auténticos.',
 '- Backend corregido; frontend sigue en rama de auditoría, sin desplegar cambios nuevos.',
 '',
 '**Dictamen:** certificación física improcedente de notificaciones canceladas corregida; protección digital preexistente verificada.'
].join('\n');
fs.writeFileSync('AUDITORIA_NOTIFICACIONES_FISICAS_V134_2026-10-22.md',report+'\n');
console.log('V134 '+JSON.stringify(totals)+' rpc='+rpc.total+' partial='+rpc.partial_reviewed+' pending='+rpc.not_fully_reviewed+' synthetic='+tests+' strict='+gate.passed+'/'+gate.checks);
