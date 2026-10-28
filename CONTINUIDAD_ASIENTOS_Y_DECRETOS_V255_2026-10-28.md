# SACRAMENTUM FINAL — Continuidad V255 (28-10-2026)

## Alcance y estado
Rama: feature/v252-ledger-state-foundation, PR #103. Esta revisión continúa V252–V254 sin fusiones, despliegues ni cambios de datos.
La nueva memoria **solo** corresponde a sacramentos nuevos celebrados y pendientes de asiento, y decretos nuevos que ordenan expresamente una partida supletoria. Los sacramentos y decretos históricos son objetos ya asentados: conservan Libro/Folio/Número físicos; se identifican y se relacionan, nunca se crean o renumeran por importación.

## Verificación del sistema real (Supabase QA, solo SELECT)
- Proyecto: REGISTRO SACRAMENTOS, referencia foczofcmwampjvlfbsqn.
- ANULACION: 7 antecedentes; 2 materialized_decree con vínculo original y supletorio en metadatos, 5 archived sin vínculos; las cinco fuentes archivadas están verificadas y mapeadas. Un antecedente carece de referencia documental de decreto.
- El RPC apply_legacy_import_batch_v3 bloquea ANULACION. materialize_legacy_decrees_v68 solo lo ejecuta Cancillería autorizada sobre origen validado, como procedimiento **separado**. No existe auto-vinculación en la confirmación ordinaria del importador.
- Los cuatro RPC reales de asiento (seat_baptism_records, seat_confirmation_records, seat_pending_marriage y seat_funeral_record) todavía consultan public.parish_parameters en la base QA. Todos usan SECURITY DEFINER y comprobación auth.uid(). La migración del contador nuevo NO se aplicó.
- La conciliación V253 de 8.393 partidas y 22 ámbitos detectó 11 ámbitos sin secuencia continua o con repetición: la memoria de libros NO puede inicializarse basándose en una suposición del próximo número.

## Código nuevo V255 en esta rama (no conectado a RPC de producción)
- registryJourneyPolicy.mjs: exige procedencia verificada y UUID único para proponer el vínculo de decreto histórico; de otro modo envía a revisión.
- validateHistoricalDecreeAssociation: recibe candidatos enriquecidos y exige origen verificado, parroquia, sacramento, referencia documental y correspondencia física Libro/Folio/Número. Rechaza supletorias de otra parroquia, sacramento o coordenadas, y original=supletoria.
- Se conserva como texto el identificador físico de Libro, Folio y Número, incluidos ceros de archivo y códigos alfanuméricos. La comparación admite ceros iniciales en valores puramente numéricos, sin renumerar el registro.
- Nuevos casos negativos incorporados a scripts/test-historical-new-boundary-v254.mjs para impedir que cambios posteriores relajen esos requisitos.
- La verificación definitiva debe repetirse en PostgreSQL dentro de la transacción y con identidad real del usuario. La función de dominio no es un mecanismo de autorización suficiente por sí sola.

## Pendientes que bloquean la activación
1. Conciliación documental por parroquia/sacramento/libro y autorización de secuencia; resolver los 11 ámbitos discrepantes sin alterar partidas históricas.
2. Sustituir, **en una única migración segura** y con pruebas por rol, la asignación heredada de los cuatro RPC de asiento por la memoria transaccional. No basta editar el frontend.
3. Separar expediente/decreto nuevo de su posterior asiento parroquial de partida supletoria; asegurar el orden de expedición y recepción.
4. Parametrización exclusivamente consultiva, salvo contador autorizable de registros de boletas. Bloquear escritura alternativa por servicios, RPC y roles.
5. Integrar enlace histórico inmediato **solo tras confirmación de origen e identidad por Cancillería**, dentro de transacción segura; mantener casos dudosos en revisión. La categoría histórica nunca crea partidas.
6. Ensayar reversión del último bloque y bloqueo por certificados, notas, decretos y dependencias, con ROLLBACK y permisos reales.
7. Completar auditoría/build/CI y mantener PR #103 separado hasta que todo pase.

## Límites de esta entrega
No se ejecutaron INSERT, UPDATE ni DELETE sobre Supabase. No se asignaron nuevos Libro/Folio/Número. No se conciliaron automáticamente los cinco expedientes. No se activó ni publicó V255. La base sigue siendo QA con datos de prueba; no afirmar operación oficial.
