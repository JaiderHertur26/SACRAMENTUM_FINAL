# SACRAMENTUM · V170 — Aislamiento de contadores, mensajes y laboratorio de conciliaciones

Fecha: 23 de octubre de 2026. Carpeta canónica: C:\SACRAMENTUM\SACRAMENTUM_FINAL.

## Defecto y cierre de seguridad
- Aunque la V162/V169 aislaba expedientes en función del usuario y de la jurisdicción, las tarjetas de métricas renderizaban `totals.pending`, `totals.authorized`, `totals.executed` y `totals.rejected`, estado bruto de una sesión anterior, no `visibleTotals` derivado de `dataCurrent`.
- La alerta `error` también era visible sin comprobar que correspondía a la identidad actual. Un cambio de identidad puede renderizar antes de que `useEffect` limpie el estado.
- Ahora todas las tarjetas muestran solo `visibleTotals`; la alerta usa `visibleError` condicionada por `scopeCurrent`. La API de servidor y las reglas jurídicas permanecen intactas.

## Laboratorio visual recuperado
- El fixture V160 no exportaba `executeLaterNoteReconciliationBatch`, añadido desde V168. Por eso los recorridos V162 ya no podían arrancar con la fuente actual. La importación faltante estaba únicamente en el mock y no en producción.
- Se añadió la simulación exclusiva del laboratorio, que nunca abre Supabase.
- Se generó la compilación aislada del laboratorio y se sirvió localmente en 127.0.0.1:4179; Chrome real utilizó el componente React auténtico.
- 6/6 comprobaciones de navegador aprobadas: contadores A, enmascaramiento al cambiar A→B, contadores propios B, rechazo de respuesta A tardía, logout y vuelta a A.
- Evidencia estructurada en `AUDITORIA_NAVEGADOR_CONTEOS_V170.json`. No se crearon datos ni cuentas reales.

## Gate V170
- 1242/1242 sintéticas; 28/28 verificaciones estrictas incluyendo compilación de producción, CSS y auditorías de dependencias.
- Se actualizó el test heredado V157 para exigir `visibleTotals.rejected` y no el contador bruto sin protección.
- El plan maestro sigue {"APROBADO":10,"EN_PROGRESO":117,"PENDIENTE":198}; ninguna certificación ampliada artificialmente.

## Concurrencia PostgreSQL · Control P0 #2
- Se ensayaron dos llamadas SQL simultáneas con una clave advisory transaccional reservada al laboratorio; el actor A mantuvo el lock unos 7 segundos en una transacción ROLLBACK, actor B sondeó pg_locks y terminó con NO_OVERLAPPING_HOLDER_DETECTED.
- Esto NO acredita dos sesiones con solapamiento ni bloqueo FOR UPDATE de filas. El mediador de consultas pudo serializar sus llamadas. No se instaló extensión ni se modificó tabla alguna.
- Sigue pendiente una conexión PostgreSQL de prueba con dos sesiones físicas superpuestas y barreras; no marcar #2 aprobado ni simular resultados.

## Reproducción del navegador
1. `npx vite build --config scripts/qa-v160-browser/vite.config.mjs --outDir dist-v170`.
2. En otra consola: `npx vite preview --config scripts/qa-v160-browser/vite.config.mjs --outDir dist-v170 --port 4179 --strictPort`.
3. `node scripts/audit-reconciliation-sensitive-ui-browser-v170.mjs`.
4. Detener el servidor de prueba y borrar `scripts/qa-v160-browser/dist-v170` después de capturar evidencia. El directorio construido es descartable.

**Dictamen:** riesgo de datos antiguos en métricas/alertas mitigado y verificado con componentes React reales y usuarios ficticios; no se certifica simultaneidad Postgres ni autenticación de dos diócesis reales.
