# SACRAMENTUM — RESTAURACIÓN SEGURA DE INSTANTÁNEAS DE BAUTISMO Y CONFIRMACIÓN · V138

## Hallazgo real (reproducido antes de corregir)
- reverse_correction_decree usaba (metadata.decree_number) para localizar la instantánea original de Confirmación, en vez del UUID del decreto. Una segunda fila de auditoría con el mismo número, distinta procedencia y created_at posterior era seleccionada y contaminaba raw_data del original al revertir.
- Se generó una partida de Confirmación únicamente ficticia, se insertó otra instantánea ficticia con qaPoison, la reversión restauró la ajena y la prueba lanzó excepción intencional con ROLLBACK.
- Archivo: scripts/qa-rollback-confirmation-audit-number-collision-baseline-v138.sql.

## Corrección instalada en Supabase
- Migración real 20261022164859_bind_confirmation_audit_to_decree_uuid_v138.sql.
- apply_confirmation_correction_internal incorpora metadata.decree_id=v_decree_id tanto al anular el original como al crear supletoria.
- reverse_correction_decree ahora selecciona la instantánea por decree_id exacto, parish_id exacta, entity_id y entity_type, tanto para Bautismo como para Confirmación.
- Un snapshot ausente, duplicado, sin status o sin objeto raw_data detiene la restauración con error 23514 y exige conciliación manual. Los datos históricos sin UUID no se adivinan mediante el número.
- La consulta de producción previa confirmó cero instantáneas de Confirmación sin UUID y cero correcciones activas de Confirmación, por lo que no hubo retroajuste sobre datos históricos.

## Ensayos transaccionales, sin datos persistidos
- qa-rollback-confirmation-audit-number-collision-baseline-v138.sql: antes del fix contaminaba restauración (falla documentada); después de V138 recuperó la instantánea correcta.
- qa-rollback-confirmation-duplicate-exact-audit-v138.sql y qa-rollback-baptism-duplicate-exact-audit-v138.sql: doble instantánea con mismo UUID, restauración rechazada; originales, supletorias, notas y avisos intactos.
- qa-rollback-confirmation-missing-exact-audit-v138.sql y qa-rollback-baptism-missing-exact-audit-v138.sql: se retiró en laboratorio metadata.decree_id, se rechazó la restauración como ambigua.
- qa-rollback-baptism-confirmation-v115.sql: las cuatro rutas correctas (Bautismo/Confirmación x corrección/reposición) siguen aprobadas.
- Consulta final de producción: 0 partidas QA, 0 decretos QA, 0 asientos de auditoría QA, 0 notas QA; ANULACION mantiene cinco pendientes y dos vinculados.

## Puerta de calidad
- scripts/test-unique-reversal-audit-snapshot-v138.mjs: 15 pruebas añadidas a scripts/audit-gate-v90.mjs y GitHub Actions.
- AUDITORIA_PUERTA_CALIDAD_V138.json: 694/694 pruebas sintéticas aprobadas, 28/28 verificaciones estrictas, npm audit completo y de producción cero vulnerabilidades, Vite build y CSS críticos OK.
- AUDITORIA_RPC_PRIVILEGIADAS_V138.json: 136 SECURITY DEFINER expuestas a authenticated, 20 parcialmente revisadas, 116 pendientes de revisión individual.
- 18 controles del plan maestro recibieron evidencia nueva. Estado global: {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}. No se certificó el sistema entero.

## Límites y continuación
- No se probaron sesiones reales con varias conexiones simultáneas, impresión, ni custodia material de sentencias y decreto histórico importado sin UUID.
- El procedimiento ante expedientes antiguos ambiguos es conciliación manual segura, no restauración silenciosa.
- No se desplegó frontend desde la rama de auditoría; no se emitió acto eclesial auténtico.

**Dictamen:** corregida la restauración de un snapshot de otro decreto por colisión numérica; integridad del enlace UUID y rechazo de ambigüedad comprobados, auditoría general todavía abierta.
