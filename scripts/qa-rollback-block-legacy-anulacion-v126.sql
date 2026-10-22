-- V126 · Los cuatro puntos de entrada legacy deben rechazar ANULACION antes de escribir.
-- Se lee un lote real SOLO para verificar que las defensas lo rechazan; ROLLBACK.
BEGIN;
DO $qa$
DECLARE
 v_batch uuid;v_actor uuid;v_status text;v_status_after text;
 v_before integer;v_after integer;v_denied integer:=0;v_name text;
BEGIN
 SELECT b.id,u.auth_user_id,b.status INTO STRICT v_batch,v_actor,v_status
 FROM public.legacy_import_batches b
 JOIN public.user_profiles u ON u.parish_id=b.parish_id
 WHERE upper(b.profile_key)='ANULACION' AND u.role='parish' AND u.is_active
 ORDER BY b.id LIMIT 1;
 SELECT count(*) INTO v_before FROM public.legacy_import_rows
 WHERE batch_id=v_batch AND status='valid';
 IF v_before<1 THEN RAISE EXCEPTION 'V126: el lote de prueba no tiene filas pendientes'; END IF;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 FOREACH v_name IN ARRAY ARRAY[
  'apply_legacy_import_batch',
  'apply_legacy_import_batch_v2',
  'apply_legacy_import_batch_v3',
  'reconcile_legacy_anulacion_batch'
 ] LOOP
  BEGIN
    CASE v_name
    WHEN 'apply_legacy_import_batch' THEN PERFORM public.apply_legacy_import_batch(v_batch,1);
    WHEN 'apply_legacy_import_batch_v2' THEN PERFORM public.apply_legacy_import_batch_v2(v_batch,1);
    WHEN 'apply_legacy_import_batch_v3' THEN PERFORM public.apply_legacy_import_batch_v3(v_batch,1);
    WHEN 'reconcile_legacy_anulacion_batch' THEN PERFORM public.reconcile_legacy_anulacion_batch(v_batch,1);
    END CASE;
    RAISE EXCEPTION 'V126 FAIL: legado ANULACION ejecutable en %',v_name;
  EXCEPTION WHEN insufficient_privilege THEN
    IF position('Cancillería' in SQLERRM)=0 THEN
      RAISE EXCEPTION 'V126 FAIL: respuesta incorrecta de bloqueo %: %',v_name,SQLERRM;
    END IF;
    v_denied:=v_denied+1;
  END;
 END LOOP;
 EXECUTE 'RESET ROLE';
 SELECT status INTO STRICT v_status_after FROM public.legacy_import_batches WHERE id=v_batch;
 SELECT count(*) INTO v_after FROM public.legacy_import_rows
 WHERE batch_id=v_batch AND status='valid';
 IF v_denied<>4 OR v_status_after IS DISTINCT FROM v_status OR v_after<>v_before THEN
  RAISE EXCEPTION 'V126 FAIL: alteró lote o filas. Denegaciones %, antes %, después %',v_denied,v_before,v_after;
 END IF;
END $qa$;
ROLLBACK;