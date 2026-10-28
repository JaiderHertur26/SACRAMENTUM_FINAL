# SACRAMENTUM FINAL · V267 · Arranque oficial desde cero tras retirar las pruebas

**28 de octubre de 2026 | PR #103, rama feature/v252-ledger-state-foundation | Preparado y NO ejecutado sobre Supabase.**

## Decisión institucional y corrección del rumbo
El responsable del proyecto confirmó expresamente que **todos los registros existentes son ficticios de prueba** y que **cuando llegue la apertura oficial se dejarán en cero para iniciar los registros reales**. Por ello, **no debe obligarse a conciliar físicamente los 22 ámbitos históricos de prueba** ni migrar sus numeraciones al registro oficial. La V266 sigue siendo una herramienta de diagnóstico y doble control útil para eventuales libros físicos verdaderamente históricos, pero **no constituye un requisito de puesta en marcha** para esta base limpia.

**No se ha borrado ningún registro ni se ha reiniciado ningún contador de la instancia actual.** El usuario indicó que el reset ocurrirá *después*, no ahora.

## Conteo real y alcance de la preparación
La consulta SELECT de Supabase `scripts/read-only-v267-full-reset-inventory.sql` clasifica 82 tablas públicas observadas (captura 28/10/2026):
- 56 tablas de registros, importaciones, expedientes, decretos, boletas, documentos, auditorías, impresiones, chat y artefactos de prueba **obligatoriamente vacías antes del corte**, con **89.714 filas de prueba actualmente presentes** en 39 de ellas. Incluyen **8.393 partidas** de los cuatro sacramentos. No son 89.714 sacramentos: incluyen muchas relaciones y copias de trabajo.
- 26 tablas maestras/propuestas de conservación (parroquias, diócesis, roles, usuarios, identificaciones institucionales, configuración, plantillas, directorios, etc.) sujetas a revisión de legitimidad antes de pasar a operación real. **Conservar estructura no significa asumir que sus datos sean oficiales.**
- Los contadores de boleta `numeroRegistroActual` en `parish_parameters` deben volver a cero en las cuatro ramas sin borrar configuraciones o plantillas. Sus formatos de longitud se conservan.

Archivos: `AUDITORIA_MATRIZ_RESET_V267_2026-10-28.json`, `AUDITORIA_FOTO_COMPLETA_RESET_V267_2026-10-28.json`, `AUDITORIA_INVENTARIO_REINICIO_CERO_V267_2026-10-28.json`, `scripts/read-only-v267-zero-inventory.sql` (24 tablas núcleo), `scripts/read-only-v267-full-reset-inventory.sql` (56 tablas).

## Corte de operación oficial V267 (candidato, no ejecutado)
`scripts/build-v267-zero-cutover.mjs` produce `scripts/staged-v267-fresh-zero-rpc-cutover.sql` desde la matriz explícita de 56 tablas a cero/26 de conservación:
1. Bloquea en transacción todas las tablas transaccionales para impedir que los clientes antiguos escriban durante las verificaciones. Si aparece una tabla pública desconocida se aborta el corte, exigiendo nueva clasificación.
2. Recalcula `COUNT(*)` exacto de las 56; **basta una sola fila de prueba restante (incluidas importaciones, decretos, impresiones o auditoría) para rechazar TODO**.
3. Exige memoria V252–V253 y atestaciones V263 completamente vacías, índices únicos V260 instalados, cuatro procedimientos antiguos, cuatro RPC de asiento V263, consulta V264, atestación V265 y nuevo procedimiento de apertura V267.
4. Restablece a **cero los cuatro contadores de boletas** dentro de `parish_parameters`, conservando longitud, otras preferencias y configuración de la parroquia.
5. Revoca ejecución a los cuatro procedimientos antiguos y permite los cuatro nuevos más la apertura del primer libro en **el mismo COMMIT**. Verifica los permisos antes de confirmar.
6. Deja un recibo privado de inicio de operación con la modalidad `FRESH_FROM_ZERO`. Si falla cualquier requisito, toda la transacción revierte: ni permisos, ni contadores ni recibo cambian.

**No contiene instrucciones DELETE/TRUNCATE de datos reales.** El retiro de los datos ficticios constituye una fase preparatoria distinta, que necesita respaldo verificado, revisión de dependencias FK, confirmación de la matriz y de quién autoriza qué retener. No ejecutar los 56 vaciados individualmente sin haber cerrado esa fase. La modalidad nueva `VITE_SACRAMENTUM_SEAT_V264=enabled` permanece apagada por defecto y solo se desplegará coordinadamente.

## Primer Libro/Folio/Número de cero
`scripts/staged-v267-first-official-book.sql` (sin GRANT hasta el corte) contiene `public.open_first_official_book_v267`:
- Solo una parroquia activa de su ámbito y **una boleta pendiente oficial con evidencia de celebración V263**.
- Solicita datos iniciales de Libro, Folio, Número, partidas por folio y si reinicia la numeración al cambiar de folio. **No deriva valores de `parish_parameters`, de máximos históricos ni de ejemplos de prueba.**
- Verifica que el mismo código de libro no tenga partidas físicas, evita libros vacíos duplicados y escribe memoria V252 con primera posición escrita por el responsable.
- Registra un evento `first_official_book_opened` en la auditoría en la misma transacción; si falla la auditoría se revierte la memoria. Repetir idéntica apertura sin asientos devuelve la misma referencia; cambiar sus coordenadas se rechaza.
- La apertura administrativa no crea una partida por sí sola. El siguiente acto —asiento real— exige volver a confirmar el Libro/Folio/Número con los RPC V263.

`src/components/FirstOfficialBookV267.jsx` está integrado en el panel sacramental V264. Solo aparece ante una boleta nueva verificada y sin libro ordinario disponible. No crea libros supletorios ni atestaciones de decretos históricos por esta vía. `src/services/ledgerSeatV264.js` verifica que el servidor confirme exactamente los valores escritos.

## Calidad y límites
`scripts/test-fresh-official-start-v267.mjs` comprueba inventario/manifest, integridad de transacción, controles de apertura y que no se incluyan borrados en el corte. `scripts/ci-fresh-official-start-v267.sh` crea 82 tablas ficticias en PostgreSQL16, conserva maestras, verifica abortos por una importación residual y una tabla nueva sin clasificar, comprueba corte ACL y contadores a cero, y abre manualmente un primer libro desde Folio 8 / Partida 50 **a modo de ensayo**, rechazando cambio indebido, usuario ajeno y fallos de auditoría. Este ensayo no escribe ningún registro de Supabase.

**Faltan antes de poner en marcha oficialmente:** aprobar qué datos institucionales maestros sí son auténticos; retirar/resguardar los datos de prueba de todas sus dependencias de manera segura; revisar FKs, políticas y restauración real; comprobar qué procesos generaron 89.714 filas para evitar que las recreen; desplegar migraciones de forma íntegra; cortar versiones antiguas de interfaz y revalidar roles y asientos sobre la base ya vacía. No anunciar 100% de puesta en producción hasta lograrlo.

## Resultado
**V267 preparada como apertura oficial desde cero y sometida a CI. No reset, no merge, no despliegue.**
