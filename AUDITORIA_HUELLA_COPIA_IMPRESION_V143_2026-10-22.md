# SACRAMENTUM · COORDENADAS, VERSIÓN Y HUELLA DE COPIA PARA IMPRESIÓN · V143

## Hallazgo reproducido en Supabase
- Antes del parche register_registry_print permitía imprimir una partida real del libro/folio/número canónico si el navegador enviaba folio desfasado: el ejemplo ficticio de Bautismo tenía folio 333, pero p_metadata.expected_coordinates solicitaba folio 222. El servidor registraba el evento igualmente.
- Reproducción: scripts/qa-rollback-stale-print-coordinates-baseline-v143.sql, con excepción intencional y ROLLBACK.

## Migración backend realmente aplicada
- supabase/migrations/20261022180645_guard_stale_registry_print_document_v143.sql.
- Si cliente envía expected_coordinates, exige objeto con tres cadenas book/folio/number, y compara contra valores canónicos recuperados de la fila del sacramento dentro del mismo RPC. La discrepancia lanza SQLSTATE 23514.
- Si cliente envía expected_record_updated_at se convierte en timestamptz y compara con updated_at de la fila; marcas inválidas o caducadas se rechazan. No se limita a status seated.
- Si recibe document_sha256, valida el formato hexadecimal de 64 caracteres y lo almacena con provenance client_digest_not_server_certification. El servidor no calcula el hash del HTML: no presume autoría ni certificación sobre datos generados por cliente.
- Al construir el recibo agrega record_updated_at, coordinates_checked, record_version_checked y document_sha256_provenance.
- Los clientes antiguos continúan siendo compatibles mientras no envían las nuevas comprobaciones; estos recibos quedan identificados como coordinates_checked=false / record_version_checked=false. Esto NO certifica impresión desde el frontend actualmente desplegado.

## Cambios frontend
- src/utils/registryPrintReceipt.js incluye sha256PrintedHtml con Web Crypto SHA-256 sobre el HTML congelado y valida coords, updated_at y el mismo hash devuelto en el recibo.
- src/services/marginalNotesV2Service.js exige htmlSnapshot, expectedCoordinates y fecha cuando existe, construye metadatos del RPC y compara el recibo real antes de imprimir. Navegador sin crypto.subtle no puede continuar silenciosamente.
- Cinco vías: Bautismo, Confirmación, Matrimonio, Exequias partida y Exequias constancia remiten los datos y el HTML congelado antes del RPC; no se leen ni regeneran tras la respuesta.
- No se guarda el HTML íntegro en la base, solo su huella SHA-256 de procedencia declarada no certificada.

## Laboratorios
- scripts/qa-rollback-print-optimistic-coordinates-v143.sql: 4 sacramentos; 24 rechazos reales de libro/folio/número desfasados, digest malformado, versión previa y objeto de coordenadas incompleto; 4 rutas válidas y 4 legacy compatibles/marcadas como no cotejadas. BEGIN/ROLLBACK. PASS.
- scripts/test-stale-print-coordinates-v143.mjs: 29 nuevos tests de backend y cliente, comparación horaria UTC, alteración de un byte HTML, hash conocido SHA-256, versiones, coordenadas y cinco flujos. PASS.
- Se actualizaron fixtures V142 para la nueva comprobación obligatoria del cliente. No se redujeron pruebas existentes.
- AUDITORIA_PUERTA_CALIDAD_V143.json: 796/796 tests sintéticos, 28/28 tareas estrictas, build/CSS y npm audit full/runtime 0 vulnerabilidades.
- Consulta final Supabase: 0 fixtures QA en los cuatro sacramentos, registry_print_events o registry_audit_log. Histórico ANULACION conserva 5 pendientes y 2 vinculados.

## Limitaciones y dictamen
- SHA-256 es huella de integridad del HTML congelado preparado por cliente, no prueba independiente de que todo el documento sea idéntico al libro institucional ni firma criptográfica de Cancillería.
- Esta fase NO ejecutó impresión física ni sesiones reales de navegador autenticado ni concurrencia entre múltiples conexiones. Tampoco ha desplegado el frontend.
- La comprobación de versión solo se exige si la pantalla recibió updated_at; las copias legacy y los registros sin updated_at requieren controles adicionales.
- Inventario SECDEF: 136 funciones, 21 parcialmente probadas y 115 aún pendientes. 19 controles maestros recibieron evidencia nueva; estado {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}.

**Dictamen:** cerrado con QA el fallo de coordenadas de copia desfasadas. La trazabilidad documental mejoró, sin reclamar certificación física o criptográfica independiente.
