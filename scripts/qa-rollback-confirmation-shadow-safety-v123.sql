-- V123: laboratorio negativo. La prueba reprodujo la eliminación indebida ANTES del arreglo;
-- DESPUÉS de corregir, verifica que una Confirmación vigente permanezca. ROLLBACK siempre.
BEGIN;
DO $qa$
DECLARE
  v_dio uuid;v_diocesan uuid;v_shadow uuid;v_correct uuid;
  v_original uuid;v_twin uuid;v_result jsonb;v_removed int;
BEGIN
  SELECT diocese_id,auth_user_id INTO STRICT v_dio,v_diocesan
  FROM public.user_profiles WHERE role='diocese' AND is_active LIMIT 1;
  SELECT id INTO STRICT v_shadow FROM public.parishes WHERE diocese_id=v_dio ORDER BY is_operational, id LIMIT 1;
  SELECT id INTO STRICT v_correct FROM public.parishes WHERE diocese_id=v_dio AND id<>v_shadow ORDER BY id LIMIT 1;
  INSERT INTO public.confirmations(parish_id,celebration_date,book_number,folio,number,nombres,apellidos,status,raw_data)
  VALUES(v_shadow,'2015-06-15','QA23','0001','0001','PRUEBA','VIGENTE','seated',
    '{"qaOnly":true,"source_parish_name":"QA-V123-SOURCE","source":"manual"}'::jsonb)
  RETURNING id INTO v_original;
  INSERT INTO public.confirmations(parish_id,celebration_date,book_number,folio,number,nombres,apellidos,status,raw_data)
  VALUES(v_correct,'2015-06-15','QA23','0001','0001','PRUEBA','VIGENTE','seated',
    '{"qaOnly":true,"source_parish_name":"QA-V123-SOURCE","source":"legacy_import"}'::jsonb)
  RETURNING id INTO v_twin;
  PERFORM set_config('request.jwt.claim.sub',v_diocesan::text,true);
  SELECT public.reconcile_legacy_confirmation_shadows_v74(v_shadow,v_correct,'QA-V123-SOURCE')
  INTO v_result;
  v_removed:=coalesce((v_result->>'removed_shadows')::integer,-1);
  IF v_removed<>0 OR NOT EXISTS(SELECT 1 FROM public.confirmations WHERE id=v_original) THEN
    RAISE EXCEPTION 'QA-V123-CONFIRMED-UNSAFE-DELETION: active manual row removed (% removed)',v_removed;
  END IF;
END $qa$;
ROLLBACK;