# SACRAMENTUM · REVERSIÓN TARDÍA DE BAUTISMO Y CONFIRMACIÓN · V136

## Hallazgo confirmado y aislamiento de la prueba
- Antes de la corrección, un decreto de corrección de Bautismo podía revertirse aunque la supletoria ya estuviera en estado reversed. El antiguo procedimiento llegaba a cambiar el decreto de estado e invalidar la relación registral. SQL del hallazgo: scripts/qa-rollback-stale-baptism-confirmation-baseline-v136.sql.
- La reproducción lanzó excepción de control y ROLLBACK: nunca alteró una partida real.

## Corrección backend aplicada
- Supabase migration: 20261022162909_guard_stale_baptism_confirmation_reversals_v136.sql.
- reverse_correction_decree y reverse_replacement_decree, llamadas sólo desde wrappers autorizados a Cancillería, comprueban previamente estado actual, parroquia, par original/supletoria y decretos activos posteriores o concurrentes que involucren las partidas.
- Sólo se restaura una corrección si original permanece anulada y supletoria conserva status seated; para reposición exige una supletoria única vigente, sin original vinculado.
- Si encuentra discrepancia, exige conciliación manual antes de alterar el libro. Utiliza FOR UPDATE para la comprobación dentro de la transacción.
- Permisos legacy: authenticated no tiene EXECUTE directo sobre reverse_correction_decree ni reverse_replacement_decree.

## Pruebas reales en Supabase (todas ROLLBACK)
- qa-rollback-stale-baptism-confirmation-postfix-v136.sql: cuatro combinaciones (dos sacramentos x corrección/reposición) con supletoria alterada, rechazo y ninguna nota/aviso/decreto indebidamente cambiado. PASS.
- qa-rollback-stale-baptism-confirmation-original-v136.sql: dos correcciones con original alterado y rechazo. PASS.
- qa-rollback-baptism-confirmation-v115.sql: cuatro procedimientos legítimos completos incluida reversión, nota y bloqueo de repetición. PASS.
- La verificación de decretos concurrentes fue inspeccionada estáticamente pero no se simuló un segundo decreto activo durante el laboratorio V136.
- Consulta final: cero Bautismos, Confirmaciones, Decretos y notas QA persistidos; ANULACION sigue 5 pendientes y 2 vinculados.

## Puerta estricta y progreso
- AUDITORIA_PUERTA_CALIDAD_V136.json: 675/675 pruebas sintéticas aprobadas, 28/28 verificaciones, npm audit producción y completo 0 vulnerabilidades, build y CSS críticos correctos.
- scripts/test-stale-baptism-confirmation-v136.mjs agrega 18 verificaciones al gate y GitHub Actions.
- AUDITORIA_RPC_PRIVILEGIADAS_V136.json: 136 SECDEF expuestas a authenticated, 19 con pruebas parciales y 117 pendientes de revisión individual.
- 18 controles recibieron nuevas evidencias. Estado de 325: {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}. No se marcó ninguna fase entera como APROBADA.

## Límites pendientes
- No hay ensayo concurrente entre sesiones físicas ni test E2E con credenciales de usuarios reales en navegador.
- Deben revisarse instantáneas históricas/duplicidad de metadatos en Confirmación, decretos posteriores efectivamente creados y otras RPC.
- No se desplegó frontend nuevo ni se generaron partidas, decretos o asientos reales.

**Dictamen:** cerrada la reversión tardía inconsistente de Bautismo y Confirmación comprobada en laboratorio; auditoría integral abierta.
