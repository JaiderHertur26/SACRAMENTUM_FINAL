# SACRAMENTUM · SEGURIDAD DE PROCEDENCIA FÍSICA V121

**Proyecto:** C:\SACRAMENTUM\SACRAMENTUM_FINAL. **Rama:** audit/v113-build-tool-risk.

## Hallazgo reproducido
- Los objetos de legacy_physical_source_artifacts, legacy_physical_source_rows y legacy_source_files se autorizaban por instalación histórica propia aunque el origen particular perteneciera a parroquia de otra diócesis.
- Prueba QA antes de V121, con JWT ficticio de cuenta autorizada pero dato de otra jurisdicción: physical=1 rows=1 hashes=0 files=1. Tres lecturas indebidas; los hashes se bloqueaban.

## Corrección instalada
- Migración Supabase V121: 20261022131752_isolate_physical_legacy_provenance_v121.sql.
- Cuatro políticas SELECT actualizadas: artefactos físicos, filas, archivos fuente y hashes de origen.
- Exige coincidencia entre instalación, origen, parroquia y jurisdicción del actor. Las filas heredan la autorización del artefacto propietario.
- No hay cambios de escritura ni alteración de información auténtica en la migración.

## Pruebas QA
- scripts/qa-rollback-physical-provenance-rls-v121.sql: SELECT ajeno rechazado en las cuatro fuentes (0/0/0/0) con ROLLBACK.
- scripts/qa-rollback-physical-provenance-legitimate-v121.sql: Diócesis, Cancillería y Administrador General mantienen lectura de expediente ficticio autorizado (1/1/1/1). La comprobación parroquial es condicional a existir un perfil parroquial activo del origen elegido.
- scripts/test-physical-provenance-rls-v121.mjs: ocho comprobaciones contractuales.
- Consulta posterior: 0 residuos QA en artefactos, archivos, orígenes y diócesis; ANULACION mantiene cinco pendientes y dos vinculados.

## Seguridad general todavía abierta
- Security Advisor: 64 objetos visibles en esquema GraphQL para authenticated. La advertencia no significa que las filas sean accesibles; revisar por objeto y rol.
- 133 funciones SECURITY DEFINER ejecutables por authenticated y cero por anon; 17 de estas no mencionan literalmente auth.uid, lo que NO acredita por sí solo ausencia de validación. Auditoría funcional por RPC pendiente.
- Security Advisor reporta protección contra contraseñas filtradas no habilitada; requiere cambio y verificación de configuración Auth.
- npm audit y dependencias: control 30.02 continúa FALLIDO; no incluido en este gate.

## Regresión
- AUDITORIA_PUERTA_CALIDAD_V121.json: 543 pruebas sintéticas, 25/25 verificaciones incluidas 23 comprobaciones legadas y build.
- Se agregaron 15 evidencias al plan maestro. Resumen: {"APROBADO":9,"EN_PROGRESO":100,"PENDIENTE":215,"FALLIDO":1}.
- Sin prueba de UI autenticada, impresión, backup completo, carga histórica real, concurrencia ni despliegue frontend.

Dictamen: la exposición de procedencia física comprobada se corrigió y verificó. **No existe certificación global de SACRAMENTUM.**
