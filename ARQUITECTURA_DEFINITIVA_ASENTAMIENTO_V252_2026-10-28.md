# SACRAMENTUM FINAL — V252: contrato definitivo de numeración, decretos y reversión

**Fecha:** 28 de octubre de 2026. **Estado:** motor de dominio implementado y probado en rama aislada. **NO ACTIVADO** en Supabase ni en los flujos de asiento; no habilita operación oficial.

## Diagnóstico confirmado
- Los cuatro libros históricos guardan Libro, Folio y Número como cadenas. La tabla heredada sacrament_books.book_number usa INTEGER: no es apta como autoridad de libros alfanuméricos 0001A sin migración controlada.
- Los procedimientos seat_baptism_records y seat_confirmation_records todavía derivan sus coordenadas desde parish_parameters; Matrimonio y Exequias emplean también consecutivos heredados. Existen pantallas y RPC que permiten editar Parámetros. Algunos decretos expiden y materializan la nueva partida directamente en Cancillería, contrario al contrato propuesto.
- Los libros históricos tienen índices de unicidad normalizada; deben conservarse, además de verificar las colisiones antes de crear memorias nuevas.

## Contrato único del libro
1. Identidad única por parroquia, sacramento, tipo de libro y código alfanumérico exacto; 0001A permanece 0001A, nunca se convierte en un número. Se impide crear falsos libros distintos como 1 y 0001 por errores de normalización.
2. El primer asiento recibe Libro, Folio, Partida inicial y Partidas por Folio. La configuración se inmoviliza tras crear el primer asiento. La consulta, la boleta y la emisión de decreto no consumen números.
3. Memoria por libro con configuración inicial, total de asientos activos y versión de concurrencia. Número siguiente = número inicial + asientos activos. Folio siguiente = folio inicial + parte entera de (asientos activos / partidas por folio). El número es consecutivo a través de folios.
4. Toda numeración histórica requiere conciliación real antes de inicializar memoria; nunca se presupone que el libro empieza en 0001 ni se rellenan vacíos antiguos sin autoridad documental.
5. Antes de mutar: bloquear memoria del libro, comprobar usuario activo, jurisdicción, celebración realizada, secuencia exacta, duplicados y referencias. En una única transacción: crear partidas, marcar boletas, registrar auditoría y avanzar memoria. Cualquier fallo revierte todo.
6. Lotes ordenados por celebración ascendente y, en empates, número de registro numérico ascendente; desempate determinista. Nadie puede asentar una boleta dos veces.

## Parámetros
- Todos los valores de libros y reglas son consulta y evidencia, sin edición manual.
- Excepción única: contador de registros de boletas, con RPC exclusiva que acepte SOLO ese campo, autorización parroquial y control de concurrencia. No dejar los RPC antiguos como una ruta secundaria de modificación.
- El contador de partidas futuras se deriva de memoria, nunca de un parámetro creado de antemano.

## Decretos
- Expedir significa registrar decreto original y notificar; NO crear partida ni asignar Libro/Folio/Número.
- Sentar decreto exige usuario de parroquia autorizado, fecha de expedición más antigua pendiente y desempate por recepción. La lectura de una notificación no equivale a asiento.
- Asiento transaccional de partida, memoria, constancia agregada sin modificar el original y aviso a Cancillería. Nunca confundir anulación jurídica con borrado administrativo.

## Reversión
- Solo sufijo terminal consecutivo, con autorización, motivo y prueba de ausencia de certificados, notas, decretos o dependencias activas.
- Ninguna partida intermedia se renumera; un lote se revierte completo solo si es el último bloque y todas sus partidas son reversibles.
- Conservar historial documental y eventos antes/después en registro inmutable; una eventual reconfiguración de libro vacío es una nueva versión auditada, no una supresión del pasado.
- Reversión, memoria y referencias se verifican y mutan en una sola transacción.

## Código realizado y probado
- src/domain/sacramentalLedgerSequence.mjs: memoria inmutable, folios, códigos alfanuméricos, lotes, secuencias y reversión del último bloque.
- src/domain/chanceryDecreeOrder.mjs: orden por expedición y recepción, prohibición de saltar notificaciones anteriores.
- scripts/test-ledger-memory-v252.mjs y scripts/test-decree-chronology-v252.mjs: 17 pruebas locales aprobadas.

## Prohibición de habilitarlo a medias
El código puro todavía NO sustituye los procedimientos SQL existentes ni las pantallas reales de Parámetros, asientos y decretos, y no se ha aplicado migración de la V252. No elimina por sí mismo rutas antiguas de asignación. **Esta rama debe mantenerse separada de main y de despliegues mientras falte integración completa.**

Antes del cierre: conciliación histórica por libro; migración transaccional con RLS y autorizaciones; implementación de los cuatro sacramentos y todos los decretos; única edición permitida de contador de boletas; pruebas reales de concurrencia, duplicidad, rollback, libro alfanumérico, folios, lote y auditoría; y contraste de datos antes y después.

**Principio rector:** al asentar, la memoria avanza; al revertir válidamente el último asiento, retrocede exactamente. Nunca renumerar asientos posteriores válidos ni eliminar trazabilidad.
