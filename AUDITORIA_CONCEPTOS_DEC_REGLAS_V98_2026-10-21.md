# SACRAMENTUM · Auditoría V97–V98 de conceptos de decreto y procedencia histórica

**Fecha:** 21 de octubre de 2026. **Ámbito:** conceptos de decreto emitidos por Cancillería, especialmente importados del archivo anterior. **Proyecto Supabase:** REGISTRO SACRAMENTOS.

## Hallazgo V97-SEC-006: modificación por roles sin competencia

En `public.conceptos_anulacion`, las políticas INSERT/UPDATE permitían actuar a `admin_general`, `diocese` y `chancery`. No existe interfaz de gestión de este catálogo en Diócesis ni Administración General: la pantalla CRUD está en `src/pages/chancery/decree-annulment/AnnulmentConceptsTab.jsx`.

**Prueba anterior:** UPDATE sin cambio sobre un concepto real, dentro de `BEGIN/ROLLBACK`:

| Actor | Filas modificables antes |
| --- | ---: |
| Administrador General | 1 |
| Diócesis | 1 |
| Cancillería | 1 |
| Parroquia | 0 |

Se comprobó que este acceso no emitía un decreto nuevo; permitía modificar su catálogo jurídico sin el control del módulo de Cancillería.

### Corrección V97

Migración `reserve_decree_concepts_to_chancery_v97` aplicada:

`supabase/migrations/20261021200248_reserve_decree_concepts_to_chancery_v97.sql`

Las políticas de escritura INSERT y UPDATE exigen `current_app_role()='chancery'` y `diocese_id=current_effective_diocese_id()`. En UPDATE el ámbito se valida con `USING` y `WITH CHECK`. SELECT y consulta histórica no fueron alterados. No se añadió DELETE directo.

**Matriz real posterior:** 8/8 casos de UPDATE sobre catálogo existente e INSERT de nuevo concepto ficticio entre cuatro roles. Solo Cancillería pudo ejecutar ambas operaciones. Pruebas adicionales: Cancillería no puede INSERT un concepto de segunda diócesis ficticia, no puede trasladar a otra diócesis un concepto existente, y DELETE directo no eliminó conceptos (0 filas).

## Hallazgo V98-SEC-007: posibilidad de falsificar la fuente histórica

Las cuatro filas actualmente presentes en `conceptos_anulacion` tienen `source_kind='legacy_catalog'`. **Antes de V98**, una sesión de Cancillería podía cambiar el `source_kind` de un concepto histórico a `manual` y asignar cualquier `source_reference`. La reproducción con datos de prueba confirmó una fila alterable; operación revertida íntegramente.

### Corrección V98: inmutabilidad de la fuente

Migración `lock_legacy_concept_provenance_v98` aplicada:

`supabase/migrations/20261021200915_lock_legacy_concept_provenance_v98.sql`

- Función `private.guard_legacy_concept_identity_v98()` con `SECURITY INVOKER` y `search_path` vacío, invocada por un trigger `BEFORE UPDATE` sobre `conceptos_anulacion`.
- Si el concepto **procede del archivo histórico** (cualquier `source_kind` distinto de `manual`), su contenido y procedencia se mantienen inmutables. Solo se autoriza cambiar `is_active` para desactivarlo y la marca `updated_at`.
- Si el concepto **fue creado manualmente**, continúa permitida su edición ordinaria, pero no la falsificación de `source_kind` ni `source_reference`.
- Para INSERT directo desde la API, la política exige `source_kind='manual'` y `source_reference IS NULL`. Las importaciones institucionales deben conservar su vía privilegiada y verificable.
- La interfaz de Cancillería oculta **Editar** para históricos, muestra **Histórico protegido**, mantiene el botón **Desactivar sin borrar historial** y explica que una corrección requiere crear un nuevo concepto.

### Ensayos de autorización e integridad

Prueba conductual SQL con identidad válida de Cancillería, `BEGIN/ROLLBACK`:

| Caso | Resultado |
|---|---|
| Convertir concepto histórico en manual | 42501, bloqueado |
| Cambiar código de concepto histórico | 42501, bloqueado |
| Desactivar concepto histórico | Permitido |
| Crear y editar un concepto manual ficticio | Permitido |
| Reetiquetar concepto manual como histórico | 42501, bloqueado |
| Insertar concepto con procedencia histórica falsificada | 42501, bloqueado |

Además, el ensayo territorial V97 validó que una Cancillería no puede modificar la diócesis de un concepto ni insertar conceptos para otra diócesis.

**Inventario antes/después:** exactamente **4 conceptos originales**, los 4 procedentes de catálogo histórico; **0** conceptos y diócesis con prefijos QA residuales; **1** trigger de integridad instalado; **0** excepciones `is_app_admin()` en las políticas de escritura de conceptos. No se sustituyeron originales ni se generaron decretos de prueba permanentes.

## Regresión y límites

Se añadieron `scripts/test-decree-concept-authority-v97.mjs` (6 pruebas) y `scripts/test-legacy-concept-provenance-v98.mjs` (8 pruebas), integradas al gate y a GitHub Actions. Total esperado: **264 pruebas sintéticas** y los 23 verificadores históricos, además de build y análisis de dependencias.

**Limitaciones reales:**

- El ensayo de importación histórica completa desde un DBF/JSON y su reejecución real no está cubierto con datos del archivo original en un sandbox separado. El código del importador anterior usa INSERT y ON CONFLICT DO NOTHING para conceptos, pero faltan pruebas exhaustivas para todos los perfiles de importación.
- El número de serie histórico, procedencia documental y exactitud jurídica requieren contrastar los originales físicos eclesiásticos.
- El control de tipos jurídicos de anulación y nulidad de Tribunal requiere auditoría independiente.
- Las **cinco advertencias HIGH** en dependencias siguen bloqueando el trabajo de seguridad; **128 funciones SECURITY DEFINER** continúan pendientes de auditoría individualizada.
- No se interpretará el éxito de tests estáticos como validación completa de la sesión gráfica, la impresión o la restauración de copias de seguridad.
