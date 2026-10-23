-- V154 · Cannot create a new MANUAL marginal note on an already reversed
-- baptism/confirmation supplemental record. Only fictional transient fixtures.
BEGIN;
DO $qa$
DECLARE
 v_parish uuid;v_actor uuid;v_new uuid;v_type text;v_message text;v_rejected integer:=0;
BEGIN
 SELECT parish_id,auth_user_id INTO STRICT v_parish,v_actor
 FROM public.user_profiles WHERE role='parish' AND is_active LIMIT 1;
 FOREACH v_type IN ARRAY ARRAY['bautismo','confirmacion'] LOOP
  IF v_type='bautismo' THEN
   INSERT INTO public.baptisms(parish_id,status,celebration_date,book_number,folio,number,nombres,apellidos,raw_data)
   VALUES(v_parish,'reversed',date '2019-01-01','QA154','950','950','QA154','REVERSO','{"qaOnly":true}'::jsonb)
   RETURNING id INTO v_new;
  ELSE
   INSERT INTO public.confirmations(parish_id,status,celebration_date,book_number,folio,number,nombres,apellidos,raw_data)
   VALUES(v_parish,'reversed',date '2019-01-01','QA154','950','950','QA154','REVERSO','{"qaOnly":true}'::jsonb)
   RETURNING id INTO v_new;
  END IF;
  PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
  BEGIN
   PERFORM public.create_manual_marginal_note(
     v_parish,v_type,v_new,'NOTA NUEVA SOBRE SUPLETORIA REVERTIDA QA154');
   RAISE EXCEPTION 'V154-FAIL: new note accepted on reversed %',v_type;
  EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT;
   IF v_message LIKE 'V154-FAIL%' THEN RAISE;END IF;
   IF position('revertid' in lower(v_message))=0 THEN
    RAISE EXCEPTION 'V154-FAIL: wrong rejection of %: %',v_type,v_message;
   END IF;
   v_rejected:=v_rejected+1;
  END;
 END LOOP;
 IF v_rejected<>2 THEN RAISE EXCEPTION 'V154-FAIL expected 2 denials, got %',v_rejected;END IF;
END $qa$;
ROLLBACK;
