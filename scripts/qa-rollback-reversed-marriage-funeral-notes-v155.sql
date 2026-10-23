-- V155 · Never create a manual note on a reversed marriage or funeral.
-- Pure fictional records in a rollback-only transaction.
BEGIN;
DO $qa$
DECLARE v_parish uuid; v_actor uuid; v_new uuid; v_type text;
 v_message text;v_denied int:=0;
BEGIN
 SELECT parish_id,auth_user_id INTO STRICT v_parish,v_actor
 FROM public.user_profiles WHERE role='parish' AND is_active LIMIT 1;
 FOREACH v_type IN ARRAY ARRAY['matrimonio','exequias'] LOOP
  IF v_type='matrimonio' THEN
   INSERT INTO public.marriages(parish_id,status,celebration_date,book_number,folio,number,raw_data)
   VALUES(v_parish,'reversed',DATE '2019-01-01','QA155','950','950','{"qaOnly":true}'::jsonb)
   RETURNING id INTO v_new;
  ELSE
   INSERT INTO public.funerals(parish_id,status,nombres,apellidos,fecha_nacimiento,
    fecha_defuncion,fecha_exequias,raw_data,book_type)
   VALUES(v_parish,'reversed','QA','REVERSO',DATE '1940-01-01',
    DATE '2019-01-01',DATE '2019-01-02','{"qaOnly":true}'::jsonb,'ordinario')
   RETURNING id INTO v_new;
  END IF;
  PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
  BEGIN
   PERFORM public.create_manual_marginal_note(v_parish,v_type,v_new,
    'QA V155: no permitir nota en supletoria revertida');
   RAISE EXCEPTION 'V155-FAIL note on reversed record accepted';
  EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT;
   IF v_message LIKE 'V155-FAIL%' THEN RAISE;END IF;
   IF position('revertid' in lower(v_message))=0 THEN
    RAISE EXCEPTION 'V155-FAIL unexpected reason for %: %',v_type,v_message;
   END IF;
   v_denied:=v_denied+1;
  END;
 END LOOP;
 IF v_denied<>2 THEN RAISE EXCEPTION 'V155-FAIL expected 2 denials, got %',v_denied;END IF;
END $qa$;
ROLLBACK;
