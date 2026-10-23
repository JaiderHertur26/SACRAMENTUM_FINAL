import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const load=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const gate=load('AUDITORIA_PUERTA_CALIDAD_V157.json');
const num=Number(gate.tasks.find(t=>t.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
const deps=gate.tasks.filter(t=>t.name.startsWith('dependencias-'));
if(num!==1029||gate.passed!==28||gate.checks!==28||gate.failed!==0||deps.length!==2||
 deps.some(x=>!x.ok||x.findingCounts?.total!==0))throw Error('Quality Gate V157 incomplete');
const inv=load('AUDITORIA_RPC_PRIVILEGIADAS_V156.json');
if(inv.total_security_definer!==204||inv.authenticated_directly_executable!==143||
 inv.partially_tested!==33||inv.pending_direct_authorization_review!==110||inv.functions.length!==204)
 throw Error('Privilege inventory V156 changed');
const additional=[
 ['reject_later_note_reconciliation_v157','p_case_id uuid, p_rejection_reference text, p_rejection_reason text',2482],
 ['list_later_note_reconciliations_v157','p_diocese_id uuid',1343]
];
for(const [name,args,chars] of additional){
 if(inv.functions.some(x=>x.schema==='public'&&x.function_name===name))throw Error('duplicate privilege '+name);
 inv.functions.push({
  schema:'public',function_name:name,signature:'public.'+name+'('+args+')',
  authenticated_execute:true,authenticated_schema_usage:true,
  directly_executable_by_authenticated:true,anon_execute:false,
  definition_chars:chars,potentially_mutating_heuristic:name.startsWith('reject'),
  references_auth_uid_heuristic:true,checks_legacy_scope_heuristic:false,
  checks_parish_scope_heuristic:false,
  review_status:'PARTIAL_TESTED_REJECTION_AND_SCOPED_AUTHENTICATED_LIST_V157',
  test_evidence:[
    'supabase/migrations/20261023032715_later_note_rejection_and_revocation_v157.sql',
    'scripts/qa-rollback-later-note-rejection-v157.sql',
    'scripts/test-later-note-rejection-revocation-v157.mjs',
    'AUDITORIA_PUERTA_CALIDAD_V157.json'
  ]
 });
}
inv.protocol='V157';
inv.source='V156 catalog plus V157 verified live pg_proc 197 public and 9 private functions, and explicit EXECUTE grants; all 206 represented.';
inv.by_schema={public:197,private:9};
inv.total_security_definer=206;
inv.authenticated_directly_executable=145;
inv.public_authenticated_executable=142;
inv.partially_tested=35;
inv.pending_direct_authorization_review=110;
inv.audit_scope_note+=' V157: role authenticated exercised under SET LOCAL ROLE authenticated with fake actor, no independent PostgreSQL concurrency proof.';
if(inv.functions.length!==206||inv.partially_tested+inv.pending_direct_authorization_review!==145)throw Error('V157 security totals drift');
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V157.json',JSON.stringify(inv,null,2)+'\n');
const masterPath='AUDITORIA_MAESTRA_CONTROLES_V90.json',master=load(masterPath);
const notes={
'06.05':'V157: se cerró estado rejected previamente declarado sin RPC, habilitando rechazo pendiente y revocación autorizada no ejecutada mediante Diócesis.',
'06.06':'V157: revisión live catálogo SECURITY DEFINER 206 (197 public + 9 private), 145 EXECUTE authenticated; 35 funciones con evidencia parcial y 110 pendientes.',
'06.07':'V157: Diócesis puede rechazar/revocar; Cancillería y Parroquia no pueden; no se permite rechazo sin rol diocesano activo ni fuera de jurisdicción.',
'06.08':'V157: reject RPC sólo authenticated; acceso anon denegado y tabla de conciliación sigue sin grants directos; row lock FOR UPDATE.',
'12.07':'V157: rechazo y revocación conservan intactos partida, decreto y nota, según prueba SQL post-deploy.',
'14.04':'V157: nota manual no se invalida al denegar autorización, ni se ejecuta la reversión del decreto.',
'14.06':'V157: rechazo de solicitud libera índice único que permite nuevo expediente, evitando bloqueo indefinido por pendientes obsoletos.',
'20.02':'V157: expediente institucional admite rechazo motivado y revocación de autorización no ejecutada con actor, fecha, referencia y fundamento documentados.',
'24.12':'V157: auditoría institucional distingue reconciliation_rejected y reconciliation_authorization_revoked sin afectar partidas.',
'27.01':'V157: dos RPC SECURITY DEFINER nuevas con QA bajo SET LOCAL ROLE authenticated: rechazo y consulta scoped v157.',
'27.04':'V157: seis rechazos de roles/estado/longitud/falso perfil, reapertura de expediente tras rechazo, y prohibición de ejecutar revocación.',
'27.12':'V157: 145 RPC ejecutables autenticadas, 35 parcialmente verificadas y 110 sin QA individual; 61 internas sin ejecución directa siguen pendientes.',
'28.06':'V157: historial de rechazo por Diócesis expuesto en lista acotada, con referencia y motivo; función no abre lectura directa de tablas auditadas.',
'31.07':'V157: QA reversible con fixtures matrimoniales, seis negativos, dos motivos registrados, note/decree intactos, BEGIN/ROLLBACK.',
'31.10':'V157: tras la QA real, 0 decretos, notas, expedientes y auditorías de ficción QA V157 residuales.',
'32.03':'V157: +24 pruebas contractuales y regresión V156 versionada corregida; total 1029/1029, 28/28 gate.',
'32.05':'V157: defecto funcional de solicitudes rechazables pero sin RPC subsanado, migración aplicada y confirmada en Supabase.',
'32.06':'V157: migración SQL 20261023032715 y servicio frontend de listado v157 y rechazo implementados; build y QA de API correctos.',
'32.07':'V157: build Vite + dependencias prod/dev 0 vulnerabilidades reportadas; 28 verificaciones aprobadas.',
'32.08':'V157: Chrome headless aislado confirma pantalla protegida no expuesta a visitante sin sesión. No equivale a QA física de roles autentificados ni concurrencia DB.'
};
let touched=0;
for(const c of master.controls){const x=notes[c.id];if(!x)continue;c.evidence??=[];if(!c.evidence.includes(x))c.evidence.push(x);c.updated_at=new Date().toISOString();touched++;}
fs.writeFileSync(masterPath,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const counts={};for(const c of master.controls)counts[c.status]=(counts[c.status]||0)+1;
if(counts.APROBADO!==10||counts.EN_PROGRESO!==102||counts.PENDIENTE!==213||(counts.FALLIDO||0)!==0)
 throw Error('Master control status drift '+JSON.stringify(counts));
const report=[
 '# SACRAMENTUM · V157 — RECHAZO Y REVOCACIÓN DE CONCILIACIONES',
 '',
 '## Hallazgo',
 '- La tabla later_note_reconciliations_v156 tenía estado rejected pero sin RPC ni acción UI para utilizarlo. Una solicitud obsoleta podía permanecer pendiente y bloquear nueva solicitud para igual decreto/nota.',
 '- Diócesis no disponía de una forma auditada de denegar solicitud o retirar autorización antes de la ejecución.',
 '',
 '## Corrección backend efectiva',
 '- Migración 20261023032715_later_note_rejection_and_revocation_v157.sql aplicada al Supabase REGISTRO SACRAMENTOS.',
 '- Función public.reject_later_note_reconciliation_v157: sólo perfil diocese activo de la diócesis de la solicitud, exige referencia documental de 8+ caracteres y motivo de 20+ caracteres, valida estado pending/authorized bajo FOR UPDATE, escribe rejected_by/reference/reason/at.',
 '- No altera marginal_notes, decretos ni tablas sacramentales; no puede revocar un expediente ya executed. Conserva auditoría de rechazo y de revocación de aprobación.',
 '- La restricción de unicidad vigente permite una nueva solicitud de la misma pareja decreto/nota tras rejected, sin borrar antecedentes.',
 '- Función public.list_later_note_reconciliations_v157 consulta alcance de diócesis desde Cancillería y Diócesis y ofrece razón del rechazo; no concede SELECT/UPDATE directos de tabla a authenticated.',
 '',
 '## Código frontend local',
 '- src/pages/chancery/LaterNoteReconciliationPage.jsx: rechazo o revocación motivada por Diócesis con confirmación explícita, razones visibles y contador de rechazados.',
 '- src/services/laterNoteReconciliationService.js actualiza listado a la nueva RPC v157 e invoca RPC rechazo. Cambiar UUID del decreto borra nota previamente seleccionada.',
 '- Build producción pasó. No hubo despliegue web.',
 '',
 '## QA efectivamente ejecutada en Supabase',
 '- scripts/qa-rollback-later-note-rejection-v157.sql ejecutado en backend real con BEGIN/ROLLBACK. Usa SET LOCAL ROLE authenticated, sujeto ficticio y perfiles activos existentes para garantizar validación de permisos SQL.',
 '- Confirma seis denegaciones: Parroquia, Cancillería, revocación ejecutable, rechazo duplicado, motivo insuficiente y actor sin perfil para listado.',
 '- Diócesis rechazó caso pending, autorizó y luego revocó segundo caso autorizado, y se permitió tercera solicitud sin modificar nota ni decreto.',
 '- Auditoría institucional distingue un rechazo de solicitud y una revocación de autorización. Residuos QA: cero decretos, notas, expedientes y registros de auditoría.',
 '- Chrome headless con perfil temporal aislado cargó la ruta privada sin autenticación: mostró la vista pública y no expuso el formulario protegido. No se probó navegación autenticada de los dos roles.',
 '',
 '## Cobertura y limitaciones',
 '- '+num+'/'+num+' pruebas sintéticas, '+gate.passed+'/'+gate.checks+' checks de calidad, build y npm audit de producción+desarrollo sin hallazgos.',
 '- Total SECURITY DEFINER '+inv.total_security_definer+' ('+inv.by_schema.public+' public, '+inv.by_schema.private+' private), '+inv.authenticated_directly_executable+' ejecutables authenticated, '+inv.partially_tested+' con QA parcial, '+inv.pending_direct_authorization_review+' pendientes.',
 '- Plan maestro '+JSON.stringify(counts)+', '+touched+' controles complementados sin ascender estados.',
 '- Sigue pendiente una prueba real con dos conexiones PostgreSQL simultáneas; la interfaz de Diócesis y Cancillería autenticadas no fue recorrida físicamente, y el frontend local aún no fue desplegado.',
 '',
 '**Dictamen:** flujo negativo de decisiones institucionales real y reversible, auditado parcialmente en backend. Certificación integral abierta.'
];
fs.writeFileSync('AUDITORIA_RECHAZO_REVOCACION_CONCILIACION_V157_2026-10-22.md',report.join('\n')+'\n');
console.log('V157 '+num+' tests '+gate.passed+'/'+gate.checks+' gates, '+inv.authenticated_directly_executable+' RPC, '+touched+' controls');
