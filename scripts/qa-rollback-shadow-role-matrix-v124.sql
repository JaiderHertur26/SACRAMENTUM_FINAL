-- V124 · Cuatro roles, dos RPC de eliminación; sólo Diócesis tiene autorización.
BEGIN;
DO $qa$
DECLARE
 v_dio uuid;v_shadow uuid;v_correct uuid;v_role text;v_actor uuid;v_fun text;
 v_result jsonb;v_allowed integer:=0;v_denied integer:=0;
BEGIN
 SELECT diocese_id INTO STRICT v_dio FROM public.user_profiles
 WHERE role='diocese' AND is_active LIMIT 1;
 INSERT INTO public.parishes(name,diocese_id,is_operational)
 VALUES('QA-V124-SOMBRA-SIN-PARTIDAS',v_dio,false) RETURNING id INTO v_shadow;
 INSERT INTO public.parishes(name,diocese_id,is_operational)
 VALUES('QA-V124-DESTINO-SIN-PARTIDAS',v_dio,false) RETURNING id INTO v_correct;
 FOREACH v_role IN ARRAY ARRAY['diocese','admin_general','chancery','parish'] LOOP
   SELECT auth_user_id INTO STRICT v_actor FROM public.user_profiles
   WHERE role=v_role AND is_active AND
     (v_role='admin_general' OR diocese_id=v_dio) LIMIT 1;
   PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
   FOREACH v_fun IN ARRAY ARRAY['baptism','confirmation'] LOOP
     IF v_role='diocese' THEN
       IF v_fun='baptism' THEN
         v_result:=public.reconcile_legacy_baptism_shadows_v73(v_shadow,v_correct,NULL);
         IF coalesce((v_result->>'removed_shadows')::integer,-1)<>0 THEN
           RAISE EXCEPTION 'V124 authorized baptism cleanup must remove 0 QA rows';
         END IF;
       ELSE
         v_result:=public.reconcile_legacy_confirmation_shadows_v74(v_shadow,v_correct,'QA-V124-ARCHIVO');
         IF coalesce((v_result->>'removed_shadows')::integer,-1)<>0 THEN
           RAISE EXCEPTION 'V124 authorized confirmation cleanup must remove 0 QA rows';
         END IF;
       END IF;
       v_allowed:=v_allowed+1;
     ELSE
       BEGIN
         IF v_fun='baptism' THEN
           PERFORM public.reconcile_legacy_baptism_shadows_v73(v_shadow,v_correct,NULL);
         ELSE
           PERFORM public.reconcile_legacy_confirmation_shadows_v74(v_shadow,v_correct,'QA-V124-ARCHIVO');
         END IF;
         RAISE EXCEPTION 'V124-FAIL role % performed cleanup %',v_role,v_fun;
       EXCEPTION WHEN insufficient_privilege THEN
         v_denied:=v_denied+1;
       END;
     END IF;
   END LOOP;
 END LOOP;
 IF v_allowed<>2 OR v_denied<>6 THEN
   RAISE EXCEPTION 'V124 authorization matrix incomplete % allowed % denied',v_allowed,v_denied;
 END IF;
END $qa$;
ROLLBACK;