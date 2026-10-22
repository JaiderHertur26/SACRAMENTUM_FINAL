-- V134 · Paridad de Confirmación física: sentencia fuente cancelada no se procesa. ROLLBACK.
BEGIN;
DO $qa$
DECLARE v_actor uuid;v_parish uuid;v_diocese uuid;v_doc uuid;v_recipient uuid;
 v_status text;v_result text;v_applied bool;v_denied int:=0;v_accepted int:=0;
BEGIN
 SELECT auth_user_id,parish_id,diocese_id INTO STRICT v_actor,v_parish,v_diocese
 FROM public.user_profiles WHERE role='parish' AND is_active LIMIT 1;
 FOREACH v_status IN ARRAY ARRAY['cancelled','sent'] LOOP
  INSERT INTO public.matrimonial_notifications(
   sender_parish_id,diocese_id,consecutive,document_number,person_name,spouse_name,
   marriage_date,marriage_book,marriage_folio,marriage_number,notification_type,status,payload
  ) VALUES(
   v_parish,v_diocese,CASE WHEN v_status='sent' THEN 991163 ELSE 991164 END,
   'QA-V134-CONF-'||v_status||'-'||left(gen_random_uuid()::text,8),
   'CONFIRMANDO FICTICIO','MINISTRO FICTICIO',DATE '2023-09-13',
   'QA','965','966','confirmacion',v_status,'{"qaOnly":true}'::jsonb
  ) RETURNING id INTO v_doc;
  INSERT INTO public.matrimonial_notification_recipients(
   notification_id,receiver_parish_id,status,note_applied,payload
  ) VALUES(
   v_doc,v_parish,'pending',false,
   '{"manualLocator":{"book":"QA","folio":"965","number":"966"},"marginalNote":"NOTA DE CONFIRMACION FICTICIA V134"}'::jsonb
  ) RETURNING id INTO v_recipient;
  PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF v_status='sent' THEN
   PERFORM public.process_manual_matrimonial_notification_physical(v_recipient);
   v_accepted:=v_accepted+1;
  ELSE
   BEGIN
    PERFORM public.process_manual_matrimonial_notification_physical(v_recipient);
    RAISE EXCEPTION 'V134-FAIL: Confirmación física con aviso cancelado certificada';
   EXCEPTION WHEN check_violation THEN v_denied:=v_denied+1; END;
  END IF;
  EXECUTE 'RESET ROLE';
  SELECT status,note_applied INTO STRICT v_result,v_applied
  FROM public.matrimonial_notification_recipients WHERE id=v_recipient;
  IF (v_status='sent' AND (v_result<>'processed' OR NOT v_applied))
    OR (v_status='cancelled' AND (v_result<>'pending' OR v_applied)) THEN
   RAISE EXCEPTION 'V134-FAIL: Confirmación % quedó incorrecta % %',v_status,v_result,v_applied;
  END IF;
 END LOOP;
 IF v_denied<>1 OR v_accepted<>1 THEN RAISE EXCEPTION 'V134 paridad no completada'; END IF;
END $qa$;
ROLLBACK;