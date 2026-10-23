import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const load=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const gate=load('AUDITORIA_PUERTA_CALIDAD_V156.json');
const tests=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
const audits=gate.tasks.filter(x=>x.name.startsWith('dependencias-'));
if(tests!==1005||gate.checks!==28||gate.passed!==28||gate.failed!==0||
 audits.length!==2||audits.some(x=>!x.ok||x.findingCounts?.total!==0)){
 throw Error('V156 quality gate evidence incomplete: '+tests);
}
const snap=load('AUDITORIA_RPC_PRIVILEGIADAS_V155.json');
if(snap.total_security_definer!==200||snap.authenticated_directly_executable!==139||
 snap.partially_tested!==30||snap.pending_direct_authorization_review!==109)throw Error('Baseline V155 changed');
const props=[
 ['request_later_note_reconciliation_v156','p_decree_id uuid, p_note_id uuid, p_reason text, p_source_reference text',true],
 ['approve_later_note_reconciliation_v156','p_case_id uuid, p_authorization_reference text, p_approval_reason text',true],
 ['execute_later_note_reconciliation_v156','p_case_id uuid',true],
 ['list_later_note_reconciliations_v156','p_diocese_id uuid',false]
];
const proofs=['supabase/migrations/20261023030534_later_note_institutional_reconciliation_v156.sql',
 'scripts/qa-rollback-note-reconciliation-grants-v156.sql',
 'scripts/test-later-note-institutional-reconciliation-v156.mjs',
 'AUDITORIA_PUERTA_CALIDAD_V156.json'];
for(const [name,args,partial] of props){
 if(snap.functions.some(x=>x.schema==='public'&&x.function_name===name))
  throw Error('Duplicate V156 function inventory: '+name);
 snap.functions.push({
  schema:'public',function_name:name,
  signature:'public.'+name+'('+args+')',
  authenticated_execute:true,authenticated_schema_usage:true,
  directly_executable_by_authenticated:true,anon_execute:false,
  definition_chars:null,potentially_mutating_heuristic: name!=='list_later_note_reconciliations_v156',
  references_auth_uid_heuristic:true,
  checks_legacy_scope_heuristic:false,checks_parish_scope_heuristic:name==='request_later_note_reconciliation_v156'||name==='execute_later_note_reconciliation_v156',
  review_status:partial?'PARTIAL_TESTED_INSTITUTIONAL_REVERSIBLE_ROLE_MATRIX_V156':'PENDING_LIVE_LIST_AUTHORIZATION_SCOPE_REVIEW',
  test_evidence:proofs
 });
}
snap.protocol='V156';
snap.source='V155 live catalog, live V156 pg_proc totals 195 public+9 private and 4 newly deployed RPCs; exact new function sizes not recaptured.';
snap.total_security_definer=204;
snap.by_schema={public:195,private:9};
snap.authenticated_directly_executable=143;
snap.public_authenticated_executable=140;
snap.not_directly_executable_by_authenticated=61;
snap.partially_tested=33;
snap.pending_direct_authorization_review=110;
snap.audit_scope_note+=' V156 approvals/execute dynamic QA in BEGIN/ROLLBACK but public UI not physically tested and list RPC only static-reviewed.';
if(snap.functions.length!==204)throw Error('Inventory length V156 '+snap.functions.length);
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V156.json',JSON.stringify(snap,null,2)+'\n');
const path='AUDITORIA_MAESTRA_CONTROLES_V90.json';
const master=load(path);
const v={
'06.05':'V156: circuito de conciliación de nota manual independiente, autorizado por dos roles y ejecutado atómicamente con reversión, auditoría y aviso parroquial.',
'06.06':'V156: 4 RPC nuevas SECURITY DEFINER verificadas en SQL, 204 totales (195 public/9 private), 143 ejecutables authenticated; 33 evidencias parciales, 110 pendientes.',
'06.07':'V156: Cancillería solicita/ejecuta, Diócesis aprueba con identidad distinta; Parroquia no puede solicitar, Diócesis no puede ejecutar.',
'06.08':'V156: expediente protegido con tabla sin grants directos a authenticated y RLS habilitado. RPC expuestas solo a authenticated, no a anon.',
'12.07':'V156: conserva instantánea íntegra de nota al solicitar; si nota o decreto cambian antes de autorizar/ejecutar, el procedimiento rechaza.',
'14.04':'V156: notas manuales independientes activas y opcionales son elegibles; notas obligatorias, bloqueadas o vinculadas a otro decreto excluidas.',
'14.06':'V156: nota conciliada sólo dentro de la misma transacción que la reversión; si otra nota vigente impide la operación, se revierte íntegramente.',
'20.02':'V156: flujo institucional de conciliación con referencia documental, motivo, autorización diferente y ejecución por Cancillería; integrado a rutas y servicio.',
'24.12':'V156: circuito genera eventos de solicitud, autorización, nota conciliada y ejecución; notificación con categoría decree_reconciliation para evitar duplicación.',
'27.01':'V156: cuatro nuevas RPC privilegiadas declaradas y protegidas con autorización scoped por diócesis; list se mantiene pendiente de QA dinámica individual.',
'27.04':'V156: prueba SQL reversible postmigración de solicitud, aprobación y ejecución con 6 negativos, incluida segunda nota activa, sin efectos permanentes.',
'27.12':'V156: 143 funciones ejecutables de 204 SECURITY DEFINER; 33 parcialmente revisadas, 110 por revisar; 61 sin ejecución directa requieren cadena de llamadas.',
'28.06':'V156: expediente de conciliación mantiene trazas de autoridad y razón de cierre de nota, además del aviso parroquial asociado al decreto.',
'31.07':'V156: pruebas reales de roles, autorización distinta, denegación de ejecución previa, rechazo si queda otra nota, idempotencia y rollback.',
'31.10':'V156: cero casos de prueba QA persistentes, debido a BEGIN/ROLLBACK; no se ejecutaron actuaciones sobre registros reales.',
'32.03':'V156: 29 pruebas contractuales nuevas; total 1005/1005 sintéticas y Quality Gate 28/28.',
'32.05':'V156: corregido conflicto de unicidad de notificación original cambiando categoría a decree_reconciliation antes de desplegar.',
'32.06':'V156: migración 20261023030534 aplicada al backend Supabase, pruebas SQL postmigración correctas; frontend integrado localmente.',
'32.07':'V156: npm build y auditorías de dependencias producción+completo sin hallazgos; Quality Gate completo 28/28.',
'32.08':'V156: pruebas SQL reales aprobadas, pero ejecución por personas reales, UI física, concurrencia de conexiones independientes y despliegue frontend todavía no certificados.'
};
let touched=0;
for(const c of master.controls){const item=v[c.id];if(!item)continue;c.evidence??=[];if(!c.evidence.includes(item))c.evidence.push(item);c.updated_at=new Date().toISOString();touched++;}
fs.writeFileSync(path,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const states={};for(const c of master.controls)states[c.status]=(states[c.status]||0)+1;
if(states.APROBADO!==10||states.EN_PROGRESO!==102||states.PENDIENTE!==213||(states.FALLIDO||0)!==0)throw Error('Master state changed '+JSON.stringify(states));
const report=[
 '# SACRAMENTUM — V156 · CIRCUITO INSTITUCIONAL DE CONCILIACIÓN DE NOTAS POSTERIORES',
 '',
 '## Problema y alcance',
 '- V154 y V155 bloqueaban correctamente la reversión cuando existía una nota marginal manual posterior independiente. Faltaba un mecanismo autorizado y auditable para conciliar esa nota y completar la reversión de forma atómica.',
 '- V156 implementa un expediente que no permite borrar el texto original ni resolver notas obligatorias, bloqueadas o vinculadas a otros decretos.',
 '',
 '## Backend y permisos',
 '- Migración instalada en Supabase: 20261023030534_later_note_institutional_reconciliation_v156.sql.',
 '- Tabla later_note_reconciliations_v156: pendiente → autorizado → ejecutado, con evidencia, snapshot, actor, referencias, justificaciones y tiempos. RLS habilitado; sin acceso de tabla directo a authenticated ni anon.',
 '- Funciones request, approve, execute y list. Las tres primeras se probaron dinámicamente; list se verificó por código y permanece pendiente de QA física autenticada.',
 '- Cancillería solicita. Cuenta de Diócesis distinta del solicitante autoriza. Cancillería ejecuta. Sólo notas de tipo manual, activas, no obligatorias, desbloqueadas y sin vínculo con otro decreto pueden entrar.',
 '- En ejecución se coteja snapshot y jurisdicción; se cambia únicamente la nota autorizada; se llama a la reversión del decreto dentro de la misma transacción. Si otra nota posterior impide revertir, ambas modificaciones se revierten.',
 '- La auditoría incluye solicitud, aprobación, cierre de nota y ejecución. Se genera notificación a la parroquia con categoría propia decree_reconciliation para respetar la unicidad de avisos por decreto.',
 '',
 '## Pruebas reales reversibles en Supabase',
 '- Caso de reposición matrimonial ficticia: solicitud Cancillería, autorización Diócesis independiente y ejecución Cancillería; decreto/partida/nota/caso quedan correctamente marcados dentro de la transacción. Auditoría de 3 eventos y aviso parroquial verificados.',
 '- Matriz postmigración: seis denegaciones correctas (Parroquia sin competencia, ejecución sin aprobación, autoaprobación, ejecución por Diócesis, otra nota manual activa no conciliada, segunda ejecución del mismo expediente).',
 '- Se comprobó que al fallar por una segunda nota manual activa la primera nota y decreto se mantienen vigentes y expediente sigue autorizado.',
 '- Verificación grants/RLS: scripts/qa-rollback-note-reconciliation-grants-v156.sql pasó. No se otorgó SELECT/UPDATE directos a authenticated, ni EXECUTE a anon.',
 '- Todos los casos ficticios se probaron dentro de BEGIN/ROLLBACK. Consulta de residuos: 0 casos QA-V156 persistidos.',
 '',
 '## Frontend de código local',
 '- Nueva página src/pages/chancery/LaterNoteReconciliationPage.jsx con formulario de solicitud, búsqueda de notas elegibles, listado de expedientes, autorización diocesana, ejecución confirmada y mensajes de error.',
 '- Rutas protegidas /chancery/decretos/conciliaciones y /diocese/decretos/conciliaciones, con enlaces desde ambos archivos de decretos. Servicio RPC aislado en src/services/laterNoteReconciliationService.js.',
 '- La interfaz sólo invoca RPC; no actualiza directamente marginal_notes/decretos.',
 '- Build de Vite correcto. La navegación física autenticada no se ha certificado y no se desplegó el frontend a Vercel.',
 '',
 '## Auditoría V156',
 '- '+tests+'/'+tests+' pruebas sintéticas, '+gate.passed+'/'+gate.checks+' controles; build y auditoría npm production+desarrollo sin vulnerabilidades informadas.',
 '- Catálogo SECURITY DEFINER '+snap.total_security_definer+' (public '+snap.by_schema.public+', private '+snap.by_schema.private+'); ejecutables por authenticated '+snap.authenticated_directly_executable+', con '+snap.partially_tested+' revisadas parcialmente y '+snap.pending_direct_authorization_review+' pendientes.',
 '- Plan maestro '+JSON.stringify(states)+'; se añadieron evidencias a '+touched+' controles; ningún control global fue ascendido a aprobado artificialmente.',
 '',
 '## Limitaciones expresas',
 '- No se verificó concurrencia real con dos conexiones PostgreSQL simultáneas; equipo sin cliente/credenciales independientes configurados.',
 '- No se ha contrastado físicamente la UX con sesiones reales de Cancillería y Diócesis. La autorización diocesana registra un acto de software, no constituye por sí misma autenticación de fuentes canónicas externas.',
 '- El frontend no fue desplegado. La certificación completa de 325 controles está abierta.',
 '',
 '**Dictamen:** procedimiento institucional reversible probado a nivel de base de datos y código frontend compilado; pendiente QA E2E física, concurrencia real y despliegue.'
];
fs.writeFileSync('AUDITORIA_CONCILIACION_INSTITUCIONAL_NOTAS_V156_2026-10-22.md',report.join('\n')+'\n');
console.log('V156 '+tests+' synth '+gate.passed+'/'+gate.checks+' gates, RPC '+snap.authenticated_directly_executable+' partial '+snap.partially_tested+' pending '+snap.pending_direct_authorization_review+' controls '+touched);
