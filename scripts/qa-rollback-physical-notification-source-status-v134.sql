-- V134 · Documento cancelado/revertido no se certifica físicamente; caso legítimo sí. ROLLBACK.
BEGIN;
DO $qa$
DECLARE
 v_actor uuid;v_other_role uuid;v_parish uuid;v_diocese uuid;
 v_document uuid;v_recipient uuid;v_status text;v_note_applied boolean;
 v_source_status text;v_denied int:=0;v_accepted int:=0;v_audit int;
 v_document_number text;v_result record;v_index integer:=0;
BEGIN
 SELECT auth_user_id,parish_id,diocese_id INTO STRICT v_actor,v_parish,v_diocese
 FROM public.user_profiles WHERE role='parish' AND is_active LIMIT 1;
 SELECT auth_user_id INTO STRICT v_other_role FROM public.user_profiles
 WHERE role='diocese' AND diocese_id=v_diocese AND is_active LIMIT 1;

 FOREACH v_source_status IN ARRAY ARRAY['cancelled','reversed','revertida','archived','anulada','sent'] LOOP
  v_index:=v_index+1;
  v_document_number:='QA-V134-'||v_source_status||'-'||left(gen_random_uuid()::text,8);
  INSERT INTO public.matrimonial_notifications(
   sender_parish_id,diocese_id,consecutive,document_number,person_name,spouse_name,
   marriage_date,marriage_book,marriage_folio,marriage_number,notification_type,status,payload
  ) VALUES(
   v_parish,v_diocese,991134+v_index,v_document_number,'PERSONA FICTICIA V134','CONTRAYENTE FICTICIO',
   DATE '2024-02-14','QA','998','996','matrimonio',v_source_status,'{"qaOnly":true}'::jsonb
  ) RETURNING id INTO v_document;
  INSERT INTO public.matrimonial_notification_recipients(
   notification_id,receiver_parish_id,status,note_applied,payload
  ) VALUES(
   v_document,v_parish,'pending',false,
   '{"manualLocator":{"book":"QA","folio":"998","number":"996"},"marginalNote":"NOTA FICTICIA DE LABORATORIO V134"}'::jsonb
  ) RETURNING id INTO v_recipient;

  PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF v_source_status='sent' THEN
    SELECT * INTO STRICT v_result FROM public.process_manual_matrimonial_notification_physical(v_recipient);
    IF v_result.status<>'processed' OR v_result.note_applied IS NOT TRUE THEN
      RAISE EXCEPTION 'V134: notificación activa no procesada';
    END IF;
    -- El segundo procesamiento no debe producir una segunda nota ni auditoría.
    SELECT * INTO STRICT v_result FROM public.process_manual_matrimonial_notification_physical(v_recipient);
    v_accepted:=v_accepted+1;
  ELSE
    BEGIN
      PERFORM public.process_manual_matrimonial_notification_physical(v_recipient);
      RAISE EXCEPTION 'V134-FAIL: documento de origen % fue certificado',v_source_status;
    EXCEPTION WHEN check_violation THEN
      v_denied:=v_denied+1;
    END;
  END IF;
  EXECUTE 'RESET ROLE';

  SELECT status,note_applied INTO STRICT v_status,v_note_applied
  FROM public.matrimonial_notification_recipients WHERE id=v_recipient;
  IF v_source_status='sent' THEN
    IF v_status<>'processed' OR NOT v_note_applied THEN RAISE EXCEPTION 'V134: no se marcó legítimo'; END IF;
    SELECT count(*) INTO v_audit FROM public.registry_audit_log WHERE entity_id=v_recipient AND action='process_physical_book';
    IF v_audit<>1 THEN RAISE EXCEPTION 'V134: auditoría física duplicada %',v_audit; END IF;
  ELSE
    IF v_status<>'pending' OR v_note_applied THEN RAISE EXCEPTION 'V134: rechazo alteró estado %',v_source_status; END IF;
  END IF;
 END LOOP;

 PERFORM set_config('request.jwt.claim.sub',v_other_role::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 BEGIN
  PERFORM public.process_manual_matrimonial_notification_physical(v_recipient);
  RAISE EXCEPTION 'V134-FAIL: rol diocesano certificó libro parroquial';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'V134-FAIL%' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE '%Cuenta parroquial activa requerida%' THEN RAISE; END IF;
  v_denied:=v_denied+1;
 END;
 EXECUTE 'RESET ROLE';
 IF v_denied<>6 OR v_accepted<>1 THEN
  RAISE EXCEPTION 'V134: matriz incompleta denegadas % aceptadas %',v_denied,v_accepted;
 END IF;
END $qa$;
ROLLBACK;