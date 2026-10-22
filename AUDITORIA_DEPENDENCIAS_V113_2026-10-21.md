# SACRAMENTUM · Evidencia de dependencias V113 (rama aislada)
Fecha local: 2026-10-21. Rama: audit/v113-build-tool-risk.

## Objetivo
No confundir dependencias compiladoras con código que se ejecuta en el navegador. Mantener intacta la representación de las pantallas.

## Cambio ejecutado
- tailwindcss-animate pasó de dependencies a devDependencies, porque sólo se utiliza en tailwind.config.js durante el build.
- package.json y package-lock.json quedaron sincronizados por npm install --save-dev ... --package-lock-only --offline.
- Tailwind CSS 3.4.19 continúa sin cambio mayor; no se instaló una versión inexistente de braces.

## Verificaciones reproducibles
- npm ls --omit=dev tailwindcss tailwindcss-animate braces micromatch chokidar fast-glob --all => (empty).
- scripts/audit-gate-v90.mjs --sin-auditoria-dependencias --protocol=V113: 445/445 sintéticas, 23 verificadores históricos y compilación correcta; 25/25 tareas.
- SHA256 del CSS compilado /dist/assets/index-DVDdktXC.css: 874FBBEE50499B2382CC29D8A2DEDB2AD9F4BF88F11AC452DC701E5DDA9C119C. Igual a la referencia productiva V110.
- npm audit --omit=dev --json --fetch-timeout=15000 --fetch-retries=0: INCERTEZA. El endpoint de auditoría de npm agotó el tiempo de red; evidencia scripts/V113_NPM_AUDIT_PRODUCTION.json.
- Advertencia upstream braces GHSA-vfj7-8cjw-p6xm, paquete 3.0.3, sin versión corregida oficialmente disponible al momento de la revisión: https://github.com/advisories/ghsa-vfj7-8cjw-p6xm

## Dictamen
Cambio local validado para compilación e identidad del CSS. La auditoría de cadena de suministros completa sigue ABIERTA y el control 30.02 permanece FALLIDO. No certifica ausencia de vulnerabilidades y no justifica despliegue automático.

## Siguiente medida
Repetir npm audit contra un endpoint disponible, inventariar uso real de las herramientas durante build/CI, considerar aislamiento del proceso de compilación y establecer política de excepciones temporales justificada y expirable. Probar interfaz completa y seguridad de producción antes de combinar la rama.
