-- V174: explicit expected denial for unverified marriage nullity; original V128 remains as historical reproduction.
BEGIN;
DO $qa$
DECLARE v_actor uuid;v_parish uuid;v_marriage uuid;v_decree uuid;v_status text;v_error text;
 v_denied boolean:=false;v_number text:='QA-V174-'||substr(gen_random_uuid()::text,1,8);
BEGIN
 SELECT u.auth_user_id,p.id INTO STRICT v_actor,v_parish
 FROM public.user_profiles u JOIN public.parishes p ON p.diocese_id=u.diocese_id
 WHERE u.role='chancery' AND u.is_active=true
 AND upper(coalesce(u.status,'ACTIVE'))='ACTIVE'
 ORDER BY p.is_operational DESC,p.id LIMIT 1;
 INSERT INTO public.marriages(parish_id,status,celebration_date,book_number,folio,number,raw_data)
 VALUES(v_parish,'seated',DATE '2018-05-05','QA-V174','998','998',jsonb_build_object('qaOnly',true,'source','V174'))
 RETURNING id INTO v_marriage;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 BEGIN
  SELECT decree_id INTO v_decree FROM public.apply_marriage_nullity(v_marriage,v_number,DATE '2025-04-21',
  'Fictitious case without verified judicial evidence','{"qaOnly":true}'::jsonb,NULL);
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_error=MESSAGE_TEXT;
  IF v_error LIKE 'La nulidad exige autorización documental previa%'
  THEN v_denied:=true;ELSE RAISE;END IF;
 END;
 EXECUTE 'RESET ROLE';
 IF NOT v_denied THEN RAISE EXCEPTION 'V174 FAIL: nullity passed without verified judicial authorization';END IF;
 SELECT status INTO STRICT v_status FROM public.marriages WHERE id=v_marriage;
 IF v_status IS DISTINCT FROM 'seated' OR v_decree IS NOT NULL THEN
  RAISE EXCEPTION 'V174 FAIL: declined nullity mutated original/decree: %, %',v_status,v_decree;
 END IF;
END $qa$;
ROLLBACK;
