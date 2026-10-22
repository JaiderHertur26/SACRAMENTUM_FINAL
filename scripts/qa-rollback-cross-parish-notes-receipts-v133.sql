-- V133 · Aislamiento horizontal de parroquias dentro de una misma Diócesis.
BEGIN;
DO $qa$
DECLARE v_actor uuid;v_owner uuid;v_foreign uuid;v_dio uuid;v_marr uuid;v_note uuid;v_notice uuid;
 v_denied int:=0;v_remaining int;
BEGIN
 SELECT auth_user_id,parish_id,diocese_id INTO STRICT v_actor,v_owner,v_dio
 FROM public.user_profiles WHERE role='parish' AND is_active LIMIT 1;
 INSERT INTO public.parishes(name,diocese_id,is_operational)
 VALUES('QA-V133-PARROQUIA-AJENA',v_dio,false) RETURNING id INTO v_foreign;
 INSERT INTO public.marriages(parish_id,status,celebration_date,book_number,folio,number,raw_data)
 VALUES(v_foreign,'seated',DATE '2019-03-08','QA133','992','992','{"qaOnly":true}'::jsonb)
 RETURNING id INTO v_marr;
 INSERT INTO public.official_notifications(diocese_id,receiver_parish_id,category,subject,message,status,payload)
 VALUES(v_dio,v_foreign,'decree','QA-V133-AVISO-AJENO','Sin acuse autorizado','pending','{"qaOnly":true}'::jsonb)
 RETURNING id INTO v_notice;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 BEGIN
  SELECT public.create_manual_marginal_note(v_foreign,'matrimonio',v_marr,
    'QA V133: parroquia ajena que intenta asentar una nota') INTO v_note;
  RAISE EXCEPTION 'V133-FAIL: parroquia emitió nota en libro ajeno';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'V133-FAIL%' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE '%Fuera de jurisdicción%' AND
     SQLERRM NOT LIKE '%propio archivo%' THEN RAISE; END IF;
  v_denied:=v_denied+1;
 END;
 BEGIN
  PERFORM public.mark_official_notification_read(v_notice);
  RAISE EXCEPTION 'V133-FAIL: parroquia marcó leído ajeno';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'V133-FAIL%' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE '%No autorizado%' THEN RAISE; END IF;
  v_denied:=v_denied+1;
 END;
 BEGIN
  PERFORM public.archive_official_notification(v_notice);
  RAISE EXCEPTION 'V133-FAIL: parroquia archivó ajeno';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'V133-FAIL%' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE '%Sólo la parroquia destinataria%' THEN RAISE; END IF;
  v_denied:=v_denied+1;
 END;
 EXECUTE 'RESET ROLE';
 SELECT count(*) INTO v_remaining FROM public.official_notifications
 WHERE id=v_notice AND status='pending' AND read_at IS NULL;
 IF v_denied<>3 OR v_remaining<>1 OR EXISTS(
  SELECT 1 FROM public.marginal_notes WHERE sacrament_id=v_marr) THEN
  RAISE EXCEPTION 'V133 horizontal scope invalid: % denials, % pending',v_denied,v_remaining;
 END IF;
END $qa$;
ROLLBACK;