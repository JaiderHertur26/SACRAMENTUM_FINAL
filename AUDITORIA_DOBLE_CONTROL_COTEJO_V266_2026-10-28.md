# SACRAMENTUM FINAL · V266 · Inventario físico verificable y doble firma

**28/10/2026. Fuente: Supabase, consulta SELECT sobre las cuatro tablas reales. Entrega en rama de desarrollo, sin despliegue y sin alterar datos.**

## Conclusiones basadas en posiciones reales
- **8.393 partidas** en **22 ámbitos** únicos: parroquia / sacramento / tipo / libro.
- **11 ámbitos con discontinuidades digitales**: saltos entre posiciones, descensos de números o folios omitidos. **11 ámbitos con patrón digital regular**: también deben cotejarse con el libro físico.
- **6 ámbitos** contienen folios con más de dos partidas, lo que impide presuponer que toda la historia tenga capacidad fija 2.
- **0 coordenadas físicas duplicadas** dentro de cada ámbito.
- Una serie de Confirmaciones tiene folios de hasta **13 registros** y muchos descensos de numeración; un simple interruptor «reiniciar por folio» no soluciona esas anomalías.
- El informe se entrega con parroquias anónimas y posiciones agregadas. No se exportaron identidades de sacramentados ni identificadores de sus partidas. Se conserva un digest MD5 por ámbito para detectar cambios en las posiciones observadas; **MD5 no es una firma criptográfica segura contra manipulación deliberada**.

## Archivos entregados
- `scripts/read-only-v266-scope-inventory.sql`: consulta reproducible SELECT a los registros reales.
- `AUDITORIA_LIBROS_HISTORICOS_V266_2026-10-28.json`: 22 ámbitos, métricas y huellas de posiciones históricas.
- `AUDITORIA_LIBROS_HISTORICOS_V266_2026-10-28.csv`: inventario de revisión en formato tabular.
- `AUDITORIA_COTEJO_LIBROS_V266_2026-10-28.md`: ficha de cotejo por libro con casos discontinuos, últimas posiciones digitales y pasos de evidencia física.
- `scripts/build-physical-review-dossier-v266.mjs`: reproduce los reportes y se detiene si cambian la cantidad de ámbitos/partidas o la clasificación de riesgo. La evidencia inicial se conserva para auditoría, pero una nueva consulta deberá capturar un snapshot diferente si cambian los registros.

## Mecanismo de doble control institucional
`scripts/staged-v266-two-signature-physical-review.sql` queda PREPARADO, **sin GRANT y sin instalar en Supabase**:

1. Un **usuario parroquial activo**, de la parroquia propietaria y diócesis correcta, presenta propuesta de conciliación con referencia y notas del cotejo físico, Libro impreso exacto, próxima posición Libro/Folio/Número, capacidad y modalidad de numeración futura. No se infiere «próximo número» del máximo digital.
2. El servidor ata la propuesta a un **digest calculado directamente de las partidas reales** bajo bloqueo de ámbito. Sin partidas físicas, con posiciones repetidas o coordenadas incompletas, la propuesta falla.
3. Un **segundo usuario distinto** con rol **`chancery` o `diocese`** y de la misma diócesis debe aprobar exactamente la misma propuesta y la misma referencia documental. Si difiere libro, configuración, digest o fuente, se rechaza.
4. Solo la segunda firma válida crea `sacramentum_ledger.book_memories` con `legacy_reconciled=true`, la siguiente posición físicamente acreditada, y deja dos eventos de auditoría separados (`reconciliation_proposed` / `reconciliation_approved`) en la misma transacción.
5. Si falla la auditoría, no se crea memoria ni firma parcial. No se permite la misma aprobación repetida o aprobar por el autor de la primera firma.

**Limitación necesaria:** SQL no puede verificar por sí solo que la fotografía o libro físico exista y corresponda a la declaración. Las dos personas responden institucionalmente de ese cotejo. Ninguna de las 22 memorias está aprobada por este informe ni se ha inventado la firma o la evidencia.

## Ensayo
`scripts/ci-two-signature-physical-review-v266.sh`: PostgreSQL 16 aislado con roles parroquia/Cancillería/Administrador General, dos partidas antiguas ficticias y auditoría. Ensaya rechazo del Administrador General y del revisor incorrecto, propuesta única, rechazo de coordenadas/evidencia divergente, invalidez por cambio de partida histórica, firma distinta y reversión integral ante error de auditoría.

`scripts/test-physical-reconciliation-v266.mjs` refuerza clasificación, hash, ausencia de datos personales, permisos privados y doble control. La batería completa de V252–V266 queda enlazada a la puerta de calidad V90 y a GitHub Actions.

## Próximo paso y condición para activar
La futura migración requiere conectar la UI de cotejo a permisos y roles reales y endurecer el preflight V265 para **recalcular y cotejar los digest V266 inmediatamente antes del corte**, dentro de la transacción con las tablas bloqueadas. El expediente por sí solo no habilita asientos; la revisión institucional físico-documental de los 22 libros todavía no ocurrió.

**Resultado V266: inventario y mecanismo de revisión listos en rama. NO oficial y SIN cambios en las 8.393 partidas.**
