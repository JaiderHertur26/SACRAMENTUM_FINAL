# SACRAMENTUM V101 | Acta de despliegue y resultados de auditoría

**Fecha:** 21 de octubre de 2026. **Commit de código y pruebas:** `856c98a`. **Rama:** `main`. **Base de datos:** proyecto REGISTRO SACRAMENTOS.

## Despliegue publicado

- URL de producción: https://sacramentum-final.vercel.app
- Despliegue confirmado **Ready**: https://sacramentum-final-6e26q55vo-jaiderherreras-projects.vercel.app
- HTTP 200 en `/`, `/chancery/decretos/archivo`, `/diocese/decretos/archivo` y `/parroquia/decretos/archivo`.
- CSS realmente descargado de producción: `/assets/index-CKKOgs_G.css`, **111.393 bytes**, SHA-256 `B9C8839A3FD61ECC302251F0A90DB358BB211DE98D66E2584458587072453816`. Huella idéntica a la publicada en V98; V101 no alteró estilos de interfaz.
- **Importante:** HTTP 200 de rutas SPA no valida el contenido interno autenticado.

## Supabase: tres migraciones aplicadas

- `preserve_legacy_import_concept_source_v99`: ahora la importación histórica asocia cada concepto al lote y fila de origen; se comprobó mediante la RPC de aplicación V3.
- `scope_legacy_migration_roles_v100`: Parroquia gestiona su archivo; Diócesis gestiona jurisdicción; Cancillería lo consulta dentro de su diócesis; Admin General deja de acceder al archivo parroquial.
- `block_unscoped_admin_legacy_batch_v101`: eliminada la excepción de creación de lote sin ámbito desde Admin General, después de reproducirla reversiblemente con `REPORTES_FRX`.

## Pruebas de conducta reales

- Matriz de ámbitos sobre perfiles `admin_general`, `diocese`, `chancery` y `parish`, incluyendo lote parroquial y otra parroquia.
- RLS: Admin General ve 0 lotes/filas/vínculos; Diócesis y Cancillería ven 42 lotes, 16.331 filas, 11.734 vínculos de su diócesis; Parroquia ve 20 lotes, 3.292 filas y 3.183 vínculos de su parroquia en la muestra comprobada.
- Aislamiento horizontal: lote ajeno y sus filas/vínculos quedan invisibles para un usuario Parroquia.
- Creación: Admin General no puede crear lotes sin ámbito ni gestionarlos; Diócesis puede crear fuente diocesana; Parroquia puede crear la propia y no otra parroquia.
- E2E Parroquia: crear lote `CPTOANULA`, cargar fila `stage_legacy_import_rows`, aplicar por `apply_legacy_import_batch_v3`, comprobar `legacy_catalog` y referencia de lote/fila; el intento de Admin General de ejecutar el lote fue rechazado.
- En todos los ensayos con escrituras se ejecutó `ROLLBACK`: 0 conceptos, 0 lotes, 0 filas y 0 vínculos QA residuales.
- Permanecen los 4 conceptos históricos originales y los registros previos del archivo.

## Automatización

- `AUDITORIA_PUERTA_CALIDAD_V101.json`: **284/284 pruebas sintéticas**, 23 verificadores históricos, build Vite y utilidades CSS aprobados.
- Puerta local: **25/26** controles aprobados. `dependencias-externas` continúa en **FAIL** por **5 HIGH**, 0 CRITICAL, 0 MODERATE.
- GitHub Actions: https://github.com/JaiderHertur26/SACRAMENTUM_FINAL/actions/runs/39679845800 — **pruebas-funcionales SUCCESS**; **seguridad-dependencias FAILURE** por las cinco advertencias altas.
- Plan maestro de **325 controles**: **9 APROBADO, 56 EN_PROGRESO, 259 PENDIENTE, 1 FALLIDO**.

## No certificado todavía

Quedan pendientes, entre otros, la revisión individual de las 128 funciones privilegiadas, pruebas visuales con sesión real de cada rol, ejecución masiva de importaciones en un sandbox distinto, concurrencia y restauración desde respaldo. La V101 aporta evidencias de autorización y regresión para escenarios definidos, no una certificación integral.
