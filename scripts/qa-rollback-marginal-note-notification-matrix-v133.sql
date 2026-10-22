-- V133 · Roles sobre notas marginales y acuses oficiales, todo ROLLBACK.
BEGIN;
DO $qa$
DECLARE
 v_parish uuid;v_diocese uuid;v_marriage uuid;v_notice uuid;v_role text;v_actor uuid;
 v_note uuid;v_allowed int:=0;v_denied int:=0;v_read int:=0;v_archived int:=0;
 v_note_count int;v_status text;v_read_at timestamptz;
BEGIN
 SELECT u.parish_id,u.diocese_id INTO STRICT v_parish,v_diocese FROM public.user_profiles u
 WHERE u.role='parish' AND u.is_active LIMIT 1;
 INSERT INTO public.marriages(parish_id,status,celebration_date,book_number,folio,number,raw_data)
 VALUES(v_parish,'seated',DATE '2018-01-05','QA133','991','991','{"qaOnly":true}'::jsonb)
 RETURNING id INTO v_marriage;
 INSERT INTO public.official_notifications(diocese_id,receiver_parish_id,category,subject,message,status,payload)
 VALUES(v_diocese,v_parish,'decree','QA-V133-MATRIZ','Comunicación ficticia; no constata recepción real','pending','{"qaOnly":true}'::jsonb)
 RETURNING id INTO v_notice;
 FOREACH v_role IN ARRAY ARRAY['admin_general','diocese','chancery','parish'] LOOP
  SELECT auth_user_id INTO STRICT v_actor FROM public.user_profiles u
  WHERE u.role=v_role AND u.is_active AND
    (v_role='admin_general' OR u.diocese_id=v_diocese) AND
    (v_role<>'parish' OR u.parish_id=v_parish) LIMIT 1;
  PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  IF v_role IN ('parish','chancery') THEN
    SELECT public.create_manual_marginal_note(v_parish,'matrimonio',v_marriage,
     'QA V133: anotación ficticia autorizada a la autoridad custodial') INTO v_note;
    IF v_note IS NULL THEN RAISE EXCEPTION 'V133: nota autorizada no creada'; END IF;
    v_allowed:=v_allowed+1;
  ELSE
    BEGIN
      PERFORM public.create_manual_marginal_note(v_parish,'matrimonio',v_marriage,
       'QA V133: anotación ficticia que no se debe permitir');
      RAISE EXCEPTION 'V133-FAIL rol % creó nota sin competencia',v_role;
    EXCEPTION WHEN insufficient_privilege THEN v_denied:=v_denied+1;
    END;
  END IF;

  IF v_role='parish' THEN
    PERFORM public.mark_official_notification_read(v_notice);
    v_read:=v_read+1;
  ELSE
    BEGIN
      PERFORM public.mark_official_notification_read(v_notice);
      RAISE EXCEPTION 'V133-FAIL rol % creó acuse de lectura parroquial',v_role;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM LIKE 'V133-FAIL%' THEN RAISE; END IF;
      IF SQLERRM NOT LIKE '%No autorizado%' THEN RAISE; END IF;
      v_denied:=v_denied+1;
    END;
  END IF;

  IF v_role='parish' THEN
    PERFORM public.archive_official_notification(v_notice);
    v_archived:=v_archived+1;
  ELSE
    BEGIN
      PERFORM public.archive_official_notification(v_notice);
      RAISE EXCEPTION 'V133-FAIL rol % archivó notificación parroquial',v_role;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM LIKE 'V133-FAIL%' THEN RAISE; END IF;
      IF SQLERRM NOT LIKE '%Sólo la parroquia destinataria%' THEN RAISE; END IF;
      v_denied:=v_denied+1;
    END;
  END IF;
  EXECUTE 'RESET ROLE';
 END LOOP;

 SELECT count(*) INTO v_note_count FROM public.marginal_notes
  WHERE sacrament_id=v_marriage AND content LIKE 'QA V133:%';
 SELECT status,read_at INTO v_status,v_read_at FROM public.official_notifications WHERE id=v_notice;
 IF v_note_count<>2 OR v_status<>'archived' OR v_read_at IS NULL
 OR v_allowed<>2 OR v_denied<>8 OR v_read<>1 OR v_archived<>1 THEN
  RAISE EXCEPTION 'V133 matrix mismatch: notes %,status %,roles allowed %, denied %, read %, archived %',
  v_note_count,v_status,v_allowed,v_denied,v_read,v_archived;
 END IF;
END $qa$;
ROLLBACK;