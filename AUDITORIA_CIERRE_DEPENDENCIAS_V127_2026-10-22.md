# SACRAMENTUM — AUDITORÍA DE DEPENDENCIAS V127 · CIERRE DEL CONTROL 30.02

Fecha: 22 octubre de 2026. Rama de trabajo: audit/v127-dependency-remediation.

## Vulnerabilidad confirmada y solución
- Antes: scripts/V127_NPM_AUDIT_ALL.json mostraba cinco HIGH en la cadena Tailwind CSS 3, braces, micromatch, chokidar y fast-glob.
- Producción ya carecía de alertas tras mover tailwindcss-animate al grupo dev, pero la auditoría completa seguía fallando.
- V127 migra Tailwind CSS 3.4.19 a 4.3.3 y agrega @tailwindcss/postcss 4.3.3; CSS importa tailwindcss y conserva config JS explícita.
- Administrador General y Diócesis cambian bg-opacity-10 (obsoleto) por fondos con opacidad /10 comprobada.
- postcss-selector-parser se declara 7.1.7 exacta para ser compatible con overrides y npm ci; pixelmatch y pngjs permiten comparación visual.

## Comprobaciones posteriores reproducibles
- Auditoría npm ALL posterior: 0 hallazgos, scripts/V127_NPM_AUDIT_ALL_AFTER.json.
- npm ci real en carpeta limpia independiente C:/SACRAMENTUM/QA_V127_INSTALL: 446 paquetes instalados, exit 0; npm audit clean install posterior: 0 hallazgos.
- npm audit --omit=dev: 0 hallazgos de producción, gate estricto V127.
- AUDITORIA_PUERTA_CALIDAD_V127.json: 28/28 verificaciones, 581/581 pruebas sintéticas, compilación y prueba de clases CSS aprobadas.
- CSS de producción: 1573 clases encontradas; compatibles opacidades /10 y tamaños 3/3.5. GitHub Actions exige ambas auditorías completas.
- Evidencia visual: dos comparaciones de siete capturas públicas en AUDITORIA_COMPARACION_VISUAL_TAILWIND_V127.json y AUDITORIA_COMPARACION_VISUAL_TAILWIND_V127_REPEAT.json. Capturas locales conservadas.

## Bloqueos y limitaciones que no se ocultan
- El npm ci del directorio principal no pudo limpiar un supabase.exe retenido por múltiples procesos locales; no se mataron procesos ajenos. npm install restauró paquetes, build y gate estrictos pasaron.
- El npm ci definitivo se validó en una carpeta aislada sin esos bloqueos, con cero vulnerabilidades.
- Las capturas públicas tienen diferencias de píxeles; la auditoría visual autenticada de toda la aplicación queda pendiente, al igual que impresión y jerarquía de pantallas.
- GitHub Actions fue actualizado localmente pero todavía no ejecutado desde la nueva rama; no hay despliegue.
- Otras obligaciones de seguridad, integridad registral y 126 RPC privilegiadas aún requieren evaluación.

## Plan maestro
- Se cierra únicamente control 30.02 (npm audit), de FALLIDO a APROBADO.
- Estado de 325 controles: {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}.
- Control 30.02 aprobado porque el árbol runtime y el de desarrollo tienen cero avisos reales verificados y el lockfile es reproducible.

Dictamen: cierre demostrado del único control de dependencias fallido. No certifica el conjunto de SACRAMENTUM.
