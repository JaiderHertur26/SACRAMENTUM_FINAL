-- V200 · Regression for four PostgreSQL UNIQUE indexes normalizing numeric registry locations.
-- Uses two existing but distinct parishes; all inserted records are fictitious and ROLLBACK.
BEGIN;
SET LOCAL statement_timeout='35000ms';
DO $init$
DECLARE par1 uuid;par2 uuid;
BEGIN
 SELECT id INTO STRICT par1 FROM public.parishes ORDER BY id LIMIT 1;
 SELECT id INTO STRICT par2 FROM public.parishes WHERE id<>par1 ORDER BY id LIMIT 1;
 PERFORM set_config('qa200.p1',par1::text,true);
 PERFORM set_config('qa200.p2',par2::text,true);
END $init$;
DO $qa$
DECLARE kind text;tbl text;p1 uuid:=current_setting('qa200.p1')::uuid;
p2 uuid:=current_setting('qa200.p2')::uuid;
blocked integer:=0;allowed_other_parish integer:=0;allowed_other_booktype integer:=0;created integer:=0;
error_text text;count_this integer;
BEGIN
 FOREACH kind IN ARRAY ARRAY['baptisms','confirmations','marriages','funerals']
 LOOP
  tbl:=kind;
  IF kind='marriages' OR kind='funerals' THEN
   EXECUTE format('INSERT INTO public.%I(parish_id,book_type,book_number,folio,number,status,raw_data) VALUES ($1,''ordinario'',''009877'',''00442'',''00888'',''seated'',''{"qa_v200":true,"historicalEntryMode":"narrative","literalTranscription":"PARTIDA FICTICIA V200"}''::jsonb)',tbl) USING p1;
  ELSE
   EXECUTE format('INSERT INTO public.%I(parish_id,book_number,folio,number,status,raw_data) VALUES ($1,''009877'',''00442'',''00888'',''seated'',''{"qa_v200":true,"historicalEntryMode":"narrative","literalTranscription":"PARTIDA FICTICIA V200"}''::jsonb)',tbl) USING p1;
  END IF;
  created:=created+1;
  BEGIN
   IF kind='marriages' OR kind='funerals' THEN
    EXECUTE format('INSERT INTO public.%I(parish_id,book_type,book_number,folio,number,status,raw_data) VALUES ($1,''ordinario'',''9877'',''442'',''888'',''seated'',''{"qa_v200":true,"historicalEntryMode":"narrative","literalTranscription":"PARTIDA FICTICIA V200"}''::jsonb)',tbl) USING p1;
   ELSE
    EXECUTE format('INSERT INTO public.%I(parish_id,book_number,folio,number,status,raw_data) VALUES ($1,''9877'',''442'',''888'',''seated'',''{"qa_v200":true,"historicalEntryMode":"narrative","literalTranscription":"PARTIDA FICTICIA V200"}''::jsonb)',tbl) USING p1;
   END IF;
   RAISE EXCEPTION 'V200 INVALID ALLOWED DUPLICATE %',kind;
  EXCEPTION WHEN unique_violation THEN
   GET STACKED DIAGNOSTICS error_text=CONSTRAINT_NAME;
   IF error_text<>('uq_'||kind||'_numeric_location_v200') THEN
    RAISE EXCEPTION 'Unexpected index for %: %',kind,error_text;
   END IF;
   blocked:=blocked+1;
  END;
  -- Identical book, folio and number in a different parish must not collide.
  IF kind='marriages' OR kind='funerals' THEN
   EXECUTE format('INSERT INTO public.%I(parish_id,book_type,book_number,folio,number,status,raw_data) VALUES ($1,''ordinario'',''9877'',''442'',''888'',''seated'',''{"qa_v200":true,"historicalEntryMode":"narrative","literalTranscription":"PARTIDA FICTICIA V200"}''::jsonb)',tbl) USING p2;
  ELSE
   EXECUTE format('INSERT INTO public.%I(parish_id,book_number,folio,number,status,raw_data) VALUES ($1,''9877'',''442'',''888'',''seated'',''{"qa_v200":true,"historicalEntryMode":"narrative","literalTranscription":"PARTIDA FICTICIA V200"}''::jsonb)',tbl) USING p2;
  END IF;
  allowed_other_parish:=allowed_other_parish+1;
  IF kind='marriages' OR kind='funerals' THEN
   EXECUTE format('INSERT INTO public.%I(parish_id,book_type,book_number,folio,number,status,raw_data) VALUES ($1,''suplementario'',''9877'',''442'',''888'',''seated'',''{"qa_v200":true,"historicalEntryMode":"narrative","literalTranscription":"PARTIDA FICTICIA V200"}''::jsonb)',tbl) USING p1;
   allowed_other_booktype:=allowed_other_booktype+1;
  END IF;
 END LOOP;
 IF blocked<>4 OR allowed_other_parish<>4 OR allowed_other_booktype<>2 OR created<>4 THEN
 RAISE EXCEPTION 'V200 incomplete matrix: %/%/%/%',blocked,allowed_other_parish,allowed_other_booktype,created;END IF;
 PERFORM set_config('qa200.result',jsonb_build_object('numeric_equivalent_duplicates_rejected',blocked,
 'different_parish_same_location_allowed',allowed_other_parish,
 'different_booktype_same_location_allowed',allowed_other_booktype,
 'original_numbering_untouched',true,'rollback',true)::text,true);
END $qa$;
SELECT current_setting('qa200.result')::jsonb AS findings;
ROLLBACK;
