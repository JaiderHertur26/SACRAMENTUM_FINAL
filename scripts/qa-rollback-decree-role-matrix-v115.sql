-- V115 · Matriz de permisos 3 roles excluidos × 8 RPC emisoras.
BEGIN;
DO $qa$
DECLARE
 v_parish uuid; v_diocese uuid; v_actor uuid;
 v_role text; v_action text; v_message text; v_denied int:=0;
BEGIN
 SELECT diocese_id INTO STRICT v_diocese FROM public.user_profiles
 WHERE role='chancery' AND is_active;
 SELECT id INTO STRICT v_parish FROM public.parishes
 WHERE diocese_id=v_diocese AND is_operational ORDER BY id LIMIT 1;
 FOREACH v_role IN ARRAY ARRAY['parish','diocese','admin_general'] LOOP
   SELECT auth_user_id INTO STRICT v_actor FROM public.user_profiles
   WHERE role=v_role AND is_active LIMIT 1;
   PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
   FOREACH v_action IN ARRAY ARRAY[
     'baptism_correction','baptism_reposition',
     'confirmation_correction','confirmation_reposition',
     'marriage_correction','marriage_reposition',
     'funeral_correction','funeral_reposition'
   ] LOOP
     BEGIN
       CASE v_action
       WHEN 'baptism_correction' THEN
         PERFORM public.apply_baptism_correction(v_parish,NULL,'QA-DENY',
         CURRENT_DATE,NULL,'{}'::jsonb,'{"reason":"QA"}'::jsonb,'QA','QA',1,1,1);
       WHEN 'baptism_reposition' THEN
         PERFORM public.apply_baptism_replacement(v_parish,'QA-DENY',
         CURRENT_DATE,NULL,'{}'::jsonb,'{"reason":"QA"}'::jsonb,'QA',1,1,1);
       WHEN 'confirmation_correction' THEN
         PERFORM public.apply_confirmation_correction(v_parish,NULL,'QA-DENY',
         CURRENT_DATE,NULL,'{}'::jsonb,'{"reason":"QA"}'::jsonb,'QA','QA',1,1,1);
       WHEN 'confirmation_reposition' THEN
         PERFORM public.apply_confirmation_replacement(v_parish,'QA-DENY',
         CURRENT_DATE,NULL,'{}'::jsonb,'{"reason":"QA"}'::jsonb,'QA',1,1,1);
       WHEN 'marriage_correction' THEN
         PERFORM public.apply_marriage_correction(NULL,CURRENT_DATE,
           'QA','{}'::jsonb,'QA-DENY');
       WHEN 'marriage_reposition' THEN
         PERFORM public.create_marriage_reposition_by_decree(v_parish,
           CURRENT_DATE,'QA','{}'::jsonb,'{}'::jsonb,'QA-DENY');
       WHEN 'funeral_correction' THEN
         PERFORM public.apply_funeral_correction(NULL,CURRENT_DATE,
           'QA','{}'::jsonb,'QA-DENY');
       WHEN 'funeral_reposition' THEN
         PERFORM public.create_funeral_reposition_by_decree(v_parish,
           CURRENT_DATE,'QA','{}'::jsonb,'{}'::jsonb,'QA-DENY');
       END CASE;
       RAISE EXCEPTION 'QA-FAIL-UNAUTHORIZED-%-%',v_role,v_action;
     EXCEPTION WHEN OTHERS THEN
       v_message:=SQLERRM;
       IF v_message LIKE 'QA-FAIL-UNAUTHORIZED-%' THEN RAISE; END IF;
       IF position('Cancillería' in v_message)=0 THEN
         RAISE EXCEPTION 'V115: error distinto a autorización (%/%): %',v_role,v_action,v_message;
       END IF;
       v_denied:=v_denied+1;
     END;
   END LOOP;
 END LOOP;
 IF v_denied<>24 THEN RAISE EXCEPTION 'V115: rechazos incompletos %',v_denied; END IF;
END $qa$;
ROLLBACK;