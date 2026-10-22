-- V125 · Parroquia explícita: acceso propio, denegación ajena y restricción de rol.
BEGIN;
DO $qa$
DECLARE
 v_actor uuid;v_own uuid;v_dio uuid;v_other uuid;v_other_dio uuid;
 v_admin uuid;v_chancery uuid;v_own_row uuid;v_other_row uuid;
 v_result jsonb;v_owned_before jsonb;v_owned_after jsonb;v_foreign_before jsonb;v_foreign_after jsonb;
 v_denied integer:=0;
BEGIN
 SELECT auth_user_id,parish_id,diocese_id INTO STRICT v_actor,v_own,v_dio
 FROM public.user_profiles WHERE role='parish' AND is_active LIMIT 1;
 SELECT id,diocese_id INTO STRICT v_other,v_other_dio FROM public.parishes
 WHERE id<>v_own ORDER BY id LIMIT 1;
 SELECT auth_user_id INTO STRICT v_admin FROM public.user_profiles
 WHERE role='admin_general' AND is_active LIMIT 1;
 SELECT auth_user_id INTO STRICT v_chancery FROM public.user_profiles
 WHERE role='chancery' AND is_active AND diocese_id=v_dio LIMIT 1;
 INSERT INTO public.legacy_marginal_note_queue(
  parish_id,diocese_id,profile_key,source_sha256,source_key,book_number,folio,number,content,status,original_data,metadata
 )VALUES
 (v_own,v_dio,'NTMAT',repeat('a',64),'QA-V125-OWN-'||substr(gen_random_uuid()::text,1,8),
 'QA-V125','9992','9992','NOTA PROPIA FICTICIA','pending','{"qaOnly":true}'::jsonb,'{"qaOnly":true}'::jsonb),
 (v_other,v_other_dio,'NTMAT',repeat('b',64),'QA-V125-OTHER-'||substr(gen_random_uuid()::text,1,8),
 'QA-V125','9993','9993','NOTA AJENA FICTICIA','pending','{"qaOnly":true}'::jsonb,'{"qaOnly":true}'::jsonb);
 SELECT id,metadata INTO STRICT v_own_row,v_owned_before
 FROM public.legacy_marginal_note_queue WHERE parish_id=v_own AND original_data->>'qaOnly'='true';
 SELECT id,metadata INTO STRICT v_other_row,v_foreign_before
 FROM public.legacy_marginal_note_queue WHERE parish_id=v_other AND original_data->>'qaOnly'='true';
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 SELECT public.reconcile_legacy_matrimonial_notes(v_own) INTO STRICT v_result;
 EXECUTE 'RESET ROLE';
 SELECT metadata INTO STRICT v_owned_after FROM public.legacy_marginal_note_queue WHERE id=v_own_row;
 SELECT metadata INTO STRICT v_foreign_after FROM public.legacy_marginal_note_queue WHERE id=v_other_row;
 IF v_owned_after IS NOT DISTINCT FROM v_owned_before OR v_foreign_after IS DISTINCT FROM v_foreign_before THEN
   RAISE EXCEPTION 'V125: debería conciliar solamente su propia parroquia';
 END IF;
 FOREACH v_actor IN ARRAY ARRAY[
   (SELECT auth_user_id FROM public.user_profiles WHERE role='parish' AND parish_id=v_own AND is_active LIMIT 1),
   v_admin,v_chancery
 ] LOOP
  PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.reconcile_legacy_matrimonial_notes(v_other);
    RAISE EXCEPTION 'V125-FAIL: una sesión no autorizada actualizó una parroquia ajena';
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied:=v_denied+1;
  END;
  EXECUTE 'RESET ROLE';
 END LOOP;
 IF v_denied<>3 THEN RAISE EXCEPTION 'V125: faltan denegaciones de rol %',v_denied; END IF;
 SELECT metadata INTO STRICT v_foreign_after FROM public.legacy_marginal_note_queue WHERE id=v_other_row;
 IF v_foreign_after IS DISTINCT FROM v_foreign_before THEN
  RAISE EXCEPTION 'V125: fila ajena modificada a pesar de rechazo';
 END IF;
END $qa$;
ROLLBACK;