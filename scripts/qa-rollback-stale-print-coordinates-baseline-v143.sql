-- V143 BASELINE: obsolete displayed folio may be accepted despite actual registry folio being different. ROLLBACK.
BEGIN;
DO $qa$
DECLARE v_actor uuid;v_parish uuid;v_id uuid;v_event uuid;v_data jsonb;
BEGIN
 SELECT auth_user_id,parish_id INTO STRICT v_actor,v_parish FROM public.user_profiles WHERE role='parish' AND is_active LIMIT 1;
 INSERT INTO public.baptisms(parish_id,status,celebration_date,nombres,apellidos,book_number,folio,number,raw_data)
 VALUES(v_parish,'seated',DATE '2021-01-01','FICTICIA','V143','QA143','333','111','{"qaOnly":true}'::jsonb) RETURNING id INTO v_id;
 v_data:=jsonb_build_object('expected_coordinates',jsonb_build_object('book','QA143','folio','222','number','111'));
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 SELECT public.register_registry_print(v_parish,'bautismo',v_id,'partida',ARRAY[]::text[],'[]'::jsonb,v_data) INTO v_event;
 EXECUTE 'RESET ROLE';
 IF v_event IS NOT NULL THEN
  RAISE EXCEPTION 'V143-CONFIRMED: print request accepted stale client folio 222 while canonical is 333';
 END IF;
END $qa$;
ROLLBACK;