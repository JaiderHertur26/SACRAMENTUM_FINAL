# SACRAMENTUM — REIMPRESIONES, BLOQUEOS, ANTECEDENTES Y DEPENDENCIAS · V144–V147

## Protecciones instaladas en Supabase
- V144 migration 20261022182523: SELECT FOR SHARE del asiento bautismal, confirmación, matrimonio y exequias durante su solicitud. pg_advisory_xact_lock agrupa solicitudes por parroquia/sacramento/partida/tipo.
- Metadatos de solicitud: print_request_sequence, previous_print_request_id y print_request_classification (primera_solicitud o reimpresion_solicitada). NO indican impresión física completada.
- V145 migration 20261022182724: orden por consecutivo anterior antes de marca temporal. Se reprodujo y corrigió el error de tres eventos con timestamps iguales.
- V146 migration 20261022183433: valores anteriores sin secuencia, no numéricos o fuera de rango no rompen el próximo documento. Mantiene el antecedente histórico sin editarlo.

## Ensayos con datos inventados y ROLLBACK
- qa-rollback-print-request-lineage-v144.sql: cuatro sacramentos, tres solicitudes sucesivas 1, 2 y 3, UUID anterior exacto y otro tipo documental con numeración independiente.
- qa-rollback-historical-print-lineage-v145.sql: evento anterior sin consecutivo, seguido por secuencias 2 y 3, con enlaces correctos.
- qa-rollback-malformed-legacy-print-baseline-v146.sql: muestra el defecto antiguo 22P02 por NO_NUMERIC. No es un test positivo postparche.
- qa-rollback-malformed-historical-lineage-postfix-v146.sql: valores NO_NUMERIC y número fuera de rango aceptados como antecedentes, sin modificar sus metadatos.
- Repetidas qa-rollback-print-optimistic-coordinates-v143.sql y qa-rollback-registry-print-four-sacraments-v141.sql. Todas las pruebas positivas pasaron. Ninguna fila ficticia persistida.

## Concurrencia: lo comprobado y lo pendiente
- Los FOR SHARE impiden cambios incompatibles sobre la fila durante la transacción. El advisory transaction lock serializa solicitudes hechas por la RPC para el mismo documento.
- La llamada de prueba con dos peticiones SQL en paralelo NO confirmó contención: la segunda obtuvo el lock. El conector puede serializar o ejecutar transacciones sucesivamente. Se declara INCONCLUSA, no aprobada.
- Los bloqueos no persisten tras la transacción, ni impiden que una nota nueva se cree después del recibo. Faltan pruebas independientes con dos sesiones físicas y impresión real.

## Bloqueo de seguridad de dependencias y reparación
- AUDITORIA_PUERTA_CALIDAD_V146.json conserva la falla inicial 26/28: DOMPurify 3.4.16 (subdependencia de jsPDF 4.2.1), avisos XSS, incluyendo GHSA-cg2g-xh64-v4q7.
- package.json fija override dompurify 3.4.17 y package-lock.json registra exactamente esa versión. jsPDF 4.2.1 no cambió.
- npm audit completo y producción actuales: cero vulnerabilidades detectadas.
- En C:\SACRAMENTUM\QA_V147_INSTALL se ejecutó npm ci --ignore-scripts --no-audit --no-fund con 446 paquetes, npm audit --audit-level=low cero vulnerabilidades y npm ls dompurify en 3.4.17.

## Estado verificado
- scripts/test-print-request-lineage-v146.mjs: 21 pruebas añadidas a gate y CI.
- AUDITORIA_PUERTA_CALIDAD_V147.json: 817/817 pruebas sintéticas aprobadas y 28/28 verificaciones estrictas, Vite build/CSS y dos npm audit OK.
- Supabase: 0 partidas, solicitudes o registros de auditoría QA; 8 eventos históricos de impresión existentes sin huella SHA-256, sin alterar; archivo ANULACION 5 pendientes y 2 vinculados.
- Catálogo de funciones SECDEF: 136, con 21 pruebas parciales y 115 pendientes de revisión individual.
- 20 controles del plan maestro recibieron evidencias. Estado {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}.

## Límites
- No se ejecutó sesión institucional real en navegador ni dos transacciones simultáneas sobre la misma partida de modo concluyente.
- No se imprimió papel ni se desplegó frontend. Una solicitud no equivale a expedición física.
- No se cambió el contenido de los datos históricos y no se certifica la auditoría completa.

**Dictamen:** linaje de solicitudes comprobado y dependencias saneadas; concurrencia multisesión física queda pendiente.
