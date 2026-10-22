# SACRAMENTUM · NOTAS MARGINALES OBLIGATORIAS E IMPRESIÓN VERIFICADA · V140–V141

## Hallazgo confirmado antes de corregir
- Supabase register_registry_print permitía registrar la solicitud de impresión de una partida de Bautismo con nota marginal print_policy=required omitida. El servidor aceptaba included_notes=[] y selected_note_keys=[].
- La reproducción está en scripts/qa-rollback-mandatory-note-print-baseline-v140.sql: excepción intencional forense y ROLLBACK.
- Antes del arreglo el servidor tampoco cotejaba las notas seleccionadas con su texto/categoría y partida originales.

## Backend aplicado
- V140: supabase/migrations/20261022172147_validate_registry_print_notes_server_v140.sql; V141: 20261022173154_preserve_audited_civil_link_helpers_v141.sql. Ambas migraciones confirmadas en Supabase.
- El procedimiento compara nota UUID con sacramento, parroquia, partida, estado, política y texto real; no permite notas inexistentes, duplicadas, internas, inactivas ni de otro registro.
- Las notas required vigentes deben estar presentes; se rechazan omisiones incluso si el usuario cambia selected_note_keys o document_kind.
- Nota de decreto reversed previa a la reversión: no se permite como vigente. Nota documental reversion_*: conserva su obligatoriedad y trazabilidad, aunque el mismo decreto permanezca reversed.
- included_notes del evento se reconstruye con los campos canónicos de la base: contenido, etiqueta, política, UUID y provenance.
- El backend registra estado de la partida e indica cuándo es una copia histórica/no vigente. No impide automáticamente la expedición de copias históricas; su validez jurídica debe tratarse aparte.
- Nota inline legacy-inline: sigue admitida como client_supplied_unverified_historical, no certificada como nota DB.
- Nota automática auto-rc-<UUID> de Bautismo: solo para la misma partida, con NUIP o Serial existente y visible en el contenido; etiqueta client_rendered_registry_fields_unverified. La composición total del texto por el cliente NO equivale a certificación notarial.

## Frontend y generación de copias
- marginalNotesV2Service.js excluye notas de decretos cancelados/revertidos salvo la nota de reversión, y evita reintroducir nota inline histórica cuando corresponde a una revertida.
- ViewMarriagePartidaModal.jsx ya no usa un fallback que podía devolver nota inline inválida tras filtrar el conjunto.
- funeralService.js consulta política, estado y vínculo con decreto para las notas de Exequias.
- FuneralPartidasPage.jsx preserva required incluso al desmarcar opcionales; tanto Partida como Constancia requieren su incorporación. Para constancias se consultan las notas del registro correcto antes de imprimir.
- funeralDocumentHtml.js representa notas obligatorias de constancia con contenido escapado; prueba de renderizado HTML aprobada.
- No se modificó la autorización institucional para imprimir; la función sigue exigiendo acceso al ámbito parroquial.

## Laboratorios en Supabase, todos reversibles
- qa-rollback-registry-print-integrity-v140.sql: 7 rechazos (omisión de nota obligatoria, falsificación, interna, reversa, otra partida, phantom key, duplicado) +3 casos válidos.
- qa-rollback-print-reversed-decree-notes-v140.sql: 2 rechazos y 1 reversión documental obligatoria válida vinculada a decreto reversed.
- qa-rollback-auto-civil-registry-print-v141.sql: 3 rechazos y 1 nota RC con NUIP coincidente, de procedencia explícitamente no certificada.
- qa-rollback-registry-print-four-sacraments-v141.sql: cuatro sacramentos x 1 denegación por omisión y 1 impresión válida por nota obligatoria correcta.
- Todas las operaciones ficticias se ejecutaron entre BEGIN y ROLLBACK. Consulta final: cero registros QA en las cuatro tablas sacramentales, marginal_notes, registry_print_events y decretos. ANULACION 5 archived y 2 materialized_decree intactos.
- authenticated sigue sin permiso directo de INSERT en registry_print_events.

## Regresión y plan maestro
- scripts/test-registry-print-marginal-integrity-v140.mjs: 28 contratos con ejecución de HTML de Exequias, incorporados a gate y GitHub Actions.
- AUDITORIA_PUERTA_CALIDAD_V141.json: 741/741 pruebas sintéticas, 28/28 controles estrictos, build Vite/CSS y npm audit completo/producción sin vulnerabilidades.
- AUDITORIA_RPC_PRIVILEGIADAS_V141.json: 136 funciones privilegiadas, 21 con pruebas parciales, 115 pendientes de revisión individual.
- Se añadieron evidencias a 19 controles. Estado de 325: {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}.

## Límites explícitos
- No existe garantía física de que la impresora haya completado la salida. Se registra una solicitud y su conjunto de notas cotejadas antes de que se invoque la impresión.
- Los textos históricos sin fila propia y los vínculos civiles armados en navegador conservan señalización de procedencia no certificada. Debe revisarse su fuente física/documental.
- El DOM HTML podría sufrir cambios o desincronización después de la solicitud. Faltan pruebas E2E con sesiones institucionales reales, concurrencia, visual de impresión y custodia del soporte.
- Frontend aún sin desplegar desde la rama local de auditoría.

**Dictamen:** omisión de notas obligatorias y anotaciones revocadas en solicitudes de impresión cerrada en backend con pruebas sobre los cuatro sacramentos; certificación integral pendiente.
