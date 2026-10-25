import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const browser=read('AUDITORIA_RECUPERACION_TRES_SACRAMENTOS_V206.json'),gate=read('AUDITORIA_PUERTA_CALIDAD_V206.json');
const tests=Number(gate.tasks.find(t=>t.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]);
if(browser.passed!==24||browser.total!==24||browser.exceptions.length||browser.externalRequests.length||gate.failed||gate.passed!==30||tests!==1572)throw Error('Incomplete V206 evidence');
const report='AUDITORIA_RECUPERACION_TRES_SACRAMENTOS_V206_2026-10-25.md',file='AUDITORIA_MAESTRA_CONTROLES_V90.json',master=read(file);
const before=master.controls.filter(c=>c.status==='APROBADO').length;
for(const id of ['07.09','08.03','09.04','11.04','15.08','24.11','25.02','25.03','25.07','25.08','25.11','31.08','32.06','32.07']){
 const c=master.controls.find(c=>c.id===id);if(!c)throw Error('Missing '+id);
 const note=report+': V206_24_escenarios_React_reales_con_servicios_simulados_Bautismo_Confirmacion_Exequias_lectura_fallida_doble_clic_respuesta_perdida_y_reintento_32_escenarios_con_Matrimonio_no_E2E_Auth_ni_concurrencia_PG';
 c.evidence??=[];if(!c.evidence.includes(note))c.evidence.push(note);if(c.status==='PENDIENTE')c.status='EN_PROGRESO';c.updated_at=new Date().toISOString();
}
if(before!==29||master.controls.filter(c=>c.status==='APROBADO').length!==29)throw Error('Certification scope changed');
fs.writeFileSync(file,JSON.stringify(master,null,2)+'\n');execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
fs.writeFileSync(report,`# SACRAMENTUM FINAL — V206: recuperación de tres circuitos sacramentales
Fecha: 25 de octubre de 2026, Colombia.
Ruta canónica: C:\\SACRAMENTUM\\SACRAMENTUM_FINAL. Base: V205, main 0bbeac2.

## Fallos corregidos
Bautismo y Confirmación conservaban selección y consecutivos tras errores del asiento. Una respuesta perdida podía dejar una boleta asentada en la lista local de pendientes. Confirmación ignoraba tempError al consultar Supabase y podía presentar un error de lectura como archivo vacío. La protección con estado React permitía dobles clics antes del siguiente render y durante la confirmación asíncrona.

Exequias solo desactivaba la fila que se estaba asentando; era posible solicitar otra mientras seguía activa la primera. La lectura fallida no bloqueaba las acciones con el snapshot anterior.

Las tres páginas verifican de nuevo los datos después del error, mantienen una exclusión inmediata con useRef y bloquean la interfaz si no logran consultar el estado. Bautismo y Confirmación recortan la selección a los pendientes canónicos y ajustan el índice visible. Confirmación ahora rechaza explícitamente errores de lectura. Exequias bloquea todos los asientos durante la operación y protege guardar pendiente/digitalizar mientras se asienta.

La cancelación de confirmación libera el bloqueo. No se reenvían escrituras automáticamente. Un éxito de RPC seguido de lectura fallida conserva la confirmación de escritura y bloquea nuevos asientos hasta sincronizar. Los lotes de Bautismo y Confirmación siguen usando una única RPC atómica; Matrimonio conserva su circuito uno por uno documentado en V205.

## Pruebas ejecutadas
Chrome montó las tres páginas React reales con servicios externos ficticios en memoria y bloqueo de red fuera de localhost. Resultado: 24/24 escenarios, cero excepciones JavaScript y cero solicitudes externas.

Bautismo y Confirmación: nueve escenarios por sacramento:
- Timeout antes de guardar y reintento explícito con el mismo consecutivo.
- Respuesta perdida después de guardar y reintento de la siguiente boleta.
- Lectura fallida después de resultado ambiguo, bloqueo y sincronización.
- RPC exitosa seguida de lectura fallida, sin reenviar la escritura.
- Lote rechazado íntegramente y reintento del lote.
- Lote guardado con respuesta perdida: cero boletas ofrecidas para duplicar.
- Lote guardado y lectura fallida: bloqueo y consulta posterior.
- Error inicial exclusivo de consulta de pendientes, con parámetros disponibles.
- Cancelación y nueva confirmación; dos clics generan una sola confirmación/RPC.

Exequias: seis escenarios: timeout, respuesta perdida, fallo de lectura tras resultado ambiguo, éxito con lectura fallida, lectura inicial fallida y dos clics inmediatos en filas diferentes. El último demuestra una sola operación en curso y permite la segunda tras finalizar la primera.

Cada resultado conserva llamadas, UUID ficticios, parámetros esperados, pendientes, asientos, consecutivo, lecturas, mensajes y SHA256 normalizado a LF de las tres páginas. Junto con V205, hay 32 escenarios de recuperación de interfaz sobre los cuatro sacramentos.

Reproducir: node scripts/audit-three-sacrament-recovery-browser-v206.mjs.
Evidencia: AUDITORIA_RECUPERACION_TRES_SACRAMENTOS_V206.json.

## Regresión y publicación
Puerta local: 1572/1572 pruebas, 30/30 verificaciones, build correcto y npm audit completo/producción sin vulnerabilidades reportadas. GitHub Actions ejecuta ahora ambas baterías de navegador y los 104 archivos de pruebas del gate; ninguna prueba nueva se omite en CI.

## Alcance
Los errores y respuestas perdidas se simulan en servicios aislados: no equivalen a una sesión Auth productiva, un corte físico de red ni dos backends PostgreSQL simultáneos. No se modificó SQL, permisos, usuarios o datos históricos. Los datos ficticios solo existieron en memoria.

Certificación global: 29/325 (8,9%), sin elevar controles globales por evidencia parcial. Pendiente: E2E autenticado, concurrencia física/deadlocks y completar resiliencia de creación de boletas y demás módulos. La revisión de impresión y el cierre jurídico conservan sus controles anteriores.
`);
console.log('V206 recorded: 24 browser scenarios, 1572 tests, 29/325 formally certified');
