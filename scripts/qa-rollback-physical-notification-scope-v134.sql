-- V134 · No certificar documentos con diócesis de origen falsa ni destinatarios archivados.
BEGIN;
DO $qa$
DECLARE v_actor uuid;v_parish uuid;v_diocese uuid;v_foreign uuid;v_doc uuid;v_recipient uuid;
  v_mode text;v_denied int:=0;v_status text;v_note_applied boolean;v_source_diocese uuid;v_expected text;
BEGIN
 SELECT auth_user_id,parish_id,diocese_id INTO STRICT v_actor,v_parish,v_diocese
 FROM public.user_profiles WHERE role='parish' AND is_active LIMIT 1;
 INSERT INTO public.dioceses(name) VALUES('QA-V134-DIOCESIS-AJENA') RETURNING id INTO v_foreign;
 FOREACH v_mode IN ARRAY ARRAY['foreign_diocese','archived_recipient'] LOOP
  v_source_diocese:=CASE WHEN v_mode='foreign_diocese' THEN v_foreign ELSE v_diocese END;
  INSERT INTO public.matrimonial_notifications(
   sender_parish_id,diocese_id,consecutive,document_number,person_name,spouse_name,
   marriage_date,marriage_book,marriage_folio,marriage_number,notification_type,status,payload
  ) VALUES(v_parish,v_source_diocese,
    CASE WHEN v_mode='foreign_diocese' THEN 991151 ELSE 991152 END,
    'QA-V134-'||v_mode||'-'||left(gen_random_uuid()::text,8),
    'PERSONA FICTICIA','CÓNYUGE FICTICIO',DATE '2022-04-08',
    'QA','881','882','matrimonio','sent','{"qaOnly":true}'::jsonb)
   RETURNING id INTO v_doc;
  INSERT INTO public.matrimonial_notification_recipients(
    notification_id,receiver_parish_id,status,note_applied,payload)
  VALUES(v_doc,v_parish,
   CASE WHEN v_mode='archived_recipient' THEN 'archived' ELSE 'pending' END,
   false,'{"manualLocator":{"book":"QA","folio":"881","number":"882"},"marginalNote":"QA V134 NO CERTIFICAR"}'::jsonb)
   RETURNING id INTO v_recipient;
  PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF v_mode='foreign_diocese' THEN
   BEGIN
    PERFORM public.process_manual_matrimonial_notification_physical(v_recipient);
    RAISE EXCEPTION 'V134-FAIL: se certificó un documento con diócesis falsa';
   EXCEPTION WHEN insufficient_privilege THEN v_denied:=v_denied+1; END;
  ELSE
   BEGIN
    PERFORM public.process_manual_matrimonial_notification_physical(v_recipient);
    RAISE EXCEPTION 'V134-FAIL: se certificó un destinatario archivado';
   EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1; END;
  END IF;
  EXECUTE 'RESET ROLE';
  SELECT status,note_applied INTO STRICT v_status,v_note_applied
  FROM public.matrimonial_notification_recipients WHERE id=v_recipient;
  v_expected:=CASE WHEN v_mode='foreign_diocese' THEN 'pending' ELSE 'archived' END;
  IF v_note_applied OR v_status IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'V134-FAIL: produjo efectos a pesar de rechazo %',v_mode;
  END IF;
 END LOOP;
 IF v_denied<>2 THEN RAISE EXCEPTION 'V134-FAIL: solo % bloqueos',v_denied; END IF;
END $qa$;
ROLLBACK;