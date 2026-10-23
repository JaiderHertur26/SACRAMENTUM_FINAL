import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const gate=load('AUDITORIA_PUERTA_CALIDAD_V165.json');
const n=Number(gate.tasks.find(t=>t.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
const deps=gate.tasks.filter(t=>t.name.startsWith('dependencias-'));
if(n!==1157||gate.passed!==28||gate.checks!==28||gate.failed!==0||
 deps.length!==2||deps.some(t=>!t.ok||t.findingCounts?.total!==0))throw Error('V165 quality gate incomplete');
const inventory=load('AUDITORIA_RPC_PRIVILEGIADAS_V164.json');
if(inventory.total_security_definer!==208||inventory.authenticated_directly_executable!==147||
 inventory.partially_tested!==42||inventory.pending_direct_authorization_review!==105)throw Error('V164 RPC baseline drift');
let promoted=0;
for(const f of inventory.functions){
 if(f.schema!=='public'||!['mark_chat_room_read','withdraw_chat_message'].includes(f.function_name))continue;
 if(f.review_status!=='PENDING_MANUAL_AUTHORIZATION_REVIEW')throw Error('Unexpected V165 RPC state '+f.function_name);
 f.review_status='PARTIAL_TESTED_CHAT_LIFECYCLE_V165';
 f.test_evidence??=[];
 for(const ev of ['scripts/qa-rollback-chat-full-lifecycle-v165.sql','supabase/migrations/20261023142209_chat_message_order_consistency_v165.sql'])
 if(!f.test_evidence.includes(ev))f.test_evidence.push(ev);
 promoted++;
}
if(promoted!==2)throw Error('V165 expected to promote 2 RPCs not '+promoted);
inventory.protocol='V165';
inventory.source='V164 plus V165 real rollback full chat role matrix; two further privileged RPCs partially verified.';
inventory.partially_tested=44;inventory.pending_direct_authorization_review=103;
inventory.review_context='V165: full positive chat send/reply/read/withdraw and negative same-diocese active non-member checks under authenticated; deterministic timestamp cursor fixed. Cross-diocese registered actor and real concurrent connections still pending.';
if(inventory.functions.length!==208||inventory.partially_tested+inventory.pending_direct_authorization_review!==147)throw Error('Unexpected new inventory counts');
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V165.json',JSON.stringify(inventory,null,2)+'\n');
const master=load('AUDITORIA_MAESTRA_CONTROLES_V90.json');
const notes={
 '06.02':'V165: usuario activo con perfil pero sin membresía ve 0 chat_messages y 0 chat_rooms por RLS, aunque pertenece a la misma diócesis.',
 '06.06':'V165: mark_chat_room_read y withdraw_chat_message tienen nueva verificación parcial; 44 RPC privilegiadas revisadas parcialmente, 103 pendientes.',
 '06.07':'V165: nueve casos denegados por roles/propiedad/validación, incluidos lectura, escritura, recibo de lectura y retiro de mensaje de tercero.',
 '19.01':'V165: parroquia y cancillería participaron en sala ficticia; diócesis pertenecía a otra sala y no pudo acceder a la primera.',
 '19.02':'V165: parroquia/cancillería autorizadas vs diócesis activa sin membresía (IDOR) bajo SET LOCAL ROLE authenticated; SELECT y RPC denegados.',
 '19.03':'V165: envío legítimo parroquial y de cancillería, con autor de perfil correcto. Intento de envío en sala ajena y mensaje vacío denegados.',
 '19.04':'V165: reply_to_id del mensaje nuevo vinculado a mensaje inicial; referencia UUID inexistente rechazada.',
 '19.05':'V165: marca de lectura apunta al último ID de mensaje incluso si los timestamps históricos son idénticos, después de corrección de orden estable.',
 '19.06':'V165: cancillería retira sólo mensaje propio y la lectura muestra Mensaje retirado; retiro ajeno y duplicado denegados.',
 '19.07':'V165: mensaje de 4001 caracteres rechazado, texto vacío rechazado; límite validado del lado servidor.',
 '19.09':'V165: orden estable mediante (created_at,id) probado también con timestamps históricos iguales; cursor p_before por fecha sola aún no prueba paginación exhaustiva y permanece pendiente.',
 '27.03':'V165: tercera identidad institucional con perfil activo no miembro no puede leer, enviar, marcar ni retirar en sala de otra cuenta.',
 '31.07':'V165: 7 operaciones positivas, 9 negativas en Supabase real bajo authenticated; salas y mensajes ficticios ROLLBACK.',
 '31.10':'V165: ninguna sala o mensaje QA-V165 permanece tras revertir transacción; sin datos sacramentales alterados.',
 '32.03':'V165: 15 nuevas pruebas contractuales de migración y QA SQL, total 1157/1157 y puerta de calidad 28/28.',
 '32.05':'V165: detectado y reparado orden ambiguo en chat: now() constante durante transacción, cursor de leído podía retroceder.',
 '32.06':'V165: migración Supabase aplicada 20261023142209_chat_message_order_consistency_v165; frontend existente sin cambios funcionales en esta etapa.',
 '32.07':'V165: Vite compilado, CSS y auditorías npm producción+completa sin hallazgos, Quality Gate PASS.',
 '32.08':'V165: empate artificial de fecha en mensajes históricos sometido a cursor, historial y resumen de sala. Falta concurrencia de conexiones y pruebas E2E entre distintas diócesis.'
};
let touched=0,progress=0;
const candidates=new Set(['19.04','19.05','19.06','19.07']);
for(const c of master.controls){
 const ev=notes[c.id];if(!ev)continue;
 c.evidence??=[];if(!c.evidence.includes(ev))c.evidence.push(ev);
 if(candidates.has(c.id)&&c.status==='PENDIENTE'){c.status='EN_PROGRESO';progress++}
 c.updated_at=new Date().toISOString();touched++;
}
if(progress!==4)throw Error('Expected 4 new progress controls, found '+progress);
fs.writeFileSync('AUDITORIA_MAESTRA_CONTROLES_V90.json',JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const states={};for(const c of master.controls)states[c.status]=(states[c.status]||0)+1;
if(states.APROBADO!==10||states.EN_PROGRESO!==110||states.PENDIENTE!==205)throw Error('Unexpected master status '+JSON.stringify(states));
const report=[
 '# SACRAMENTUM — V165 · Ciclo completo del Chat Diocesano',
 '',
 'Fecha 23 de octubre de 2026. Enlace: https://github.com/JaiderHertur26/SACRAMENTUM_FINAL',
 '',
 '## Hallazgo confirmado',
 '- Dentro de PostgreSQL, now() es constante durante una transacción. La función send_chat_message utilizaba la hora por defecto now(); si se enviaban dos mensajes dentro de una transacción, podían compartir created_at.',
 '- mark_chat_room_read elegía el último por ORDER BY created_at DESC sin segundo criterio. Una prueba real con 2 envíos válidos dentro de una transacción provocó que el recibo señalara otro mensaje. El ensayo abortó y revirtió los datos.',
 '',
 '## Corrección aplicada',
 '- Migración efectiva Supabase: 20261023142209_chat_message_order_consistency_v165.sql.',
 '- chat_messages.created_at tiene ahora DEFAULT clock_timestamp(); send_chat_message fija explícitamente la fecha de envío mediante clock_timestamp() para cada inserción.',
 '- mark_chat_room_read ordena por created_at DESC,id DESC; get_chat_room_messages usa el mismo desempate y agrega de antiguo a reciente por created_at,id. list_my_chat_rooms también desempata el mensaje de vista previa.',
 '- No hay UPDATE de mensajes históricos, DROP, ni cambio de privilegios. Las cuatro funciones conservan SECURITY DEFINER y search_path.',
 '',
 '## Prueba funcional positiva y negativa en Supabase',
 '- scripts/qa-rollback-chat-full-lifecycle-v165.sql: usuario real activo de Parroquia emite mensaje y respuesta; usuario de Cancillería responde y retira su propio mensaje; Diócesis (usuario real activo, pero excluido de la sala ficticia) no puede ver, escribir, marcar como leído ni retirar.',
 '- 7 verificaciones positivas y 9 operaciones denegadas (vacío, >4000, referencia errónea, retiro ajeno/duplicado, acceso/operación de no miembro).',
 '- Reproducción complementaria de timestamps históricos idénticos: se fija fecha igual a los tres mensajes ficticios; cursor, historial y resumen de sala concuerdan en ID ordenado.',
 '- La prueba se ejecutó tras aplicar la migración, bajo SET LOCAL ROLE authenticated y con BEGIN/ROLLBACK. Cero salas y mensajes de QA-V165 residuales.',
 '',
 '## Calidad, alcance y limitaciones',
 '- '+n+'/'+n+' pruebas sintéticas, '+gate.passed+'/'+gate.checks+' verificaciones generales. Compilación y auditorías de dependencias correctas sin vulnerabilidades reportadas.',
 '- Registro RPC: '+inventory.total_security_definer+' SECURITY DEFINER, '+inventory.authenticated_directly_executable+' ejecutables autenticadas, '+inventory.partially_tested+' con evidencia parcial, '+inventory.pending_direct_authorization_review+' pendientes de revisión manual.',
 '- Plan maestro '+JSON.stringify(states)+': cuatro controles de Chat avanzan a EN_PROGRESO, ninguno se certifica integralmente.',
 '- Paginación total de chat aún no certificada: la firma actual p_before por timestamp puede omitir mensajes antiguos si varias filas históricas comparten exactamente la misma fecha; separar nuevo cursor compuesto en siguiente etapa.',
 '- Sesiones reales de diferentes diócesis y dos conexiones PostgreSQL realmente simultáneas siguen pendientes.',
 '',
 '**Dictamen:** defecto de orden y lectura corregido y verificado, ciclo de mensajería probado reversiblemente, certificación integral permanece abierta.'
];
fs.writeFileSync('AUDITORIA_CICLO_CHAT_ORDEN_V165_2026-10-23.md',report.join('\n')+'\n');
console.log('V165 REGISTERED '+n+' tests '+gate.passed+'/'+gate.checks+' controls updated='+touched+' progress='+progress);
