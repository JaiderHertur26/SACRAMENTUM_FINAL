-- V125: REPRODUCCIÓN DE ALCANCE GLOBAL INDEBIDO EN RPC NOTAS MATRIMONIALES.
-- El test DEBE fallar antes de corregir la RPC, y pasar después. ROLLBACK.
BEGIN;
DO $qa$
DECLARE
 v_actor uuid;v_own uuid;v_other uuid;v_other_dio uuid;v_row uuid;v_diocese uuid;
 v_before jsonb;v_after jsonb;v_out jsonb;
BEGIN
 SELECT auth_user_id,parish_id,diocese_id INTO STRICT v_actor,v_own,v_diocese
 FROM public.user_profiles WHERE role='parish' AND is_active LIMIT 1;
 SELECT id,diocese_id INTO STRICT v_other,v_other_dio FROM public.parishes
 WHERE id<>v_own ORDER BY id LIMIT 1;
 INSERT INTO public.legacy_marginal_note_queue(
  parish_id,diocese_id,profile_key,source_sha256,source_key,book_number,
  folio,number,content,status,original_data,metadata
 )VALUES(
  v_other,v_other_dio,'NTMAT',repeat('9',64),
  'QA-V125-FOREIGN-'||substr(gen_random_uuid()::text,1,8),
  'QA-V125','9991','9991','NOTA AJENA FICTICIA SIN PARTIDA','pending',
  '{"qaOnly":true}'::jsonb,'{"qaOnly":true}'::jsonb
 ) RETURNING id INTO v_row;
 SELECT metadata INTO v_before FROM public.legacy_marginal_note_queue WHERE id=v_row;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 BEGIN
   SELECT public.reconcile_legacy_matrimonial_notes(NULL) INTO v_out;
   RAISE EXCEPTION 'V125-FAIL: un usuario parroquial logró conciliar sin parroquia explícita';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 EXECUTE 'RESET ROLE';
 SELECT metadata INTO v_after FROM public.legacy_marginal_note_queue WHERE id=v_row;
 IF v_after IS DISTINCT FROM v_before THEN
   RAISE EXCEPTION 'V125-CONFIRMED-CROSS-PARISH: parish actor processed foreign note queue';
 END IF;
END $qa$;
ROLLBACK;