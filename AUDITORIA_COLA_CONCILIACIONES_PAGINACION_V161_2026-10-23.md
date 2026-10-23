# SACRAMENTUM — V161 · EXPEDIENTES ANTIGUOS OCULTOS Y PAGINACIÓN INSTITUCIONAL

## Defecto reproducido sobre Supabase
- list_later_note_reconciliations_v157 devolvía sólo 300 expedientes ordenados por creación descendente, sin filtro ni paginación. Al crear 315 rejected ficticios posteriores a un pending anterior, éste existía pero desaparecía del listado.
- Reproducción real en scripts/qa-rollback-backlog-starvation-baseline-v161.sql con SET LOCAL ROLE authenticated, 315 casos y un expediente pendiente creado sobre decreto y nota ficticios. Todos los registros terminan en ROLLBACK.

## Reparación aplicada y verificada
- Migración confirmada en Supabase: 20261023052453_reconciliation_keyset_pagination_v161.sql.
- list_later_note_reconciliations_v161: filtros allowlist all/pending/authorized/executed/rejected, tamaño de página 1–100 y paginación keyset por (requested_at,id) descendente para evitar duplicados u omisiones por cambios posteriores.
- count_later_note_reconciliations_v161: contadores reales de toda la diócesis sin límite de página.
- Ambos RPC SECURITY DEFINER mantienen control de alcance con auth.uid/current_app_role/current_app_diocese_id. Sólo concede EXECUTE a authenticated, revocado para anon. Índices para listado global y por estado.
- Interfaz Cancillería/Diócesis incorpora cinco filtros, contadores globales, páginas de 50, botón de continuar y descarte de resultados asíncronos obsoletos. Servicio invoca las nuevas RPC, sin actualizar tablas directamente.

## Pruebas postdespliegue
- scripts/qa-rollback-reconciliation-keyset-v161.sql pasó sobre las funciones reales: pendiente antiguo recuperado, contadores correctos, primera y segunda páginas de 50 rechazados sin solapamiento, cinco denegaciones por filtro/límite/cursor/jurisdicción/identidad.
- Chrome Headless aislado: 320 expedientes ficticios, primer listado 50, filtro Pendientes revela 2 incluida solicitud anterior; Rechazados despliega 50 y Cargar anteriores agrega otros 50 distintos (100 sin duplicados), sin scroll horizontal ni errores JS.
- AUDITORIA_PAGINACION_VISUAL_V161.json, AUDITORIA_EVIDENCIA_VISUAL_V161/v161-pending-ancient-visible.png.
- Regresiones del componente V160: 6/6 vistas y 4/4 clicks tras actualizar test heredado que asumía posiciones fijas. Evidencia histórica V160 se preservó en Git.

## Calidad y alcance
- 1093/1093 pruebas sintéticas, 28/28 controles, compilación y npm audit producción+total sin hallazgos.
- Catálogo SECURITY DEFINER 208 (199 public, 9 private), 147 ejecutables authenticated; 37 con QA parcial; 110 pendientes.
- Plan maestro {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}; 17 controles ampliados sin promocionar ninguna aprobación global.

## Pendientes no certificados
- No hubo navegación autenticada real con cuentas de Cancillería y Diócesis. El navegador de QA empleó mocks locales sin comunicación Supabase.
- No se logró certificar simultaneidad de dos transacciones en PostgreSQL mediante FOR SHARE/FOR UPDATE. Son necesarias conexiones estables independientes para probar carreras.
- El frontend corregido está compilado localmente pero NO se desplegó.

**Dictamen:** falla de visibilidad operativa reproducida y corregida, con pruebas SQL reales reversibles y navegador Chrome aislado. Certificación general abierta.
