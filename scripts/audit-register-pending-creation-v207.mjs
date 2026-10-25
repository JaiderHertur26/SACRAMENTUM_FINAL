import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const gate=read('AUDITORIA_PUERTA_CALIDAD_V207.json'),browser=read('AUDITORIA_CREACION_BOLETAS_NAVEGADOR_V207.json'),sql=read('AUDITORIA_CREACION_BOLETAS_SQL_V207.json');
const tests=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]);
if(gate.failed||gate.passed!==30||tests!==1603||browser.passed!==21||browser.exceptions.length||browser.externalRequests.length||sql.actual_postgres_tests.same_receipt_replays!==15||sql.atomicity.forced_receipt_failures!==4)throw Error('V207 evidence incomplete');
const report='AUDITORIA_CREACION_IDEMPOTENTE_BOLETAS_V207_2026-10-25.md',file='AUDITORIA_MAESTRA_CONTROLES_V90.json',master=read(file);
for(const id of ['01.04','01.05','06.01','06.06','06.07','07.04','07.05','07.06','08.01','09.01','10.02','11.01','15.01','15.08','25.02','25.03','25.08','31.08','32.06','32.07']){
 const c=master.controls.find(x=>x.id===id);if(!c)throw Error('Missing control '+id);
 const note=report+': V207_nuevas_altas_manuales_4_sacramentos_UUID_por_intento_recibo_PG_unico_5_circuitos_15_replays_4_fallos_de_recibo_con_rollback_21_escenarios_UI_y_servicios_reales_sin_Auth_E2E_ni_concurrencia_fisica';
 c.evidence??=[];if(!c.evidence.includes(note))c.evidence.push(note);if(c.status==='PENDIENTE')c.status='EN_PROGRESO';c.updated_at=new Date().toISOString();
}
if(master.controls.filter(c=>c.status==='APROBADO').length!==29)throw Error('Global certification scope changed');
fs.writeFileSync(file,JSON.stringify(master,null,2)+'\n');execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
fs.writeFileSync(report,`# SACRAMENTUM FINAL — V207: reserva de boletas sin duplicar por reintento
Fecha: 25 de octubre de 2026, Colombia.
Ruta: C:\\SACRAMENTUM\\SACRAMENTUM_FINAL. Base V206: 9033bf5.

## Fallo y comportamiento nuevo
Las cuatro pantallas de altas manuales confiaban en estado React para evitar dobles envíos. Una respuesta perdida tras reservar el número permitía repetir la creación. Bautismo y Confirmación también podían presentar como fallo una lectura posterior, aunque la boleta ya estuviera guardada.

Cada intento mantiene un UUID en memoria del formulario, adquirido antes del primer await. Los servicios usan create_pending_registration_v207, que valida primero al usuario parroquial activo y su diócesis/parroquia, adquiere un bloqueo transaccional para esa solicitud y devuelve el recibo existente cuando se repite el mismo contenido. No consume otro consecutivo. Un cambio de contenido con la misma solicitud se rechaza y pide consultar las boletas guardadas. Los IDs y números de vista previa, asignados por PostgreSQL, se excluyen del contenido enviado para evitar conflictos por cambios de vista previa o UUIDs temporales.

El servidor conserva los procedimientos originales de validación y creación. Bautismo usa el flujo conjunto atómico con Confirmación. Exequias libera el UUID solo después de recibir confirmación de la creación; una inscripción intencional nueva obtiene otro. La interfaz no reenvía escrituras automáticamente.

## Migración aplicada
20261025232301_idempotent_pending_creation_v207.sql coincide con el historial de Supabase.
- Nueva tabla pending_creation_requests: clave única parroquia + sacramento + UUID, hash del contenido, respuesta de IDs/números, actor y fecha. No almacena una copia del contenido personal completo.
- RLS habilitada, sin acceso directo de PUBLIC/anon/authenticated.
- Nueva RPC SECURITY DEFINER con search_path vacío, sin EXECUTE para anon/PUBLIC y autorización parroquial antes de leer cualquier recibo.
- Recibo y creación original comparten transacción; un fallo del recibo revierte todo.

## PostgreSQL real
qa-rollback-idempotent-pending-creation-v207.sql:
- 5 circuitos: Bautismo, Confirmación, Matrimonio, Exequias y Bautismo con Confirmación.
- 15 reenvíos devuelven la misma respuesta sin modificar parámetros/consecutivos.
- 5 solicitudes con contenido cambiado rechazadas.
- 2 accesos no autorizados rechazados, incluso al intentar recuperar un recibo.
- Lectura directa del registro de recibos denegada al rol authenticated.

qa-rollback-pending-receipt-atomicity-v207.sql:
- Fallo inyectado después de crear cada boleta, al insertar su recibo: 4/4 revertidos sin boletas, cambios de parámetros ni auditorías huérfanas.
- Eliminada la inyección dentro de la transacción: 4/4 recuperados usando los mismos UUID.
- Ambas pruebas terminaron en ROLLBACK. Verificación posterior: cero recibos, cero boletas QA y cero triggers QA persistentes. Ningún registro histórico fue modificado.

## Navegador con páginas y servicios reales
Se montaron las cuatro páginas y sus servicios reales, incluido pendingCreationService, normalizadores, verificaciones de persistencia y caché. Solo se sustituyó Supabase y los componentes externos de catálogo/impresión por adaptadores aislados.

21/21 escenarios: doble envío, respuesta perdida después de guardar, rechazo anterior a guardar, cambio de datos después de un resultado ambiguo y lectura posterior fallida; además, segunda inscripción intencional de Exequias con UUID nuevo. Matrimonio conserva su salida segura cuando la lectura falla después de recibir ID y número confirmados. Exequias bloquea la pantalla si falla el refresco y reintenta solo la lectura.

Cero excepciones JavaScript y cero solicitudes externas. Evidencia con SHA256 normalizado de ocho archivos productivos. Se volvió a ejecutar V206 sobre Exequias modificada: 24/24. Con Matrimonio V205, la batería de navegador suma 53 escenarios.

## Regresión y alcance
1603/1603 pruebas y 30/30 verificaciones locales, build correcto y auditorías de dependencias de producción/completas sin vulnerabilidades reportadas. CI ejecuta las tres baterías de navegador y los 105 archivos de pruebas.

Los ensayos SQL usan rol authenticated y claims locales en una transacción, sin una sesión Auth independiente de navegador. La pérdida de respuesta se simula en el cliente; no se certifican dos conexiones PostgreSQL físicamente simultáneas ni un corte físico de red. Los formularios conservan el UUID durante el intento abierto; persistencia de borradores tras recargar/cerrar y su restauración siguen pendientes. Los RPC antiguos continúan disponibles por compatibilidad y no reciben automáticamente esta protección.

Advisors señala dos configuraciones intencionales nuevas: [RLS sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), porque la tabla no admite acceso directo de clientes; y [RPC SECURITY DEFINER ejecutable por authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), porque es el único acceso autorizado al recibo. La autorización y el aislamiento se comprobaron antes de devolver respuestas. No se afirma que todos los avisos anteriores del proyecto estén resueltos.

Certificación global: 29/325 (8,9%), sin aprobar controles globales por cobertura parcial. El recibo nuevo debe conservarse en la futura prueba de backup/restauración. La reversión de frontend puede volver a V206 dejando esta migración aditiva instalada; no borrar recibos de operación como parte de un rollback.
`);
console.log('V207 registered: 1603 tests, 21 creation scenarios, 53 browser scenarios total; 29/325 formal');
