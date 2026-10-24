-- SACRAMENTUM V189: ejercicio transaccional de estados invalidos sobre UN decreto ficticio.
BEGIN;
DO $qa$
DECLARE di uuid;par uuid;actor uuid;issued uuid;v_number text;
  invalid_status_denied boolean:=false;invalid_sacrament_denied boolean:=false;
  got_state text; got_constraint text;
BEGIN
 SELECT diocese_id,auth_user_id INTO STRICT di,actor FROM public.user_profiles
 WHERE role='chancery' AND is_active=true AND status='ACTIVE' LIMIT 1;
 SELECT id INTO STRICT par FROM public.parishes
 WHERE diocese_id=di AND is_operational=true ORDER BY id LIMIT 1;
 v_number:='QA-V189-'||substr(gen_random_uuid()::text,1,14);
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 issued:=public.issue_documentary_decree_v88(par,'bautismo',v_number,CURRENT_DATE,
    'PERSONA FICTICIA','Documento ficticio de prueba transaccional.',false,NULL);
 IF issued IS NULL THEN RAISE EXCEPTION 'QA V189 decree not issued'; END IF;
 BEGIN
  UPDATE public.decretos SET status='INVALID_QA' WHERE id=issued;
  RAISE EXCEPTION 'QA V189 invalid status was accepted';
 EXCEPTION WHEN check_violation THEN
  GET STACKED DIAGNOSTICS got_constraint=CONSTRAINT_NAME;
  IF got_constraint<>'chk_decretos_status' THEN
   RAISE EXCEPTION 'QA V189 wrong status constraint %',got_constraint;
  END IF;
  invalid_status_denied:=true;
 END;
 BEGIN
  UPDATE public.decretos SET sacrament_type='INVALID_QA' WHERE id=issued;
  RAISE EXCEPTION 'QA V189 invalid sacrament was accepted';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS got_state=RETURNED_SQLSTATE,got_constraint=CONSTRAINT_NAME;
  IF got_state='P0001' AND SQLERRM='QA V189 invalid sacrament was accepted' THEN RAISE; END IF;
  IF got_state NOT IN ('23514','P0001') THEN
   RAISE EXCEPTION 'QA V189 unexpected rejection state %',got_state;
  END IF;
  invalid_sacrament_denied:=true;
 END;
 IF (SELECT status FROM public.decretos WHERE id=issued)<>'active' THEN
  RAISE EXCEPTION 'QA V189 original decree status modified';
 END IF;
 IF (SELECT sacrament_type FROM public.decretos WHERE id=issued)<>'bautismo' THEN
  RAISE EXCEPTION 'QA V189 original decree sacrament changed';
 END IF;
 IF NOT invalid_status_denied OR NOT invalid_sacrament_denied THEN
  RAISE EXCEPTION 'QA V189 rejections incomplete';
 END IF;
 PERFORM set_config('qa189.reversible',jsonb_build_object(
   'fictitious_decrees',1,'invalid_status_denied',1,'invalid_sacrament_denied',1,
   'original_record_unchanged',true,'rollback_required',true
 )::text,true);
END $qa$;
SELECT current_setting('qa189.reversible')::jsonb AS qa_result;
ROLLBACK;