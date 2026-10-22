-- V134 baseline: fuente cancelada NO debería poder certificarse en libro físico. Toda la prueba es reversible.
BEGIN;
DO $qa$
DECLARE v_actor uuid;v_parish uuid;v_diocese uuid;v_note uuid;v_recipient uuid;v_status text;v_note_applied boolean;
BEGIN
 SELECT auth_user_id,parish_id,diocese_id INTO STRICT v_actor,v_parish,v_diocese
 FROM public.user_profiles WHERE role='parish' AND is_active LIMIT 1;
 INSERT INTO public.matrimonial_notifications
 (sender_parish_id,diocese_id,consecutive,document_number,person_name,spouse_name,marriage_date,
 marriage_book,marriage_folio,marriage_number,notification_type,status,payload)
 VALUES(v_parish,v_diocese,991134,'QA-V134-CANCELLED','PERSONA FICTICIA V134','CONTRAYENTE FICTICIO',
 DATE '2023-01-02','QA','888','887','matrimonio','cancelled','{"qaOnly":true}'::jsonb)
 RETURNING id INTO v_note;
 INSERT INTO public.matrimonial_notification_recipients
 (notification_id,receiver_parish_id,status,note_applied,payload)
 VALUES(v_note,v_parish,'pending',false,
 '{"manualLocator":{"book":"QA","folio":"888","number":"887"},"marginalNote":"NOTA V134 FICTICIA QUE NUNCA DEBE CERTIFICARSE"}'::jsonb)
 RETURNING id INTO v_recipient;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 PERFORM public.process_manual_matrimonial_notification_physical(v_recipient);
 EXECUTE 'RESET ROLE';
 SELECT status,note_applied INTO v_status,v_note_applied
 FROM public.matrimonial_notification_recipients WHERE id=v_recipient;
 IF v_status='processed' AND v_note_applied THEN
  RAISE EXCEPTION 'V134-CONFIRMED: se certificó una notificación matrimonial CANCELADA como asiento físico';
 END IF;
END $qa$;
ROLLBACK;