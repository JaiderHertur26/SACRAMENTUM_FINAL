# SACRAMENTUM — CONSTANCIA Y CONTENIDO DE IMPRESIÓN · V142

## Hallazgo de código y corrección
- Antes de V142 los modales Bautismo/Confirmación/Matrimonio leían contenido.innerHTML después de esperar registerRegistryPrint. Un rerender React durante ese await podía cambiar notas/documento sin correspondencia con la solicitud persistida.
- Las cinco rutas (tres modales y dos documentos de Exequias) ahora capturan el HTML exacto que intentan imprimir antes de iniciar el RPC. Las notas seleccionadas se fijan al mismo momento.
- marginalNotesV2Service.registerRegistryPrint deja de conformarse con el UUID devuelto por el RPC: recupera registry_print_events por el ID recién creado bajo RLS y coteja sus atributos.
- Se agregó src/utils/registryPrintReceipt.js con una función pura para comprobar parish_id, sacrament_id, sacrament_type, document_kind, metadata de procedencia y estado actual de la partida.
- Para cada nota imprimible coteja posición, id, policy y content. Se permite que label mostrado por cliente no sea canónico, pero nunca que cambie texto/política/identidad.
- Si falta el evento, no puede leerse, la nota difiere o el estado registral cambió, se lanza error y la pantalla interrumpe la impresión con aviso visible.
- Exequias conserva distinción partida y constancia; ambas imprimen únicamente printHtmlSnapshot generado antes del RPC. La constancia sigue incorporando required.

## Laboratorios y regresión
- scripts/qa-rollback-print-receipt-authenticated-v142.sql: cuatro partidas ficticias separadas y nota required; el actor parroquial autenticado simulado leyó el propio registro de impresión bajo las políticas RLS reales, validando solicitante, documento, estado y procedencia. BEGIN/ROLLBACK, PASS.
- scripts/test-print-receipt-consistency-v142.mjs: 26 pruebas del helper y contratos de pantalla. Rechaza parroquia/tipo/partida/clase errónea, event faltante, metadata sin validación, cambio de estado, nota eliminada, añadida, adulterada, reordenada o con política distinta; prueba snapshot antes de await en las cinco salidas. PASS.
- AUDITORIA_PUERTA_CALIDAD_V142.json: 767/767 pruebas sintéticas; 28/28 verificaciones estrictas; build/CSS, npm audit producción/completo 0 vulnerabilidades.
- Consulta posterior a Supabase: 0 QA en Bautismo/Confirmación/Matrimonio/Exequias y print events; ANULACION 5 archived y 2 materialized_decree sin cambios. Sin INSERT directo a registry_print_events por authenticated.

## Estado de seguridad
- El catálogo de 136 SECURITY DEFINER accesibles por authenticated mantiene 21 con pruebas parciales y 115 pendientes de revisión individual. register_registry_print recibe evidencia V142, NO se declara auditado por completo.
- Plan maestro actualizado en 19 controles, totales {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}. No se cierra la auditoría completa.

## Limitaciones y siguiente frente
- La congelación HTML evita rerenders dentro de esa espera, pero no demuestra concordancia byte a byte de todos los campos originales contra una instantánea completa del servidor; el RPC compara los atributos y notas descritos, no un hash del HTML final.
- No hay verificación física de papel ni prueba con sesiones institucionales reales en navegador. El ensayo de permisos usa un rol autenticado simulado dentro de transacción SQL.
- Un cambio después de emitirse la constancia no invalida automáticamente un documento ya generado; falta diseño y prueba de versionado de copias/hashes y políticas de reimpresión.
- El frontend modificado permanece en rama local de auditoría, sin despliegue desde V139.

**Dictamen:** cerrada la carrera de lectura de DOM tras el RPC y añadido cotejo obligatorio del recibo antes de imprimir. Queda pendiente certificación documental completa.
