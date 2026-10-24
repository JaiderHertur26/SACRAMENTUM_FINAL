-- V187: número institucional de decreto, colisión con variación de espacios y mayúsculas.
-- Datos inventados dentro de una transacción reversible.
BEGIN;
DO $qa$
DECLARE
  di uuid;par uuid;actor uuid;
  number_one text:='QA-V187-DEC-'||substr(gen_random_uuid()::text,1,12);
  issued uuid;actual text;v_count integer;
BEGIN
 SELECT diocese_id,auth_user_id INTO STRICT di,actor FROM public.user_profiles
 WHERE role='chancery' AND status='ACTIVE' AND is_active=true LIMIT 1;
 SELECT id INTO STRICT par FROM public.parishes
 WHERE diocese_id=di AND is_operational=true ORDER BY id LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 issued:=public.issue_documentary_decree_v88(par,'bautismo',number_one,CURRENT_DATE,
    'PERSONA FICTICIA','Ensayo de numeración, sin efectos sacramentales.',false,NULL);
 IF issued IS NULL THEN RAISE EXCEPTION 'V187 cannot issue fictitious decree'; END IF;
 BEGIN
  PERFORM public.issue_documentary_decree_v88(par,'bautismo','  '||lower(number_one)||'  ',
    CURRENT_DATE,'OTRA PERSONA FICTICIA','El número ya existe.',false,NULL);
  RAISE EXCEPTION 'V187 duplicate decree accepted';
 EXCEPTION WHEN raise_exception THEN
  GET STACKED DIAGNOSTICS actual=MESSAGE_TEXT;
  IF actual<>'El número ya corresponde a otro decreto de esta diócesis' THEN
   RAISE EXCEPTION 'V187 unexpected business rejection %',actual;
  END IF;
 WHEN unique_violation THEN
  GET STACKED DIAGNOSTICS actual=CONSTRAINT_NAME;
  IF actual<>'uq_decretos_diocese_number' THEN
   RAISE EXCEPTION 'V187 unexpected uniqueness guard %',actual;
  END IF;
 END;
 SELECT count(*) INTO v_count FROM public.decretos
 WHERE diocese_id=di AND lower(trim(decree_number))=lower(number_one);
 IF v_count<>1 THEN RAISE EXCEPTION 'V187 wrong number of decrees %',v_count; END IF;
 PERFORM set_config('qa187.decree',jsonb_build_object('created',1,'collision_denied',1,'same_diocese',true)::text,true);
END $qa$;
SELECT current_setting('qa187.decree')::jsonb AS qa_results;
ROLLBACK;