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

## Seguridad, límites y publicación

- **No** se ha demostrado simultaneidad física de dos conexiones PostgreSQL compitiendo por la misma fila: el control #2 sigue abierto. El ensayo HTTP paralelo temporal no terminó y la función experimental se eliminó inmediatamente. No se conservaron extensiones experimentales.
- Sigue pendiente la certificación E2E física autenticada de dos diócesis distintas (#1).
- La aplicación no debe llegar a producción hasta que la rama supere compilación, pruebas contractuales y auditoría de dependencias en GitHub; la barrera V163 exige aprobación del mismo commit en Vercel.
- La función antigua se conserva para conciliaciones individuales y compatibilidad histórica.

**Dictamen:** defecto multinota reproducido y mecanismo de lote verificado reversiblemente en los cuatro sacramentos; el cierre definitivo requiere CI y despliegue verificados. La auditoría integral sigue abierta.
