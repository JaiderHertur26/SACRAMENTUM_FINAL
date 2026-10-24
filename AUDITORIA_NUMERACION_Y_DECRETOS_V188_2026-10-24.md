# SACRAMENTUM FINAL — V187/V188 · Numeración registral y decretos
Fecha de corte: 24 de octubre de 2026 (Colombia).
Ruta: `C:\SACRAMENTUM\SACRAMENTUM_FINAL`
Supabase: REGISTRO SACRAMENTOS.

## Descubrimiento real
- 8.393 partidas: 5.040 Bautismos, 2.091 Confirmaciones, 1.261 Matrimonios y 1 Exequias.
- No hay duplicados existentes por parroquia, libro/tipo de libro cuando aplica, folio y número, incluso aplicando `lower(btrim())`; tampoco coordenadas incompletas.
- Índices previos impedían duplicación *literal*. Se reprodujo con dos registros Bautismo ficticios que una diferencia de mayúsculas y espacios permitía duplicación lógica (ambos coexistían dentro de `BEGIN/ROLLBACK`).
- La RPC real `issue_documentary_decree_v88` denegó un segundo número de decreto diocesano aunque variaban mayúsculas y espacios; su índice único `uq_decretos_diocese_number` está activo. Los dos decretos existentes tenían número y fecha, sin colisiones.

## Corrección ya aplicada en Supabase
- Migración real `20261024183828_registry_normalized_uniqueness_v188` aplicada correctamente.
- Índices adicionales únicos: `uq_baptisms_registry_normalized_v188`, `uq_confirmations_registry_normalized_v188`, `uq_marriages_registry_normalized_v188`, `uq_funerals_registry_normalized_v188`.
- Protección: parroquia + minúsculas y espacios externos suprimidos para libro, folio y número; en Matrimonio y Exequias se conserva la separación de `book_type`.
- Catálogo PostgreSQL volvió a confirmar los 4 índices `indisunique=true`, `indisvalid=true`, `indisready=true`. Los índices anteriores permanecen intactos; no se renumeró ninguna partida.
- La misma migración quedó incorporada al repositorio para trazabilidad y despliegue futuro.

## Pruebas reales de PostgreSQL, con reversión
- `qa-rollback-registry-uniqueness-v187.sql`: 4 altas ficticias válidas y 4 rechazos por repetición literal, una única fila original por sacramento en cada transacción.
- `qa-rollback-registry-normalized-v188.sql`: **4 de 4** intentos de insertar libro/folio/número equivalente pero con espacios y mayúsculas diferentes denegados por su índice normalizado correcto; 1 fila ficticia válida por sacramento.
- `qa-rollback-decree-number-v187.sql`: se emitió un decreto documental ficticio de Cancillería, el segundo número equivalente normalizado fue rechazado; sólo 1 en la transacción.
- `qa-readonly-numbering-v187.sql`: catálogo + 8.393 partidas en sólo lectura; 0 duplicaciones normalizadas, 0 referencias incompletas, índice de decretos válido, 0 decretos sin fecha.
- Reconsulta posterior en tablas: **0 filas de prueba V187/V188 persistentes** en los cuatro sacramentos y decretos.

## Alcance certificado y pendientes
- 07.01 «Unicidad Libro Folio Número»: APROBADO para las cuatro tablas declaradas bajo equivalencia de mayúsculas y espacios externos, respetando parroquia y tipo de libro.
- 07.02 «Colisión de número de decreto»: APROBADO para ámbito diocesano con normalización de espacios y mayúsculas, probado en la RPC de Cancillería y en índice SQL.
- 12.02 «Número y fecha únicos» todavía no se certifica como flujo jurídico integral: la fecha no es un identificador necesariamente único, y se requieren pruebas documentales.
- La equivalencia de ceros a la izquierda (`01` frente a `1`) y los libros históricos con convenciones especiales siguen fuera de esta normalización: no se impuso ninguna transformación de numeración antigua.
- Las dos CHECK antiguas `chk_decretos_sacrament_type` y `chk_decretos_status` siguen marcadas `NOT VALID`; merece revisión separada antes del cierre integral.
- Concurrencia intersesión verdadera, E2E con roles autenticados y recuperación tras timeout continúan pendientes.
- No hay cambios de permisos, RLS, credenciales, partidas históricas ni decretos reales.
