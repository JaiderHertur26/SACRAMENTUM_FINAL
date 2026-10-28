# SACRAMENTUM FINAL · V254 · Separación irreversible de nuevos e históricos

**28 de octubre de 2026. Estado: implementación y ensayo aislado, sin migraciones activadas en Supabase.**

## Contrato registral confirmado

Esta distinción es **obligatoria**. La fecha antigua de una ceremonia, por sí sola, NO convierte un registro en histórico. La diferencia es registral: ¿el sacramento ya tiene una **partida existente** con Libro/Folio/Número físicamente asignados, o es una celebración nueva comprobada **pendiente de asiento**?

| Origen real | Destino | Asigna Libro/Folio/Número nuevos | Consume memoria secuencial V252/V253 |
|---|---|---|---|
| Nuevo sacramento celebrado con boleta pendiente | Asiento nuevo por libro de su parroquia | Sí, en momento de asiento | **Sí** |
| Registro histórico directo estructurado o literal | Copia fiel del asiento ya existente | No; preserva los físicos originales | **No** |
| Importación de partida histórica de archivo físico | Copia fiel de la partida del archivo original | No; preserva los físicos originales | **No** |
| Decreto nuevo que ordena **crear partida supletoria** | Asiento nuevo supletorio autorizado | Sí, al asentar en parroquia | **Sí** |
| Decreto nuevo documental o correctivo sobre partida existente | Vinculación/actuación sobre partida existente | No para esa partida existente | **No** |
| Decreto histórico importado (ANULACION) | Identificación y vinculación a una o dos partidas históricas existentes | **Nunca** | **Nunca** |

Los contadores de la memoria solo miden **asientos nuevos posteriores a la conciliación**. Si un libro físico ya tiene historial y se seguirá usando, sus siguientes coordenadas deben establecerse con respaldo del archivo original. Introducir una partida histórica posteriormente NO debe consumir o retroceder la memoria de los nuevos. La unicidad global Libro/Folio/Número por parroquia/sacramento/tipo sigue siendo obligatoria.

## Implementación efectuada en rama de trabajo

1. **Motor de asignación:** `src/domain/sacramentalLedgerSequence.mjs` exige origen `new_sacrament` o `new_decree_supplement`, comprobación de celebración y ausencia de coordenadas previas. Rechaza `historical_import`, `historical_archive`, partida ya numerada y decreto que no ordene expresamente crear partida supletoria.
2. **Clasificador explícito:** `src/domain/registryJourneyPolicy.mjs` determina las seis rutas del cuadro, exige Libro/Folio/Número a partidas históricas y **nunca** genera coordenadas para ellas.
3. **Servicios existentes de digitalización histórica:** `historicalRegistryService.js` valida Libro/Folio/Número antes de llamar exclusivamente a los RPC históricos ya establecidos. Las Exequias conservan su formulario y prueba histórica de recuperación V206 original: su pantalla ya exigía esos tres campos.
4. **Cancillería histórica:** `legacyDecreeReconciliationService.js` expone en la vista si el expediente archivado tiene constancia del vínculo original y opcional supletorio; el panel distingue `vinculado` frente a una referencia todavía incompleta.
5. **Aislamiento SQL de prueba:** el módulo `qa_append_batch_v253` rechaza un historial incluso si se presenta como boleta nueva pero contiene libro/folio/número; rechaza cualquier origen ausente o celebración no verificada. `qa_link_historical_decree_v254` (solo fixture privada PG16) vincula únicamente partidas preexistentes de la parroquia/sacramento correcto; el expediente ambiguo/missing pasa a revisión, no crea otra partida ni toca memoria y deja evento inmutable.
6. **Pruebas:** nuevos controles `test-historical-new-boundary-v254.mjs` y `ci-historical-decree-link-v254.sh` agregados a la auditoría maestra y al job PostgreSQL del GitHub Actions.

## Verificación REAL solo lectura de la instancia QA

Dos decretos de origen histórico ya registrados están archivados y **ambos** conservan relaciones directas válidas a original y reemplazo de su parroquia (2/2). Su metadato actual `legacyHistorical=true` y `recordOrigin=legacy_import` protege su categoría; el campo opcional `provenanceOnly` no está informado en estos dos registros, por lo que no se afirma que esa bandera se haya registrado.

En el archivo fuente `ANULACION`, de 7 expedientes, 2 se han materializado y 5 siguen `archived`; estos cinco tienen origen verificado y parroquia mapeada, pero el cotejo preliminar detecta **una partida original ambigua, dos búsquedas supletorias con varias coincidencias y un antecedente sin referencia de decreto**. La coincidencia debe resolverse *dentro del mismo sacramento*, además de parroquia y coordenadas.

**Observación importante:** el RPC `apply_legacy_import_batch_v3` **bloquea ANULACION**, no relaciona automáticamente las partidas. La asociación actual la realiza, como una acción separada y autorizada de Cancillería, el RPC `materialize_legacy_decrees_v68`, que ya conserva los vínculos y las notas con procedencia y rechaza lo ambiguo. Por tanto, el objetivo futuro de vincular *inmediatamente tras la importación verificada* **NO debe presentarse como ya implementado**. Para lograrlo deberá incluirse en el mismo flujo transaccional de confirmación del origen de Cancillería; las excepciones permanecerán para revisión y jamás crearán partidas históricas nuevas.

## Cambios excluidos

No se aplicaron migraciones V252–V254 a Supabase, no se activaron RPCs nuevos públicos, no se convirtió ninguna partida histórica en boleta pendiente, no se alteró dato histórico, decreto, contador, parámetro, nota marginal ni registro del usuario. La rama sigue en PR #103 como **borrador**, sin publicar en Vercel. Para activar se requiere integrar y probar con permisos reales los cuatro asientos nuevos y la emisión de decretos nuevos sin escritura secundaria antigua desde Cancillería/Parámetros.
