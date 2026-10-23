# SACRAMENTUM · V169 — Aislamiento institucional de respuestas asíncronas

Fecha: 23 de octubre de 2026. Carpeta: C:\SACRAMENTUM\SACRAMENTUM_FINAL.

## Hallazgo
La V168 protegía la respuesta tardía de la conciliación por lotes pero no aplicaba la misma comprobación de identidad a solicitar, autorizar, rechazar y ejecutar un único expediente. Un resultado pendiente podía producir notificaciones de la sesión anterior, o un diálogo de confirmación abierto podía continuar después del cambio de cuenta. Esto afecta la confidencialidad de la interfaz y la integridad del contexto visible, sin demostrar por sí solo un bypass de permisos SQL.

## Corrección
- La clave institucional (usuario, rol, diócesis y Cancillería) se captura ANTES de cada espera de confirmación.
- Cada manejo de éxito, error y limpieza comprueba que la clave institucional siga siendo actual.
- Si la cuenta cambia antes de confirmar, no se despacha la llamada RPC.
- Si la cuenta cambia mientras una RPC ya está en vuelo, se ignoran sus mensajes, formularios y recargas tardías. La operación enviada previamente puede terminar en el servidor; el control de permisos permanece en RLS y RPC.
- No se modificó ninguna migración, expediente, nota marginal ni cuenta de Supabase.

## Evidencia ejecutada
- Script: `scripts/test-reconciliation-session-guards-v169.mjs` ejecuta los cinco handlers reales extraídos de la fuente JSX con dependencias de red simuladas.
- 20 casos V169: éxito y error tardíos, cambio durante confirmación (cuatro operaciones), éxito legítimo con identidad estable y verificación del contrato.
- Total integrado: **1237/1237** sintéticas; **28/28** verificaciones del gate estricto V169. Build y auditoría de dependencias completos incluidos.
- Se actualizan seis referencias del plan maestro, sin convertir ninguna revisión parcial en APROBADO: {"APROBADO":10,"EN_PROGRESO":117,"PENDIENTE":198}.

## Límites explícitos
- Pruebas Node instrumentadas: NO son navegador Chrome, no usan usuarios autenticados reales de dos diócesis y no certifican simultaneidad física PostgreSQL.
- GitHub issue #1 (E2E auténtica), #2 (transacciones concurrentes) y revisión documental/canónica continúan abiertos.
- El cambio no cancela promesas que ya llegaron al servidor; las invariantes institucionales del backend siguen siendo obligatorias.

**Dictamen V169:** regresión de aislamiento visual mitigada en cinco acciones; quality gate local aprobado; alcance de certificación limitado a estos handlers. Publicación externa requiere confirmación posterior de CI/Vercel.
