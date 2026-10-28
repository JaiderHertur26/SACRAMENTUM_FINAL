# SACRAMENTUM FINAL · V268 · Retiro restaurable de TODOS los datos ficticios

**28 de octubre de 2026 · PR #103 en borrador · desarrollo exclusivamente preparado y ensayado. NUNCA ejecutar este procedimiento en la instancia actual antes de aprobar apertura oficial.**

## Decisión vigente del usuario
Todos los registros sacramentales, las boletas, decretos, importaciones, expedientes, auditorías, impresiones y datos de operación registrados actualmente son **DE PRUEBA**; cuando corresponda pasar a operación oficial, la operación debe comenzar desde CERO. No hay que conciliar físicamente las 22 series ficticias; la V266 se conserva únicamente como una herramienta para eventuales libros *realmente históricos*. No se borrarán todavía los datos: se necesitan para pruebas funcionales.

## Hallazgo de dependencia real en Supabase
- Catálogo observado: **82 tablas públicas**, **168 relaciones FK entre tablas públicas**; 56 tablas de operaciones de prueba, 26 de institucionalidad/configuración cuya legitimidad aún requiere revisión.
- Una de las seis parroquias públicas tiene `legacy_origin_id` enlazado a `legacy_source_origins` (de prueba), y `legacy_source_origins` depende de `legacy_source_installations`. Este enlace está presente en la base real: no basta con TRUNCATE todas las tablas, y mucho menos con TRUNCATE CASCADE porque podría afectar tablas maestras.
- Solución **verificada a nivel de diseño**: se conservan 26 tablas institucionales; antes de limpiar se pone a NULL exclusivamente `public.parishes.legacy_origin_id` donde tenga un origen de prueba. Un único `TRUNCATE ... RESTRICT` incluye **54** tablas transaccionales; después se hace `DELETE` solo de **2** tablas de origen/instalación residual. Las tablas maestras no se truncan ni se eliminan.
- Supabase Storage: 1 bucket y **0 objetos**. El procedimiento falla si aparecen objetos nuevos para revisión independiente; no elimina archivos del almacenamiento. Auth: 4 usuarios y 4 sesiones según consulta del 28/10, fuera del alcance del reinicio (revisar cuentas/roles reales antes de liberar oficialmente).
- La foto exacta V267 es **89.714 filas** en 56 tablas de registros/operación, de las que 39 estaban pobladas. De estas, **8.393** son partidas sacramentales. Es una foto de revisión, no un número fijo que el borrado asuma a ciegas.

## Procedimiento V268 preparado, NO ejecutado
`scripts/build-v268-transactional-purge.mjs` genera `scripts/staged-v268-transactional-test-purge.sql`. Ambos son artefactos de migración de alto riesgo y no están enlazados a un botón web, no fueron enviados a Supabase ni deben ejecutarse a demanda en producción. El SQL:
1. Requiere rol técnico de migración, identificador del respaldo comprobado (**SHA256 de 64 caracteres**), constancia de prueba de restauración y referencia de autorización. **Esas variables son declaraciones del operador y no sustituyen la verificación externa efectiva**.
2. Adquiere bloqueo exclusivo lógico del procedimiento y bloqueo de escritura de las **82 tablas clasificadas**; falla si una tabla nueva aparece, si una FK preservada apunta a otra transaccional sin tratamiento explícito o si Storage tiene objetos.
3. Toma conteos exactos de las 56 tablas y huellas de contenido de las otras 26. Rechaza instancias ya vacías, reejecuciones, cambios imprevistos de estructura y memorias sacramentales privadas ya abiertas.
4. En la misma transacción, desvincula únicamente `parishes.legacy_origin_id` y retira filas de las 56 tablas de prueba. **Nunca usa TRUNCATE CASCADE, DROP de tablas/constraints ni deshabilita triggers**.
5. Repite conteos exactos (56 deben quedar en CERO), compara los 26 conjuntos de datos institucionales con sus huellas originales (ignorando solo el campo de importación desvinculado de parroquias), registra número de referencias desvinculadas y total descartado en un recibo privado `sacramentum_ledger.purge_receipts_v268`. Todo queda bajo una sola transacción; ante error, todo hace rollback.
6. No modifica la estructura de los 82 conjuntos, roles, perfiles, parroquias, diócesis ni su configuración. Tampoco reinicia todavía la numeración de las boletas; **la V267 la reinicia a cero en el corte definitivo**, una vez vaciada toda la base de pruebas.

## Respaldo externo obligatorio
Antes de usar el SQL sobre una instancia autorizada, crear un respaldo integral externo `pg_dump -Fc` o un equivalente soportado, comprobar el SHA256 y **restaurar el respaldo en un entorno aislado**. Comparar conteos, identidad de parroquias, perfiles, configuración y datos ficticios en la restauración. Conservar ese respaldo cifrado, privado y fuera del repositorio Git. El registro de un digest en V268 no es por sí mismo un backup. En caso de emergencia, recurrir al respaldo completo/servicio PITR institucional; no diseñar rollback de un simple DELETE de producción ejecutado y confirmado.

Según la documentación oficial de Supabase, las copias de base de datos no contienen los objetos de Storage (solo sus metadatos). Si Storage dejara de estar vacío, hace falta un procedimiento independiente para preservar sus objetos. Tampoco debe asumirse que una copia física de Supabase se puede descargar como archivo lógico; puede usarse el cliente pg_dump/CLI cuando esté disponible.

## Bloqueo adicional a la activación V267
La V267 ahora exige un recibo privado `purge_receipts_v268` válido y de respaldo restaurado, antes de conceder permisos a los nuevos RPC. Así se impide activar el modo real sin una retirada documentada de las pruebas. Los contadores y apertura manual del primer Libro/Folio/Número siguen en la misma transacción posterior.

## Pruebas y objetivos de aceptación
`scripts/ci-verified-test-purge-v268.sh` monta una base PostgreSQL 16 ficticia con **82 tablas**, simula exactamente los dos enlaces de importación, restaura un backup de verdad en una segunda base y prueba las negativas (sin respaldo, sin constancia de restauración, Storage con archivo, nueva tabla pública, FK de maestro no previsto, reejecución). Solo tras todas esas pruebas ejecuta el vaciado **en PostgreSQL desechable**; comprueba 56 tablas en cero, 26 maestras preservadas, la referencia ficticia desvinculada y el respaldo restaurado todavía íntegro. `scripts/test-verified-reset-v268.mjs` y `scripts/test-fresh-official-start-v267.mjs` validan las garantías y mantienen la CI GitHub.

## Limitaciones que deben permanecer visibles
- Ningún dato de la instancia Supabase actual ha sido borrado ni alterado.
- **26 tablas «preservadas» no equivale a 26 conjuntos de datos institucionales acreditados**. Deben verificarse los directorios, parroquias, usuarios, roles, preferencias, modelos y datos importados que realmente se necesiten para el arranque.
- Es preciso evitar nuevas escrituras entre el backup y el corte; mantener la aplicación antigua en modo mantenimiento hasta la activación de RPC V267/V263.
- Las referencias externas fuera de PostgreSQL (archivos físicos, correos y servicios externos) no quedan limpiadas automáticamente por este SQL. Son inventario separado.
- No crear una segunda versión del proyecto ni mezclar registros ficticios con oficiales.

**Estado V268:** procedimiento y pruebas en rama; no desplegado, no borrado. Apertura oficial todavía pendiente de revisión de maestras, respaldo y autorización final del corte.