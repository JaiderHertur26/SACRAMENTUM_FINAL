# SACRAMENTUM FINAL · Auditoría V212 de importaciones históricas

**Fecha:** 25 de octubre de 2026, Colombia (registros UTC del 26). **Rama:** `audit/v212-imports-forms-resilience`. **Base:** V211 en `main`, `945ab02`.

## Correcciones efectivamente implementadas

1. `LegacyMigrationCenterPage.jsx` vincula inequívocamente archivo, hash SHA-256, perfil de análisis, estructura normalizada, parroquia y lote antes de ejecutar staging o aplicar importaciones.
2. Cambiar el perfil tras analizar un JSON obliga a pulsar **Reanalizar con este perfil**. El botón de staging queda deshabilitado, y el servidor no recibe una mezcla de perfiles normalizados.
3. Un archivo de origen no reconocido conserva sus filas para selección manual del perfil y reanálisis, pero **no hereda** el perfil de un archivo anterior. Los archivos vacíos o JSON inválidos no avanzan.
4. Las lecturas asíncronas de archivos cuentan con secuencia de solicitud: si se seleccionan rápidamente varios, la lectura lenta anterior no puede reemplazar los datos del último archivo elegido.
5. Cuando cambia el rol o la diócesis, la UI invalida la parroquia seleccionada, la lista anterior de parroquias, el historial anterior y el lote listo, antes de mostrar el nuevo ámbito.
6. Seleccionar otra parroquia o perfil invalida el lote listo de la UI. Además, justo antes de materializar, se verifica que el lote pertenezca a la parroquia visible, al ámbito diocesano permitido y al perfil guardado.
7. El servicio `applyLegacyBatch` comunica el estado `stalled` y los remanentes cuando una RPC no consigue procesar más filas. La UI informa una **importación parcial** en lugar de anunciar completitud; protección adicional contra bucles prolongados.
8. Se actualizó el verificador heredado `verify-import-parish-ownership-v5.mjs` para evaluar el guardia actual, no una cadena de código obsoleta. Se conservó la prohibición de importar sin parroquia.

## Resultados comprobables

| Prueba | Resultado |
|---|---|
| Puerta estricta integrada V212 | 30/30 aprobada |
| Batería automática acumulada | **1.680/1.680** aprobadas |
| Casos nuevos de preflight, jurisdicción, lotes y boletas | **35/35** aprobados |
| Navegador Chrome de la página React real, servicios simulados | **11/11** |
| Excepciones JS y solicitudes externas no autorizadas en ese laboratorio | 0 |
| Compilación producción Vite y auditorías npm | Aprobadas |

### Casos específicos en navegador
Ámbito propio de Diócesis; JSON reconocido; cambio de perfil bloquea staging; reanálisis obligatorio; staging correcto; cambio de parroquia invalida lote; archivo desconocido con perfil manual; aviso de proceso incompleto; cambio de jurisdicción; Administrador General puede elegir otra diócesis; selección rápida de dos archivos asíncronos; staging de General ligado a parroquia y diócesis destino.

### Semántica de boletas históricas
Los tests de `INSBAUTI` y `INSCONFI` confirman que `reported=1` y `reported=0` mantienen su valor, integran filas del tipo pendiente y no fabrican una partida celebrada. `ANULACION` permanece bloqueado para ejecución registral directa desde Importación.

## Alcance y seguridad

La auditoría V212 ejecutó el componente React original en Chrome con archivos JSON ficticios, servicios simulados y sin credenciales de Supabase; **no ingresó registros al backend**. No se declara validado todo el formulario de Cancillería ni la recepción de correos reales. Las verificaciones SQL transaccionales de los cuatro sacramentos y decretos están documentadas por separado en V210.

La comprobación frontend es una segunda defensa; la autorización definitiva sigue siendo PostgreSQL RLS y las RPC de Supabase. Los cambios de esta versión no requieren ni ejecutan migraciones de producción.

## Evidencias
- `AUDITORIA_CENTRO_MIGRACION_BROWSER_V212.json`
- `AUDITORIA_PUERTA_CALIDAD_V212.json`
- `scripts/audit-legacy-migration-browser-v212.mjs`
- `scripts/qa-v212-migration/`
- `scripts/test-legacy-migration-preflight-v212.mjs`
- `src/utils/legacyMigrationPreflight.mjs`

**Siguiente fase:** una cuenta QA y un entorno de datos ficticios separados para validar positivamente importación/boletas en el backend mediante navegador y verificación completa de correo de recuperación, siempre sin afectar registros históricos.
