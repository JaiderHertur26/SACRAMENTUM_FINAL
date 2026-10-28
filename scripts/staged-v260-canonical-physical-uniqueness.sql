-- V260 STAGED · NOT APPLIED TO SUPABASE. Atomic physical-slot constraints.
-- Actual read-only inventory 2026-10-28: 8393 rows, zero missing coordinates,
-- zero canonical duplicates; 11 book-scope discontinuities remain UNRECONCILED.
-- Deploy only in a coordinated V252-V260 cutover following backups and tests.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
-- Locks prevent live writers from racing the unique-index build.
LOCK TABLE public.baptisms,public.confirmations,public.marriages,public.funerals
 IN SHARE ROW EXCLUSIVE MODE;
-- All physical records (including annulled/corrected) reserve their original
-- book/folio/partida; never use a status-based partial unique index.

ALTER TABLE public.baptisms
 ADD CONSTRAINT ck_v260_baptism_physical_coordinates
 CHECK (book_number IS NOT NULL AND book_number ~ '^[A-Za-z0-9]{1,32}$'
   AND folio IS NOT NULL AND folio ~ '^[0-9]{1,30}$' AND ltrim(folio,'0') <> ''
   AND number IS NOT NULL AND number ~ '^[0-9]{1,30}$' AND ltrim(number,'0') <> '') NOT VALID;
-- Preserve all old rows; reject the entire transaction if an invalid row exists.
ALTER TABLE public.baptisms VALIDATE CONSTRAINT ck_v260_baptism_physical_coordinates;
CREATE UNIQUE INDEX uq_v260_baptism_physical_coordinates
 ON public.baptisms (parish_id,
 (CASE WHEN book_number ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(book_number,'0'),''),'0') ELSE upper(book_number) END),(CASE WHEN folio ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(folio,'0'),''),'0') ELSE folio END),(CASE WHEN number ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(number,'0'),''),'0') ELSE number END)) NULLS NOT DISTINCT;

ALTER TABLE public.confirmations
 ADD CONSTRAINT ck_v260_confirmation_physical_coordinates
 CHECK (book_number IS NOT NULL AND book_number ~ '^[A-Za-z0-9]{1,32}$'
   AND folio IS NOT NULL AND folio ~ '^[0-9]{1,30}$' AND ltrim(folio,'0') <> ''
   AND number IS NOT NULL AND number ~ '^[0-9]{1,30}$' AND ltrim(number,'0') <> '') NOT VALID;
-- Preserve all old rows; reject the entire transaction if an invalid row exists.
ALTER TABLE public.confirmations VALIDATE CONSTRAINT ck_v260_confirmation_physical_coordinates;
CREATE UNIQUE INDEX uq_v260_confirmation_physical_coordinates
 ON public.confirmations (parish_id,
 (CASE WHEN book_number ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(book_number,'0'),''),'0') ELSE upper(book_number) END),(CASE WHEN folio ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(folio,'0'),''),'0') ELSE folio END),(CASE WHEN number ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(number,'0'),''),'0') ELSE number END)) NULLS NOT DISTINCT;

ALTER TABLE public.marriages
 ADD CONSTRAINT ck_v260_marriage_physical_coordinates
 CHECK (book_number IS NOT NULL AND book_number ~ '^[A-Za-z0-9]{1,32}$'
   AND folio IS NOT NULL AND folio ~ '^[0-9]{1,30}$' AND ltrim(folio,'0') <> ''
   AND number IS NOT NULL AND number ~ '^[0-9]{1,30}$' AND ltrim(number,'0') <> ''
   AND book_type IS NOT NULL AND lower(book_type) IN ('ordinario','suplementario')) NOT VALID;
-- Preserve all old rows; reject the entire transaction if an invalid row exists.
ALTER TABLE public.marriages VALIDATE CONSTRAINT ck_v260_marriage_physical_coordinates;
CREATE UNIQUE INDEX uq_v260_marriage_physical_coordinates
 ON public.marriages (parish_id,(lower(book_type)),
 (CASE WHEN book_number ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(book_number,'0'),''),'0') ELSE upper(book_number) END),(CASE WHEN folio ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(folio,'0'),''),'0') ELSE folio END),(CASE WHEN number ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(number,'0'),''),'0') ELSE number END)) NULLS NOT DISTINCT;

ALTER TABLE public.funerals
 ADD CONSTRAINT ck_v260_funeral_physical_coordinates
 CHECK (book_number IS NOT NULL AND book_number ~ '^[A-Za-z0-9]{1,32}$'
   AND folio IS NOT NULL AND folio ~ '^[0-9]{1,30}$' AND ltrim(folio,'0') <> ''
   AND number IS NOT NULL AND number ~ '^[0-9]{1,30}$' AND ltrim(number,'0') <> ''
   AND book_type IS NOT NULL AND lower(book_type) IN ('ordinario','suplementario')) NOT VALID;
-- Preserve all old rows; reject the entire transaction if an invalid row exists.
ALTER TABLE public.funerals VALIDATE CONSTRAINT ck_v260_funeral_physical_coordinates;
CREATE UNIQUE INDEX uq_v260_funeral_physical_coordinates
 ON public.funerals (parish_id,(lower(book_type)),
 (CASE WHEN book_number ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(book_number,'0'),''),'0') ELSE upper(book_number) END),(CASE WHEN folio ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(folio,'0'),''),'0') ELSE folio END),(CASE WHEN number ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(number,'0'),''),'0') ELSE number END)) NULLS NOT DISTINCT;
-- Only four physical record tables change; no sequence numbers, records,
-- decrees, notes, or boletas are updated or deleted by this staged migration.
COMMIT;
