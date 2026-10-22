-- V133 · Prueba de acceso indebido al libro marginal desde Administrador General; todo ROLLBACK.
BEGIN;
DO $qa$
DECLARE v_actor uuid;v_parish uuid;v_marriage uuid;
BEGIN
 SELECT auth_user_id INTO STRICT v_actor FROM public.user_profiles WHERE role='admin_general' AND is_active LIMIT 1;
 SELECT id INTO STRICT v_parish FROM public.parishes WHERE is_operational ORDER BY id LIMIT 1;
 INSERT INTO public.marriages(parish_id,status,celebration_date,book_number,folio,number,raw_data)
 VALUES(v_parish,'seated',DATE '2019-02-11','QA-V133','993','993','{"qaOnly":true}'::jsonb) RETURNING id INTO v_marriage;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 BEGIN
  PERFORM public.create_manual_marginal_note(v_parish,'matrimonio',v_marriage,'QA-V133 NOTA NO AUTORIZADA DE ADMINISTRADOR GENERAL');
  RAISE EXCEPTION 'V133-CONFIRMED: admin_general escribió nota sacramental sin autoridad registral';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 EXECUTE 'RESET ROLE';
END $qa$;
ROLLBACK;