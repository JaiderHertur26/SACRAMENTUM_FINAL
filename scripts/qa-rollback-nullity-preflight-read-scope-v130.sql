-- V130 · RPC de consulta por roles y protección de tabla documental interna.
BEGIN;
DO $qa$
DECLARE v_role text;v_actor uuid;v_scope jsonb;v_denied int:=0;v_allowed int:=0;v_select_denied int:=0;
BEGIN
 FOREACH v_role IN ARRAY ARRAY['admin_general','parish','chancery','diocese'] LOOP
 SELECT auth_user_id INTO STRICT v_actor FROM public.user_profiles
 WHERE role=v_role AND is_active LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 IF v_role IN ('chancery','diocese') THEN
  SELECT public.list_marriage_nullity_execution_v130(NULL) INTO v_scope;
  IF jsonb_typeof(v_scope)<>'array' THEN
   RAISE EXCEPTION 'V130 list does not return an array';
  END IF;
  v_allowed:=v_allowed+1;
 ELSE
  BEGIN
   PERFORM public.list_marriage_nullity_execution_v130(NULL);
   RAISE EXCEPTION 'V130-FINDING list exposed to unauthorized role %',v_role;
  EXCEPTION WHEN insufficient_privilege THEN
   v_denied:=v_denied+1;
  END;
 END IF;
 BEGIN
  PERFORM 1 FROM public.nullity_execution_authorizations_v128 LIMIT 1;
  RAISE EXCEPTION 'V130-FINDING direct table read allowed';
 EXCEPTION WHEN insufficient_privilege THEN
  v_select_denied:=v_select_denied+1;
 END;
 EXECUTE 'RESET ROLE';
 END LOOP;
 IF v_allowed<>2 OR v_denied<>2 OR v_select_denied<>4 THEN
  RAISE EXCEPTION 'V130 incomplete matrix % % %',v_allowed,v_denied,v_select_denied;
 END IF;
END $qa$;
ROLLBACK;