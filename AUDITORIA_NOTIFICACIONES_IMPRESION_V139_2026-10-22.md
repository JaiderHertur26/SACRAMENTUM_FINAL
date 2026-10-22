# SACRAMENTUM · INTEGRIDAD DE NOTIFICACIONES OFICIALES E IMPRESIÓN · V139

## Defectos reales reproducidos pre-fix
- archive_official_notification permitía que una parroquia cambiara status=cancelled a archived y asignara read_at, aunque el decreto ya había sido cancelado. Reproducción QA script qa-rollback-cancelled-notice-archive-baseline-v139.sql, abortada por RAISE y ROLLBACK.
- mark_official_notification_read degradaba un aviso status=processed a status=read. Reproducción QA script qa-rollback-processed-notice-read-baseline-v139.sql, abortada por RAISE y ROLLBACK.

## Backend aplicado en Supabase
- Migración: supabase/migrations/20261022170342_guard_official_notification_terminal_states_v139.sql.
- Archive sólo acepta read o processed con read_at realmente existente; no fabrica lectura desde pending, no reabre cancelled/reversed y no archiva dos veces.
- Mark Read sólo cambia pending/unread hacia read; deja read, processed, cancelled, archived intactos.
- Las funciones siguen limitadas a la parroquia receptora, con SELECT FOR UPDATE y logs sobre actuaciones aceptadas.

## Matriz de seguridad reversible
- scripts/qa-rollback-notice-status-transitions-v139.sql: cinco estados (pending,read,processed,cancelled,archived), siete pasos legítimos, cuatro intentos no autorizados/contradictorios rechazados; PASS.
- QA anteriores scripts/qa-rollback-marginal-note-notification-matrix-v133.sql y scripts/qa-rollback-cross-parish-notes-receipts-v133.sql repetidas, PASS.
- El cliente authenticated continúa sin UPDATE directo a official_notifications. Consulta final: cero avisos QA y cero bitácoras QA. ANULACION cinco pendientes y dos vinculados sin alteración.

## Frontend: solicitud de impresión auditada antes de mostrar impresión
- ViewBaptismPartidaModal.jsx, ViewConfirmationPartidaModal.jsx, ViewMarriagePartidaModal.jsx y FuneralPartidasPage.jsx (partida y constancia): antes permitían mostrar/imprimir mientras el RPC registraba asíncronamente y cualquier fallo se reducía a console.warn.
- Ahora esperan await registerRegistryPrint. Si falla, emiten toast destructive y no abren el contenido imprimible. Exequias cierra la ventana vacía al fallar.
- marginalNotesV2Service.js ahora rechaza parroquia/partida ausente; no devuelve null en silencio.
- Esto registra la SOLICITUD PREVIA de impresión, no confirma que el navegador, sistema operativo o impresora materialmente haya finalizado. La renderización y los permisos no se ensayaron con sesión real. Una aplicación web no puede garantizar un trabajo físico de impresión completado.

## Verificación
- scripts/test-official-notification-and-print-v139.mjs: 19 contratos de backend y frontend agregados al quality gate y CI.
- AUDITORIA_PUERTA_CALIDAD_V139.json: 713 pruebas sintéticas, 28/28 tareas estrictas, build/CSS, npm audit full/runtime con 0 vulnerabilidades.
- AUDITORIA_RPC_PRIVILEGIADAS_V139.json: 136 funciones SECDEF accesibles a authenticated, 20 con pruebas parciales, 116 restantes. register_registry_print sigue pendiente de auditoría individual profunda.
- Plan maestro: 19 controles con evidencia nueva; estado {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}.

## Límites
- La validación visual autenticada y la prueba de impresión física siguen pendientes. La auditoría solo puede afirmar que la interfaz propia exige registro previo.
- Las variables de impresión seleccionadas por cliente y la conservación de notas en documentos históricamente revertidos requieren evaluación adicional.
- No se desplegó frontend de esta rama ni se emitieron certificados reales.

**Dictamen:** corregidos dos estados inconsistentes de avisos oficiales y eliminado éxito silencioso de los cinco flujos principales de impresión.
