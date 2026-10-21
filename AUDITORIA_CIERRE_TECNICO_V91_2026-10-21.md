# SACRAMENTUM V91 · Acta técnica de controles ejecutados

Fecha: 21 de octubre de 2026. El protocolo maestro V90 mantiene 325 controles individuales y no se declara completado.

## Compilación de producción y código sincronizado

- Parche de producción: commit `6264333` — dependencias con mitigaciones conservadoras, inventario RPC y ensayos visuales CDP.
- Corrección exclusiva del orden de ejecución de CI: commit `2fabed0` — el verificador CSS corre después de construir `dist`; sin modificación del runtime web.
- Publicación Vercel: `https://sacramentum-final.vercel.app`, Ready; despliegue `https://sacramentum-final-dfx3y414a-jaiderherreras-projects.vercel.app`.
- Se comprobó HTTP 200 en `/`, `/chancery/decretos/archivo`, `/diocese/decretos/archivo`, `/parroquia/decretos/archivo`. Respuesta de SPA NO valida permisos del contenido autenticado.
- CSS descargado **desde producción**: `/assets/index-S3QUKhxO.css`, **111.368 bytes**.
- SHA256 de CSS de producción: `F60940EBBA847BCE141ED90BDA0388CB8182D24228907B59BBC0088C9BA0A68A`.
- SHA256 de CSS original y del laboratorio V91 es idéntico a esa suma; se comprobó mediante `Get-FileHash`.

## GitHub Actions real

Última ejecución validada: https://github.com/JaiderHertur26/SACRAMENTUM_FINAL/actions/runs/39643131067

- **pruebas-funcionales: SUCCESS**, incluye npm ci, pruebas sintéticas V89, verificadores históricos aptos para CI, build Vite y prueba de utilidades CSS usada por paneles.
- **seguridad-dependencias: FAILURE**, causado por `npm audit --omit=dev --audit-level=moderate`: 5 avisos HIGH no remediados en la cadena de Tailwind 3.
- Un intento anterior (commit `6264333`) falló porque el verificador CSS se ejecutaba antes de compilar: hallazgo corregido con commit `2fabed0`, CI reejecutada y función aprobada.
- No se modificó el umbral de vulnerabilidades para producir una aprobación artificial.

## Cobertura V91 adicional

- Laboratorio Tailwind 3: `npm ci` limpio, `npm run build` OK, 206 pruebas sintéticas, CSS idéntico a producción anterior.
- Laboratorio Tailwind 4: npm audit con cero avisos y build OK, pero no aprobada su adopción por diferencias de CSS, tres selectores perdidos y falta de recorrido visual de pantallas internas.
- Chrome DevTools Protocol: **6/6 mediciones de la pantalla pública** para 390, 768 y 1365 px; sin desbordamiento horizontal. Capturas y huellas: `AUDITORIA_VISUAL_PUBLICA_V91.json`, archivos PNG en `C:\SACRAMENTUM\AUDITORIA_EVIDENCIAS_V91`.
- RLS adversarial de segunda diócesis ficticia, con vicaría, decanato, parroquia y Bautismo: todos los roles fuera de esa jurisdicción observaron **0 registros**; se confirmó `ROLLBACK` y cero residuos.
- Inventario estático de las 129 RPC privilegiadas: `AUDITORIA_INVENTARIO_RPC_V91.json`. No hay certificación individual de sus 129 autorizaciones todavía.

## Bloqueos honestamente pendientes

- Cinco avisos HIGH en dependencias Tailwind 3, aún sin mitigación total compatible con todos los paneles. El gate general continúa en FAIL.
- Los formularios internos autenticados y las impresiones no se compararon en Tailwind 4; esa migración debe permanecer fuera de producción.
- Faltan E2E con datos ficticios en un sandbox persistente separado de producción, simulación de dos diócesis completas, escenarios de concurrencia, restauración de respaldo y firma documental.
- Permanecen las cinco filas ANULACION reales pendientes y la parametrización de consecutivo supletorio ocupado; no fueron alteradas.
- La aprobación parcial de puntos de compilación, inventario o acceso público no acredita la totalidad de SACRAMENTUM.

## Reproducción local

```powershell
cd C:\SACRAMENTUM\SACRAMENTUM_FINAL
node scripts/audit-master-plan-v90.mjs
node --test scripts/test-sistema-integral-v89.mjs scripts/test-chancery-decrees-v88.mjs scripts/test-supplementary-preflight-v89.mjs
npm run build
node scripts/check-critical-css-v91.mjs
node scripts/audit-gate-v90.mjs --protocol=V91 --output=AUDITORIA_PUERTA_CALIDAD_V91.json
```

El comando del gate debe terminar con código 1 mientras se mantengan las vulnerabilidades catalogadas. Ello no es motivo para desactivar el gate ni declarar aptitud total.
