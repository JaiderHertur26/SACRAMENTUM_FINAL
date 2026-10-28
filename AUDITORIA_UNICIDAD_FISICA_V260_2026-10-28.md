# SACRAMENTUM FINAL · V260 · Unicidad física canónica de libros, folios y partidas

**28 de octubre de 2026 · Rama de ensayo `feature/v252-ledger-state-foundation` · PR #103 (borrador). No aplicar aisladamente en Supabase.**

## Evidencia real de Supabase (consultas SELECT, sin mutación)
- Bautismo: 5.040 partidas; Confirmación: 2.091; Matrimonio: 1.261; Exequias: 1; total **8.393**.
- Las 8.393 tienen Libro/Folio/Número informados, con formato actual válido; no se encontraron coordenadas canónicas duplicadas por parroquia/sacramento/tipo de libro. La comparación de libros solo elimina ceros cuando son enteramente numéricos; en alfanuméricos convierte a mayúsculas y conserva los ceros iniciales. Folio y Número eliminan ceros iniciales para comparación.
- Los 1.261 Matrimonios y la Exequia existente son tipo `ordinario`; comprobar las futuras partidas `suplementario` antes de habilitar.
- **Este resultado NO resuelve 11 ámbitos con discontinuidades** identificados en los 22 ámbitos de cotejo físico previo. No asigna el siguiente libro a ninguna parroquia.

## Problema descubierto al contrastar código actual
Los cuatro RPC reales `seat_baptism_records`, `seat_confirmation_records`, `seat_pending_marriage` y `seat_funeral_record` siguen derivando las coordenadas del JSON de `parish_parameters`. Las comprobaciones de duplicados existentes comparan texto formateado: `0001` frente a `1` o `0001A` frente a `0001a` pueden escapar de una coincidencia exacta. Los cuatro procedimientos preservan lógica especializada (notas cruzadas en Confirmación, fechas, declaraciones, recibos de auditoría y boletas), que NO debe perderse al migrar.

## V260 construida y ensayada
- `scripts/staged-v260-canonical-physical-uniqueness.sql`: propuesta de transacción sin DML sobre partidas. Bloquea escrituras durante la instalación, exige coordenadas físicas válidas, valida datos existentes y crea **cuatro índices UNIQUE normalizados** en los registros físicos. Las partidas anuladas, corregidas y archivadas siguen reservando su coordenada; no existe filtro por `status`.
- Para Bautismo y Confirmación, los libros suplementarios comparten tabla sin `book_type` independiente; por seguridad, los índices no distinguen tipos y prohíben reutilizar una misma coordenada en esos dos ámbitos. Matrimonio y Exequias sí tienen `book_type`, y lo incluyen en la clave.
- `scripts/ci-canonical-physical-uniqueness-v260.sh`: fixture PostgreSQL 16 real, cuatro tablas físicas, variantes de ceros/letras, autorización de claves por diferentes parroquias, espacio ordinario/suplementario, dos escrituras concurrentes al mismo asiento, rollback de lote e instalación íntegra fallida ante un duplicado heredado.
- `scripts/test-canonical-physical-uniqueness-v260.mjs`: 4 pruebas de presencia, invariantes e incorporación a la puerta de calidad y CI.

## Restricciones para operación oficial
1. **No aplicar solo los índices**. La instalación debe ser coordinada con las memorias V252–V253, el contador protegido V256–V258 y cuatro RPC reales nuevos que sustituyan los escritores de coordenadas en `parish_parameters`. El índice es la defensa final contra carreras, no el motor de asiento.
2. Los 11 ámbitos de libro discontinuos deben cotejarse contra el físico, sin renumerar históricos.
3. Se debe preservar la semántica integral de los cuatro procedimientos: Bautismo/Confirmación procesan lotes y retornan consecutivos `integer`; Matrimonio/Exequias son individuales y también retornan `next_book integer`. **No admiten libro alfanumérico como retorno actual**, por lo que el nuevo contrato API requiere `book text` y actualización coordinada de clientes.
4. El asiento de Exequias aún acepta un flujo sin boleta pendiente: establecer si se permite nueva celebración directa, pero nunca confundir con la digitalización histórica.
5. No activar un cambio de permisos si rompe la creación de boletas, las notas marginales, decretos y reposiciones; no habilitar asiento oficial sin prueba de cierre/reversión terminal con dependencias.
6. Los borradores SQL V256, V258 y V260 NO fueron aplicados. La instancia Supabase, partidas y `ANULACION` quedan intactos.

**Conclusión:** hay evidencia de cero colisiones y un mecanismo robusto de unicidad física que se puede ensayar; la sustitución efectiva de los cuatro RPC de asiento continúa pendiente. No declarar operación oficial.
