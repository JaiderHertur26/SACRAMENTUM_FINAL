-- V135 Verificación de defensa preexistente: trigger impide trámite digital sin partida ni certificación física. ROLLBACK.
BEGIN;
DO $qa$
DECLARE v_actor uuid;v_parish uuid;v_diocese uuid;v_doc uuid;v_recipient uuid;v_status text;v_applied bool;
BEGIN
 SELECT auth_user_id,parish_id,diocese_id INTO STRICT v_actor,v_parish,v_diocese
 FROM public.user_profiles WHERE role='parish' AND is_active LIMIT 1;
 INSERT INTO public.matrimonial_notifications(sender_parish_id,diocese_id,consecutive,document_number,
 person_name,spouse_name,marriage_date,marriage_book,marriage_folio,marriage_number,
 notification_type,status,payload)
 VALUES(v_parish,v_diocese,991135,'QA-V135-'||left(gen_random_uuid()::text,8),
 'BAUTIZANDO FICTICIO','CÓNYUGE FICTICIO',DATE '2024-01-03','QA','992','992',
 'matrimonio','sent','{"qaOnly":true}'::jsonb) RETURNING id INTO v_doc;
 INSERT INTO public.matrimonial_notification_recipients(
 notification_id,receiver_parish_id,target_baptism_id,status,note_applied,payload)
 VALUES(v_doc,v_parish,NULL,'pending',false,
 '{"manualLocator":{"book":"QA","folio":"992","number":"992"},"marginalNote":"NOTA QUE REQUIERE PARTIDA O CERTIFICACION FISICA"}'::jsonb)
 RETURNING id INTO v_recipient;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 BEGIN
  PERFORM public.process_matrimonial_notification_recipient(v_recipient);
  RAISE EXCEPTION 'V135-FAIL: procesó sin partida ni certificación';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'V135-FAIL%' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE '%debe vincular una partida digital o certificar el asiento físico%'
    THEN RAISE; END IF;
 END;
 EXECUTE 'RESET ROLE';
 SELECT status,note_applied INTO STRICT v_status,v_applied
 FROM public.matrimonial_notification_recipients WHERE id=v_recipient;
 IF v_status<>'pending' OR v_applied IS DISTINCT FROM false THEN
   RAISE EXCEPTION 'V135-FAIL: no se conservó el destinatario pendiente';
 END IF;
END $qa$;
ROLLBACK;