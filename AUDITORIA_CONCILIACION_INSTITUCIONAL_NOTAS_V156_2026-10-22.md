# SACRAMENTUM — V156 · CIRCUITO INSTITUCIONAL DE CONCILIACIÓN DE NOTAS POSTERIORES

## Problema y alcance
- V154 y V155 bloqueaban correctamente la reversión cuando existía una nota marginal manual posterior independiente. Faltaba un mecanismo autorizado y auditable para conciliar esa nota y completar la reversión de forma atómica.
- V156 implementa un expediente que no permite borrar el texto original ni resolver notas obligatorias, bloqueadas o vinculadas a otros decretos.

## Backend y permisos
- Migración instalada en Supabase: 20261023030534_later_note_institutional_reconciliation_v156.sql.
- Tabla later_note_reconciliations_v156: pendiente → autorizado → ejecutado, con evidencia, snapshot, actor, referencias, justificaciones y tiempos. RLS habilitado; sin acceso de tabla directo a authenticated ni anon.
- Funciones request, approve, execute y list. Las tres primeras se probaron dinámicamente; list se verificó por código y permanece pendiente de QA física autenticada.
- Cancillería solicita. Cuenta de Diócesis distinta del solicitante autoriza. Cancillería ejecuta. Sólo notas de tipo manual, activas, no obligatorias, desbloqueadas y sin vínculo con otro decreto pueden entrar.
- En ejecución se coteja snapshot y jurisdicción; se cambia únicamente la nota autorizada; se llama a la reversión del decreto dentro de la misma transacción. Si otra nota posterior impide revertir, ambas modificaciones se revierten.
- La auditoría incluye solicitud, aprobación, cierre de nota y ejecución. Se genera notificación a la parroquia con categoría propia decree_reconciliation para respetar la unicidad de avisos por decreto.

## Pruebas reales reversibles en Supabase
- Caso de reposición matrimonial ficticia: solicitud Cancillería, autorización Diócesis independiente y ejecución Cancillería; decreto/partida/nota/caso quedan correctamente marcados dentro de la transacción. Auditoría de 3 eventos y aviso parroquial verificados.
- Matriz postmigración: seis denegaciones correctas (Parroquia sin competencia, ejecución sin aprobación, autoaprobación, ejecución por Diócesis, otra nota manual activa no conciliada, segunda ejecución del mismo expediente).
- Se comprobó que al fallar por una segunda nota manual activa la primera nota y decreto se mantienen vigentes y expediente sigue autorizado.
- Verificación grants/RLS: scripts/qa-rollback-note-reconciliation-grants-v156.sql pasó. No se otorgó SELECT/UPDATE directos a authenticated, ni EXECUTE a anon.
- Todos los casos ficticios se probaron dentro de BEGIN/ROLLBACK. Consulta de residuos: 0 casos QA-V156 persistidos.

## Frontend de código local
- Nueva página src/pages/chancery/LaterNoteReconciliationPage.jsx con formulario de solicitud, búsqueda de notas elegibles, listado de expedientes, autorización diocesana, ejecución confirmada y mensajes de error.
- Rutas protegidas /chancery/decretos/conciliaciones y /diocese/decretos/conciliaciones, con enlaces desde ambos archivos de decretos. Servicio RPC aislado en src/services/laterNoteReconciliationService.js.
- La interfaz sólo invoca RPC; no actualiza directamente marginal_notes/decretos.
- Build de Vite correcto. La navegación física autenticada no se ha certificado y no se desplegó el frontend a Vercel.

## Auditoría V156
- 1005/1005 pruebas sintéticas, 28/28 controles; build y auditoría npm production+desarrollo sin vulnerabilidades informadas.
- Catálogo SECURITY DEFINER 204 (public 195, private 9); ejecutables por authenticated 143, con 33 revisadas parcialmente y 110 pendientes.
- Plan maestro {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}; se añadieron evidencias a 20 controles; ningún control global fue ascendido a aprobado artificialmente.

## Limitaciones expresas
- No se verificó concurrencia real con dos conexiones PostgreSQL simultáneas; equipo sin cliente/credenciales independientes configurados.
- No se ha contrastado físicamente la UX con sesiones reales de Cancillería y Diócesis. La autorización diocesana registra un acto de software, no constituye por sí misma autenticación de fuentes canónicas externas.
- El frontend no fue desplegado. La certificación completa de 325 controles está abierta.

**Dictamen:** procedimiento institucional reversible probado a nivel de base de datos y código frontend compilado; pendiente QA E2E física, concurrencia real y despliegue.
