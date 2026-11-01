-- Solo para el esquema ficticio aislado: prueba los materializadores vigentes.
BEGIN;
DO $qa$
DECLARE
  d uuid:=gen_random_uuid(); pa uuid:=gen_random_uuid();pb uuid:=gen_random_uuid();
  ua uuid:=gen_random_uuid();ub uuid:=gen_random_uuid();batch uuid; owner_id uuid;actor uuid;
  profile text; table_name text;origin_column text; normalized jsonb; n integer; total integer:=0;
BEGIN
  INSERT INTO public.dioceses(id,name) VALUES(d,'QA IMPORTACIÓN COMÚN');
  INSERT INTO public.parishes(id,name,diocese_id) VALUES(pa,'QA IMPORTACIÓN A',d),(pb,'QA IMPORTACIÓN B',d);
  INSERT INTO auth.users(id,aud,role,is_anonymous) VALUES(ua,'authenticated','authenticated',false),(ub,'authenticated','authenticated',false);
  INSERT INTO public.user_profiles(auth_user_id,parish_id,diocese_id,role,is_active,status)
    VALUES(ua,pa,d,'parish',true,'ACTIVE'),(ub,pb,d,'parish',true,'ACTIVE');
  FOREACH owner_id IN ARRAY ARRAY[pa,pb] LOOP
    actor:=CASE WHEN owner_id=pa THEN ua ELSE ub END;
    PERFORM set_config('request.jwt.claim.sub',actor::text,true);
    FOREACH profile IN ARRAY ARRAY['DIOCESIS','IGLESIAS','CIUDADES','OBISPOS'] LOOP
      batch:=gen_random_uuid();
      normalized:=CASE profile
        WHEN 'DIOCESIS' THEN '{"legacy_code":"QA323","name":"QA DIÓCESIS COMÚN","city":"QA"}'::jsonb
        WHEN 'IGLESIAS' THEN '{"legacy_code":"QA323","name":"QA IGLESIA COMÚN","city":"QA"}'::jsonb
        WHEN 'CIUDADES' THEN '{"value":"QA CIUDAD COMÚN","usage_count":"2","weight":"3"}'::jsonb
        ELSE '{"nombre":"QA OBISPO COMÚN","apellido":"QA"}'::jsonb END;
      INSERT INTO public.legacy_import_batches(id,parish_id,diocese_id,profile_key,sha256,original_filename)
        VALUES(batch,owner_id,d,profile,repeat('a',64),'QA_V323.dbf');
      INSERT INTO public.legacy_import_rows(batch_id,status,row_number,normalized_data) VALUES(batch,'imported',1,normalized);
      IF profile='DIOCESIS' THEN PERFORM public.materialize_diocesis_catalog_batch(batch);
      ELSE PERFORM public.materialize_auxiliary_catalog_batch(batch); END IF;
      total:=total+1;
    END LOOP;
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['diocesis','iglesias','ciudades','obispos'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE diocese_id=$1',table_name) INTO n USING d;
    IF n<>1 THEN RAISE EXCEPTION 'La segunda importación duplicó % (filas=%)',table_name,n; END IF;
    origin_column:=CASE WHEN table_name='ciudades' THEN 'context_id' ELSE 'parish_id' END;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE diocese_id=$1 AND %I=$2',table_name,origin_column) INTO n USING d,pa;
    IF n<>1 THEN RAISE EXCEPTION 'Se alteró la procedencia de %',table_name; END IF;
  END LOOP;
  PERFORM set_config('qa323.imports',jsonb_build_object('materializations',total,'unique_shared_rows',4,'provenance_preserved',true,'rollback',true)::text,true);
END $qa$;
SELECT current_setting('qa323.imports')::jsonb AS import_result;
ROLLBACK;
