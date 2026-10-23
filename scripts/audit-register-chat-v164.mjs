import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const load=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const gate=load('AUDITORIA_PUERTA_CALIDAD_V164.json');
const browser=load('AUDITORIA_AISLAMIENTO_CHAT_V164.json');
const tests=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
const dep=gate.tasks.filter(x=>x.name.startsWith('dependencias-'));
if(tests!==1142||gate.passed!==28||gate.checks!==28||gate.failed!==0||dep.length!==2||
 dep.some(x=>!x.ok||x.findingCounts?.total!==0)||
 browser.passed!==true||browser.steps.length!==7||browser.errors.length>0)
 throw Error('V164 evidence missing or failed');

const inv=load('AUDITORIA_RPC_PRIVILEGIADAS_V163.json');
if(inv.total_security_definer!==208||inv.authenticated_directly_executable!==147||
 inv.partially_tested!==37||inv.pending_direct_authorization_review!==110)
 throw Error('RPC baseline changed');
const promoted=new Set(['can_access_chat_room','current_chat_profile_id',
 'get_chat_room_messages','list_my_chat_rooms','send_chat_message']);
let promotedCount=0;
for(const fn of inv.functions){
 if(fn.schema!=='public'||!promoted.has(fn.function_name))continue;
 if(fn.review_status!=='PENDING_MANUAL_AUTHORIZATION_REVIEW')throw Error('Unexpected pre-audit state '+fn.function_name);
 fn.review_status='PARTIAL_TESTED_CHAT_RLS_V164';
 fn.test_evidence??=[];
 for(const evidence of ['scripts/qa-rollback-chat-role-rls-v164.sql','scripts/test-chat-session-isolation-v164.mjs'])
 if(!fn.test_evidence.includes(evidence))fn.test_evidence.push(evidence);
 promotedCount++;
}
if(promotedCount!==5)throw Error('Missing chat RPC '+promotedCount);
inv.protocol='V164';
inv.source='V163 inventory plus reversible production chat RLS verification; no SQL/privilege changes';
inv.review_context='V164 confirms 5 RPC authorized/denied in scoped chat QA, including only negative send; no foreign-diocese room fixture available, no full role E2E.';
inv.partially_tested=42;inv.pending_direct_authorization_review=105;
if(inv.partially_tested+inv.pending_direct_authorization_review!==inv.authenticated_directly_executable)throw Error('Privilege count invalid');
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V164.json',JSON.stringify(inv,null,2)+'\n');

const masterPath='AUDITORIA_MAESTRA_CONTROLES_V90.json';
const master=load(masterPath);
const note={
 '06.02':'V164: RLS SELECT bajo SET LOCAL ROLE authenticated: miembro legítimo puede leer su sala; actor sin perfil no puede leer sala ni mensajes. SQL read-only con ROLLBACK.',
 '06.06':'V164: auditoría parcial en cinco SECURITY DEFINER de Chat Diocesano, 42 de 147 funciones authenticated con evidencia parcial, 105 pendientes. Sin grants nuevos.',
 '06.07':'V164: can_access_chat_room false, get_chat_room_messages denegada y send_chat_message denegada a identidad sin perfil; falta actor válido de otra diócesis.',
 '19.01':'V164: perfil de miembro activo resuelve current_chat_profile_id y su sala bajo RLS; pertenencia validada en función SECURITY DEFINER.',
 '19.02':'V164: sin perfil, RLS de salas y mensajes oculta registros; no se pudo ensayar segunda diócesis REAL porque sólo una tiene chat configurado.',
 '19.03':'V164: send_chat_message rechaza una identidad sin perfil antes de escribir. Envío positivo y escenarios de concurrencia siguen pendientes.',
 '19.10':'V164: navegador Chrome ejecutó 7/7 transiciones de sesión A→B→logout→A, incluidas respuesta tardía y limpieza de realtime/draft; cuentas simuladas.',
 '27.03':'V164: prueba de chat IDOR con UUID real de sala y perfil inexistente bajo rol authenticated: denegado en acceso directo y RPC.',
 '31.07':'V164: consulta QA reversible contra Supabase real; sin contenidos de mensajes publicados, sin cambios sacramentales ni escrituras persistentes.',
 '31.10':'V164: Chat Diocesano QA sólo lectura real bajo BEGIN/ROLLBACK; Chrome local con datos y roles sintéticos.',
 '32.03':'V164: 17 tests nuevos, total '+tests+'/'+tests+' sintéticos y '+gate.passed+'/'+gate.checks+' Quality Gate; npm audit 0 hallazgos.',
 '32.05':'V164: se corrigió riesgo de conservar chat anterior en cambio de cuenta; instancia React key por identidad y desuscripción contra respuestas tardías.',
 '32.06':'V164: frontend chat corregido y compilado localmente; backend sin migraciones.',
 '32.07':'V164: Vite build, checks CSS, ensayos históricos y npm audit producción+total aprobaron.',
 '32.08':'V164: QA local de cambio de cuenta 7/7, RLS real 1 miembro/1 actor sin perfil. Faltan E2E reales de dos diócesis y concurrencia.'
};
const toProgress=new Set(['19.01','19.02','19.03','19.10']);
let updated=0,promotedControls=0;
for(const c of master.controls){
 if(!note[c.id])continue;
 c.evidence??=[];if(!c.evidence.includes(note[c.id]))c.evidence.push(note[c.id]);
 if(toProgress.has(c.id) && c.status==='PENDIENTE'){
  c.status='EN_PROGRESO';promotedControls++;
 }
 c.updated_at=new Date().toISOString();
 updated++;
}
if(promotedControls!==4)throw Error('Expected 4 newly in-progress Chat controls, got '+promotedControls);
fs.writeFileSync(masterPath,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const stats={};for(const c of master.controls)stats[c.status]=(stats[c.status]||0)+1;
if(stats.APROBADO!==10||stats.EN_PROGRESO!==106||stats.PENDIENTE!==209)throw Error('Unexpected master stats '+JSON.stringify(stats));
const report=[
 '# SACRAMENTUM — V164 · CHAT DIOCESANO, AISLAMIENTO DE CUENTAS Y RLS',
 '',
 'Fecha 2026-10-23. Módulo institucional Chat Diocesano (Parroquia, Diócesis y Cancillería).',
 '',
 '## Hallazgo',
 'La pantalla CommunicationsPage tenía estado React persistente de conversaciones, mensajes, borradores y suscripción por sala, inicializaba sólo con useEffect([]) y no reiniciaba su subárbol al cambiar de usuario o jurisdicción dentro de la aplicación. Existía riesgo de exposición temporal de información de la cuenta anterior al reutilizar la pantalla en sesiones compartidas.',
 '',
 '## Corrección implementada',
 '- Nuevo wrapper CommunicationsPage toma useAuth, exige authId y perfil activo de rol admitido; sin ellos bloquea el montaje del Chat.',
 '- CommunicationsPageSession key basada en authId, perfil, rol, diócesis, parroquia y cancillería; al cambiar cualquiera desmonta todo el subárbol. Se eliminan instantáneamente salas, mensajes, borradores y participantes asociados a la cuenta anterior.',
 '- La suscripción en tiempo real verifica cancelled después de loadMessages y, si termina después del desmontaje, se desuscribe inmediatamente antes de ser utilizada.',
 '- Sin migraciones, sin concesiones de permisos y sin modificación de mensajes existentes.',
 '',
 '## Prueba física en Chrome aislado',
 '- scripts/audit-chat-session-browser-v164.mjs ejecutó el componente React auténtico con dos perfiles y dos diócesis completamente ficticios.',
 '- 7/7: perfil A ve sólo su sala y mensaje; cambio B sin A y borrador A; B carga mensajes propios; respuesta lenta A no se reintroduce; logout elimina mensajes y finaliza suscripción; A regresa sin arrastrar contenido B ni borrador anterior.',
 '- Captura PNG real y observaciones en AUDITORIA_EVIDENCIA_CHAT_V164/v164-chat-b-excludes-a.png y AUDITORIA_AISLAMIENTO_CHAT_V164.json.',
 '',
 '## Supabase RLS ejecutado en vivo y revertido',
 '- scripts/qa-rollback-chat-role-rls-v164.sql: miembro activo autorizado obtiene sala e historial; una identidad aleatoria autenticada sin perfil no accede a salas/mensajes vía SELECT, no ve conversaciones propias ni puede invocar lectura/envío del chat ajeno.',
 '- Utilizó SET LOCAL ROLE authenticated y manipulación de claims solamente dentro de BEGIN/ROLLBACK. Sin persistencia ficticia ni modificación de datos reales.',
 '- En la BD había dos salas en una sola diócesis; por tanto no es prueba de un miembro real de otra diócesis. Se deja abierta esa validación.',
 '',
 '## Calidad y riesgo residual',
 '- '+tests+'/'+tests+' pruebas sintéticas, '+gate.passed+'/'+gate.checks+' verificaciones de calidad; compila y npm audit no reporta vulnerabilidades.',
 '- 5 funciones SECURITY DEFINER de chat con revisión parcial adicional: inventario '+inv.total_security_definer+', funciones authenticated '+inv.authenticated_directly_executable+', verificadas parcialmente '+inv.partially_tested+', todavía pendientes '+inv.pending_direct_authorization_review+'.',
 '- Plan maestro '+JSON.stringify(stats)+'; 4 controles nuevos pasan de PENDIENTE a EN_PROGRESO y otros controles reciben evidencia. Ninguno pasa a APROBADO.',
 '- Resta verificar chat E2E con cuentas reales, otras diócesis, envío y retiro positivos y concurrencia PostgreSQL simultánea.',
 '',
 '**Dictamen:** mitigación del riesgo de retención de chat entre cuentas demostrada en navegador y autorizaciones negativas respaldadas por RLS real. Certificación integral pendiente.'
];
fs.writeFileSync('AUDITORIA_CHAT_SEGURIDAD_SESIONES_V164_2026-10-23.md',report.join('\n')+'\n');
console.log('V164 registered: '+updated+' control evidences, '+promotedControls+' progress, '+tests+' tests, '+gate.passed+'/'+gate.checks+' checks');
