-- V188: proteger referencias registrales contra diferencias de mayúsculas y espacios externos.
-- Aprobado tras verificar 8.393 partidas existentes sin conflictos normalizados.
-- Conservar índices exactos previos, agregar defensa adicional a la base de datos.
SET LOCAL lock_timeout = '4s';
SET LOCAL statement_timeout = '30s';

CREATE UNIQUE INDEX IF NOT EXISTS uq_baptisms_registry_normalized_v188
 ON public.baptisms (parish_id, (lower(btrim(book_number))), (lower(btrim(folio))), (lower(btrim(number))))
 WHERE parish_id IS NOT NULL AND book_number IS NOT NULL AND folio IS NOT NULL AND number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_confirmations_registry_normalized_v188
 ON public.confirmations (parish_id, (lower(btrim(book_number))), (lower(btrim(folio))), (lower(btrim(number))))
 WHERE parish_id IS NOT NULL AND book_number IS NOT NULL AND folio IS NOT NULL AND number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_marriages_registry_normalized_v188
 ON public.marriages (parish_id, book_type, (lower(btrim(book_number))), (lower(btrim(folio))), (lower(btrim(number))))
 WHERE parish_id IS NOT NULL AND book_number IS NOT NULL AND folio IS NOT NULL AND number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_funerals_registry_normalized_v188
 ON public.funerals (parish_id, book_type, (lower(btrim(book_number))), (lower(btrim(folio))), (lower(btrim(number))))
 WHERE parish_id IS NOT NULL AND book_number IS NOT NULL AND folio IS NOT NULL AND number IS NOT NULL;
