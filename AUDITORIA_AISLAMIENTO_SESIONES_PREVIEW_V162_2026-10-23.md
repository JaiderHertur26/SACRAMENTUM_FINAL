# SACRAMENTUM — V162 · AISLAMIENTO DE SESIONES Y DESPLIEGUE DE VISTA PREVIA

## Problema comprobado por revisión del código
- En el componente de conciliaciones, las filas y contadores estaban asociados al estado React, pero no identificaban al usuario y jurisdicción que los había originado.
- Un cambio de cuenta dentro de una página montada podía conservar temporalmente datos anteriores o dejar respuestas de red atrasadas. La corrección refuerza fail-closed incluso si la sesión autenticada cambia antes de que responda la red.

## Reparación frontend
- src/pages/chancery/LaterNoteReconciliationPage.jsx: identityKey une ID de autenticación, rol, diócesis y cancillería. scopeOwner y loadedScope impiden representar datos de otra identidad.
- Cuando cambia el actor: revoca versión de listado y versión de búsqueda de notas, vacía dioceseId, expedientes, contadores, formularios, borradores y motivos, y vuelve a resolver el contexto válido.
- Si la respuesta tardía no coincide con la versión vigente, no modifica la interfaz. En fallo de consulta borra resultados y no mantiene antiguas fichas. Las operaciones de aceptación o reversión requieren scopeCurrent/dataCurrent.
- Cambiar el decreto en el formulario invalida la búsqueda de nota en curso.

## Navegador Chrome real, identidades ficticias aisladas
- scripts/audit-session-isolation-browser-v162.mjs: 6/6 transiciones aprobadas sobre la página React real, con cliente Supabase/usuarios simulados y retraso de 900ms en solicitud de identidad A.
- A primero ve cuatro expedientes suyos; B no ve A y sólo ve su expediente; la respuesta de A que termina después de B se ignora.
- Tras logout no hay expedientes ni formulario; el regreso A muestra únicamente sus registros. Captura de pantalla en AUDITORIA_EVIDENCIA_VISUAL_V162/v162-diocese-b-no-cross-scope.png y JSON AUDITORIA_AISLAMIENTO_SESION_V162.json.
- Regresiones de la interfaz aislada V160: 6/6 vistas (móvil, tablet, escritorio para 2 roles), 4/4 interacciones; backlog V161: prueba pendiente antiguo y 2 páginas sin duplicados PASS.

## Vercel preview construido y comprobado
- Proyecto vinculado: sacramentum-final, misma carpeta git del proyecto SACRAMENTUM_FINAL. Despliegue no productivo Ready.
- URL: https://sacramentum-final-9f7ylgecy-jaiderherreras-projects.vercel.app
- Vista previa protegida por Vercel Authentication: Chrome sin credenciales vio Login – Vercel y ningún control institucional. Con vercel curl autorizado la ruta de conciliaciones devolvió HTML SPA con root y assets Vite.
- No se alteró la protección de Vercel ni se hizo despliegue --prod. Claves Supabase requeridas confirmadas por NOMBRE, no se copiaron valores.
- Se añadió .vercelignore para excluir scripts de QA, documentación de auditoría, supabase SQL y .env*, sin alterar la aplicación construida.

## Calidad y controles
- 1107/1107 pruebas sintéticas y 28/28 controles Quality Gate. Vite build y auditorías de dependencias completas/producción correctas, 0 vulnerabilidades informadas.
- No hubo migraciones ni mutaciones de producción en Supabase.
- Inventario RPC 208, authenticated 147, evidencia parcial 37, pendientes 110.
- Plan maestro {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}; 15 controles enriquecidos sin ascender ninguno a aprobación artificial.

## Pendientes (no certificados)
- Vercel preview es accesible a usuarios autorizados de Vercel, pero no se realizó sesión real de aplicación con Diócesis y Cancillería. Los usuarios del ensayo Chrome fueron explícitamente simulados.
- No se pudo certificar competencia de dos transacciones PostgreSQL simultáneas; sin conexión SQL estable independiente disponible. No modificar permisos de base de datos ni activar extensiones para forzar el ensayo.
- Vista previa NO sustituye producción ni representa certificación completa de la aplicación.

**Dictamen:** el aislamiento visual entre sesiones y la vista previa separada fueron comprobados. Queda abierta la certificación física autenticada y de concurrencia.
