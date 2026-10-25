-- SACRAMENTUM V200 · A numeric book location is the same regardless of leading zeros.
-- Existing indexes normalized case/outer whitespace, but 0001 and 1 were distinct.
-- Four race-safe UNIQUE indexes enforce parish + book type + numeric coordinates.
-- Non-numeric historical references remain governed by existing indexes.
-- Preflight on 2026-10-24 found zero numerically equivalent duplicates in all four tables.
CREATE UNIQUE INDEX IF NOT EXISTS uq_baptisms_numeric_location_v200
ON public.baptisms (
 parish_id,
 ltrim(btrim(book_number), '0'),
 ltrim(btrim(folio), '0'),
 ltrim(btrim(number), '0')
)
WHERE parish_id IS NOT NULL
AND btrim(book_number) ~ '^[0-9]+$'
AND btrim(folio) ~ '^[0-9]+$'
AND btrim(number) ~ '^[0-9]+$';

CREATE UNIQUE INDEX IF NOT EXISTS uq_confirmations_numeric_location_v200
ON public.confirmations (
 parish_id,
 ltrim(btrim(book_number), '0'),
 ltrim(btrim(folio), '0'),
 ltrim(btrim(number), '0')
)
WHERE parish_id IS NOT NULL
AND btrim(book_number) ~ '^[0-9]+$'
AND btrim(folio) ~ '^[0-9]+$'
AND btrim(number) ~ '^[0-9]+$';

CREATE UNIQUE INDEX IF NOT EXISTS uq_marriages_numeric_location_v200
ON public.marriages (
 parish_id,
 lower(btrim(book_type)),
 ltrim(btrim(book_number), '0'),
 ltrim(btrim(folio), '0'),
 ltrim(btrim(number), '0')
)
WHERE parish_id IS NOT NULL
AND btrim(book_number) ~ '^[0-9]+$'
AND btrim(folio) ~ '^[0-9]+$'
AND btrim(number) ~ '^[0-9]+$';

CREATE UNIQUE INDEX IF NOT EXISTS uq_funerals_numeric_location_v200
ON public.funerals (
 parish_id,
 lower(btrim(book_type)),
 ltrim(btrim(book_number), '0'),
 ltrim(btrim(folio), '0'),
 ltrim(btrim(number), '0')
)
WHERE parish_id IS NOT NULL
AND btrim(book_number) ~ '^[0-9]+$'
AND btrim(folio) ~ '^[0-9]+$'
AND btrim(number) ~ '^[0-9]+$';
