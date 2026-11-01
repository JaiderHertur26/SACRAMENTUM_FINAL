# SACRAMENTUM V323 · Datos Auxiliares por diócesis
Fecha: 1 de noviembre de 2026 (Colombia).

## Cambio
Diócesis, Iglesias, Obispos / Ministros, Obispos Titulares y Ciudades se consultan y administran por diócesis. Párrocos y Mis Datos conservan su alcance parroquial.

La aplicación resuelve la jurisdicción desde la parroquia registrada y la base vuelve a comprobarla con RLS. Las cinco tablas reciben diocese_id, manteniendo sus UUID, contenido y parroquia de procedencia. El ámbito y la procedencia no pueden reasignarse desde un formulario. Se conserva el catálogo común si se elimina su parroquia de origen.

La carga usa páginas de 500 filas; se ensayaron 1.501 iglesias sin recorte. Al abrir o volver a una pantalla se actualizan los datos; las pantallas activas también refrescan cada minuto. Los formularios sacramentales y el autocompletado de Mis Datos usan el mismo catálogo.

Los materializadores de importación se ajustan al ámbito diocesano. Una segunda importación no genera copias por parroquia. Los períodos episcopales bloquean solapamientos por diócesis y el resolver de obispo valida la jurisdicción.

## Validación realizada
- Compilación de producción aprobada.
- Siete pruebas de comportamiento del servicio aprobadas: 1.501 filas, dos parroquias, otra diócesis, procedencia, importación y exclusión de apartados privados.
- PostgreSQL 18.6 en WASM aislado: 54 controles aprobados con tres identidades ficticias y dos diócesis, ROLLBACK completo.
- Ocho materializaciones SQL aisladas: cuatro catálogos cargados desde dos parroquias; cuatro filas únicas, procedencia preservada.
- Navegador Chrome aislado: 21/21 escenarios de creación de boletas, cero excepciones y cero solicitudes externas. Es simulación de servicios, no sesiones institucionales reales.
- Puerta general local: 30/30 controles. Pasan las pruebas sintéticas, verificadores históricos, compilación, frontera de secretos, CSS y auditoría de dependencias de producción.

La cadena de herramientas se actualizó a ESLint 9.39.5 y al motor oficial minimatch 11.0.1 con un adaptador de interfaz CommonJS/ESM. Cinco pruebas adicionales verifican el motor real, su integridad y la configuración de lint. Las auditorías estándar de dependencias completas y de producción arrojan cero vulnerabilidades. No se añadieron exclusiones ni se rebajó el umbral de seguridad.
Referencia: https://github.com/advisories/GHSA-g3hv-75wg-m249

## Estado de activación
**APLICADO Y VERIFICADO EN SUPABASE.** La migración se confirmó mediante el conector y quedó aplicada. Los 54 controles se repitieron en la base enlazada: dos parroquias comparten los cinco catálogos, otra diócesis queda aislada y Párrocos/Mis Datos conservan su privacidad. El ensayo terminó con ROLLBACK y no dejó diócesis ni parroquias temporales.

Se compararon cantidades y huellas completas del contenido anterior en las siete tablas: sin cambios en registros existentes. Quedaron asociados a su diócesis los 103 registros de Diócesis, 1.138 Iglesias y 1.500 Ciudades. Los avisos de seguridad de Advisors coinciden con la línea base; no hay errores nuevos ni advertencias de rendimiento. Los índices nuevos aparecen como información de uso pendiente.

El ensayo reproduce la restricción de la migración V25 del resolver episcopal interno: no se amplían sus permisos a usuarios anónimos o autenticados. La comprobación de su autorización jurisdiccional se realiza como servidor con la identidad de ensayo; el CRUD compartido se prueba con el rol authenticated.

El SQL fue creado con Supabase CLI y se conserva en:
`supabase/deployment/20261101190320_shared_diocesan_auxiliary_catalogs_v323.sql`.
Se sigue el esquema de despliegues V314–V321; el inventario histórico de 166 migraciones y sus hashes permanece intacto. Esta entrega no certifica apertura de libros oficiales.

Integración y despliegue: [PR #142](https://github.com/JaiderHertur26/SACRAMENTUM_FINAL/pull/142). La integración exige que los controles automáticos de la revisión estén aprobados.

## Evidencias
- AUDITORIA_SQL_AUXILIARES_V323_SUPABASE.json
- AUDITORIA_SQL_AUXILIARES_V323_AISLADA.json
- AUDITORIA_CREACION_BOLETAS_NAVEGADOR_V323.json
- AUDITORIA_V323_REVISION_AUXILIARES.json
- AUDITORIA_PUERTA_CALIDAD_V323.json
- AUDITORIA_V323_HUELLAS_PREVIAS.json
- AUDITORIA_V323_SEGURIDAD_DEPENDENCIAS.json

Las pruebas nuevas de PostgreSQL nativo se añadieron a GitHub Actions mediante un servicio postgres:16 aislado. Su ejecución remota queda registrada por CI; los resultados WASM anteriores no se presentan como resultados de Supabase.