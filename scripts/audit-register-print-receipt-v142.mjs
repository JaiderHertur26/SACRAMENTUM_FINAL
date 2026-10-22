import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const gate=load('AUDITORIA_PUERTA_CALIDAD_V142.json');
const n=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests ([0-9]+)/)?.[1]||0);
const audits=gate.tasks.filter(x=>x.name.startsWith('dependencias-'));
if(n!==767||gate.checks!==28||gate.passed!==28||gate.failed!==0||audits.length!==2||
 audits.some(x=>!x.ok||x.findingCounts?.total!==0))throw Error('V142 strict quality incomplete: '+n);
const rpc=load('AUDITORIA_RPC_PRIVILEGIADAS_V141.json');
let touchedRPC=0;
for(const f of rpc.functions){
 if(f.function_name!=='register_registry_print')continue;
 if(!f.review_status.startsWith('PARTIAL_TESTED'))throw Error('Unexpected RPC state');
 f.test_evidence??=[];
 f.test_evidence.push('scripts/qa-rollback-print-receipt-authenticated-v142.sql');
 f.test_evidence.push('scripts/test-print-receipt-consistency-v142.mjs');
 f.tested_in_this_turn=true;
 touchedRPC++;
}
rpc.protocol='V142';rpc.updated_at=new Date().toISOString();
rpc.partial_reviewed=rpc.functions.filter(x=>x.review_status.startsWith('PARTIAL_TESTED')).length;
rpc.not_fully_reviewed=rpc.functions.filter(x=>x.review_status==='PENDING_MANUAL_AUTHORIZATION_REVIEW').length;
if(touchedRPC!==1||rpc.total!==136||rpc.partial_reviewed!==21||rpc.not_fully_reviewed!==115)
 throw Error('Privilege count changed');
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V142.json',JSON.stringify(rpc,null,2)+'\n');
const filename='AUDITORIA_MAESTRA_CONTROLES_V90.json',master=load(filename);
const notes={
 '06.06':'V142: register_registry_print y acceso SELECT RLS a constancia verificados parcialmente; catálogo sigue 136 SECDEF, 21 revisadas parcialmente y 115 pendientes.',
 '06.07':'V142: impresión cliente exige comprobar constancia canónica por parroquia, partida, sacramento, clase documental y notas; no basta un UUID del RPC.',
 '12.07':'V142: la impresión de la nota histórica no cambia después del RPC porque HTML y lista se capturan antes del await; discrepancia en constancia bloquea.',
 '14.04':'V142: se comparan status canónico, texto y política de cada nota del evento auditado con los enviados antes de mostrar impresión.',
 '14.06':'V142: Bautismo, Confirmación y Matrimonio congelan DOM/selección antes de RPC; ambas salidas de Exequias congelan HTML generado previamente.',
 '16.06':'V142: protección contra discordancia de estado y notas entre solicitud y recibo; aún sin SHA de la totalidad del documento ni ensayo concurrente auténtico.',
 '24.12':'V142: cinco salidas de impresión validan el recibo leído desde registry_print_events por el mismo actor parroquial, y detienen la impresión ante discrepancias.',
 '27.01':'V142: lectura de registry_print_events bajo rol authenticated y request.jwt.claim.sub parroquial simulado pasó para cuatro sacramentos.',
 '27.02':'V142: receipt debe contener parish_id, sacrament_id, sacrament_type y document_kind exactos; matriz unitaria rechaza suplantación de cada atributo.',
 '27.04':'V142: el recibo del backend se recupera por ID devuelto por register_registry_print y valida identidad/notas/estado antes de permitir impresión.',
 '27.05':'V142: se separa recibo de solicitud de impresión de constancia de impresión física. No se certifican bytes/píxeles del documento completo.',
 '27.12':'V142: inventario sin cambios en cantidad, 136 SECDEF; 21 parciales (register_registry_print con evidencia extendida), 115 pendientes.',
 '31.07':'V142: SQL rollback cuatro sacramentos demostró que el mismo usuario parroquial lee su evento canónico bajo RLS; 26 nuevos tests de identidad, estado y notas.',
 '31.10':'V142: 0 datos QA en cuatro sacramentos y registry_print_events; ANULACION sin variación 5 archived y 2 materialized_decree.',
 '32.03':'V142: 26 pruebas nuevas de sincronía/constancia incluidas en CI, 767/767 sintéticas y 28/28 verificaciones estrictas.',
 '32.05':'V142: defecto de secuencia en cliente: innerHTML se obtenía después de await registrar, pudiendo cambiar desde la selección auditada.',
 '32.06':'V142: snapshots de HTML y notas se crean antes de RPC; receipt leído y validado; SQL RLS + build + tests PASS. E2E browser autenticado pendiente.',
 '32.07':'V142: build Vite y CSS crítico OK; npm audit producción y completo sin hallazgos, gate 28/28.',
 '32.08':'V142: ajuste frontend únicamente, sin DDL ni nuevas migraciones, no despliegue y sin persistencia de fixtures QA.'
};
let annotated=0;
for(const c of master.controls){
 const note=notes[c.id];if(!note)continue;
 c.evidence??=[];if(!c.evidence.includes(note))c.evidence.push(note);
 if(c.status==='PENDIENTE')c.status='EN_PROGRESO';
 c.updated_at=new Date().toISOString();annotated++;
}
fs.writeFileSync(filename,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const totals={};for(const c of master.controls)totals[c.status]=(totals[c.status]||0)+1;
if(totals.APROBADO!==10||(totals.FALLIDO||0)!==0)throw Error('Master result does not match baseline');
const report=[
 '# SACRAMENTUM — CONSTANCIA Y CONTENIDO DE IMPRESIÓN · V142',
 '',
 '## Hallazgo de código y corrección',
 '- Antes de V142 los modales Bautismo/Confirmación/Matrimonio leían contenido.innerHTML después de esperar registerRegistryPrint. Un rerender React durante ese await podía cambiar notas/documento sin correspondencia con la solicitud persistida.',
 '- Las cinco rutas (tres modales y dos documentos de Exequias) ahora capturan el HTML exacto que intentan imprimir antes de iniciar el RPC. Las notas seleccionadas se fijan al mismo momento.',
 '- marginalNotesV2Service.registerRegistryPrint deja de conformarse con el UUID devuelto por el RPC: recupera registry_print_events por el ID recién creado bajo RLS y coteja sus atributos.',
 '- Se agregó src/utils/registryPrintReceipt.js con una función pura para comprobar parish_id, sacrament_id, sacrament_type, document_kind, metadata de procedencia y estado actual de la partida.',
 '- Para cada nota imprimible coteja posición, id, policy y content. Se permite que label mostrado por cliente no sea canónico, pero nunca que cambie texto/política/identidad.',
 '- Si falta el evento, no puede leerse, la nota difiere o el estado registral cambió, se lanza error y la pantalla interrumpe la impresión con aviso visible.',
 '- Exequias conserva distinción partida y constancia; ambas imprimen únicamente printHtmlSnapshot generado antes del RPC. La constancia sigue incorporando required.',
 '',
 '## Laboratorios y regresión',
 '- scripts/qa-rollback-print-receipt-authenticated-v142.sql: cuatro partidas ficticias separadas y nota required; el actor parroquial autenticado simulado leyó el propio registro de impresión bajo las políticas RLS reales, validando solicitante, documento, estado y procedencia. BEGIN/ROLLBACK, PASS.',
 '- scripts/test-print-receipt-consistency-v142.mjs: 26 pruebas del helper y contratos de pantalla. Rechaza parroquia/tipo/partida/clase errónea, event faltante, metadata sin validación, cambio de estado, nota eliminada, añadida, adulterada, reordenada o con política distinta; prueba snapshot antes de await en las cinco salidas. PASS.',
 '- AUDITORIA_PUERTA_CALIDAD_V142.json: '+n+'/'+n+' pruebas sintéticas; 28/28 verificaciones estrictas; build/CSS, npm audit producción/completo 0 vulnerabilidades.',
 '- Consulta posterior a Supabase: 0 QA en Bautismo/Confirmación/Matrimonio/Exequias y print events; ANULACION 5 archived y 2 materialized_decree sin cambios. Sin INSERT directo a registry_print_events por authenticated.',
 '',
 '## Estado de seguridad',
 '- El catálogo de 136 SECURITY DEFINER accesibles por authenticated mantiene 21 con pruebas parciales y '+rpc.not_fully_reviewed+' pendientes de revisión individual. register_registry_print recibe evidencia V142, NO se declara auditado por completo.',
 '- Plan maestro actualizado en '+annotated+' controles, totales '+JSON.stringify(totals)+'. No se cierra la auditoría completa.',
 '',
 '## Limitaciones y siguiente frente',
 '- La congelación HTML evita rerenders dentro de esa espera, pero no demuestra concordancia byte a byte de todos los campos originales contra una instantánea completa del servidor; el RPC compara los atributos y notas descritos, no un hash del HTML final.',
 '- No hay verificación física de papel ni prueba con sesiones institucionales reales en navegador. El ensayo de permisos usa un rol autenticado simulado dentro de transacción SQL.',
 '- Un cambio después de emitirse la constancia no invalida automáticamente un documento ya generado; falta diseño y prueba de versionado de copias/hashes y políticas de reimpresión.',
 '- El frontend modificado permanece en rama local de auditoría, sin despliegue desde V139.',
 '',
 '**Dictamen:** cerrada la carrera de lectura de DOM tras el RPC y añadido cotejo obligatorio del recibo antes de imprimir. Queda pendiente certificación documental completa.'
];
fs.writeFileSync('AUDITORIA_CONSISTENCIA_IMPRESION_V142_2026-10-22.md',report.join('\n')+'\n');
console.log('V142 states '+JSON.stringify(totals)+' RPC='+rpc.total+' partial='+rpc.partial_reviewed+' pending='+rpc.not_fully_reviewed+' tests='+n+' strict='+gate.passed+'/'+gate.checks);
