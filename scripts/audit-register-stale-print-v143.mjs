import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const gate=read('AUDITORIA_PUERTA_CALIDAD_V143.json');
const tests=Number(gate.tasks.find(t=>t.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests ([0-9]+)/)?.[1]||0);
const audit=gate.tasks.filter(t=>t.name.startsWith('dependencias-'));
if(tests!==796||gate.checks!==28||gate.passed!==28||gate.failed!==0||
 audit.length!==2||audit.some(x=>!x.ok||x.findingCounts?.total!==0))
 throw Error('V143 strict evidence incomplete: '+tests);
const rpc=read('AUDITORIA_RPC_PRIVILEGIADAS_V142.json');
let target=0;
for(const f of rpc.functions){
 if(f.function_name!=='register_registry_print')continue;
 if(!f.review_status.startsWith('PARTIAL_TESTED'))throw Error('Unexpected status '+f.review_status);
 f.test_evidence??=[];
 for(const path of [
  'supabase/migrations/20261022180645_guard_stale_registry_print_document_v143.sql',
  'scripts/qa-rollback-stale-print-coordinates-baseline-v143.sql',
  'scripts/qa-rollback-print-optimistic-coordinates-v143.sql',
  'scripts/test-stale-print-coordinates-v143.mjs'
 ]) if(!f.test_evidence.includes(path)) f.test_evidence.push(path);
 f.tested_in_this_turn=true;target++;
}
rpc.protocol='V143';rpc.updated_at=new Date().toISOString();
rpc.partial_reviewed=rpc.functions.filter(x=>x.review_status.startsWith('PARTIAL_TESTED')).length;
rpc.not_fully_reviewed=rpc.functions.filter(x=>x.review_status==='PENDING_MANUAL_AUTHORIZATION_REVIEW').length;
if(target!==1||rpc.total!==136||rpc.partial_reviewed!==21||rpc.not_fully_reviewed!==115)throw Error('Unexpected RPC counts');
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V143.json',JSON.stringify(rpc,null,2)+'\n');
const masterFile='AUDITORIA_MAESTRA_CONTROLES_V90.json',master=read(masterFile);
const evidence={
 '06.06':'V143: register_registry_print comprobada parcialmente contra coordenadas desfasadas, updated_at y huella de HTML aportada por navegador; inventario 136/21 parciales/115 pendientes.',
 '06.07':'V143: impresión exige igualdad de libro/folio/número comparando metadata declarada por cliente con fila original, en misma transacción.',
 '12.07':'V143: no basta una nota íntegra; un folio diferente provoca rechazo de solicitud de impresión antes de obtener constancia.',
 '14.04':'V143: versión original updated_at cotejada como timestamptz; rehúsa copia caducada aunque estado siga seated.',
 '14.06':'V143: campos originales y hash cliente enlazados a la solicitud de partida en Bautismo/Confirmación/Matrimonio.',
 '16.06':'V143: Exequias partida y constancia remiten libro/folio/número/updated_at/huella del HTML preparado, no texto recomputado posteriormente.',
 '24.12':'V143: cinco flujos de impresión cotejan recibo con coordenadas/version/huella; prueba visual autenticada e impresión física todavía pendientes.',
 '27.01':'V143: huella SHA-256 calculada con Web Crypto en origen; metadatos dejan claro que digest de cliente no prueba certificación del libro.',
 '27.02':'V143: SQL sobre cada sacramento rechazo de libro/folio/número falsos y versión de fecha antigua; compatibilidad con clientes legacy marcada como unchecked.',
 '27.04':'V143: contrato de register_registry_print valida p_metadata.expected_coordinates, expected_record_updated_at y formato SHA-256 antes de registrar evento.',
 '27.05':'V143: digest de contenido íntegro congelado enviado, persistido, leído y comparado en cliente. No se considera documento firmado por la Curia.',
 '27.12':'V143: inventario SECURITY DEFINER mantiene 136, 21 con pruebas parciales y 115 por revisar; evidencia complementaria de RPC impresión.',
 '31.07':'V143: SQL ROLLBACK multissacramento 24 denegaciones, 4 solicitudes válidas y 4 solicitudes antiguas aceptadas pero marcadas sin cotejo.',
 '31.10':'V143: conteo posterior cero partidas QA, print_events QA o audit_events QA; ANULACION 5 archived y 2 materialized_decree intactos.',
 '32.03':'V143: +29 contratos y pruebas hash/cotejo, 796/796 sintéticas y 28/28 checks estrictos.',
 '32.05':'V143: reproducido pre-migración que frontend podía declarar folio 222 y registrar impresión sobre libro con folio 333.',
 '32.06':'V143: migración aplicada 20261022180645 y matriz SQL post-fix 4x6 rechazos, ROLLBACK; tests funcionales de hash.',
 '32.07':'V143: build Vite/CSS, npm audit runtime y completo cero alertas, 28/28 checks estrictos.',
 '32.08':'V143: frontend en rama sin despliegue. Backend opcional para clientes previos; eventos de clientes legacy quedan marcados sin verificación de coordenadas/version.'
};
let touched=0;
for(const c of master.controls){
 const note=evidence[c.id];if(!note)continue;
 c.evidence??=[];if(!c.evidence.includes(note))c.evidence.push(note);
 if(c.status==='PENDIENTE')c.status='EN_PROGRESO';
 c.updated_at=new Date().toISOString();touched++;
}
fs.writeFileSync(masterFile,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const totals={};for(const c of master.controls)totals[c.status]=(totals[c.status]||0)+1;
if(totals.APROBADO!==10||(totals.FALLIDO||0)!==0)throw Error('Master status changed unexpectedly');
const report=[
 '# SACRAMENTUM · COORDENADAS, VERSIÓN Y HUELLA DE COPIA PARA IMPRESIÓN · V143',
 '',
 '## Hallazgo reproducido en Supabase',
 '- Antes del parche register_registry_print permitía imprimir una partida real del libro/folio/número canónico si el navegador enviaba folio desfasado: el ejemplo ficticio de Bautismo tenía folio 333, pero p_metadata.expected_coordinates solicitaba folio 222. El servidor registraba el evento igualmente.',
 '- Reproducción: scripts/qa-rollback-stale-print-coordinates-baseline-v143.sql, con excepción intencional y ROLLBACK.',
 '',
 '## Migración backend realmente aplicada',
 '- supabase/migrations/20261022180645_guard_stale_registry_print_document_v143.sql.',
 '- Si cliente envía expected_coordinates, exige objeto con tres cadenas book/folio/number, y compara contra valores canónicos recuperados de la fila del sacramento dentro del mismo RPC. La discrepancia lanza SQLSTATE 23514.',
 '- Si cliente envía expected_record_updated_at se convierte en timestamptz y compara con updated_at de la fila; marcas inválidas o caducadas se rechazan. No se limita a status seated.',
 '- Si recibe document_sha256, valida el formato hexadecimal de 64 caracteres y lo almacena con provenance client_digest_not_server_certification. El servidor no calcula el hash del HTML: no presume autoría ni certificación sobre datos generados por cliente.',
 '- Al construir el recibo agrega record_updated_at, coordinates_checked, record_version_checked y document_sha256_provenance.',
 '- Los clientes antiguos continúan siendo compatibles mientras no envían las nuevas comprobaciones; estos recibos quedan identificados como coordinates_checked=false / record_version_checked=false. Esto NO certifica impresión desde el frontend actualmente desplegado.',
 '',
 '## Cambios frontend',
 '- src/utils/registryPrintReceipt.js incluye sha256PrintedHtml con Web Crypto SHA-256 sobre el HTML congelado y valida coords, updated_at y el mismo hash devuelto en el recibo.',
 '- src/services/marginalNotesV2Service.js exige htmlSnapshot, expectedCoordinates y fecha cuando existe, construye metadatos del RPC y compara el recibo real antes de imprimir. Navegador sin crypto.subtle no puede continuar silenciosamente.',
 '- Cinco vías: Bautismo, Confirmación, Matrimonio, Exequias partida y Exequias constancia remiten los datos y el HTML congelado antes del RPC; no se leen ni regeneran tras la respuesta.',
 '- No se guarda el HTML íntegro en la base, solo su huella SHA-256 de procedencia declarada no certificada.',
 '',
 '## Laboratorios',
 '- scripts/qa-rollback-print-optimistic-coordinates-v143.sql: 4 sacramentos; 24 rechazos reales de libro/folio/número desfasados, digest malformado, versión previa y objeto de coordenadas incompleto; 4 rutas válidas y 4 legacy compatibles/marcadas como no cotejadas. BEGIN/ROLLBACK. PASS.',
 '- scripts/test-stale-print-coordinates-v143.mjs: 29 nuevos tests de backend y cliente, comparación horaria UTC, alteración de un byte HTML, hash conocido SHA-256, versiones, coordenadas y cinco flujos. PASS.',
 '- Se actualizaron fixtures V142 para la nueva comprobación obligatoria del cliente. No se redujeron pruebas existentes.',
 '- AUDITORIA_PUERTA_CALIDAD_V143.json: '+tests+'/'+tests+' tests sintéticos, 28/28 tareas estrictas, build/CSS y npm audit full/runtime 0 vulnerabilidades.',
 '- Consulta final Supabase: 0 fixtures QA en los cuatro sacramentos, registry_print_events o registry_audit_log. Histórico ANULACION conserva 5 pendientes y 2 vinculados.',
 '',
 '## Limitaciones y dictamen',
 '- SHA-256 es huella de integridad del HTML congelado preparado por cliente, no prueba independiente de que todo el documento sea idéntico al libro institucional ni firma criptográfica de Cancillería.',
 '- Esta fase NO ejecutó impresión física ni sesiones reales de navegador autenticado ni concurrencia entre múltiples conexiones. Tampoco ha desplegado el frontend.',
 '- La comprobación de versión solo se exige si la pantalla recibió updated_at; las copias legacy y los registros sin updated_at requieren controles adicionales.',
 '- Inventario SECDEF: 136 funciones, '+rpc.partial_reviewed+' parcialmente probadas y '+rpc.not_fully_reviewed+' aún pendientes. '+touched+' controles maestros recibieron evidencia nueva; estado '+JSON.stringify(totals)+'.',
 '',
 '**Dictamen:** cerrado con QA el fallo de coordenadas de copia desfasadas. La trazabilidad documental mejoró, sin reclamar certificación física o criptográfica independiente.'
];
fs.writeFileSync('AUDITORIA_HUELLA_COPIA_IMPRESION_V143_2026-10-22.md',report.join('\n')+'\n');
console.log('V143 '+JSON.stringify(totals)+' rpc '+rpc.total+'/'+rpc.partial_reviewed+'/'+rpc.not_fully_reviewed+' tests='+tests+' strict='+gate.passed+'/'+gate.checks);
