# SACRAMENTUM · V167 — Estados conflictivos de conciliaciones y límites de concurrencia

Fecha 23 de octubre de 2026. Fase de auditoría profesional sobre decreto/nota/conciliación para los 4 sacramentos.

## Resultado real y confirmado
- Prueba scripts/qa-rollback-reconciliation-conflicting-transitions-v167.sql con actores institucionales y 4 expedientes ficticios sobre Bautismo, Confirmación, Matrimonio y Exequias: PASS en Supabase.
- Por sacramento: duplicado abierto denegado por índice UNIQUE parcial, ejecución prematura sin autorización denegada; autorización independiente y ejecución legítima; reejecución denegada; reapertura del decreto revertido denegada; segunda autorización y rechazo tardío denegados.
- En las 4 rutas, comprobado estado reversed de decreto y nota, executed de expediente, exactamente 3 audit events y 1 notificación oficial para cada caso.
- Contrato físico de esquema leído en vivo: las 4 RPC de transición tienen FOR UPDATE y verifican auth.uid(); índice parcial uq_later_note_open_decree_v156 existente. scripts/qa-readonly-reconciliation-lock-contract-v167.sql PASS.
- Cero decretos, expedientes, notas ni trazas QA-V167 tras ROLLBACK. No se aplicaron migraciones en esta etapa.

## Intentos de comprobar dos conexiones independientes
- Primera prueba: dos execute_sql lanzados con Promise.all, pid A 212157 y B 212160. La sesión B consiguió adquirir el advisory lock; por tanto NO se demostró un bloqueo simultáneo. Los PID distintos por sí mismos no prueban concurrencia.
- Segundo método: CREATE EXTENSION dblink sólo dentro de BEGIN/ROLLBACK (sin instalación persistente). La conexión independiente local fue rechazada por Postgres por falta de contraseña o credenciales GSSAPI delegadas. No se pidieron ni revelaron contraseñas.
- NO se declara probada la concurrencia física, el lock wait, el deadlock handling ni un conflicto de dos transacciones solapadas. GitHub issue #2 permanece abierto.

## Auditoría técnica
- 1195/1195 pruebas sintéticas, 28/28 controles Quality Gate. npm audit y build sin hallazgos reportados.
- Registro de 209 funciones SECURITY DEFINER, 148 ejecutables authenticated, 45 con QA parcial, 103 pendientes. Cuatro contratos revisados con nueva evidencia, sin ascenso de certificación.
- 325 controles maestros: {"APROBADO":10,"EN_PROGRESO":113,"PENDIENTE":202}. 07.06 y 17.09 pasaron de pendientes a en progreso por evidencia parcial. 07.03/07.08/26.07 siguen sin certificar.

## Próximo requisito para cerrar issue #2
- Habilitar dos sesiones SQL estables independientes usando conexión administrativa segura y sin registrar credenciales; ensayar con fixture transaccional aislado y sincronización temporal.
- Debe existir evidencia de transacciones realmente simultáneas disputando bloqueo FOR UPDATE, bloqueo NOWAIT/timeout o serialización controlada y únicamente una acción exitosa.
- Validar rutas de aprobación vs rechazo, ejecución vs revocación y decreto vs notas; comprobar trazas/notificaciones únicas después de ambos cierres.

**Dictamen:** transiciones y duplicados bajo múltiples actores verificados; simultaneidad física pendiente. No declarar certificación integral.
