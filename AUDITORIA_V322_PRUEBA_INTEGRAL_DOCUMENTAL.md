# AUDITORÍA V322 — ENSAYO INTEGRAL DE REGISTROS, BOLETAS, PARTIDAS, NOTIFICACIONES Y DECRETOS

**Corte:** 30 de octubre de 2026 · SACRAMENTUM_FINAL · Arquidiócesis de Barranquilla.

## Propósito
Examinar la presentación y los contratos de los cuatro sacramentos, recorrer la generación de boletas, asiento y partida, impresión y huellas, libros e índices, y los decretos/correspondencia de Cancillería y Parroquia. Los documentos están **marcados como ejemplos ficticios sin valor legal ni canónico**. La auditoría SQL opera en el proyecto real con `BEGIN … ROLLBACK`; la captura de interfaces usa servicios ficticios sin conexión externa.

## Evidencia entregada
- [Portafolio navegable con enlaces por sacramento y tipo](AUDITORIA_EVIDENCIAS_V322/README.md).
- [Expediente ZIP integral](EXPEDIENTE_SACRAMENTUM_V322.zip).
- Capturas de **4 formularios/boletas** de React; pruebas de creación y recuperación de respuesta en navegador **21/21**; sin errores JS ni solicitudes externas.
- **8 capturas de partida** (4 × carta/móvil) de componentes reales React, **8/8**. Adicionalmente se conservan muestras de resistencia frente a HTML ejecutable.
- **8 PDF** reales de generadores de libro e índice (4 libros × 2 documentos).
- **5 PDF de decretos** con el generador actual de `decreeDocumentHtml.js`: corrección, reposición, repetición, documental, reconstrucción histórica.
- **3 capturas de notificaciones** en bandejas React (aviso sacramental, decreto recibido y Confirmación para notificar), con simulación de dos parroquias: **8/8** controles de sesión, borrado de modal al cambiar de usuario y rechazo de origen ajeno.
- `sql-bloque1.json`, `sql-bloque2.json` y `sql-bloque3.json`: **25 ejecuciones reales SQL** en transacciones reversibles.

## Matriz de verificación de dominio
| Proceso | Resultado |
|---|---|
| Alta/boleta en Bautismo, Confirmación, Matrimonio y Exequias | 8 boletas con consecutivo y UID únicos; 21/21 recorridos UI con manejo de reintentos |
| Celebración / asiento de los cuatro sacramentos | 4 procesos completados, 4 duplicaciones bloqueadas |
| Partidas impresas y notas obligatorias | V194: 4 constancias correctas; 4 notas preservadas, 20 solicitudes rechazadas |
| Libro e índice alfabético | 8 PDF generados desde fuente real; **datos ficticios, sin apertura del ledger oficial** |
| Corrección | SQL de creación, reversión/conciliación y verificación de notas; PDF de muestra |
| Reposición | SQL de reposiciones y conciliación tardía; PDF de muestra |
| Repetición multiactor | 3 parroquias, notas y acuses, cierre anticipado bloqueado, partidas originales preservadas |
| Repetición externa | 3 parroquias locales y una constancia externa, cierre documental solo al completar evidencias |
| Decretos documentales e históricos | SQL V152 y V118; expedientes PDF ilustrativos |
| Nulidad matrimonial / control judicial | SQL V128 y V130: doble autorización, límites territoriales; **no se simula una sentencia judicial PDF** |
| Avisos de Matrimonio / Confirmación | V319, V318 y control de consecutivos V321; RLS de cuatro roles V320 |
| Vista de decreto / notificación interparroquial | Capturas React; la segunda parroquia no ve el contenido de la primera |
| Notificación física a parroquia externa y correo real | No probado con entrega real; se ensaya constancia transaccional |

## Resultado SQL real
**21/25 guiones pasan directamente.** Las otras **4 ejecuciones se conservaron como falla del guion histórico**, por motivos concretos:
- V210: precondiciones de identidades parroquiales independientes no existentes en la instancia actual; ya se ensayó en V319 con fixtures reversibles.
- V216: requiere dos parroquias con ámbito y actores coherentes; sin esas precondiciones se detiene antes de ejercitar la lógica.
- V140 y V142: las constancias de impresión antiguas carecen de huellas y cotejo exigidos por V194. Se conserva el requisito vigente; **la prueba V194 actual pasó**.
No sería correcto afirmar 25/25 ni confundir estas cuatro ejecuciones con errores confirmados en la aplicación actual. Los resultados están en archivos JSON por escenario.

## Protección de datos y alcance
Los resultados de pruebas usan documentos falsos; los registros de la instancia NO se sustituyeron ni fueron purgados. Las inserciones de QA se revierten en cada ejecución SQL. No se accede a buzones ajenos reales, no se envían mensajes reales a parroquias externas y no se generan certificados auténticos. Las pruebas HTML/PDF se originan en componentes y funciones de producción, pero con entradas 100 % ficticias, sin certificado de impresión física.

**Pendiente para declarar funcionamiento oficial al 100 %:** múltiples cuentas institucionales auténticas, constancias V268 y validación de 26 maestros V273, arranque del ledger V267, correspondencia externa real e inspección de 172 RPC privilegiados. Este expediente no cambia esos controles.

## Evidencia reproducible
Los scripts `scripts/audit-v322-boletas-browser.mjs`, `scripts/audit-v322-notifications-browser.mjs` y `scripts/generate-v322-document-review.mjs` reconstruyen la evidencia en entorno aislado; `scripts/test-v322-integral-evidence.mjs` valida los archivos entregados. El portafolio incluye `sha256-archivos.json` para cotejar la integridad de los archivos.

**Conclusión:** las cuatro rutas sacramentales y las principales clases de decreto/notificación disponen ahora de pruebas y documentos revisables. No se certifica una operación oficial en vivo porque el inicio oficial sigue bloqueado de forma deliberada.
