# SACRAMENTUM FINAL — V194 · Integridad de impresiones y cotejo del asiento

**Corte:** 24 de octubre de 2026, Colombia. **Ruta:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL`.
**Supabase:** REGISTRO SACRAMENTOS.

## Hallazgo y reproducción
La RPC privilegiada `register_registry_print` aceptaba el formato legado de impresión con `p_metadata={}`: se generaba una constancia nueva marcada como `coordinates_checked=false` y `record_version_checked=false`, sin cotejar libro, folio, número, edición vigente ni huella HTML. La debilidad se reprodujo directamente en PostgreSQL con un Bautismo ficticio en `BEGIN/ROLLBACK`.

En el historial preexistente había **8 constancias**, todas con verificación registral incompleta. No se alteraron, eliminaron, ni declararon certificadas por la migración. Para constancias anteriores no verificadas será necesaria conciliación documental separada.

## Corrección de servidor aplicada realmente
Migración Supabase `20261024212500_guard_print_integrity_v194`:
- Nueva función trigger `guard_registry_print_integrity_v194()`, invocada con `BEFORE INSERT` desde `registry_print_events`, con ruta de búsqueda vacía.
- Cada nuevo evento **exige** `coordinates_checked=true`, `record_version_checked=true`, `record_updated_at` válido/no vacío, `record_status`, libro/folio/número no vacíos, huella `document_sha256` de 64 caracteres hexadecimales y procedencia `client_digest_not_server_certification`.
- El trigger no confía en permisos del cliente: los roles authenticated/anon **no tienen INSERT ni UPDATE directo** sobre `registry_print_events`, y el trigger no es invocable desde ellos.
- Se preservan las verificaciones preexistentes en la RPC: cotejo con la fila canónica bajo bloqueo de lectura `FOR SHARE`, notas marginales obligatorias y hash aportado por el navegador.
- **No se actualizó ninguna constancia antigua.** La huella SHA-256 sigue siendo una huella calculada por el cliente y no constituye firma criptográfica del servidor ni prueba de identidad física del impresor.

## Prueba real integral, cuatro sacramentos
`scripts/qa-rollback-print-integrity-v194.sql` ejecutado contra Supabase con usuario parroquial activo, rol SQL `authenticated` y datos ficticios, bajo `BEGIN/ROLLBACK`:
- **4/4** constancias de impresión válidas: Bautismo, Confirmación, Matrimonio y Exequias, con libro/folio/número correctos, versión vigente, SHA-256 y **nota marginal obligatoria incluida**.
- **20/20** rechazos: cinco intentos por sacramento — formato antiguo sin metadatos, libro ajeno, versión antigua, digest inválido y nota marginal obligatoria omitida.
- El cotejo de la constancia persistida dentro de la transacción comprobó `parish_id`, `sacrament_id`, `requested_by`, tipo, coordenadas, campos de cotejo y procedencia real de la nota.
- Tras `ROLLBACK`: **0** partidas `QA194` en los cuatro sacramentos y **8** constancias históricas originales, sin cambios.

## Correspondencia del documento impreso
- Se agregó `src/utils/canonicalRegistryCoordinates.js` para usar primero columnas oficiales del asiento y tomar `raw_data` solo como alternativa para expedientes históricos sin coordenada en columna.
- Plantillas de Bautismo, Confirmación y Matrimonio usan libro/folio/número canónicos; en Bautismo/Confirmación se priorizan nombres, apellidos y fecha de celebración de las columnas registrales.
- `funeralDocumentHtml.js` ya usaba `record.book_number`, `record.folio`, `record.number`: verificado por prueba que incluso si el JSON histórico discrepa, el HTML toma las columnas oficiales.
- `scripts/test-registry-print-canonical-v194.mjs`: ocho pruebas de no regresión, datos históricos contradictorios, notas, huella, versión y fuentes de impresión.

## Puerta de calidad
**V194:** 1.489 de 1.489 pruebas Node aprobadas; 30/30 verificaciones generales, compilación y auditorías de dependencias aprobadas.

## Cierre honesto de alcance
**22.10 Registro de impresión — APROBADO para la constancia canónica y el bloqueo de rutas no cotejadas.**
**08.04 Libro/Folio/Número de Bautismo — APROBADO para la continuidad asiento→modelo de impresión canónico.**

No se aprueban aún **08.05, 09.05, 10.06 y 11.10** (impresión en navegador/impresora). Para cerrarlos faltan sesiones reales autenticadas, renderizado físico/visual del documento, correspondencia verificable de todos los campos personales, selección de notas y control de fallos de popup/impresora.

**Importante:** la RPC valida las coordenadas y la versión, pero no comprueba en servidor cada carácter del HTML generado por React. No se debe denominar certificación de contenido íntegro del documento sin controles adicionales.

**Plan maestro tras V194:** 24/325 controles APROBADO ≈ 7,38 %; no implica certificación completa.
