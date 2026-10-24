-- SACRAMENTUM V187 · catálogo de numeración y colisiones normalizadas.
-- Control independiente, exclusivamente de lectura, sobre todas las partidas presentes.
BEGIN READ ONLY;
DO $qa$
DECLARE
  s record; v_index text; v_def text; v_enabled boolean;
  v_rows bigint;v_dup bigint;v_incomplete bigint;
  v_decree_dups bigint;v_invalid_decree bigint;v_total bigint:=0;
BEGIN
 FOR s IN SELECT * FROM (VALUES
   ('baptisms','uq_baptisms_registry_number',false),
   ('confirmations','uq_confirmations_registry_number',false),
   ('marriages','uq_marriages_parish_booktype_location',true),
   ('funerals','uq_funerals_location_by_book_type',true)
 ) t(table_name,index_name,booktype_scoped)
 LOOP
   SELECT pg_get_indexdef(i.indexrelid),i.indisunique AND i.indisvalid AND i.indisready
    INTO STRICT v_def,v_enabled
   FROM pg_index i JOIN pg_class idx ON idx.oid=i.indexrelid
   WHERE idx.relnamespace='public'::regnamespace AND idx.relname=s.index_name
      AND i.indrelid=format('public.%I',s.table_name)::regclass;
   IF NOT v_enabled OR v_def NOT ILIKE '%parish_id%'
      OR v_def NOT ILIKE '%book_number%'
      OR v_def NOT ILIKE '%folio%'
      OR v_def NOT ILIKE '%number%'
      OR (s.booktype_scoped AND v_def NOT ILIKE '%book_type%') THEN
      RAISE EXCEPTION 'V187 broken unique index for %',s.table_name;
   END IF;
   EXECUTE format('SELECT count(*) FROM public.%I',s.table_name) INTO v_rows;
   EXECUTE format(
     'SELECT count(*) FROM public.%I WHERE parish_id IS NULL OR book_number IS NULL OR folio IS NULL OR number IS NULL OR btrim(book_number)='''' OR btrim(folio)='''' OR btrim(number)=''''',
     s.table_name) INTO v_incomplete;
   EXECUTE format(
    'SELECT count(*) FROM (SELECT parish_id,%s lower(btrim(book_number)) AS book,lower(btrim(folio)) AS fol,lower(btrim(number)) AS number, count(*) n FROM public.%I GROUP BY parish_id,%s lower(btrim(book_number)),lower(btrim(folio)),lower(btrim(number)) HAVING count(*)>1) collisions',
    CASE WHEN s.booktype_scoped THEN 'book_type,' ELSE '' END,
    s.table_name,
    CASE WHEN s.booktype_scoped THEN 'book_type,' ELSE '' END) INTO v_dup;
   IF v_incomplete<>0 OR v_dup<>0 THEN
    RAISE EXCEPTION 'V187 invalid registry %: incomplete % collisions %',s.table_name,v_incomplete,v_dup;
   END IF;
   v_total:=v_total+v_rows;
 END LOOP;
 SELECT pg_get_indexdef(i.indexrelid),i.indisunique AND i.indisvalid AND i.indisready
 INTO STRICT v_def,v_enabled
 FROM pg_index i JOIN pg_class idx ON idx.oid=i.indexrelid
 WHERE idx.relnamespace='public'::regnamespace AND idx.relname='uq_decretos_diocese_number'
 AND i.indrelid='public.decretos'::regclass;
 IF NOT v_enabled OR v_def NOT ILIKE '%diocese_id%' OR v_def NOT ILIKE '%lower%'
    OR v_def NOT ILIKE '%decree_number%' THEN
    RAISE EXCEPTION 'V187 decree scope uniqueness index invalid';
 END IF;
 SELECT count(*) INTO v_decree_dups FROM (
 SELECT diocese_id,lower(btrim(decree_number)) AS norm_number FROM public.decretos
 WHERE diocese_id IS NOT NULL AND nullif(btrim(coalesce(decree_number,'')),'') IS NOT NULL
 GROUP BY 1,2 HAVING count(*)>1
 ) t;
 SELECT count(*) INTO v_invalid_decree FROM public.decretos
 WHERE diocese_id IS NULL OR nullif(btrim(coalesce(decree_number,'')),'') IS NULL OR decree_date IS NULL;
 IF v_decree_dups<>0 OR v_invalid_decree<>0 OR v_total<100 THEN
  RAISE EXCEPTION 'V187 invalid existing records: decree collisions %, incomplete %, registry rows %',
    v_decree_dups,v_invalid_decree,v_total;
 END IF;
 PERFORM set_config('qa187.readonly',jsonb_build_object(
  'sacramental_tables',4,'checked_registry_rows',v_total,
  'normalization_collisions',0,'missing_registry_references',0,
  'decree_uniqueness_index_valid',true,'decree_collisions',0,
  'decree_dates_missing',0
 )::text,true);
END $qa$;
SELECT current_setting('qa187.readonly')::jsonb AS qa_results;
ROLLBACK;