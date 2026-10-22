import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const gate=read('AUDITORIA_PUERTA_CALIDAD_V141.json');
const tests=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests ([0-9]+)/)?.[1]||0);
const audits=gate.tasks.filter(x=>x.name.startsWith('dependencias-'));
if(tests!==741||gate.checks!==28||gate.passed!==28||gate.failed!==0||audits.length!==2||
 audits.some(x=>!x.ok||x.findingCounts?.total!==0))throw Error('V141 gate incomplete '+tests);
const catalog=read('AUDITORIA_RPC_PRIVILEGIADAS_V139.json');
let totalChanged=0;
for(const f of catalog.functions){
 if(f.function_name!=='register_registry_print')continue;
 if(f.review_status!=='PENDING_MANUAL_AUTHORIZATION_REVIEW')throw Error('RPC state drift: '+f.review_status);
 f.review_status='PARTIAL_TESTED_PRINT_NOTES_POLICY_SCOPE_CONTENT_AND_LEGACY_PROVENANCE';
 f.tested_in_this_turn=true;
 f.test_evidence=[
  'supabase/migrations/20261022172147_validate_registry_print_notes_server_v140.sql',
  'supabase/migrations/20261022173154_preserve_audited_civil_link_helpers_v141.sql',
  'scripts/qa-rollback-registry-print-integrity-v140.sql',
  'scripts/qa-rollback-print-reversed-decree-notes-v140.sql',
  'scripts/qa-rollback-auto-civil-registry-print-v141.sql',
  'scripts/qa-rollback-registry-print-four-sacraments-v141.sql',
  'scripts/test-registry-print-marginal-integrity-v140.mjs'
 ];
 totalChanged++;
}
catalog.protocol='V141';catalog.updated_at=new Date().toISOString();
catalog.partial_reviewed=catalog.functions.filter(f=>f.review_status.startsWith('PARTIAL_TESTED')).length;
catalog.not_fully_reviewed=catalog.functions.filter(f=>f.review_status==='PENDING_MANUAL_AUTHORIZATION_REVIEW').length;
if(totalChanged!==1||catalog.total!==136||catalog.partial_reviewed!==21||catalog.not_fully_reviewed!==115)
 throw Error('Catalog state mismatch');
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V141.json',JSON.stringify(catalog,null,2)+'\n');
const path='AUDITORIA_MAESTRA_CONTROLES_V90.json',plan=read(path);
const evidence={
 '06.06':'V140-V141: RPC register_registry_print auditada parcialmente por contenido, política required, scope, reversión e integridad; 136 SECDEF, 21 con pruebas parciales, 115 pendientes de revisión individual.',
 '06.07':'V140: backend evita impresión sin notas required y bloquea notas internas, ajenas, duplicadas, inactivas y contenido falsificado.',
 '12.07':'V140: una nota de decreto revertido deja de imprimirse como vigente; la nota específica reversion_* continúa como constancia requerida.',
 '14.04':'V140: impresión no restaura notas anteriores de decretos revertidos; metadatos de estatus y referencias históricas conservados.',
 '14.06':'V141: Exequias partida y constancia incluyen notas obligatorias aunque el usuario desmarque opcionales; renderizado HTML escapado.',
 '16.06':'V141: Matrimonio elimina fallback a nota marginal inline no verificada tras filtro de decreto; BAUTISMO/CONFIRMACIÓN y Exequias usan lista vinculada a estado.',
 '24.12':'V141: filtro de notas en componentes de Matrimonio/Exequias y servicio general respeta reversión y nota de reversión; build OK, navegador institucional real pendiente.',
 '27.01':'V140: register_registry_print persiste un conjunto canónico de notas del servidor; no confía en label y texto enviado por cliente.',
 '27.02':'V140: impresión de nota UUID exige coincidencia de parroquia, sacramento, partida y estado; todas verificaciones en backend.',
 '27.04':'V140: obligatoriedad de notas required respaldada por SQL en cuatro sacramentos, validación de texto y política real.',
 '27.05':'V141: identificadores legacy-inline y auto-rc permitidos únicamente con metadatos unverified, RC cotejado contra NUIP/Serial real. No se certifica su texto HTML generado por cliente.',
 '27.12':'V141: inventario de 136 SECDEF, 21 con pruebas parciales, 115 pendientes. Se agregó prueba individual parcial de register_registry_print.',
 '31.07':'V140-V141: SQL 7 negativas +3 positivas, 2 negativas +1 positiva con decreto revertido, 3 negativas +1 positiva RC y 4 denegaciones+4 aceptaciones en 4 sacramentos, todas ROLLBACK.',
 '31.10':'V141: tras todos los laboratorios, cero Baptisms/Confirmations/Marriages/Funerals/Notes/PrintEvents/Decrees QA; ANULACION intacto 5 archivados y 2 materializados.',
 '32.03':'V141: 28 nuevos contratos y pruebas de ROLLBACK, 741/741 sintéticas y 28/28 tareas estrictas, compilación y dos npm audit OK.',
 '32.05':'V140: reproducido pre-migración que register_registry_print aceptaba omisión de nota required al solicitar impresión; corregido.',
 '32.06':'V141: pruebas SQL de cuatro sacramentos y decreto revertido PASS; usuario autenticado simulado; frontend filtros y constancia incluidos.',
 '32.07':'V141: gate 28/28, tests 741/741, npm audit completo/runtime sin vulnerabilidades, CSS/build OK.',
 '32.08':'V141: migraciones registradas 20261022172147 y 20261022173154; notas inventadas en BEGIN/ROLLBACK; sin nuevo despliegue frontend.'
};
let noted=0;
for(const item of plan.controls){
 if(!evidence[item.id])continue;
 item.evidence??=[];if(!item.evidence.includes(evidence[item.id]))item.evidence.push(evidence[item.id]);
 if(item.status==='PENDIENTE')item.status='EN_PROGRESO';
 item.updated_at=new Date().toISOString();noted++;
}
fs.writeFileSync(path,JSON.stringify(plan,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const states={};for(const c of plan.controls)states[c.status]=(states[c.status]||0)+1;
if(states.APROBADO!==10||(states.FALLIDO||0)!==0)throw Error('Master validation failed');
const md=[
 '# SACRAMENTUM · NOTAS MARGINALES OBLIGATORIAS E IMPRESIÓN VERIFICADA · V140–V141',
 '',
 '## Hallazgo confirmado antes de corregir',
 '- Supabase register_registry_print permitía registrar la solicitud de impresión de una partida de Bautismo con nota marginal print_policy=required omitida. El servidor aceptaba included_notes=[] y selected_note_keys=[].',
 '- La reproducción está en scripts/qa-rollback-mandatory-note-print-baseline-v140.sql: excepción intencional forense y ROLLBACK.',
 '- Antes del arreglo el servidor tampoco cotejaba las notas seleccionadas con su texto/categoría y partida originales.',
 '',
 '## Backend aplicado',
 '- V140: supabase/migrations/20261022172147_validate_registry_print_notes_server_v140.sql; V141: 20261022173154_preserve_audited_civil_link_helpers_v141.sql. Ambas migraciones confirmadas en Supabase.',
 '- El procedimiento compara nota UUID con sacramento, parroquia, partida, estado, política y texto real; no permite notas inexistentes, duplicadas, internas, inactivas ni de otro registro.',
 '- Las notas required vigentes deben estar presentes; se rechazan omisiones incluso si el usuario cambia selected_note_keys o document_kind.',
 '- Nota de decreto reversed previa a la reversión: no se permite como vigente. Nota documental reversion_*: conserva su obligatoriedad y trazabilidad, aunque el mismo decreto permanezca reversed.',
 '- included_notes del evento se reconstruye con los campos canónicos de la base: contenido, etiqueta, política, UUID y provenance.',
 '- El backend registra estado de la partida e indica cuándo es una copia histórica/no vigente. No impide automáticamente la expedición de copias históricas; su validez jurídica debe tratarse aparte.',
 '- Nota inline legacy-inline: sigue admitida como client_supplied_unverified_historical, no certificada como nota DB.',
 '- Nota automática auto-rc-<UUID> de Bautismo: solo para la misma partida, con NUIP o Serial existente y visible en el contenido; etiqueta client_rendered_registry_fields_unverified. La composición total del texto por el cliente NO equivale a certificación notarial.',
 '',
 '## Frontend y generación de copias',
 '- marginalNotesV2Service.js excluye notas de decretos cancelados/revertidos salvo la nota de reversión, y evita reintroducir nota inline histórica cuando corresponde a una revertida.',
 '- ViewMarriagePartidaModal.jsx ya no usa un fallback que podía devolver nota inline inválida tras filtrar el conjunto.',
 '- funeralService.js consulta política, estado y vínculo con decreto para las notas de Exequias.',
 '- FuneralPartidasPage.jsx preserva required incluso al desmarcar opcionales; tanto Partida como Constancia requieren su incorporación. Para constancias se consultan las notas del registro correcto antes de imprimir.',
 '- funeralDocumentHtml.js representa notas obligatorias de constancia con contenido escapado; prueba de renderizado HTML aprobada.',
 '- No se modificó la autorización institucional para imprimir; la función sigue exigiendo acceso al ámbito parroquial.',
 '',
 '## Laboratorios en Supabase, todos reversibles',
 '- qa-rollback-registry-print-integrity-v140.sql: 7 rechazos (omisión de nota obligatoria, falsificación, interna, reversa, otra partida, phantom key, duplicado) +3 casos válidos.',
 '- qa-rollback-print-reversed-decree-notes-v140.sql: 2 rechazos y 1 reversión documental obligatoria válida vinculada a decreto reversed.',
 '- qa-rollback-auto-civil-registry-print-v141.sql: 3 rechazos y 1 nota RC con NUIP coincidente, de procedencia explícitamente no certificada.',
 '- qa-rollback-registry-print-four-sacraments-v141.sql: cuatro sacramentos x 1 denegación por omisión y 1 impresión válida por nota obligatoria correcta.',
 '- Todas las operaciones ficticias se ejecutaron entre BEGIN y ROLLBACK. Consulta final: cero registros QA en las cuatro tablas sacramentales, marginal_notes, registry_print_events y decretos. ANULACION 5 archived y 2 materialized_decree intactos.',
 '- authenticated sigue sin permiso directo de INSERT en registry_print_events.',
 '',
 '## Regresión y plan maestro',
 '- scripts/test-registry-print-marginal-integrity-v140.mjs: 28 contratos con ejecución de HTML de Exequias, incorporados a gate y GitHub Actions.',
 '- AUDITORIA_PUERTA_CALIDAD_V141.json: 741/741 pruebas sintéticas, 28/28 controles estrictos, build Vite/CSS y npm audit completo/producción sin vulnerabilidades.',
 '- AUDITORIA_RPC_PRIVILEGIADAS_V141.json: 136 funciones privilegiadas, '+catalog.partial_reviewed+' con pruebas parciales, '+catalog.not_fully_reviewed+' pendientes de revisión individual.',
 '- Se añadieron evidencias a '+noted+' controles. Estado de 325: '+JSON.stringify(states)+'.',
 '',
 '## Límites explícitos',
 '- No existe garantía física de que la impresora haya completado la salida. Se registra una solicitud y su conjunto de notas cotejadas antes de que se invoque la impresión.',
 '- Los textos históricos sin fila propia y los vínculos civiles armados en navegador conservan señalización de procedencia no certificada. Debe revisarse su fuente física/documental.',
 '- El DOM HTML podría sufrir cambios o desincronización después de la solicitud. Faltan pruebas E2E con sesiones institucionales reales, concurrencia, visual de impresión y custodia del soporte.',
 '- Frontend aún sin desplegar desde la rama local de auditoría.',
 '',
 '**Dictamen:** omisión de notas obligatorias y anotaciones revocadas en solicitudes de impresión cerrada en backend con pruebas sobre los cuatro sacramentos; certificación integral pendiente.'
];
fs.writeFileSync('AUDITORIA_IMPRESION_NOTAS_OBLIGATORIAS_V141_2026-10-22.md',md.join('\n')+'\n');
console.log('V141 statuses='+JSON.stringify(states)+' privileged='+catalog.total+' partial='+catalog.partial_reviewed+' pending='+catalog.not_fully_reviewed+' tests='+tests+' gate='+gate.passed+'/'+gate.checks);
