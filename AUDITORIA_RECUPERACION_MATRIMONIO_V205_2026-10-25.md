# SACRAMENTUM FINAL — V205: recuperación del asiento matrimonial
Fecha: 25 de octubre de 2026, Colombia.
Ruta: C:\SACRAMENTUM\SACRAMENTUM_FINAL.
Base revisada: main V204, commit 89af0615a4a19ac4b0e28298c16739119fdb4862.

## Fallos y resultado
Un lote de Matrimonio usa una RPC por acta. Si falla la segunda llamada después de confirmar la primera, la interfaz anterior conservaba selección, pendientes y consecutivos antiguos. El error individual o por lote no explicaba lo sucedido. Una lectura inicial fallida podía presentarse como Archivo al Día. El bloqueo basado solo en estado React dejaba entrar dos clics antes del siguiente render, incluso al abrir la confirmación asíncrona.

La página ahora consulta pendientes, boletas emitidas y parámetros tras cualquier fallo de asiento. Solo conserva seleccionadas las boletas que siguen pendientes, ajusta el índice visible y explica cuántas llamadas quedaron confirmadas antes de interrumpirse. No reenvía ninguna escritura automáticamente. La confirmación explica que el lote se procesa una por una y conserva las actas ya asentadas.

Si falla esa consulta, oculta todas las acciones de asiento y muestra un panel con Reintentar sincronización. Un useRef adquirido antes de cualquier await bloquea el doble clic; se libera también al cancelar o fallar. No se cambiaron funciones PostgreSQL, permisos ni registros históricos.

## Ensayo en navegador
Se montó MatrimonioSentarRegistrosPage.jsx real en Chrome headless con servicios ficticios en memoria. El control CDP bloquea cualquier solicitud externa a localhost; hubo cero solicitudes externas y cero excepciones JavaScript. La evidencia incluye SHA256 del código de la página, normalizado a LF para Windows y Linux.

Los ocho escenarios pasaron:
- Timeout simulado antes de guardar un asiento individual; reintento explícito correcto.
- Respuesta perdida después de guardar el asiento; lectura retira la boleta ya asentada.
- Lectura no disponible tras un resultado ambiguo; bloqueo y posterior recuperación.
- Lote interrumpido en la segunda acta: primera conservada, dos seleccionadas para reintentar.
- Respuesta perdida después de guardar la segunda acta del lote: solo queda la tercera.
- Fallo de lectura tras interrumpir el lote: sin acciones de escritura hasta sincronizar.
- Lectura inicial fallida: no se confunde con archivo vacío y el reintento solo lee.
- Cancelar la confirmación y volver a intentarlo: bloqueo liberado, tres actas sin duplicar.

Se enviaron dobles clics en los escenarios de asiento y confirmación. Antes de aplicar el cambio, la misma batería dio 0/8, con reenvíos y estado obsoleto. Después: 8/8. No son ocho fallos independientes; varios escenarios verifican las mismas causas bajo diferentes interrupciones.

Archivos reproducibles: scripts/audit-seat-recovery-browser-v205.mjs y scripts/qa-v205-seat-recovery/vite.config.mjs. Ejecución: node scripts/audit-seat-recovery-browser-v205.mjs. La opción --baseline etiqueta la salida; para reproducir el corte anterior se debe usar la página del commit base en un checkout aislado.

## Regresión y CI
Puerta local: 1546/1546 pruebas y 30/30 verificaciones. Compilación de producción correcta; npm audit de producción y completo sin vulnerabilidades reportadas.

Se detectó que el workflow mantenía la lista de pruebas hasta V168 aunque la puerta local incluía V204. Se sincronizó con los 103 archivos explícitos actuales, incluyendo V169–V205. La nueva prueba comprueba que ninguna entrada de la puerta quede ausente en CI. GitHub Actions ejecuta primero el navegador aislado y después valida su evidencia junto a toda la regresión.

## Alcance y siguiente trabajo
Esta evidencia verifica comportamiento real de React con fallos simulados, sin sesión Auth productiva. No demuestra un corte físico de red, dos conexiones PostgreSQL simultáneas, recuperación de los otros tres sacramentos ni E2E autenticado.

Certificación global: 29/325 (8,9%), sin aprobar controles globales por una prueba parcial. Próximos: llevar la recuperación de respuesta ambigua a Bautismo, Confirmación y Exequias; acreditar concurrencia real y deadlocks cuando existan dos sesiones independientes autorizadas. Los datos ficticios de V205 existieron solo en memoria.
