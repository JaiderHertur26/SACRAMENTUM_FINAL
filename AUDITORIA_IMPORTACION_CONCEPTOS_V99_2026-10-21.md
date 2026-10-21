# SACRAMENTUM V99 · Importación histórica con procedencia verificable

**Fecha:** 21 de octubre de 2026. **Hallazgo:** V99-LEGACY-008.

## Problema y solución

Aunque V98 protegía los conceptos históricos existentes, la función real `public.apply_legacy_import_batch(uuid,integer)` seguía insertando conceptos desde el perfil `annulment_concept` sin rellenar `source_kind` ni `source_reference`. Eso hacía que una nueva importación histórica quedara almacenada erróneamente como `manual` por los valores predeterminados de la tabla.

Se aplicó la migración `preserve_legacy_import_concept_source_v99`, registrada en:

`supabase/migrations/20261021202136_preserve_legacy_import_concept_source_v99.sql`

Para conservar el resto del importador de unos 22.000 caracteres, la migración modifica exclusivamente su bloque `annulment_concept`, comprobando primero la firma, los límites del bloque y el patrón de SQL existente. Si alguno difiere, interrumpe la migración sin alterar la función.

En adelante cada concepto histórico importado lleva:

- `source_kind='legacy_catalog'`.
- `source_reference='legacy_batch:<uuid del lote>/row:<uuid de fila>'`.

Las autorizaciones originales de `apply_legacy_import_batch`, su firma y el atributo `SECURITY DEFINER` no fueron alterados en V99.

## Pruebas de función y operación

**Ensayo reversible de estructura:** actualización de la definición dentro de `BEGIN/ROLLBACK`, comprobando que la firma compila, conserva `SECURITY DEFINER` y aparecen las dos columnas de procedencia en la única rama esperada.

**Ensayo E2E de importación:** se insertaron temporalmente un lote `CPTOANULA` y una fila `annulment_concept`, ambos completamente ficticios. Con una sesión autenticada del rol Diócesis se invocó la RPC institucional `apply_legacy_import_batch`.

1. El primer caso sin `parish_id` falló de manera controlada: el importador exigió una **parroquia propietaria**. No hubo efectos persistentes.
2. Al asociar lote y fila a una parroquia operativa de la diócesis, la fila pasó a `imported`, no registró incidentes y quedó un concepto transaccional `legacy_catalog`, con `source_reference` exactamente igual al lote y a la fila de prueba.
3. Ejecutado `ROLLBACK`, se verificó **0** conceptos ficticios, **0** lotes, **0** filas y **0** vínculos de importación ficticios. Permanecen **4/4 conceptos históricos anteriores**.

**Resultado:** la corrección funciona en la ruta real de la RPC para un lote ficticio, no solo por inspección estática. Todavía falta el ensayo integral de reimportación masiva, concurrencia y perfiles históricos combinados.

## Regresión automática

Archivo `scripts/test-legacy-import-provenance-v99.mjs`: **7 pruebas** de firma, alcance del parche, procedencia, lote/fila, fail-closed y no alteración de registros. Integrado al gate y GitHub Actions.

Batería total prevista de V99: **271 pruebas sintéticas**, 23 verificadores históricos, build Vite, controles CSS y análisis de dependencias.

## Riesgo institucional adicional identificado

La función `can_manage_legacy_import` concede hoy permisos amplios al rol `admin_general` y limita de forma diferente a Diócesis y Parroquia. **Esto se considera una cuestión de autorización independiente de V99**, pendiente de verificar contra la jerarquía institucional y corregir mediante pruebas reversibles. No declarar la seguridad de importaciones globalmente aprobada.

Persiste además el bloqueo de cinco alertas HIGH de dependencias, la auditoría de funciones privilegiadas y la validación visual autenticada.
