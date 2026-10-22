-- V123 · Matriz positiva/negativa de limpieza de Confirmaciones.
-- Datos inventados; prueba con ROLLBACK, sin alterar asientos auténticos.
BEGIN;
DO $qa$
DECLARE
 v_dio uuid;v_diocese_user uuid;v_shadow uuid;v_correct uuid;
 v_manual uuid;v_import_active uuid;v_import_reversed uuid;v_result jsonb;
 v_removed int;v_before bigint;v_after bigint;
BEGIN
 SELECT diocese_id,auth_user_id INTO STRICT v_dio,v_diocese_user
 FROM public.user_profiles WHERE role='diocese' AND is_active LIMIT 1;
 SELECT id INTO STRICT v_shadow FROM public.parishes
 WHERE diocese_id=v_dio ORDER BY is_operational,id LIMIT 1;
 SELECT id INTO STRICT v_correct FROM public.parishes
 WHERE diocese_id=v_dio AND id<>v_shadow ORDER BY id LIMIT 1;

 INSERT INTO public.confirmations(parish_id,celebration_date,book_number,folio,number,nombres,apellidos,status,raw_data)
 VALUES(v_shadow,'2015-06-15','QA23','0101','0001','QA','MANUAL','seated',
 '{"qaOnly":true,"source_parish_name":"QA-V123-ARCHIVO","source":"manual"}'::jsonb)
 RETURNING id INTO v_manual;
 INSERT INTO public.confirmations(parish_id,celebration_date,book_number,folio,number,nombres,apellidos,status,raw_data)
 VALUES(v_correct,'2015-06-15','QA23','0101','0001','QA','MANUAL','seated','{"qaOnly":true}'::jsonb);

 INSERT INTO public.confirmations(parish_id,celebration_date,book_number,folio,number,nombres,apellidos,status,raw_data)
 VALUES(v_shadow,'2015-06-15','QA23','0101','0002','QA','ACTIVA','seated',
 '{"qaOnly":true,"source_parish_name":"QA-V123-ARCHIVO","source":"legacy_import"}'::jsonb)
 RETURNING id INTO v_import_active;
 INSERT INTO public.confirmations(parish_id,celebration_date,book_number,folio,number,nombres,apellidos,status,raw_data)
 VALUES(v_correct,'2015-06-15','QA23','0101','0002','QA','ACTIVA','seated','{"qaOnly":true}'::jsonb);

 INSERT INTO public.confirmations(parish_id,celebration_date,book_number,folio,number,nombres,apellidos,status,raw_data)
 VALUES(v_shadow,'2015-06-15','QA23','0101','0003','QA','REVERSADA','reverted',
 '{"qaOnly":true,"source_parish_name":"QA-V123-ARCHIVO","source":"legacy_import"}'::jsonb)
 RETURNING id INTO v_import_reversed;
 INSERT INTO public.confirmations(parish_id,celebration_date,book_number,folio,number,nombres,apellidos,status,raw_data)
 VALUES(v_correct,'2015-06-15','QA23','0101','0003','QA','REVERSADA','seated','{"qaOnly":true}'::jsonb);

 SELECT count(*) INTO v_before FROM public.confirmations WHERE parish_id=v_shadow;
 PERFORM set_config('request.jwt.claim.sub',v_diocese_user::text,true);
 SELECT public.reconcile_legacy_confirmation_shadows_v74(v_shadow,v_correct,'QA-V123-ARCHIVO') INTO STRICT v_result;
 v_removed:=coalesce((v_result->>'removed_shadows')::integer,-1);

 IF v_removed<>1 OR
    NOT EXISTS(SELECT 1 FROM public.confirmations WHERE id=v_manual) OR
    NOT EXISTS(SELECT 1 FROM public.confirmations WHERE id=v_import_active) OR
    EXISTS(SELECT 1 FROM public.confirmations WHERE id=v_import_reversed) THEN
    RAISE EXCEPTION 'V123 FAILED: active vs imported reversed separation: %',v_result;
 END IF;
 SELECT count(*) INTO v_after FROM public.confirmations WHERE parish_id=v_shadow;
 IF v_before-v_after<>1 THEN RAISE EXCEPTION 'V123 unexpected number of deletions'; END IF;

 SELECT public.reconcile_legacy_confirmation_shadows_v74(v_shadow,v_correct,'QA-V123-ARCHIVO') INTO STRICT v_result;
 IF coalesce((v_result->>'removed_shadows')::integer,-1)<>0 THEN
   RAISE EXCEPTION 'V123 repeat execution removed another row';
 END IF;

 BEGIN
   PERFORM public.reconcile_legacy_confirmation_shadows_v74(v_shadow,v_correct,'%');
   RAISE EXCEPTION 'V123 wildcard pattern accepted';
 EXCEPTION WHEN others THEN
   IF SQLERRM='V123 wildcard pattern accepted' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%comodines%' THEN RAISE; END IF;
 END;

 BEGIN
   PERFORM public.reconcile_legacy_confirmation_shadows_v74(v_shadow,v_correct,'QA_23');
   RAISE EXCEPTION 'V123 underscore wildcard accepted';
 EXCEPTION WHEN others THEN
   IF SQLERRM='V123 underscore wildcard accepted' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%comodines%' THEN RAISE; END IF;
 END;
END $qa$;
ROLLBACK;