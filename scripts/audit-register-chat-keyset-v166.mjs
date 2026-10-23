import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const gate=load('AUDITORIA_PUERTA_CALIDAD_V166.json');
const browser=load('AUDITORIA_CHAT_PAGINACION_VISUAL_V166.json');
const n=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
const deps=gate.tasks.filter(x=>x.name.startsWith('dependencias-'));
if(n!==1176||gate.passed!==28||gate.checks!==28||gate.failed!==0||
 deps.length!==2||deps.some(x=>!x.ok||x.findingCounts?.total!==0)||
 !browser.passed||browser.steps.length!==6||browser.errors.length!==0)
 throw Error('V166 quality/browser evidence incomplete');

const inv=load('AUDITORIA_RPC_PRIVILEGIADAS_V165.json');
if(inv.total_security_definer!==208||inv.authenticated_directly_executable!==147||
 inv.partially_tested!==44||inv.pending_direct_authorization_review!==103||
 inv.functions.some(x=>x.function_name==='get_chat_room_messages_v166'))
 throw Error('RPC inventory drift');
inv.functions.push({
 schema:'public',function_name:'get_chat_room_messages_v166',
 signature:'public.get_chat_room_messages_v166(p_room_id uuid, p_limit integer, p_before_created_at timestamp with time zone, p_before_id uuid)',
 authenticated_execute:true,authenticated_schema_usage:true,directly_executable_by_authenticated:true,
 anon_execute:false,definition_chars:1651,potentially_mutating_heuristic:false,
 references_auth_uid_heuristic:false,checks_legacy_scope_heuristic:false,checks_parish_scope_heuristic:false,
 review_status:'PARTIAL_TESTED_CHAT_KEYSET_AUTH_AND_PAGINATION_V166',
 test_evidence:[
  'supabase/migrations/20261023144508_chat_history_keyset_v166.sql',
  'scripts/qa-rollback-chat-keyset-complete-v166.sql',
  'AUDITORIA_CHAT_PAGINACION_VISUAL_V166.json',
  'scripts/test-chat-history-keyset-v166.mjs'
 ]
});
inv.protocol='V166';
inv.source='V165 catalog plus new get_chat_room_messages_v166 SECURITY DEFINER with real auth/keyset testing';
inv.total_security_definer=209;
inv.by_schema.public=200;
inv.public_authenticated_executable=145;
inv.authenticated_directly_executable=148;
inv.partially_tested=45;
inv.pending_direct_authorization_review=103;
inv.review_context='V166 real PostgreSQL authenticated test: 305 timestamp-identical legacy + 7 recent messages, 312 unique complete over 5 calls, 6 denied malformed/non-member requests. Browser 6/6 with session change; no live 2-connection concurrency or two-diocese E2E.';
if(inv.functions.length!==209||inv.partially_tested+inv.pending_direct_authorization_review!==inv.authenticated_directly_executable)
 throw Error('V166 privilege inventory totals incorrect');
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V166.json',JSON.stringify(inv,null,2)+'\n');

const masterPath='AUDITORIA_MAESTRA_CONTROLES_V90.json',master=load(masterPath);
const notes={
 '06.02':'V166: sala scope enforced in versioned SECURITY DEFINER; actual active nonmember denied despite authenticated role.',
 '06.06':'V166: 209 SECURITY DEFINER, 148 authenticated, 45 reviewed partially and 103 pending. Existing auth grants unchanged, new RPC limited to authenticated.',
 '06.07':'V166: negative auth: actual Parish member of other room and active Diocese user outside target room both denied for historical chat.',
 '19.02':'V166: target room isolated by can_access_chat_room under PostgreSQL authenticated, including active but unrelated member.',
 '19.05':'V166: new historical paging preserves chronological stable (created_at,id); latest and old reading contract unchanged.',
 '19.07':'V166: historical page size 1–100 and cursor validation; 101, 0 and partial cursor denied.',
 '19.09':'V166: 312 messages with 305 identical historical timestamps retrieved in five keyset calls (80+80+80+72+0), without skips/duplicates. Real Supabase ROLLBACK and Chrome page 80→160→240→312.',
 '19.10':'V166: after full historical load, switching to different institutional identity removed prior history instantly in real Chrome mock test.',
 '27.03':'V166: RLS/SECURITY DEFINER prevents cross-room historical data from active but unrelated authenticated roles.',
 '31.07':'V166: 305 legacy + 7 newer messages inserted only inside BEGIN/ROLLBACK, zero residual QA rooms/messages after live test.',
 '31.10':'V166: QA synthetic data isolated, real chats and sacramental registers untouched; no grants to anon.',
 '32.03':'V166: 19 additional contract tests, 1176/1176 synthetic, 28/28 gate; browser visual 6/6.',
 '32.05':'V166: date-only legacy RPC remains for compatibility; new RPC uses composite keyset and isolated UI older-message cursor.',
 '32.06':'V166: Supabase migration 20261023144508 applied; frontend Chat supports older pages without clearing current/received messages.',
 '32.07':'V166: production build CSS and npm audits passed, no vulnerabilities reported.',
 '32.08':'V166: old chat history recovered completely with timestamp tie and user-switch test; still lacks E2E with real different dioceses and true concurrent PostgreSQL connections.'
};
let updated=0,progress=0;
for(const c of master.controls){
 if(!notes[c.id])continue;
 c.evidence??=[];
 if(!c.evidence.includes(notes[c.id]))c.evidence.push(notes[c.id]);
 if(c.id==='19.09'&&c.status==='PENDIENTE'){c.status='EN_PROGRESO';progress++;}
 c.updated_at=new Date().toISOString();
 updated++;
}
if(progress!==1)throw Error('V166 pagination control should advance to partial progress only');
fs.writeFileSync(masterPath,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const counts={};for(const c of master.controls)counts[c.status]=(counts[c.status]||0)+1;
if(counts.APROBADO!==10||counts.EN_PROGRESO!==111||counts.PENDIENTE!==204)
 throw Error('Master status mismatch '+JSON.stringify(counts));

const report=[
 '# SACRAMENTUM — V166 · Paginación íntegra del historial del Chat Diocesano',
 '',
 'Fecha 2026-10-23. GitHub issue #9.',
 '',
 '## Defecto preexistente',
 '- La RPC get_chat_room_messages usaba cursor p_before como fecha exclusiva; si muchos mensajes históricos tenían la misma fecha y se cortaba la página por el medio, se omitía el resto de esos mensajes.',
 '- Se preserva RPC anterior para compatibilidad de clientes históricos. El frontend actual usa la nueva RPC V166.',
 '',
 '## Corrección efectiva',
 '- Migration Supabase: 20261023144508_chat_history_keyset_v166.sql. Nueva RPC get_chat_room_messages_v166 recibe p_before_created_at + p_before_id.',
 '- Consulta antigua por (created_at,id) < (fecha,id) con ORDER BY created_at DESC,id DESC, tamaño 1–100. La salida ordena de antiguo a reciente. Índice (room_id,created_at DESC,id DESC).',
 '- SECURITY DEFINER con search_path public y comprobación obligatoria can_access_chat_room. Sólo autenticados tienen EXECUTE; anon no. No hay permiso directo sobre tabla para nuevos roles.',
 '- ChatService actualizado para pasar cursor doble. CommunicationsPage incluye Cargar 80 mensajes anteriores, fusiona por UUID sin duplicados, conserva el historial al recibir mensajes recientes y desactiva auto-scroll al cargar páginas antiguas.',
 '- El selector de sala utiliza versión de consulta y roomId para descartar resultados tardíos de otra sala, y en cambio de usuario el subárbol se desmonta (v164).',
 '',
 '## Evidencia real y visual',
 '- scripts/qa-rollback-chat-keyset-complete-v166.sql ejecutado sobre Supabase instalado: 305 mensajes de exactamente 2012-01-01T10:00:00Z más 7 recientes. 312 únicos recuperados: 80+80+80+72, seguida de página vacía.',
 '- Seis operaciones malformadas/ajenas denegadas: page >100, 0, cursor incompleto por ambos lados y dos perfiles activos ajenos a la sala.',
 '- Ensayo siempre BEGIN/ROLLBACK y comprobación independiente: 0 salas y 0 mensajes QA-V166 remanentes, índice presente, authenticated EXECUTE true, anon false.',
 '- scripts/audit-chat-history-browser-v166.mjs utilizó Chat React verdadero en Chrome con mocks estrictamente locales: 6/6 pasos, 312/312, sin duplicados, sin overflow y eliminación de historia de la primera cuenta al cambiar a otra. Captura AUDITORIA_EVIDENCIA_CHAT_V166/v166-chat-history-312.png.',
 '- Reejecución de regresión V164: 7/7 cambios de identidad/desuscripciones sobre Chat React con mocks, sin fugas.',
 '',
 '## Calidad y limitaciones',
 '- '+n+'/'+n+' sintéticas, '+gate.passed+'/'+gate.checks+' controles gate; npm audits y build sin hallazgos.',
 '- Inventario '+inv.total_security_definer+' privileged functions, '+inv.authenticated_directly_executable+' authenticated, '+inv.partially_tested+' partially reviewed y '+inv.pending_direct_authorization_review+' pendientes.',
 '- Plan maestro '+JSON.stringify(counts)+'; '+updated+' controles con nuevas evidencias y 19.09 pasa de pendiente a en progreso sin certificación completa.',
 '- No se han probado aún sesiones reales de dos diócesis ni transacciones simultáneas PostgreSQL con locks y barrera. El paso de revisión parcial a APROBADO exige ambas dimensiones.',
 '',
 '**Dictamen:** bug de paginación por timestamps iguales corregido y comprobado en Supabase y Chrome aislado; auditoría integral permanece abierta.'
];
fs.writeFileSync('AUDITORIA_CHAT_HISTORIAL_PAGINADO_V166_2026-10-23.md',report.join('\n')+'\n');
console.log('V166 registered '+n+' tests '+gate.passed+'/'+gate.checks+' gate '+updated+' controls, master '+JSON.stringify(counts));
