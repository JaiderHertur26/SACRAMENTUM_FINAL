# SACRAMENTUM — REVERSIÓN TARDÍA Y CONSISTENCIA REGISTRAL V135

## Hallazgo real
- Antes de V135, reverse_marriage_decree y reverse_funeral_decree no comprobaban si original/supletoria habían recibido modificaciones de estado posteriores. La corrección antigua podía restaurar original indebidamente y reemplazar estado supletorio.
- Se reprodujo para Matrimonio y Exequias con partidas ficticias y ROLLBACK: la supletoria matrimonial fue marcada nullified y la de Exequias reversed, pero la reversión antigua rehabilitaba original.
- Se documenta la reproducción como caso forense scripts/qa-rollback-stale-correction-reversal-baseline-v135.sql; tras parche la reproducción intencional ya no es válida como test positivo.

## Protección instalada
- Migración Supabase efectiva 20261022161842_guard_stale_marriage_funeral_reversals_v135.sql.
- Las RPC reverse_marriage_decree y reverse_funeral_decree sólo permiten decretos activos/archivados no revertidos.
- Una corrección solo se puede revertir si original permanece anulada, supletoria permanece seated, IDs pertenecen a la parroquia titular y ambas partidas son distintas.
- Una reposición requiere partida supletoria vigente de la misma parroquia; en Matrimonio además exige que no exista partida original asociada.
- En Exequias se introdujeron SELECT FOR UPDATE tanto de la partida original como de la supletoria antes de ejecutar reversión.
- Si el estado cambió por una decisión posterior o una importación, la función rechaza con error 23514 y exige conciliación documental; no elimina ni cambia notas de otros decretos.

## Pruebas SQL reversibles
- scripts/qa-rollback-stale-correction-reversal-postfix-v135.sql: ambas supletorias cambiadas y reversión denegada sin restaurar originales.
- scripts/qa-rollback-stale-original-correction-v135.sql: los originales ya no conservaban estado anulada; ambas reversiones denegadas.
- scripts/qa-rollback-stale-reposition-reversal-v135.sql: reposiciones con supletorias alteradas; decretos, notas y auditorías intactos.
- scripts/qa-rollback-corrections-v115.sql y scripts/qa-rollback-repositions-v115.sql: verificadas las rutas legítimas de reversión de ambos sacramentos. Todas pasaron.
- Todo dato insertado para QA se revirtió con ROLLBACK; consulta posterior: 0 matrimonios QA, 0 Exequias QA, 0 decretos QA, 0 notas QA. Histórico ANULACION 5 pendientes, 2 vinculados.

## Puerta estricta
- AUDITORIA_PUERTA_CALIDAD_V135.json: 28/28 controles, 657/657 tests sintéticos, npm audit producción y completo sin vulnerabilidades, compilación Vite y CSS críticos correctos.
- scripts/test-stale-registral-reversals-v135.mjs: 18 pruebas permanentes de contrato y rollback incluidas en gate y CI.
- AUDITORIA_RPC_PRIVILEGIADAS_V135.json: 136 SECDEF alcanzables por authenticated, 17 parcialmente probadas; 119 aún necesitan revisión individual exhaustiva.

## Límites pendientes
- No se ejecutaron pruebas concurrentes con transacciones en sesiones físicas distintas; FOR UPDATE reduce riesgos pero no sustituye esa validación.
- Aún deben evaluarse reversiones de Bautismo/Confirmación frente a decretos posteriores, especialmente instantáneas de auditoría y legados ambiguos.
- No se probó interfaz autenticada ni impresión, ni se desplegó frontend desde rama de auditoría.

## Plan maestro
- 18 controles con evidencia específica añadida; estado de 325 controles: {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}. Ningún control de alcance mayor se declara cerrado por estas pruebas parciales.

**Dictamen:** eliminada vía demostrada de reversión tardía indebida en Matrimonio y Exequias; faltan áreas y validaciones integrales.
