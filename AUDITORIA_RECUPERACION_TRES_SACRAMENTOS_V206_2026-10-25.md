# SACRAMENTUM FINAL — V206: recuperación de tres circuitos sacramentales
Fecha: 25 de octubre de 2026, Colombia.
Ruta canónica: C:\SACRAMENTUM\SACRAMENTUM_FINAL. Base: V205, main 0bbeac2.

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
