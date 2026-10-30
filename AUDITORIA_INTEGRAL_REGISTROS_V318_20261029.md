# SACRAMENTUM · Auditoría integral de registros V318
**Fecha:** 29 de octubre de 2026 (Colombia)
**Ámbito:** Supabase REGISTRO SACRAMENTOS, rama temporal feat/v318-auditoria-integral, Vercel SACRAMENTUM
**Precaución:** Todos los ejercicios de escritura real se realizaron en transacciones SQL BEGIN/ROLLBACK. Son QA; no se deben confundir con registros eclesiásticos oficiales.

## I. Pruebas transaccionales reales en la base

Se ejecutaron 35 verificaciones de escenarios transaccionales (33 archivos heredados más 2 escenarios específicos V318), de las que **27 finalizaron satisfactoriamente**, y **8 archivos de QA anteriores no pudieron cumplir sus precondiciones o expectativas ya obsoletas**. Se comprobó BEGIN/ROLLBACK y ausencia de COMMIT en todos los archivos. Los escenarios abortados no persistieron operaciones.

### Aprobaciones verificadas
- **4 sacramentos**: creación de boleta, asiento, cierre, 4 rechazos de asiento duplicado, 4 entradas de auditoría (V193).
- **Certificados / impresión**: 4 comprobaciones de impresión autorizada y 20 solicitudes inválidas rechazadas (V194).
- **Reposición**: 2 nuevas partidas por decreto, 2 reversiones autorizadas, 4 reversiones por rol indebido rechazadas (V210).
- **Corrección y conciliación**: Bautismo, Confirmación, Matrimonio, Exequias; pruebas de conciliación posterior y conflictos, con reversión (V159,V167).
- **Memoria/folio**: Matrimonio y Exequias, avance del siguiente folio y cuatro reintentos duplicados rechazados (V202).
- **Boletas**: 5 tipos de idempotencia, 15 reintentos con mismo comprobante, 5 cambios de contenido rechazados y 2 denegaciones de acceso (V207).
- **Recuperación**: 4 fallos forzados al generar comprobantes y 4 recuperaciones con el mismo identificador (V207).
- **Históricos**: cuatro flujos históricos, archivo de notificaciones, preservación de origen físico y límites de permiso (V173,V171,V121).
- **Notificaciones**: matrices marginales, destino físico, suplantación de lectura rechazada, 2 destinatarios externos en un matrimonio, 1 confirmación local pendiente de libro físico, 1 confirmación externa, duplicado rechazado y cierre prematuro rechazado (V133,V134,V174,V318).
- **Privacidad / permisos / decretos**: matriz de roles, 24 variaciones prohibidas de boletas, límites de asiento, decretos con tipo/estado inválidos rechazados, nulidad con doble autorización y notas de partidas incorrectas rechazadas (V115,V177,V178,V189,V128,V216).
- **Notas marginales**: casos de múltiples notas por sacramento y guardas de decretos; inscripción histórica preservada (V168,V154,V137).
- **Numeración V318**: el consecutivo ahora es único y compartido para notificaciones de Matrimonio y Confirmación por parroquia, usando bloqueo transaccional; dos prefijos válidos, contador mayor respetado y usuario diocesano sin autorización rechazado.

### Incidencia real resuelta
**V318 — colisión de consecutivos:** V277 tenía secuencias separadas para Matrimonio y Confirmación, pero la tabla matrimonial_notifications impone una unicidad compartida sobre (sender_parish_id, consecutive). Una emisión de cada sacramento dentro de la misma transacción colisionó en el consecutivo 1. Se añadió `next_sacramental_case_sequence_v318`, con ámbito parroquial, contador compartido, valor máximo histórico y serialización para evitar dos asignaciones coincidentes. El RPC `issue_sacramental_case_v277` usa ahora ese mecanismo. La prueba que antes fallaba pasó después de la migración, y todas sus operaciones fueron revertidas.

### Ocho casos heredados sin aprobación en este entorno
1. `qa-rollback-marginal-four-sacraments-v216.sql`: su fixture exige al menos dos parroquias operativas de la misma diócesis; solo una cumple la condición actualmente.
2. `qa-rollback-documentary-decree-lifecycle-v210.sql`: no encuentra los actores parroquiales coherentes exigidos por el fixture.
3. `qa-rollback-chancery-decree-scope-v179.sql`: pretende llamar una función de corrección matrimonial cuyo EXECUTE está ahora denegado al rol invocante (perímetro cambiado).
4. `qa-rollback-registry-print-four-sacraments-v141.sql`: usa una constancia de impresión anterior al contrato obligatorio de huella/cotejo V194. La versión actual V194 sí pasó.
5. `qa-rollback-four-role-read-matrix-v197.sql`: espera que el rol Diócesis lea dos decretos parroquiales; ese acceso fue restringido por la política institucional actual.
6. `qa-rollback-generic-link-matrimon-v217.sql`: preparación incompleta de dos destinos parroquiales; UUID vacío.
7. `qa-rollback-marginal-parish-guard-v216.sql`: preparación de actores/parroquias insuficiente; UUID vacío.
8. `qa-rollback-print-optimistic-coordinates-v143.sql`: contrato de impresión antiguo, incompatible con la guardia actual V194.

Estos ocho archivos requieren fixture aislado adecuado o modernizar la expectativa; **NO cuentan como pruebas superadas** ni justifican relajar los controles actuales. No se concluye automáticamente que exista un fallo de producción en cada uno.

## II. Puerta de calidad y pruebas automatizadas
- `npm run audit:master`: **30/30 verificaciones aprobadas**, ahora con V314/V315/V317/V318 incluidos expresamente en la lista sintética y en GitHub Actions.
- Test de V318: 4/4; test específico combinado de V314–V318: 23/23.
- Build Vite y chequeo de dependencias: correctos.
- La suite de GitHub incluye pruebas de navegadores Chrome con datos ficticios aislados, pero no reemplaza una sesión real autenticada de todos los roles ni el envío real de correo.

## III. Control de contaminación
**Conteos antes y después, sin variación:**

| Tabla | Antes | Después |
|---|---:|---:|
| baptisms | 5040 | 5040 |
| confirmations | 2091 | 2091 |
| marriages | 1261 | 1261 |
| funerals | 1 | 1 |
| pending_baptisms | 71 | 71 |
| pending_confirmations | 233 | 233 |
| pending_marriages | 1 | 1 |
| pending_funerals | 1 | 1 |
| decretos | 2 | 2 |
| marginal_notes | 82 | 82 |
| matrimonial_notifications | 0 | 0 |
| official_notifications | 2 | 2 |
| registry_print_events | 9 | 9 |
| registry_audit_log | 365 | 365 |
| document_sequences con `sacramental_case_global_v318` | 0 | 0 |

## IV. Limitaciones y próximos ensayos para habilitación oficial
- Falta un entorno QA con varias parroquias operativas y cuentas de párrocos separadas para cerrar toda la matriz interparroquial (y evitar usar identidades reales de personas).
- Falta una prueba completa de navegador con sesiones autenticadas y formularios reales de cada rol, no solo simulación de JWT o fixtures.
- Falta la comprobación real de envío, recepción, acuse de notificaciones físicas/externas y del correo; la emisión de la correspondencia en BD no equivale a entrega.
- Las pruebas no examinan todos los contenidos importados desde libros físicos ni todas las posibles combinaciones de datos; no sería correcto afirmar «cero errores» o «100% operativo» en todo el producto.
- Los registros actualmente presentes son de **prueba**, no oficiales. No se limpian en esta auditoría: hacerlo requiere el mecanismo de inicio oficial autorizado y verificado.
