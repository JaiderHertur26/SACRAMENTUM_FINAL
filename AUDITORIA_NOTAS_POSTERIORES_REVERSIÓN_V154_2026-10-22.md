# SACRAMENTUM — V154 · NOTAS POSTERIORES Y REVERSIÓN DE DECRETOS

## Hallazgo reproducido contra Supabase
- Un decreto de corrección o reposición de Bautismo/Confirmación pudo revertirse sobre supletoria que ya tenía nota marginal manual independiente y activa.
- La QA base de cuatro flujos V115 fue adaptada para insertar nota manual posterior, y la reversión antigua aceptó los cuatro escenarios. Todo en BEGIN/ROLLBACK.
- El riesgo es dejar nota activa vinculada a una partida supletoria sin vigencia, mientras el decreto anterior se da por revertido; no se ha probado explotación externa.

## Reparación backend
- Migración efectiva 20261023012458_guard_independent_marginal_notes_before_decree_reversal_v154.sql: las funciones internas de reversión de corrección y reposición comprueban notas independientes activas en la supletoria. Si existen, rechazan con 23514 y exigen conciliación.
- La comprobación ocurre después de bloquear la supletoria FOR UPDATE; la función de anotación manual usa FOR SHARE sobre partidas de Bautismo/Confirmación, como defensa ante carreras entre nota y reversión.
- La función de notas manuales rechaza nuevas notas ordinarias sobre partidas con status reversed/revertida.
- Corrección complementaria 20261023012719_fix_confirmation_manual_note_lock_v154b.sql: en la primera migración se omitió aplicar el replace de la rama Confirmación. Fue identificado por ensayo posterior y corregido. Se conservó la migración histórica V154 tal como realmente fue aplicada y se agregó V154b como cambio independiente.
- No se agregaron GRANT ni se modificaron tablas sacramentales persistentes.

## Pruebas postmigración realizadas
- scripts/qa-rollback-independent-marginal-decree-guards-v154.sql: 4 rechazos de reversión con nota manual posterior en Bautismo/Confirmación corrección y reposición. Decreto y nota activa intactos tras el rechazo.
- Como simulación estricta de QA, se marcó la nota nueva como conciliada/reversed; luego la reversión autorizada funcionó, generó nota de reversión y rechazó doble reversión. Esto NO certifica un circuito público de conciliación documental.
- scripts/qa-rollback-reversed-record-manual-note-v154.sql: dos intentos de anotación manual sobre partida revertida, 2 rechazados.
- Regresiones scripts/qa-rollback-later-active-decree-baptism-confirmation-v137.sql, scripts/qa-rollback-baptism-confirmation-v115.sql y scripts/qa-rollback-print-reversed-decree-notes-v140.sql: todas pasaron postmigración.
- Toda QA se ejecutó con ROLLBACK. Verificación residual: cero decretos QA-V115, bautismos/confirmaciones qaOnly, notas QA V154 y partidas libro QA154.

## Calidad y cobertura
- scripts/test-independent-marginal-note-chain-v154.mjs: 20 pruebas. Total 953/953 sintéticas y 28/28 controles de Quality Gate.
- Compilación, CSS crítico y dependencias npm: PASS y 0 vulnerabilidades informadas.
- Inventario de seguridad: 139 funciones ejecutables, 30 con evidencia parcial y 109 pendientes. Añadidas evidencias a 5 funciones, sin aumentar aprobaciones globales.
- Plan maestro {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}; 20 controles documentados en V154.

## Pendientes expresos
- Falta una prueba física de dos conexiones PostgreSQL simultáneas para validar espera de locks y la ausencia de phantoms bajo concurrencia.
- Falta un flujo visible y autorizado de conciliación de notas posteriores; la simulación QA no lo sustituye.
- Falta extensión análoga a Matrimonios y Exequias y validación del frontend autenticado/impresión real.
- El frontend V149 aún no fue desplegado en esta intervención.

**Dictamen:** riesgo de reversión con nota posterior activa corregido y ensayado para Bautismos/Confirmaciones. No constituye certificación integral.
