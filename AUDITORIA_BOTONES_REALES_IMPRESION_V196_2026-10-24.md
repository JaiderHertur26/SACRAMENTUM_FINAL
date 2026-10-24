# SACRAMENTUM FINAL — Auditoría V196: botones reales de impresión (entorno aislado)

**Fecha:** 24 de octubre de 2026. **Repositorio:** C:\\SACRAMENTUM\\SACRAMENTUM_FINAL.

## Sesión institucional y límite ineludible

Se comprobó sin revelar credenciales que la sesión histórica disponible en el almacén local de Firefox (usada en auditorías previas) **ya no autentica contra Supabase Auth**. La petición de validación del usuario devolvió **HTTP 403**. No se inició sesión con una cuenta parroquial auténtica ni se obtuvo acceso a sus registros.

Por eso la auditoría **NO afirma E2E real autenticado**: los controles 08.05, 09.05, 10.06 y 11.10 continúan EN_PROGRESO. Ninguna prueba aquí habilitó privilegios ficticios en Supabase ni tocó el backend productivo.

## Enfoque

Se montaron los componentes React reales en Chrome headless con control CDP y datos 100% ficticios. Se sustituyeron **solamente los servicios externos** por adaptadores temporales de prueba, que registran llamadas y pueden simular la denegación de `registerRegistryPrint`:

- `ViewBaptismPartidaModal.jsx` y su botón **Imprimir Partida Oficial**.
- `ViewConfirmationPartidaModal.jsx` y su botón **Imprimir Acta**.
- `ViewMarriagePartidaModal.jsx` y su botón **Imprimir Partida**.
- `FuneralPartidasPage.jsx`: carga ficticia de la tabla, botón **Ver** y finalmente **Imprimir Partida**.

### Resultados de las cuatro acciones de usuario

Prueba reproducible: `scripts/audit-print-buttons-browser-v196.mjs`, con servidor Vite aislado definido en `scripts/qa-v196-print-buttons/vite.config.mjs`.

**4/4 flujos aprobaron tanto el rechazo como el camino positivo.**

En el camino denegado: llamada al servicio de auditoría = 1 por sacramento; error simulado; se muestra toast y no se invoca `print()`. Exequias cierra su ventana preliminar al denegarse la autorización.

En el camino permitido: la segunda llamada al servicio registra `sacramentType`, coordenadas `book=31, folio=442, number=888`, fecha de versión y HTML congelado. Bautismo, Confirmación y Matrimonio invocaron **exactamente una vez** `iframe.contentWindow.print()`, interceptado por el navegador de pruebas sin abrir diálogo del sistema. Exequias creó la ventana de impresión simulada y escribió **más de 11 mil caracteres de HTML** correcto, pero **no se ejecutó físicamente** el script de impresión de la ventana de Exequias en el entorno aislado.

En ningún documento se filtraron valores falsos de importación histórica `9999/9998/9997`.

El archivo `AUDITORIA_BOTONES_IMPRESION_V196.json` conserva los indicadores de rechazo, aceptación y metadatos por sacramento.

## Regresión y alcance

Las nuevas cuatro pruebas contractuales de `scripts/test-print-buttons-browser-v196.mjs` se integraron en `scripts/audit-gate-v90.mjs`. Todos los actores y registros existen únicamente en memoria local.

**No corresponde aprobar todavía** la impresión física, la sesión auténtica, la validación JWT externa, los errores reales de conexión o la constancia registrada en Supabase desde esta interfaz. No se deben usar los mocks para acreditar permisos o titularidad diocesana.

El corte formal se mantiene en **26/325 APROBADO (8,0 %)**. Esta ejecución agrega evidencia a los controles de impresión en progreso y comprueba el comportamiento de los botones sin aumentar incorrectamente el porcentaje de certificación.
