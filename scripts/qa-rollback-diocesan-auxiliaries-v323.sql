-- Ensayo real de permisos: dos parroquias comparten; otra diócesis queda aislada.
BEGIN;
SET LOCAL statement_timeout='60000ms';
DO $qa$
DECLARE
  d1 uuid:=gen_random_uuid(); d2 uuid:=gen_random_uuid();
  v1 uuid:=gen_random_uuid(); v2 uuid:=gen_random_uuid();
  pa uuid:=gen_random_uuid(); pb uuid:=gen_random_uuid(); pc uuid:=gen_random_uuid();
  ua uuid:=gen_random_uuid(); ub uuid:=gen_random_uuid(); uc uuid:=gen_random_uuid();
  ids uuid[]:=ARRAY[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
  tables text[]:=ARRAY['diocesis','iglesias','obispos','bishop_tenures','ciudades'];
  foreign_bishop uuid:=gen_random_uuid(); key_text text:='QA V323 '||gen_random_uuid()::text;
  i integer; n integer; blocked boolean; checks integer:=0; resolved jsonb;
BEGIN
  INSERT INTO public.dioceses(id,name) VALUES(d1,'QA V323 DIÓCESIS A'),(d2,'QA V323 DIÓCESIS EXTERNA');
  INSERT INTO public.vicarias(id,name,diocese_id) VALUES(v1,'QA V323 VICARÍA A',d1),(v2,'QA V323 VICARÍA EXTERNA',d2);
  INSERT INTO public.parishes(id,name,diocese_id,vicary_id,is_operational)
    VALUES(pa,'QA V323 PARROQUIA A',d1,v1,true),(pb,'QA V323 PARROQUIA B',d1,v1,true),(pc,'QA V323 PARROQUIA C',d2,v2,true);
  INSERT INTO auth.users(id,aud,role,is_anonymous,email) VALUES
    (ua,'authenticated','authenticated',false,ua::text||'@example.invalid'),
    (ub,'authenticated','authenticated',false,ub::text||'@example.invalid'),
    (uc,'authenticated','authenticated',false,uc::text||'@example.invalid');
  INSERT INTO public.user_profiles(auth_user_id,parish_id,diocese_id,role,is_active,status)
    VALUES(ua,pa,d1,'parish',true,'ACTIVE'),(ub,pb,d1,'parish',true,'ACTIVE'),(uc,pc,d2,'parish',true,'ACTIVE');
  INSERT INTO public.parrocos(parish_id,nombre,apellido,fecha_ingreso)
    VALUES(pa,'QA V323 PÁRROCO A','PRIVADO',current_date),(pb,'QA V323 PÁRROCO B','PRIVADO',current_date);
  INSERT INTO public.mis_datos(entity_id,nombre) VALUES(pa,'QA V323 MEMBRETE A'),(pb,'QA V323 MEMBRETE B');

  PERFORM set_config('request.jwt.claim.sub',ua::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.diocesis(id,parish_id,nombre,codigo) VALUES(ids[1],pa,key_text,'QA323');
  INSERT INTO public.iglesias(id,parish_id,nombre,codigo) VALUES(ids[2],pa,key_text,key_text);
  INSERT INTO public.obispos(id,parish_id,nombre,apellido) VALUES(ids[3],pa,key_text,'OBISPO');
  INSERT INTO public.bishop_tenures(id,parish_id,bishop_id,bishop_name,start_date,end_date)
    VALUES(ids[4],pa,ids[3],key_text,'1300-01-01','1301-01-01');
  INSERT INTO public.ciudades(id,context_id,nombre) VALUES(ids[5],pa,key_text);
  checks:=checks+5;

  -- La segunda parroquia ve y edita las cinco filas de la primera.
  PERFORM set_config('request.jwt.claim.sub',ub::text,true);
  FOR i IN 1..5 LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id=$1',tables[i]) INTO n USING ids[i];
    IF n<>1 THEN RAISE EXCEPTION 'B no ve el catálogo %',tables[i]; END IF;
    EXECUTE format('UPDATE public.%I SET %I=$1 WHERE id=$2',tables[i],
      CASE WHEN i=4 THEN 'notes' WHEN i=5 THEN 'source' ELSE 'nombre' END)
      USING key_text||' EDITADO POR B',ids[i];
    GET DIAGNOSTICS n=ROW_COUNT;
    IF n<>1 THEN RAISE EXCEPTION 'B no pudo actualizar %',tables[i]; END IF;
    checks:=checks+2;
  END LOOP;
  resolved:=public.sacramentum_bishop_at_date(pb,'1300-06-01');
  IF resolved->>'id' IS DISTINCT FROM ids[4]::text THEN RAISE EXCEPTION 'El motor episcopal no comparte por diócesis'; END IF;
  checks:=checks+1;

  SELECT count(*) INTO n FROM public.parrocos WHERE parish_id=pa;
  IF n<>0 THEN RAISE EXCEPTION 'Párrocos privados de A visibles desde B'; END IF;
  SELECT count(*) INTO n FROM public.mis_datos WHERE entity_id=pa;
  IF n<>0 THEN RAISE EXCEPTION 'Mis Datos privados de A visibles desde B'; END IF;
  SELECT count(*) INTO n FROM public.parrocos WHERE parish_id=pb;
  IF n<>1 THEN RAISE EXCEPTION 'B perdió sus propios párrocos'; END IF;
  SELECT count(*) INTO n FROM public.mis_datos WHERE entity_id=pb;
  IF n<>1 THEN RAISE EXCEPTION 'B perdió sus propios datos'; END IF;
  checks:=checks+4;

  blocked:=false;
  BEGIN INSERT INTO public.ciudades(context_id,nombre) VALUES(pb,lower(key_text));
    EXCEPTION WHEN unique_violation THEN blocked:=true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Ciudad duplicada permitida entre parroquias de una diócesis'; END IF;
  checks:=checks+1;
  blocked:=false;
  BEGIN INSERT INTO public.iglesias(parish_id,codigo,nombre) VALUES(pb,lower(key_text),'OTRO NOMBRE');
    EXCEPTION WHEN unique_violation THEN blocked:=true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Código de iglesia duplicado en catálogo común'; END IF;
  checks:=checks+1;
  blocked:=false;
  BEGIN INSERT INTO public.obispos(parish_id,nombre,apellido) VALUES(pb,key_text||' EDITADO POR B','OBISPO');
    EXCEPTION WHEN unique_violation THEN blocked:=true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Obispo duplicado permitido entre parroquias'; END IF;
  checks:=checks+1;
  blocked:=false;
  BEGIN INSERT INTO public.bishop_tenures(parish_id,bishop_name,start_date,end_date)
    VALUES(pb,'QA SOLAPADO','1300-06-01','1302-01-01');
    EXCEPTION WHEN raise_exception THEN blocked:=position('Ya existe un Obispo titular' IN SQLERRM)>0; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Período episcopal solapado entre parroquias'; END IF;
  checks:=checks+1;

  blocked:=false;
  BEGIN UPDATE public.ciudades SET diocese_id=d2 WHERE id=ids[5];
    EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Se permitió trasladar una fila a otra diócesis'; END IF;
  checks:=checks+1;
  blocked:=false;
  BEGIN UPDATE public.diocesis SET parish_id=pb WHERE id=ids[1];
    EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Se permitió falsificar la procedencia parroquial'; END IF;
  checks:=checks+1;
  blocked:=false;
  BEGIN INSERT INTO public.ciudades(context_id,nombre,diocese_id) VALUES(pb,'QA FORJADO',d2);
    EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Se aceptó diócesis forjada'; END IF;
  checks:=checks+1;

  -- La tercera cuenta, de otra diócesis, no puede leer ni modificar las filas.
  PERFORM set_config('request.jwt.claim.sub',uc::text,true);
  FOR i IN 1..5 LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id=$1',tables[i]) INTO n USING ids[i];
    IF n<>0 THEN RAISE EXCEPTION 'Otra diócesis pudo leer %',tables[i]; END IF;
    EXECUTE format('UPDATE public.%I SET updated_at=now() WHERE id=$1',tables[i]) USING ids[i];
    GET DIAGNOSTICS n=ROW_COUNT;
    IF n<>0 THEN RAISE EXCEPTION 'Otra diócesis pudo actualizar %',tables[i]; END IF;
    EXECUTE format('DELETE FROM public.%I WHERE id=$1',tables[i]) USING ids[i];
    GET DIAGNOSTICS n=ROW_COUNT;
    IF n<>0 THEN RAISE EXCEPTION 'Otra diócesis pudo eliminar %',tables[i]; END IF;
    checks:=checks+3;
  END LOOP;
  INSERT INTO public.ciudades(context_id,nombre) VALUES(pc,key_text);
  INSERT INTO public.obispos(id,parish_id,nombre,apellido) VALUES(foreign_bishop,pc,key_text,'EXTERNO');
  checks:=checks+2;
  blocked:=false;
  BEGIN INSERT INTO public.ciudades(context_id,nombre) VALUES(pa,'QA CONTEXTO AJENO');
    EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Se permitió insertar en otra diócesis'; END IF;
  checks:=checks+1;
  blocked:=false;
  BEGIN PERFORM public.sacramentum_bishop_at_date(pa,'1300-06-01');
    EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'RPC episcopal reveló información de otra diócesis'; END IF;
  checks:=checks+1;

  PERFORM set_config('request.jwt.claim.sub',ua::text,true);
  blocked:=false;
  BEGIN INSERT INTO public.bishop_tenures(parish_id,bishop_id,bishop_name,start_date,end_date)
    VALUES(pa,foreign_bishop,'QA OBISPO AJENO','1700-01-01','1701-01-01');
    EXCEPTION WHEN check_violation THEN blocked:=true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Período vinculado a un Obispo de otra diócesis'; END IF;
  checks:=checks+1;

  EXECUTE 'RESET ROLE';
  UPDATE public.user_profiles SET status='SUSPENDED' WHERE auth_user_id=ub;
  PERFORM set_config('request.jwt.claim.sub',ub::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.ciudades WHERE id=ids[5];
  IF n<>0 THEN RAISE EXCEPTION 'Cuenta suspendida conservó acceso'; END IF;
  checks:=checks+1;
  EXECUTE 'RESET ROLE';
  UPDATE public.user_profiles SET status='ACTIVE' WHERE auth_user_id=ub;
  EXECUTE 'SET LOCAL ROLE authenticated';
  -- B también puede borrar las filas compartidas creadas por A.
  FOR i IN REVERSE 5..1 LOOP
    EXECUTE format('DELETE FROM public.%I WHERE id=$1',tables[i]) USING ids[i];
    GET DIAGNOSTICS n=ROW_COUNT;
    IF n<>1 THEN RAISE EXCEPTION 'B no pudo borrar la fila compartida de %',tables[i]; END IF;
    checks:=checks+1;
  END LOOP;
  EXECUTE 'RESET ROLE';
  IF has_function_privilege('anon','sacramentum_private.auxiliary_diocese_id_v323()','EXECUTE') THEN
    RAISE EXCEPTION 'Helper privado accesible anónimamente';
  END IF;
  checks:=checks+1;
  PERFORM set_config('qa323.result',jsonb_build_object('checks',checks,'shared_catalogs',5,
    'parishes',3,'dioceses',2,'private_sections_preserved',2,'complete',true,'rollback',true)::text,true);
END $qa$;
SELECT current_setting('qa323.result')::jsonb AS test_result;
ROLLBACK;
