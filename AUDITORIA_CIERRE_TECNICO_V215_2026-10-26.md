# SACRAMENTUM FINAL — Auditoría V215 · Integridad de importaciones matrimoniales

**Fecha:** 26 de octubre de 2026, Colombia.

## Hallazgos reproducidos en Supabase con datos ficticios (BEGIN/ROLLBACK)

1. **Procedencia compartida entre parroquias:** la RPC `private.materialize_pending_legacy_marriages` reutilizaba un `legacy_record_links.target_id` del primer lote desde otra parroquia si coincidían sistema, perfil `INSMATRI` y clave de origen. La segunda importación quedaba indebidamente enlazada al pendiente de la primera. Reproducción confirmada y revertida.
2. **Conciliación matrimonial sin fecha:** una preinscripción `reported=true` con nombres de ambos contrayentes iguales a los de una partida ya celebrada se conciliaba automáticamente incluso sin fecha de matrimonio. Reproducción confirmada y revertida.

## Protección versionada

`supabase/migrations/20261026120242_guard_pending_legacy_marriage_provenance_v215.sql` mantiene íntegra la función y sus permisos, añadiendo:
- Exclusión mutua transaccional por clave global; impide carreras simultáneas.
- Verificación de parroquia del lote histórico original y de la parroquia de la boleta o partida física; error seguro si el vínculo pertenece a otra parroquia.
- Para matrimoni​os reportados, nombres y apellidos completos de ambos contrayentes y fecha efectiva de celebración obligatorios antes de enlazar una partida existente.
- Caso incompleto en `review`, con `REPORTED_MARRIAGE_IDENTITY_INSUFFICIENT` e información auditable, sin crear partidas.
- Fallo explícito ante cambios inesperados de función origen, para evitar alteración insegura de SQL.
- Un reintento legítimo en la parroquia propietaria conserva el vínculo, sin duplicar boletas.

### Validación real reversible antes de publicar

| Escenario | Resultado |
|---|---|
| Preinscripción con clave repetida, otra parroquia | Bloqueada; vínculo ajeno preservado |
| Reintento de la misma clave en parroquia propia | Idempotente |
| `reported=true` con nombres coincidentes, sin fecha | A revisión, 0 vínculos incorrectos |
| `reported=true` con identidad y fecha válidas | Enlaza a la partida correcta, 0 partidas nuevas |
| Residuo persistente ficticio en 4 ámbitos inspeccionados | 0 |

Los ensayos no realizaron importaciones permanentes ni modificaron matrimonios reales.

## Interfaz de usuario

El Centro de Migración ahora diferencia `INSMATRI`: **expedientes pendientes creados**, **matrimonios existentes conciliados** y **casos en revisión manual**. Nunca describe un lote con expedientes en revisión como una importación completa sin incidencias.

**Chrome aislado:** 15/15 recorridos aprobados de la página React real con identidad y servicios simulados; cero excepciones JS y cero peticiones externas.

## Auditoría general

- 1.743 / 1.743 pruebas automáticas.
- 30 / 30 controles rigurosos.
- Compilación Vite, frontera de secretos y auditorías npm aprobadas.

## Evidencias

- `AUDITORIA_MATRIMONIOS_HISTORICOS_SQL_V215.json`
- `AUDITORIA_CENTRO_MIGRACION_BROWSER_V215.json`
- `AUDITORIA_PUERTA_CALIDAD_V215.json`
- `scripts/qa-rollback-marriage-*.sql`
- `scripts/test-marriage-historical-scope-v215.mjs`

**Pendientes medidos:** revisar las funciones de importación de notas marginales y otros registros legacy, según el Issue #64. No se ha completado el clic real en correo de recuperación de contraseña ni impresión física. La migración será aplicada de forma permanente solo después de aprobación de GitHub CI.
