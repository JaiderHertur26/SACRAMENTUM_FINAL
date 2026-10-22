-- V152: ensure documentary decrees cannot receive registrar-effect concept policies.
-- Read own audit trace only, deny other-parish access. All inserts rolled back.
BEGIN;
SELECT set_config('qa.chancery_uid',(SELECT auth_user_id::text FROM public.user_profiles
 WHERE lower(role)='chancery' AND coalesce(is_active,true) LIMIT 1),true);
SELECT set_config('qa.diocese_uid',(SELECT auth_user_id::text FROM public.user_profiles
 WHERE lower(role)='diocese' AND coalesce(is_active,true) LIMIT 1),true);
SELECT set_config('qa.parish_uid',(SELECT auth_user_id::text FROM public.user_profiles
 WHERE lower(role)='parish' AND coalesce(is_active,true) LIMIT 1),true);
SELECT set_config('qa.parish_own',(SELECT parish_id::text FROM public.user_profiles
 WHERE lower(role)='parish' AND coalesce(is_active,true) LIMIT 1),true);
SELECT set_config('qa.parish_other',(SELECT p.id::text FROM public.parishes p
 WHERE p.id::text<>(SELECT parish_id::text FROM public.user_profiles
 WHERE lower(role)='parish' AND coalesce(is_active,true) LIMIT 1)
 ORDER BY p.id LIMIT 1),true);
SELECT set_config('qa.concept',(SELECT c.id::text FROM public.conceptos_anulacion c
 JOIN public.user_profiles u ON u.diocese_id=c.diocese_id
 WHERE lower(u.role)='chancery' AND coalesce(c.is_active,true)
 ORDER BY c.id LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $qa$
DECLARE
 v_uid text:=current_setting('qa.chancery_uid');
 v_own uuid:=current_setting('qa.parish_own')::uuid;
 v_other uuid:=current_setting('qa.parish_other')::uuid;
 v_concept uuid:=current_setting('qa.concept')::uuid;
 v_document uuid;v_historical uuid;v_msg text;v_ct integer;
 v_checks integer:=0;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',v_uid,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_uid,'role','authenticated')::text,true);
 v_document:=public.issue_documentary_decree_v88(v_own,'bautismo',
  'QA152-TRACE-'||substr(replace(gen_random_uuid()::text,'-',''),1,16),
  current_date,'PERSONA FICTICIA V152','Ensayo reversible de política conceptual',false,null);
 v_historical:=public.issue_documentary_decree_v88(v_other,'confirmacion',
  'QA152-TRACE-H-'||substr(replace(gen_random_uuid()::text,'-',''),1,16),
  current_date,'PERSONA FICTICIA V152','Ensayo histórico reversible de trazas',true,'ARCHIVO QA V152');
 BEGIN
  PERFORM private.attach_decree_concept_policy_internal(v_document,v_concept);
  RAISE EXCEPTION 'V152-FAIL documentary decree acquired concept policy';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_msg=MESSAGE_TEXT;
  IF v_msg LIKE 'V152-FAIL%' THEN RAISE;END IF;
  IF v_msg NOT LIKE '%documental%' THEN RAISE EXCEPTION 'V152-FAIL incorrect policy denial %',v_msg;END IF;
  v_checks:=v_checks+1;
 END;
 BEGIN
  PERFORM public.attach_decree_concept_policy(v_historical,v_concept);
  RAISE EXCEPTION 'V152-FAIL historical decree acquired concept policy';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_msg=MESSAGE_TEXT;
  IF v_msg LIKE 'V152-FAIL%' THEN RAISE;END IF;
  IF v_msg NOT LIKE '%documental%' THEN RAISE EXCEPTION 'V152-FAIL incorrect historical policy denial %',v_msg;END IF;
  v_checks:=v_checks+1;
 END;
 SELECT count(*) INTO v_ct FROM public.get_decree_trace_v89(v_document);
 IF v_ct<>1 THEN RAISE EXCEPTION 'V152-FAIL chancery trace count %',v_ct;END IF;
 v_uid:=current_setting('qa.diocese_uid');
 PERFORM set_config('request.jwt.claim.sub',v_uid,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_uid,'role','authenticated')::text,true);
 BEGIN
  PERFORM private.attach_decree_concept_policy_internal(v_document,v_concept);
  RAISE EXCEPTION 'V152-FAIL diocese modified documentary policy';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_msg=MESSAGE_TEXT;
  IF v_msg LIKE 'V152-FAIL%' THEN RAISE;END IF;
  IF v_msg NOT LIKE '%Cancillería%' THEN RAISE EXCEPTION 'V152-FAIL role denial: %',v_msg;END IF;
  v_checks:=v_checks+1;
 END;
 v_uid:=current_setting('qa.parish_uid');
 PERFORM set_config('request.jwt.claim.sub',v_uid,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_uid,'role','authenticated')::text,true);
 SELECT count(*) INTO v_ct FROM public.get_decree_trace_v89(v_document);
 IF v_ct<>1 THEN RAISE EXCEPTION 'V152-FAIL parish cannot inspect own decree trace';END IF;
 SELECT count(*) INTO v_ct FROM public.get_decree_trace_v89(v_historical);
 IF v_ct<>0 THEN RAISE EXCEPTION 'V152-FAIL parish sees other parish trace';END IF;
 v_checks:=v_checks+2;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000152',true);
 PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000152","role":"authenticated"}',true);
 SELECT count(*) INTO v_ct FROM public.get_decree_trace_v89(v_document);
 IF v_ct<>0 THEN RAISE EXCEPTION 'V152-FAIL unprofiled actor sees decree trace';END IF;
 v_checks:=v_checks+1;
 IF v_checks<>6 THEN RAISE EXCEPTION 'V152-FAIL assertion count %',v_checks;END IF;
END $qa$;
ROLLBACK;
