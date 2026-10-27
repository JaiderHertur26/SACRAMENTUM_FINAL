# SACRAMENTUM FINAL V245 — Cierre de las rutas históricas de enumeración de lotes

**27 de octubre de 2026.** Proyecto Supabase **QA**, referencia `foczofcmwampjvlfbsqn`. Todos los datos y usuarios son ficticios. No está habilitada la operación sacramental oficial.

## Riesgo confirmado antes de aplicar V245
La V244 había corregido `apply_legacy_import_batch_v2` y `apply_legacy_import_batch_v3`. Una búsqueda posterior del código y las funciones realmente instaladas descubrió dos rutas originales todavía expuestas: `apply_legacy_import_batch` y `reconcile_legacy_anulacion_batch`. Las dos hacen `SELECT ... FOR UPDATE` sobre `legacy_import_batches` y comprueban el tipo de importación antes de verificar el ámbito del solicitante.

**Prueba real reproducida, no inferida:** una cuenta ficticia parroquial perteneciente a otra diócesis consultó un UUID existente del tipo protegido `ANULACION` y recibió la excepción específica reservada a ese tipo, mientras el UUID inexistente respondía `Lote no encontrado`. Se reprodujo en las **dos funciones**. Por tanto, existía fuga de metadatos entre jurisdicciones, aunque la ruta de materialización de `ANULACION` siguiera bloqueada.

## Corrección aplicada efectivamente
`supabase/migrations/20261027152000_close_original_legacy_batch_enumeration_v245.sql` se ejecutó mediante migración Supabase en QA. Ambas funciones exigen `public.can_manage_legacy_import(parish_id,diocese_id)` en la consulta inicial del lote y antes de interpretarlo, adquirir el bloqueo de la fila y diferenciar `ANULACION`. El SQL falla de forma atómica si las expresiones originales no tienen la coincidencia auditada exacta. No altera tipos, tablas, filas, firmas, concesiones de permisos ni la política de rechazo de materializaciones legadas.

### Evidencia viva posterior
Se ejecutaron transacciones `BEGIN; SET LOCAL ROLE authenticated;` con `request.jwt.claim.sub` de cuentas ficticias, argumentos de lote real o inexistente, y reversión automática al recibir excepción. Resultados observados:

| Ruta | Parroquia ajena, lote existente | Parroquia ajena, lote inexistente | Usuario autorizado, `ANULACION` |
|---|---|---|---|
| Importador original | `Lote no encontrado` | `Lote no encontrado` | Denegación especial conservada |
| Reconciliador antiguo | `Lote no encontrado` | `Lote no encontrado` | Denegación especial conservada |

**6/6 casos aprobados.** Con la V244 y V245 quedan comprobadas las cuatro rutas históricas de importación conocidas: original, v2, v3 y reconciliador `ANULACION`. El CI prueba el acta y fuentes sin reejecutar estas consultas contra la base; no debe presentarse como monitorización permanente.

La huella PostgreSQL verificada de las **152 funciones públicas privilegiadas** cambió de `d10ec9b11e3726fc8427dd983400028e` a `91f3bb1bf8a50fd85d066d86fd79da2b`, fijada en el guard de lanzamiento. El manifiesto de migraciones alcanza **165 archivos**, sin nuevos DML: los **14 archivos con 45 sentencias DML antiguas** conservan sus bloqueos para una base oficial limpia.

La comparación de conteos QA luego de aplicar la migración confirma **5.040 Bautismos, 2.091 Confirmaciones, 1.261 Matrimonios, 1 Exequia y 12 cuentas**, sin variación por esta intervención.

## Condiciones pendientes para cierre al 100 %
Estos seis ensayos negativos y esta corrección **no certifican importaciones válidas completas, revisión de las 152 funciones privilegiadas, restauración real de respaldo, SMTP, base oficial nueva independiente ni conformidad institucional de impresión y firma**. Permanecen todas esas puertas bloqueadas hasta probarlas.

**Porcentaje técnico ponderado estimado: 97,41 %**, sin aumento artificial. **Autorización oficial de registros: NO.**
