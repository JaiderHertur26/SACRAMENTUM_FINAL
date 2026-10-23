# SACRAMENTUM — V155 · INTEGRIDAD DE DECRETOS CON NOTAS POSTERIORES EN MATRIMONIOS Y EXEQUIAS

## Falla real reproducida
- Los RPC reverse_marriage_decree y reverse_funeral_decree permitían revertir una reposición cuya supletoria ya había recibido una nota marginal manual independiente activa.
- El resultado dejaba una nota activa vinculada con una partida revocada. Reproducido en ambos sacramentos usando scripts/qa-rollback-marriage-funeral-late-note-baseline-v155.sql. BEGIN/ROLLBACK; sin datos ficticios permanentes.

## Corrección aplicada al backend
- Migración Supabase efectiva 20261023023443_guard_marriage_funeral_independent_notes_v155.sql.
- Se insertaron guardas de nota independiente activa en las ramas de CORRECCIÓN y REPOSICIÓN de reverse_marriage_decree y reverse_funeral_decree, luego del bloqueo de la supletoria FOR UPDATE.
- create_manual_marginal_note ahora bloquea FOR SHARE las partidas de Matrimonio/Exequias mientras agrega la nota, y rechaza registros reversed/revertida.
- La migración conserva SECURITY DEFINER, argumentos, valores por defecto, propietarios y permisos; no introduce GRANT ni DROP.

## Pruebas de base de datos contra Supabase efectivo
- Matriz positiva/negativa real con scripts/qa-rollback-marriage-funeral-corrections-late-notes-v155.sql y scripts/qa-rollback-marriage-funeral-repositions-late-notes-v155.sql: cuatro reversions bloqueadas por nota independiente, conservando estado de la nota y las partidas.
- Cada caso recupera reversibilidad tras simular dentro de QA el cierre documental de la nota. Esta simulación SQL NO certifica que exista un procedimiento institucional visible y seguro de conciliación manual.
- scripts/qa-rollback-reversed-marriage-funeral-notes-v155.sql: dos intentos de nota ordinaria sobre partidas revertidas son rechazados.
- Regresiones reales de reversión V115 y bloqueo por cambio posterior V135 se ejecutaron de nuevo y pasaron. Todas las pruebas usan ROLLBACK.
- Comprobación independiente de residuos: 0 decretos QA, 0 partidas matrimoniales/exequiales qaOnly, 0 notas QA V155, 0 registros de auditoría QA V155.

## Auditoría automatizada
- scripts/test-marriage-funeral-independent-notes-v155.mjs incluye 23 nuevas pruebas de contratos y pruebas negativas estructurales.
- Puerta de calidad V155: 976/976 pruebas sintéticas, 28/28 checks, build PASS, npm audit completo y producción 0 vulnerabilidades reportadas.
- Inventario RPC 139 ejecutables: 30 con evidencia parcial, 109 pendientes; 3 funciones reforzadas sin promocionar estados.
- Plan maestro {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}, 20 controles ampliados con evidencia, sin cambiar ninguna fase a APROBADO.

## Limitaciones y próximos controles
- Dos conexiones PostgreSQL simultáneas auténticas siguen sin certificarse. La conexión administrativa disponible serializa las consultas y carecemos de canal independiente verificado. No inferir ausencia de carrera únicamente de FOR SHARE/FOR UPDATE.
- El procedimiento público y documentado para conciliar o revertir una nota posterior (competencias, permisos y trazas) no está probado, y la simulación SQL no sustituye dicho flujo.
- No se probó DOM/impresión física ni frontend autenticado; no se desplegó frontend de versiones anteriores.

**Dictamen:** Falla de integridad de datos encadenados reparada y revalidada en backend efectivo. Auditoría integral aún abierta.
