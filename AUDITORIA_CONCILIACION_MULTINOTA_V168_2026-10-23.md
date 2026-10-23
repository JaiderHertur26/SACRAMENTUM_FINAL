# SACRAMENTUM · V168 — Conciliación atómica de varias notas posteriores

Fecha: 23 de octubre de 2026. Incidencia: #12. Auditoría extrema de decretos y notas marginales.

## Defecto encontrado y reproducido

Un mismo decreto de reposición ficticia de Matrimonio podía tener dos notas marginales manuales independientes posteriores, cada una con su solicitud y autorización de Diócesis. La función institucional anterior `execute_later_note_reconciliation_v156` sólo admitía una nota por actuación: al intentar revertir el decreto, la otra nota seguía activa y la operación abortaba íntegramente.

La negativa protegía la base de datos de una reversión parcial, pero dejaba ambos expedientes autorizados sin un camino para ejecutar conjuntamente todas las notas. Reproducción real en Supabase utilizando `BEGIN...ROLLBACK`, sin datos residuales.

## Nueva operación institucional

- Migración `20261023154826_batch_later_note_reconciliation_v168.sql`: nueva RPC `execute_later_note_reconciliation_batch_v168(uuid[])` compatible con el flujo individual existente.
- Solo rol Cancillería de la diócesis competente; cada expediente debe tener aprobación individual de Diócesis, independiente de quien lo solicitó.
- Entre 2 y 30 expedientes únicos del **mismo decreto, parroquia y diócesis**.
- Bloqueos `FOR UPDATE` en casos, decreto y notas; ordenación determinista de casos y notas.
- Comprobación de instantáneas, estado vigente, tipo manual independiente, política de impresión, ausencia de bloqueo y pertenencia a la partida supletoria.
- Rechazo de expedientes no incluidos, solicitudes todavía abiertas y otras notas activas posteriores fuera del lote.
- **Una sola reversión** canónica del decreto (Bautismo, Confirmación, Matrimonio o Exequias); todas las notas pasan a reversed y todos los expedientes a executed, o toda la transacción se revierte.
- Auditoría de conciliación por cada nota y expediente, con **una única notificación consolidada** para la parroquia.
- `SECURITY DEFINER`, `search_path=public`, ejecución sólo `authenticated`, no `anon`; sin conceder SELECT/UPDATE directos a tablas privadas.

## Interfaz

- Servicio `executeLaterNoteReconciliationBatch` usa exclusivamente la nueva RPC.
- En Cancillería se agrupan expedientes autorizados por decreto, previa selección del filtro **Autorizados** y carga completa de sus páginas.
- Si hay un solo expediente, conserva ejecución institucional existente. Si hay varios, ofrece «Ejecutar conciliación conjunta (N notas)» con confirmación explícita.
- No permite mezclar decretos. El servidor valida la jurisdicción y todas las notas de nuevo al ejecutar.
- El resultado de una identidad anterior no debe mostrar notificaciones después de cambio de sesión.

## Evidencia real de PostgreSQL

- Prueba de dos notas matrimoniales: dos autorizaciones independientes, siete solicitudes indebidas o malformadas rechazadas, dos notas y dos expedientes cerrados, decreto y partida supletoria revertidos, **6 eventos de auditoría de expedientes y 1 notificación de lote**. QA reversible completa.
- Prueba equivalente para los cuatro sacramentos: dos notas posteriores y autorizaciones por decreto, cuatro ejecuciones de lote reversibles, 6 eventos de expediente y 1 notificación por sacramento.
- Las pruebas se ejecutaron incluyendo la definición de la nueva RPC dentro de `BEGIN`, seguida del ensayo y `ROLLBACK`: constituyen validación funcional del código antes de la migración de producción.

## Verificación final y publicación V168

- GitHub PR #13 integrada en main, commit `32dfdbb94a856a811ea136d43e66b95a477f4e55`.
- GitHub Actions run #39982084560: 1217 pruebas, 0 fallos; funcional y dependencias success.
- Vercel registró success para ese commit; publicación protegida por el gate V163.
- Migración aplicada permanentemente en Supabase con versión `20261023154826` y ambas pruebas ejecutadas nuevamente contra la RPC instalada.
- Confirmados: auth EXECUTE true, anon EXECUTE false, SECURITY DEFINER true, sin residuos ficticios de decretos, notas, expedientes ni notificaciones, y sin RPC temporal.
- Gate local V168: 1217 pruebas sintéticas y 28/28 controles, dependencias sin vulnerabilidades reportadas.
- Plan maestro: 325 controles, 10 APROBADO, 117 EN_PROGRESO, 198 PENDIENTE. Cuatro controles adicionales elevados sólo a revisión parcial.
- Límites vigentes: falta prueba de concurrencia con dos transacciones Postgres superpuestas y E2E de roles realmente distintos.

## Seguridad, límites y publicación

- **No** se ha demostrado simultaneidad física de dos conexiones PostgreSQL compitiendo por la misma fila: el control #2 sigue abierto. El ensayo HTTP paralelo temporal no terminó y la función experimental se eliminó inmediatamente. No se conservaron extensiones experimentales.
- Sigue pendiente la certificación E2E física autenticada de dos diócesis distintas (#1).
- Completado: GitHub Actions aprobó el mismo commit y Vercel confirmó publicación sucesiva protegida por V163.
- La función antigua se conserva para conciliaciones individuales y compatibilidad histórica.

**Dictamen V168:** defecto multinota reproducido y reparado; RPC migrada, comprobada en los cuatro sacramentos y publicada tras CI. Auditoría integral y concurrencia física permanecen abiertas.
