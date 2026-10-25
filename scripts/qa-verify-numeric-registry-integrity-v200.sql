-- V200 read-only proof: canonical numeric positions unique across all four sacraments.
WITH allrows AS (
  SELECT 'baptisms' kind, parish_id, 'ordinario' book_type, book_number,folio,number FROM public.baptisms
  UNION ALL SELECT 'confirmations',parish_id,'ordinario',book_number,folio,number FROM public.confirmations
  UNION ALL SELECT 'marriages',parish_id,coalesce(book_type,'ordinario'),book_number,folio,number FROM public.marriages
  UNION ALL SELECT 'funerals',parish_id,coalesce(book_type,'ordinario'),book_number,folio,number FROM public.funerals
), normalized AS (
 SELECT kind,parish_id,lower(btrim(book_type)) class,
   ltrim(btrim(book_number),'0') book,
   ltrim(btrim(folio),'0') page,
   ltrim(btrim(number),'0') entry
 FROM allrows
 WHERE parish_id IS NOT NULL
  AND btrim(book_number) ~ '^[0-9]+$'
  AND btrim(folio) ~ '^[0-9]+$'
  AND btrim(number) ~ '^[0-9]+$'
), duplicates AS (
 SELECT kind,parish_id,class,book,page,entry,count(*) amount FROM normalized
 GROUP BY kind,parish_id,class,book,page,entry HAVING count(*)>1
)
SELECT (SELECT count(*) FROM normalized) AS protected_numeric_records,
 (SELECT count(*) FROM duplicates) AS numeric_equivalent_duplicate_locations,
 (SELECT count(*) FROM pg_index pi JOIN pg_class pc ON pc.oid=pi.indexrelid
  WHERE pc.relname IN('uq_baptisms_numeric_location_v200',
  'uq_confirmations_numeric_location_v200','uq_marriages_numeric_location_v200',
  'uq_funerals_numeric_location_v200')
  AND pi.indisunique IS TRUE AND pi.indisvalid IS TRUE) AS enforced_valid_unique_indexes;
