-- V155 · Post-correction manual marginal note requires reconciliation before reversal.
-- All records fictional, not retained. Never replace ROLLBACK with COMMIT.
BEGIN;
DO $qa$
DECLARE
 v_dio uuid;v_actor uuid;v_parish uuid;v_s text;
 v_original uuid;v_new uuid;v_decree uuid;v_ref text;
 v_later uuid;v_msg text;v_old_st text;v_new_st text;v_rejected integer:=0;v_reconciled integer:=0;
 v_before_notes integer;
BEGIN
 SELECT diocese_id,auth_user_id INTO STRICT v_dio,v_actor
 FROM public.user_profiles WHERE role='chancery' AND is_active LIMIT 1;
 SELECT id INTO STRICT v_parish FROM public.parishes
 WHERE diocese_id=v_dio AND is_operational ORDER BY id LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 FOREACH v_s IN ARRAY ARRAY['matrimonio','exequias'] LOOP
  v_ref:='QA-V155-CORR-'||v_s||'-'||left(gen_random_uuid()::text,8);
  IF v_s='matrimonio' THEN
   INSERT INTO public.marriages(parish_id,celebration_date,status,raw_data,book_type)
   VALUES(v_parish,DATE '2019-01-01','seated',
    '{"qaOnly":true,"novioNombres":"PRUEBA","noviaNombres":"FICTICIA"}'::jsonb,'ordinario')
   RETURNING id INTO v_original;
   SELECT decree_id,replacement_marriage_id INTO STRICT v_decree,v_new
   FROM public.apply_marriage_correction(
    v_original,CURRENT_DATE,'Corrección ficticia reversible de QA V155.',
    '{"novioApellidos":"CORREGIDO-V155"}'::jsonb,v_ref);
  ELSE
   INSERT INTO public.funerals(parish_id,status,nombres,apellidos,fecha_nacimiento,
    fecha_defuncion,fecha_exequias,raw_data,book_type)
   VALUES(v_parish,'seated','PERSONA','QA V155',DATE '1945-01-01',
    DATE '2021-01-01',DATE '2021-01-02','{"qaOnly":true}'::jsonb,'ordinario')
   RETURNING id INTO v_original;
   SELECT decree_id,replacement_funeral_id INTO STRICT v_decree,v_new
   FROM public.apply_funeral_correction(
    v_original,CURRENT_DATE,'Corrección ficticia reversible de QA V155.',
    '{"apellidos":"CORREGIDO-V155"}'::jsonb,v_ref);
  END IF;
  SELECT count(*) INTO v_before_notes FROM public.marginal_notes WHERE decree_id=v_decree;
  IF v_before_notes<1 THEN RAISE EXCEPTION 'V155-FAIL faltan notas del decreto de corrección';END IF;
  SELECT public.create_manual_marginal_note(v_parish,v_s,v_new,
    'QA V155 NOTA INDEPENDIENTE SOBRE CORRECCION POSTERIOR') INTO v_later;
  BEGIN
   IF v_s='matrimonio' THEN
    PERFORM public.reverse_marriage_decree(v_decree,'QA: REVERSIÓN NO AUTORIZABLE');
   ELSE
    PERFORM public.reverse_funeral_decree(v_decree,'QA: REVERSIÓN NO AUTORIZABLE');
   END IF;
   RAISE EXCEPTION 'V155-FAIL reversión de corrección con nota independiente aceptada';
  EXCEPTION WHEN check_violation THEN
   GET STACKED DIAGNOSTICS v_msg=MESSAGE_TEXT;
   IF v_msg LIKE 'V155-FAIL%' THEN RAISE;END IF;
   IF position('conciliación' in v_msg)=0 THEN
    RAISE EXCEPTION 'V155-FAIL causa equivocada %',v_msg;
   END IF;
   v_rejected:=v_rejected+1;
  END;
  IF v_s='matrimonio' THEN
   SELECT status INTO STRICT v_old_st FROM public.marriages WHERE id=v_original;
   SELECT status INTO STRICT v_new_st FROM public.marriages WHERE id=v_new;
  ELSE
   SELECT status INTO STRICT v_old_st FROM public.funerals WHERE id=v_original;
   SELECT status INTO STRICT v_new_st FROM public.funerals WHERE id=v_new;
  END IF;
  IF v_old_st IS DISTINCT FROM 'anulada' OR v_new_st IS DISTINCT FROM 'seated'
     OR (SELECT status FROM public.decretos WHERE id=v_decree) IS DISTINCT FROM 'active'
     OR (SELECT status FROM public.marginal_notes WHERE id=v_later) IS DISTINCT FROM 'active'
     OR (SELECT count(*) FROM public.marginal_notes WHERE decree_id=v_decree)<>v_before_notes
  THEN RAISE EXCEPTION 'V155-FAIL rechazo mutó corrección original/supletoria/nota';END IF;
  -- QA emulates completed DOCUMENTARY reconciliation only; not production workflow.
  UPDATE public.marginal_notes SET status='reversed' WHERE id=v_later;
  IF NOT FOUND THEN RAISE EXCEPTION 'V155-FAIL no se pudo marcar nota ficticia como conciliada';END IF;
  IF v_s='matrimonio' THEN
   PERFORM public.reverse_marriage_decree(v_decree,'QA: REVERSIÓN TRAS CONCILIACIÓN');
   SELECT status INTO STRICT v_old_st FROM public.marriages WHERE id=v_original;
   SELECT status INTO STRICT v_new_st FROM public.marriages WHERE id=v_new;
  ELSE
   PERFORM public.reverse_funeral_decree(v_decree,'QA: REVERSIÓN TRAS CONCILIACIÓN');
   SELECT status INTO STRICT v_old_st FROM public.funerals WHERE id=v_original;
   SELECT status INTO STRICT v_new_st FROM public.funerals WHERE id=v_new;
  END IF;
  IF v_old_st IS DISTINCT FROM 'seated' OR v_new_st IS DISTINCT FROM 'reversed'
     OR (SELECT status FROM public.decretos WHERE id=v_decree) IS DISTINCT FROM 'reversed'
     OR (SELECT status FROM public.marginal_notes WHERE id=v_later) IS DISTINCT FROM 'reversed'
     OR (SELECT count(*) FROM public.marginal_notes WHERE decree_id=v_decree)<=v_before_notes
  THEN RAISE EXCEPTION 'V155-FAIL corrección no se revirtió correctamente después de conciliación';END IF;
  v_reconciled:=v_reconciled+1;
 END LOOP;
 IF v_rejected<>2 OR v_reconciled<>2 THEN RAISE EXCEPTION 'V155-FAIL conteos %/%',v_rejected,v_reconciled;END IF;
END $qa$;
ROLLBACK;
