import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const parse=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const gate=parse('AUDITORIA_PUERTA_CALIDAD_V139.json');
const n=Number(gate.tasks.find(t=>t.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests ([0-9]+)/)?.[1]||0);
const audits=gate.tasks.filter(t=>t.name.startsWith('dependencias-'));
if(n!==713||gate.checks!==28||gate.passed!==28||gate.failed!==0||
 audits.length!==2||audits.some(x=>!x.ok||x.findingCounts?.total!==0))
 throw Error('V139 no finaliza sin gate estricto, tests='+n);
const rpc=parse('AUDITORIA_RPC_PRIVILEGIADAS_V138.json');
let updated=0;
for(const fn of rpc.functions){
 if(!['archive_official_notification','mark_official_notification_read'].includes(fn.function_name))continue;
 if(!fn.review_status.startsWith('PARTIAL_TESTED'))throw Error('RPC unexpectedly unreviewed '+fn.function_name);
 fn.tested_in_this_turn=true;
 fn.test_evidence??=[];
 fn.test_evidence.push(
  'supabase/migrations/20261022170342_guard_official_notification_terminal_states_v139.sql',
  'scripts/qa-rollback-notice-status-transitions-v139.sql',
  'scripts/test-official-notification-and-print-v139.mjs'
 );
 updated++;
}
rpc.protocol='V139';rpc.updated_at=new Date().toISOString();
rpc.partial_reviewed=rpc.functions.filter(f=>f.review_status.startsWith('PARTIAL_TESTED')).length;
rpc.not_fully_reviewed=rpc.functions.filter(f=>f.review_status==='PENDING_MANUAL_AUTHORIZATION_REVIEW').length;
if(updated!==2||rpc.total!==136||rpc.partial_reviewed!==20||rpc.not_fully_reviewed!==116)
 throw Error('RPC status unexpected '+updated+' '+rpc.partial_reviewed+'/'+rpc.not_fully_reviewed);
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V139.json',JSON.stringify(rpc,null,2)+'\n');
const planFile='AUDITORIA_MAESTRA_CONTROLES_V90.json';
const plan=parse(planFile);
const notes={
 '06.06':'V139: dos RPC SECURITY DEFINER de comunicaciones oficiales con nuevas pruebas de estados; total 136, 20 parciales y 116 pendientes. RPC register_registry_print sólo tiene QA estática de interfaz, no auditoría individual.',
 '06.07':'V139: comunicaciones canceladas/revertidas no pueden archivarse como recibidas; processed no retrocede a read; sólo parroquia destinataria cambia el estado.',
 '12.07':'V139: aviso de decreto revertido conserva status cancelled ante intento de archivo, sin read_at ni falsa recepción.',
 '14.04':'V139: bitácora de comunicaciones ya no certifica lectura sin evento previo, preserva fechas reales al archivar.',
 '14.06':'V139: impresión de Bautismo y Confirmación se detiene si falla RPC de auditoría; no se asegura impresión física, sólo solicitud registrada.',
 '16.06':'V139: interfaz de Partida matrimonial y Exequias condiciona solicitud de impresión a RPC persistida; comprobado por build/contrato, no sesión real.',
 '24.12':'V139: flujo visual de impresión cambia a fail-closed en cinco entradas de Bautismo, Confirmación, Matrimonio y Exequias; inspección visual autenticada pendiente.',
 '27.01':'V139: Diócesis no puede archivar comunicación parroquial como recibida, prueba SQL rol autenticado simulado.',
 '27.02':'V139: matriz de comunicación comprueba sólo actor parroquial destinatario, permisos directos UPDATE denegados por authenticated.',
 '27.04':'V139: archive_official_notification requiere read_at existente y estado read/processed; mark_official_notification_read solo transita pending/unread->read.',
 '27.05':'V139: al imprimir, componentes esperan await register_registry_print antes de generar vista; error impide proseguir. La constancia no certifica finalización física.',
 '27.12':'V139: catálogo 136 SECURITY DEFINER, 20 revisadas parcialmente, 116 pendientes; se amplió evidencia de dos RPC y del front de impresión.',
 '31.07':'V139: QA SQL 7 actuaciones legítimas, 4 denegadas, cinco estados; reproducciones previas de falsa lectura y regresión processed->read, con ROLLBACK.',
 '31.10':'V139: cero avisos ficticios ni bitácoras ficticias persistidos, ANULACION intacto 5 pendientes y 2 vinculados.',
 '32.03':'V139: 19 pruebas contractuales/rollback añadidas, 713/713 sintéticas y 28/28 tareas estrictas; build Vite correcto.',
 '32.05':'V139: dos fallos reales SQL reproducidos pre-fix: archivo cancelled generaba read_at y status archived, marcar processed como leído lo degradaba a read.',
 '32.06':'V139: SQL matriz post-fix pasó y V133 matrices previas de autoridad/aislamiento siguen pasando. Front de impresión ahora fallo visible.',
 '32.07':'V139: npm audit producción/completo 0 vulnerabilidades, CSS crítico y build correctos, gate 28/28.',
 '32.08':'V139: migración real 20261022170342 aplicada, QA SQL ROLLBACK, frontend en rama no desplegada; impresión en papel no ensayada.'
};
let touched=0;
for(const c of plan.controls){
 if(!notes[c.id])continue;
 c.evidence??=[];
 if(!c.evidence.includes(notes[c.id]))c.evidence.push(notes[c.id]);
 if(c.status==='PENDIENTE')c.status='EN_PROGRESO';
 c.updated_at=new Date().toISOString();touched++;
}
fs.writeFileSync(planFile,JSON.stringify(plan,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const tally={};for(const c of plan.controls)tally[c.status]=(tally[c.status]||0)+1;
if(tally.APROBADO!==10||(tally.FALLIDO||0)!==0)throw Error('Master state unexpected');
const report=[
 '# SACRAMENTUM · INTEGRIDAD DE NOTIFICACIONES OFICIALES E IMPRESIÓN · V139',
 '',
 '## Defectos reales reproducidos pre-fix',
 '- archive_official_notification permitía que una parroquia cambiara status=cancelled a archived y asignara read_at, aunque el decreto ya había sido cancelado. Reproducción QA script qa-rollback-cancelled-notice-archive-baseline-v139.sql, abortada por RAISE y ROLLBACK.',
 '- mark_official_notification_read degradaba un aviso status=processed a status=read. Reproducción QA script qa-rollback-processed-notice-read-baseline-v139.sql, abortada por RAISE y ROLLBACK.',
 '',
 '## Backend aplicado en Supabase',
 '- Migración: supabase/migrations/20261022170342_guard_official_notification_terminal_states_v139.sql.',
 '- Archive sólo acepta read o processed con read_at realmente existente; no fabrica lectura desde pending, no reabre cancelled/reversed y no archiva dos veces.',
 '- Mark Read sólo cambia pending/unread hacia read; deja read, processed, cancelled, archived intactos.',
 '- Las funciones siguen limitadas a la parroquia receptora, con SELECT FOR UPDATE y logs sobre actuaciones aceptadas.',
 '',
 '## Matriz de seguridad reversible',
 '- scripts/qa-rollback-notice-status-transitions-v139.sql: cinco estados (pending,read,processed,cancelled,archived), siete pasos legítimos, cuatro intentos no autorizados/contradictorios rechazados; PASS.',
 '- QA anteriores scripts/qa-rollback-marginal-note-notification-matrix-v133.sql y scripts/qa-rollback-cross-parish-notes-receipts-v133.sql repetidas, PASS.',
 '- El cliente authenticated continúa sin UPDATE directo a official_notifications. Consulta final: cero avisos QA y cero bitácoras QA. ANULACION cinco pendientes y dos vinculados sin alteración.',
 '',
 '## Frontend: solicitud de impresión auditada antes de mostrar impresión',
 '- ViewBaptismPartidaModal.jsx, ViewConfirmationPartidaModal.jsx, ViewMarriagePartidaModal.jsx y FuneralPartidasPage.jsx (partida y constancia): antes permitían mostrar/imprimir mientras el RPC registraba asíncronamente y cualquier fallo se reducía a console.warn.',
 '- Ahora esperan await registerRegistryPrint. Si falla, emiten toast destructive y no abren el contenido imprimible. Exequias cierra la ventana vacía al fallar.',
 '- marginalNotesV2Service.js ahora rechaza parroquia/partida ausente; no devuelve null en silencio.',
 '- Esto registra la SOLICITUD PREVIA de impresión, no confirma que el navegador, sistema operativo o impresora materialmente haya finalizado. La renderización y los permisos no se ensayaron con sesión real. Una aplicación web no puede garantizar un trabajo físico de impresión completado.',
 '',
 '## Verificación',
 '- scripts/test-official-notification-and-print-v139.mjs: 19 contratos de backend y frontend agregados al quality gate y CI.',
 '- AUDITORIA_PUERTA_CALIDAD_V139.json: '+n+' pruebas sintéticas, 28/28 tareas estrictas, build/CSS, npm audit full/runtime con 0 vulnerabilidades.',
 '- AUDITORIA_RPC_PRIVILEGIADAS_V139.json: 136 funciones SECDEF accesibles a authenticated, 20 con pruebas parciales, 116 restantes. register_registry_print sigue pendiente de auditoría individual profunda.',
 '- Plan maestro: '+touched+' controles con evidencia nueva; estado '+JSON.stringify(tally)+'.',
 '',
 '## Límites',
 '- La validación visual autenticada y la prueba de impresión física siguen pendientes. La auditoría solo puede afirmar que la interfaz propia exige registro previo.',
 '- Las variables de impresión seleccionadas por cliente y la conservación de notas en documentos históricamente revertidos requieren evaluación adicional.',
 '- No se desplegó frontend de esta rama ni se emitieron certificados reales.',
 '',
 '**Dictamen:** corregidos dos estados inconsistentes de avisos oficiales y eliminado éxito silencioso de los cinco flujos principales de impresión.'
];
fs.writeFileSync('AUDITORIA_NOTIFICACIONES_IMPRESION_V139_2026-10-22.md',report.join('\n')+'\n');
console.log('V139 '+JSON.stringify(tally)+' rpc='+rpc.total+' partial='+rpc.partial_reviewed+' pending='+rpc.not_fully_reviewed+' tests='+n+' checks='+gate.passed+'/'+gate.checks);
