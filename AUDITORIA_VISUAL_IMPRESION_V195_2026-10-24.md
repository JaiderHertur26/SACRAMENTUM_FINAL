# SACRAMENTUM FINAL · V195 — Auditoría visual real de las partidas

**Fecha:** 24 de octubre de 2026. **Ruta de trabajo:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL`.
**Capturas verificables en el equipo:** `C:\SACRAMENTUM\AUDITORIA_EVIDENCIAS_IMPRESION_V195`.

## Método honesto
Se ejecutó Chrome real en modo headless controlado mediante CDP contra Vite local. Se renderizaron los **componentes React reales**:
- `BaptismPrintTemplate.jsx`
- `ConfirmationPrintTemplate.jsx`
- `MatrimonioPrintTemplate.jsx`
- `buildFuneralPartidaHtml`, HTML real de Exequias.

Las fichas, parroquia, titulares, coordenadas y usuarios se generaron exclusivamente como datos **ficticios en memoria**, en una aplicación de pruebas local totalmente separada del inicio de sesión y de Supabase.

**ESTO NO ES UNA SESIÓN REAL AUTENTICADA DE PARROQUIA**, ni prueba funcional del clic Imprimir de cada modal conectado a datos privados, ni comprobación física del dispositivo de impresión.

## Primera batería — Documentos canónicos
`node scripts/audit-print-visual-browser-v195.mjs`, local Vite puerto 4845, validó:
- **8 de 8** capturas: Bautismo, Confirmación, Matrimonio y Exequias, en visualización carta (1090 × 1290) y emulación móvil (390 × 844).
- Ninguna excepción JS durante los ocho renderizados.
- Títulos, cabeceras institucionales, referencias `libro=31 / folio=442 / número=888` comprobados directamente en el DOM resultante, incluidos datos de identidad ficticia.
- Se añadió `raw_data` falso con referencias `9999/9998/9997` e identidad histórica contradictoria. Esos datos **no aparecieron** en ninguna salida canónica.
- Cuatro capturas carta inspeccionadas visualmente: diseño institucional unificado, referencias completas, sin texto antiguo falsamente prioritario.
- Las imágenes están guardadas en `C:\SACRAMENTUM\AUDITORIA_EVIDENCIAS_IMPRESION_V195\v195-<sacramento>-<letter|mobile>.png`. Sus huellas SHA-256 y medidas constan en `AUDITORIA_VISUAL_PARTIDAS_V195.json`.

## Segunda batería — Escape HTML y contenido hostil
`node scripts/audit-print-visual-browser-v195.mjs --xss`:
- **8 de 8** pruebas positivas de protección frente a inyección.
- Se insertaron fragmentos deliberadamente maliciosos en campos de **nombre, parroquia, notas marginales y familia**, tanto en componentes React como en HTML de Exequias.
- Ninguna plantilla creó `img[onerror]` o `svg[onload]`; **0 ejecuciones de código** y 0 excepciones en los ocho casos.
- La salida mostró contenido hostil **como texto literal escapado**, y los identificadores oficiales siguieron siendo 31/442/888.
- Capturas `v195-xss-<sacramento>-<letter|mobile>.png`; indicadores y hashes en `AUDITORIA_XSS_PARTIDAS_V195.json`.

## Verificaciones y cierre por alcance
`scripts/test-print-visual-v195.mjs` añade cuatro pruebas de contrato para el fixture real, los 16 escenarios de Chrome, la matriz de identidades y la separación de secretos.
Puerta integral V195: **1.493/1.493** pruebas automatizadas Node y **30/30** verificaciones; build, dependencias y comprobaciones heredadas aprobadas.

**22.05 — Títulos y tipografías: APROBADO** para las cuatro plantillas oficiales de partida inspeccionadas visualmente en Chrome, con capturas SHA-256.
**22.09 — Escapar HTML: APROBADO** en las cuatro plantillas oficiales con entradas hostiles en múltiples campos, DOM examinado sin nodos ejecutables ni ejecución de payload.

Los cuatro controles de impresión `08.05`, `09.05`, `10.06`, `11.10` **siguen EN_PROGRESO**. Falta autenticación real en el navegador, diálogo de impresión, correspondencia de cada campo con un expediente remoto y páginas A4/impresora física. El tamaño de hoja carta es fijo por diseño: no se certifica adaptación del papel al ancho de un teléfono.

**Situación al cierre:** 26/325 APROBADO ≈ **8,0 %**; la certificación integral continúa pendiente.

## Seguridad de datos
No se modificaron tablas, permisos, decretos, perfiles ni partidas en Supabase. El harness no recoge claves ni cookies de Chrome: usa un perfil efímero recién creado que se elimina. Sus capturas de prueba no contienen personas o expedientes reales.
