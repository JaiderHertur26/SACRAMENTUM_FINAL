# SACRAMENTUM FINAL — V214 · Conciliación segura de boletas reportadas

**Fecha local:** 25 de octubre de 2026, Colombia. Pruebas ejecutadas el 26 de octubre en UTC.

## 1. Pruebas PostgreSQL reales, íntegramente revertidas

El script `scripts/qa-rollback-reported-reconciliation-v214.sql` generó partidas celebradas y boletas totalmente ficticias de **Bautismo y Confirmación**, dentro de `BEGIN/ROLLBACK`. Con JWT de una diócesis de ensayo, el materializador real demostró:

- Dos coincidencias únicas con una partida celebrada existente, ligadas correctamente y sin crear otra partida.
- Dos coincidencias ambiguas (más de un candidato), retenidas para revisión manual.
- Dos candidatas ubicadas únicamente en otra parroquia, sin acceso cruzado.
- Dos boletas con partida inexistente, retenidas para revisión.
- Dos reintentos idempotentes, sin otro vínculo ni partida.

## 2. Segundo fallo confirmado: coincidencia sin evidencia temporal

El script de reproducción `qa-rollback-reported-insufficient-identity-repro-v214.sql` usó boletas con nombres y apellidos coincidentes, pero **sin fecha de sacramento ni de nacimiento**. El materializador anterior conciliaba las dos boletas de manera automática solo porque el nombre era único. Es una vinculación débil en registros eclesiales.

La nueva migración `require_reported_legacy_identity_v214` exige **nombres no vacíos, apellidos no vacíos y al menos una fecha válida** antes de permitir una conciliación automática. Si falta alguno, la fila queda como `review`, con incidencia auditable `REPORTED_IDENTITY_INSUFFICIENT`; no se inventa una partida ni se altera la existente.

Las pruebas con la migración aplicada **temporalmente** en transacción demostraron **2/2 errores eliminados** y preservaron las dos conciliaciones positivas. El filtro de parroquia y el bloqueo por clave de origen instalados en V213 permanecen intactos.

## 3. Centro de Migración

La interfaz React y el servicio siguen separados por parroquia. Tras importar boletas se informa por separado el número de **pendientes creados**, **partidas existentes conciliadas** y **casos en revisión manual**. Cuando hay revisiones pendientes, no se presenta el proceso como éxito completo.

Se ejecutaron **13/13** escenarios de la pantalla React real en Chrome con servicios en memoria, 0 excepciones de JavaScript y 0 solicitudes externas. Esta auditoría no incluye persistencia HTTP real desde el navegador.

## 4. Puerta de calidad

- **1.724/1.724** ensayos automatizados aprobados.
- **30/30** verificaciones rigurosas aprobadas.
- Compilación Vite y control de secretos/dependencias correctos.
- Pruebas SQL reversibles, verificando que los datos ficticios no persisten.

## 5. Evidencias y límites

`AUDITORIA_RECONCILIACION_REPORTADA_SQL_V214.json`, `AUDITORIA_CENTRO_MIGRACION_BROWSER_V214.json`, `AUDITORIA_PUERTA_CALIDAD_V214.json`, `scripts/test-reported-reconciliation-v214.mjs`, `scripts/qa-rollback-*.sql`.

La migración SQL quedó registrada y aplicada correctamente en Supabase después de la aprobación de CI, bajo la versión **20261026044654**. Se volvieron a superar las tres pruebas SQL reversibles después de instalarla, incluido el aislamiento V213. El materializador revisado corresponde a preinscripciones históricas INSBAUTI e INSCONFI: falta extender la revisión de procedencia a otros perfiles. La recuperación de contraseña con entrega de correo y la impresión física permanecen pendientes, sin suponer su éxito.
