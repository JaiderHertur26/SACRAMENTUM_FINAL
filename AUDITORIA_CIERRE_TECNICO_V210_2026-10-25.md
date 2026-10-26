# SACRAMENTUM FINAL · Cierre técnico V210

**Fecha de trabajo:** 25 de octubre de 2026 (Colombia; evidencias UTC del 26 de octubre).

**Base:** `main` commit `62ec021`. **Rama:** `audit/v210-qa-workflows-and-jurisdiction`.

## Avance efectivo

Se ejecutaron consultas SQL transaccionales en el proyecto conectado «REGISTRO SACRAMENTOS», usando únicamente identificadores y contenido ficticios. Las cuatro secuencias terminan en `ROLLBACK` y **no modificaron registros reales de forma permanente**.

| Operación real validada | Resultado |
|---|---|
| Boleta → asiento → cierre: Bautismo, Confirmación, Matrimonio y Exequias | 4/4 |
| Intento de volver a asentar una boleta ya procesada | 4/4 denegados |
| Corrección con decreto, nota marginal, doble aprobación institucional y restauración de original | 4/4 sacramentos |
| Decreto documental nuevo de Cancillería | 1 correcto |
| Decretos históricos documentales recuperados | 2 correctos |
| Emisión indebida, número repetido, fuente insuficiente, contenedor histórico indebido | 4/4 denegaciones correctas |
| Lectura por parroquia propietaria de sus decretos documentales | 2 visibles |
| Lectura por parroquia de otra diócesis | 0 visibles |
| Reposiciones de Matrimonio y Exequias | 2/2 |
| Reversiones legítimas por Cancillería | 2/2 |
| Reversiones prohibidas de Parroquia y Diócesis | 4/4 rechazadas |

El auditor comparó los totales de la base antes y después de las pruebas: **5.040 Bautismos, 2.091 Confirmaciones, 1.261 Matrimonios, 1 Exequias y 2 Decretos** permanecieron iguales. No quedaron decretos residuales con los prefijos QA revisados.

### Corrección del laboratorio de pruebas

El antiguo selector de test documental V152 podía emparejar un canciller con una parroquia de otra diócesis. El nuevo `qa-rollback-documentary-decree-lifecycle-v210.sql` selecciona una sola jurisdicción coherente y comprueba que las actuaciones se vean **únicamente desde la parroquia que corresponde**. Su ejecución actual pasó.

`qa-rollback-repositions-v210.sql` fija igualmente la identidad del párroco de prueba a la parroquia evaluada, en lugar de escoger cualquier actor de la diócesis. Pasó tras la revisión.

### Seguridad

Se inspeccionaron 13 tablas registrales o de identidad. Todas tienen RLS activo y ninguna concede lectura SELECT al rol anónimo. Cuatro tablas señaladas por el asesor con RLS sin políticas tampoco conceden SELECT a `anon` ni `authenticated`: su cierre es deliberado, no una apertura.

El asesor de Supabase marca 64 objetos visibles en el esquema GraphQL para usuarios autenticados; esta **visibilidad del esquema no demuestra exposición de filas** cuando rigen permisos y políticas RLS. Queda como seguimiento de minimización de superficie de API, no como vulnerabilidad demostrada. Referencia: https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed

## Puerta de calidad V210

- **1.638/1.638 pruebas automatizadas aprobadas** (11 controles nuevos).
- **30/30 verificaciones estrictas aprobadas**.
- Compilación Vite correcta; `npm audit` de producción y dependencias completas sin hallazgos en esta ejecución.
- GitHub Actions ejecuta exclusivamente la prueba estructural de estos circuitos, sin tokens para escribir en Supabase; la ejecución SQL real debe ser explícita y siempre reversible.

## Evidencias

- `AUDITORIA_E2E_REAL_REVERSIBLE_V210.json`
- `AUDITORIA_PUERTA_CALIDAD_V210.json`
- `scripts/qa-rollback-documentary-decree-lifecycle-v210.sql`
- `scripts/qa-rollback-repositions-v210.sql`
- `scripts/test-real-transactional-workflows-v210.mjs`

## Alcance pendiente — no declarar auditoría integral terminada

Quedan fuera de esta V210 el flujo de correo recibido y enlace de recuperación consumido, pruebas UI exhaustivas de todos los botones y formularios, pruebas positivas de visor/impresión contra un expediente ficticio existente usando navegador, y certificación completa de importación antigua mediante frontend. La prueba V159 de conciliación es SQL real, **no** una demostración del proceso en cada pantalla.

**Siguiente bloque V211:** integrar evidencia de navegador contra datos QA controlados, recepción/impresión de decretos y correos de recuperación, además de analizar la necesidad de restringir exposición GraphQL manteniendo compatibilidad con las consultas existentes.
