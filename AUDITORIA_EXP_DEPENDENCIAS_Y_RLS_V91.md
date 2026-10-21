# SACRAMENTUM · Ensayos adversariales y de dependencias V91

Fecha: 21 de octubre de 2026. Aplicación real V89; auditoría V90 y ensayos de desarrollo V91.

## Regla: dos laboratorios aislados, ninguna emisión sacramental real

- Tailwind 3, parche conservador: `C:\SACRAMENTUM\AUDITORIA_V91_WORKTREE` (rama audit/v91-dependency-trial).
- Tailwind 4, migración de prueba: `C:\SACRAMENTUM\AUDITORIA_V91_TAILWIND4` (rama audit/v91-tailwind4-trial).
- Capturas públicas locales sin inicio de sesión: `C:\SACRAMENTUM\AUDITORIA_EVIDENCIAS_V91`.
- El único archivo de configuración copiado a esos laboratorios contiene **dos variables VITE públicas** (URL de API y clave publicable); **NO** contiene VERCEL_OIDC_TOKEN ni credenciales privadas.
- Ningún ensayo visual efectuó un login real ni creó partidas.

## Vulnerabilidades de paquetes (npm audit --omit=dev)

| Variante | Altas | Moderadas | Críticas | Evidencia |
|---|---:|---:|---:|---|
| Línea original V90 | 6 | 2 | 0 | scripts/AUDITORIA_DEPENDENCIAS_V90.json |
| V3, npm audit fix conservador | 5 | 2 | 0 | Salida aislada npm audit |
| V3 + postcss-selector-parser 7.1.7 vía npm overrides | 5 | 0 | 0 | npm audit aislado |
| Tailwind 4.3.3 y plugin PostCSS v4 | 0 | 0 | 0 | npm audit aislado |

El problema residual en Tailwind 3 tiene un origen compartido: `braces` (GHSA-vfj7-8cjw-p6xm), utilizado por `micromatch`, `fast-glob` y `chokidar`. La clasificación de cinco paquetes vulnerables no significa cinco exposiciones independientes de la aplicación. La actualización a Tailwind 4 es mayor y no puede aprobarse automáticamente sin compatibilidad visual y funcional.

**Remediación conservadora:** `source-map-js` 1.2.2, `postcss-selector-parser` 7.1.7 mediante override explícito. El paquete Tailwind sigue en 3.4.19. El CSS V3 conserva exactamente los **111.368 bytes** y el mismo nombre de asset `index-S3QUKhxO.css` frente a la compilación original. Las 206 pruebas sintéticas pasaron en el laboratorio.

**Remediación mayor experimental:** Tailwind 4.3.3 + `@tailwindcss/postcss`; build OK, npm audit sin avisos, pero CSS creció a **150.362 bytes** y cambió a `index-Dqwaff-d.css`. Revisión por selectores: V3 emite 1.533 clases; V4, 1.555; se ausentan `bg-opacity-10`, `size-3`, `size-3.5`, usadas realmente en paneles administrativos o componentes. Por tanto **NO** se considera lista para producción.

## Ensayo visual público real con Chrome DevTools Protocol

Herramienta reproducible: `scripts/audit-browser-visual-v91.mjs`. Se comprueba `innerWidth` real, ancho total del documento y dimensiones de formulario, botones y encabezados; las capturas PNG se guardan fuera del repositorio y se documentan con SHA-256 en `AUDITORIA_VISUAL_PUBLICA_V91.json`.

Comparaciones efectuadas con navegador sin credenciales de usuario:

| Dimensión | Tailwind 3 | Tailwind 4 |
|---|---|---|
| Móvil 390 × 844 | PASS, ancho interno 390, no overflow | PASS, ancho interno 390, no overflow |
| Tableta 768 × 1024 | PASS, ancho interno 768, no overflow | PASS, ancho interno 768, no overflow |
| Escritorio 1365 × 900 | PASS, ancho interno 1365, no overflow | PASS, ancho interno 1365, no overflow |

**6/6 comprobaciones públicas pasaron**, pero la distribución vertical y los textos presentan variaciones menores. NO demuestra diseño perfecto ni páginas internas. Se descartaron las primeras capturas con `--window-size` como prueba móvil porque Chrome recortaba a 390 píxeles un viewport CSS más grande: la emulación CDP corrigió el error metodológico.

## Prueba SQL adversarial de jurisdicción ficticia

En transacción de prueba PostgreSQL se creó una Diócesis, Vicaría, Decanato, Parroquia **operativa** y Bautismo completamente ficticios, todos ligados entre sí y con datos de prueba inequívocos. El trigger `enforce_parish_hierarchy` rechazó el primer intento de crear parroquia sin vicaría/decanato, como debía, y la prueba se ajustó a los requisitos estructurales.

Con el rol SQL `authenticated` y el sujeto de cada uno de cuatro perfiles institucionales reales, se examinó la visibilidad de la partida ficticia **ajena a la diócesis real**:

- Admin General: 0 registros ajenos visibles.
- Diócesis: 0.
- Cancillería: 0.
- Parroquia: 0.

El usuario Administrador General no precisa acceso directo a partidas sacramentales ajenas para sus funciones de gobierno; el primer supuesto de visibilidad global fue corregido en el caso de prueba. Tras `ROLLBACK` se comprobó que no quedaba la diócesis ficticia.

**Limitación:** se ha probado denegación de lectura de Bautismos de segunda diócesis ficticia, no sus flujos completos ni usuarios ficticios reales con credenciales. Todos esos recorridos continúan pendientes.

## Segundo barrido SQL: las 129 RPC privilegiadas

El inventario íntegro, por firma exacta, está guardado en `AUDITORIA_INVENTARIO_RPC_V91.json`. Los conteos de la inspección **estática**, que no son pruebas de autorización, son:

- 129 funciones con SECURITY DEFINER disponibles para `authenticated`; 0 ejecutables por `anon`.
- 112 contienen una referencia directa a `auth.uid()`.
- 65 contienen algún patrón de control delegado de ámbito o rol (se superponen con las anteriores).
- 92 incluyen operaciones de modificación según un cribado léxico aproximado.
- 0 incluyen SQL dinámico mediante `EXECUTE` según el mismo cribado.
- Una función de modificación no contiene en su propio texto un patrón básico de identidad/scope: `register_historical_baptism(uuid,jsonb)`. **No es una vulnerabilidad demostrada**: se revisó y delega la autorización a `register_historical_baptism_internal`, que comprueba que el perfil parroquial autenticado pertenezca a la parroquia destinataria.

La auditoría no dará por aprobadas las 129 únicamente por estos resultados. Se requiere probar llamadas autorizadas, denegadas, parámetros inválidos y separación territorial una por una; muchas de estas RPC ejecutan acciones jurídicas y son de riesgo elevado si se invocan fuera de su circuito.

## Decisión de ingeniería y próximos controles

1. No promocionar automáticamente Tailwind 4 hasta completar pantallas autenticadas, utilidades faltantes, impresiones y regresión visual sin variaciones inaceptables.
2. Aprobar primero parches V3 compatibles solo después de `npm ci` limpio, compilación, pruebas y comprobación de CSS.
3. Mantener el CI de seguridad en FAIL cuando queden avisos; no manipular umbrales para fingir éxito.
4. Ensayar permisos jurisdiccionales positivos y negativos en las cuatro áreas sacramentales dentro de un sandbox, con documentación de origen ficticio.
5. Continuar uno por uno los 325 controles del protocolo.
