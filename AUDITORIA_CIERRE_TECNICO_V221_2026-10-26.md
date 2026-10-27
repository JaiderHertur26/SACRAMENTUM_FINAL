# SACRAMENTUM FINAL — Cierre técnico V221
**Fecha:** 26 de octubre de 2026. **Proyecto local:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL`.

## Objetivo concluido
Dotar a Cancillería de una **ficha preliminar de cotejo histórico**, imprimible desde la pantalla real de conciliación, sin modificar partidas ni vínculos. Esta funcionalidad reduce la necesidad de transcribir manualmente cada caso histórico y conserva explícitamente la naturaleza de prueba de los registros.

## Desarrollo aplicado
- `src/utils/historicalEvidenceDossier.mjs`: generador HTML A4 independiente de los estilos React. Identifica diócesis, sacramento, procedencia, coordenadas de libro/folio/número, última referencia y clasificación orientativa. No divulga el identificador de la partida candidata ni propone aplicar cambios.
- `src/pages/chancery/HistoricalLinkReviewPage.jsx`: botón **Imprimir ficha de cotejo** por caso, protegido por rol, identidad de sesión y presencia en la página cargada. La ventana emergente no conserva `opener`; si el navegador bloquea la ventana se muestra un error recuperable.
- Escapado HTML de campos no confiables antes de incorporarlos al documento; no hay inserciones ni actualizaciones en Supabase.
- La ficha incluye **DATOS DE PRUEBA - NO OFICIALES**, la leyenda de expediente preliminar y una advertencia de que no equivale a decreto ni partida auténtica.
- `scripts/test-historical-evidence-dossier-v221.mjs`: **13/13** comprobaciones específicas, incluyendo campos maliciosos, omisiones y prohibición de expedientes sin jurisdicción verificable.
- `scripts/audit-historical-evidence-dossier-browser-v221.mjs`: **11/11** pruebas reales de la página React en Chromium, con RPC ficticia aislada y solicitudes externas bloqueadas. Se verifican impresión, bloqueo de popup, cambio de usuario, cambio de diócesis y paginación.
- `.github/workflows/sacramentum-auditoria-v90.yml` y `scripts/audit-gate-v90.mjs`: inclusión automática de las nuevas pruebas en la CI y en la puerta integral.

## Resultados medidos
- **1.921/1.921** pruebas sintéticas integrales.
- **30/30** verificaciones de calidad local, incluida compilación Vite y auditoría de dependencias.
- **13/13** nuevas pruebas documentales.
- **11/11** escenarios Chromium con 0 excepciones JavaScript y 0 solicitudes externas.
- **0** migraciones a base de datos y **0** modificaciones de registros existentes.

**Evidencias:** `AUDITORIA_PUERTA_CALIDAD_V221.json`, `AUDITORIA_FICHAS_COTEJO_BROWSER_V221.json` y `AUDITORIA_AVANCE_GLOBAL_V221.json`.

## Límites y siguientes prioridades
- La clasificación automática solo facilita la investigación documental. **No** vincula los 46 candidatos técnicos de V219 ni resuelve el conflicto de identidad o los 172 casos sin partida.
- Faltan pruebas E2E positivas con sesiones reales de todos los roles, envío efectivo de correos, cotejo e impresión física de todas las plantillas y segregación autorizada de datos ficticios antes de cualquier operación oficial.
- No se realizaron escrituras en Supabase en V221. Todos los datos existentes deben permanecer etiquetados como **de prueba, no oficiales**.

## Avance global estimado
**90 %** (cálculo ponderado: **89,61 %**). Es una estimación de madurez técnica en nueve áreas y **no** una certificación de operación ni garantía de ausencia de defectos.
