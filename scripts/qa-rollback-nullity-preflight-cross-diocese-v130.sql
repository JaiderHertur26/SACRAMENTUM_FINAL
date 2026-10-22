-- V130 · Consulta con una autorización local y otra de diócesis ajena (todo ficticio).
BEGIN;
DO $qa$
DECLARE
 v_diocese uuid;v_parish uuid;v_actor_chancery uuid;v_actor_diocese uuid;
 v_foreign_diocese uuid;v_foreign_parish uuid;
 v_marr_local uuid;v_marr_foreign uuid;v_auth_local uuid;v_auth_foreign uuid;
 v_actor uuid;v_scope jsonb;v_role text;
BEGIN
 SELECT diocese_id,auth_user_id INTO STRICT v_diocese,v_actor_chancery
 FROM public.user_profiles WHERE role='chancery' AND is_active LIMIT 1;
 SELECT auth_user_id INTO STRICT v_actor_diocese FROM public.user_profiles
 WHERE role='diocese' AND diocese_id=v_diocese AND is_active LIMIT 1;
 SELECT id INTO STRICT v_parish FROM public.parishes WHERE diocese_id=v_diocese ORDER BY id LIMIT 1;
 INSERT INTO public.dioceses(name) VALUES('QA-V130-DIOCESIS-FICTICIA-AJENA') RETURNING id INTO v_foreign_diocese;
 INSERT INTO public.parishes(name,diocese_id,is_operational)
 VALUES('QA-V130-PARROQUIA-AJENA',v_foreign_diocese,false) RETURNING id INTO v_foreign_parish;
 INSERT INTO public.marriages(parish_id,status,celebration_date,book_number,folio,number,raw_data)
 VALUES(v_parish,'seated',DATE '2018-05-05','QA130','991','991','{"qaOnly":true}'::jsonb)
 RETURNING id INTO v_marr_local;
 INSERT INTO public.marriages(parish_id,status,celebration_date,book_number,folio,number,raw_data)
 VALUES(v_foreign_parish,'seated',DATE '2017-05-05','QA130','990','990','{"qaOnly":true}'::jsonb)
 RETURNING id INTO v_marr_foreign;
 INSERT INTO public.nullity_execution_authorizations_v128(
 marriage_id,parish_id,diocese_id,decree_number,decree_date,court_issuer,
 court_document_reference,court_document_date,court_document_sha256,
 request_justification,requested_by)
 VALUES(v_marr_local,v_parish,v_diocese,'QA-V130-L',DATE '2025-04-12',
  'TRIBUNAL FICTICIO LOCAL','QA-V130-REF-LOCAL',DATE '2025-04-12',
  repeat('c',64),'SOLICITUD FICTICIA LOCAL PARA PRUEBA DE CONSULTA DE EXPEDIENTES.',
  v_actor_chancery) RETURNING id INTO v_auth_local;
 INSERT INTO public.nullity_execution_authorizations_v128(
 marriage_id,parish_id,diocese_id,decree_number,decree_date,court_issuer,
 court_document_reference,court_document_date,court_document_sha256,
 request_justification,requested_by)
 VALUES(v_marr_foreign,v_foreign_parish,v_foreign_diocese,'QA-V130-F',DATE '2025-04-12',
  'TRIBUNAL FICTICIO AJENO','QA-V130-REF-AJENA',DATE '2025-04-12',
  repeat('d',64),'SOLICITUD FICTICIA AJENA, TOTALMENTE AISLADA DE LOS DATOS.',
  v_actor_chancery) RETURNING id INTO v_auth_foreign;
 FOREACH v_role IN ARRAY ARRAY['chancery','diocese'] LOOP
   v_actor:=CASE WHEN v_role='chancery' THEN v_actor_chancery ELSE v_actor_diocese END;
   PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
   EXECUTE 'SET LOCAL ROLE authenticated';
   SELECT public.list_marriage_nullity_execution_v130('pending_diocesan_review') INTO v_scope;
   EXECUTE 'RESET ROLE';
   IF jsonb_typeof(v_scope)<>'array'
      OR NOT v_scope @> jsonb_build_array(jsonb_build_object('id',v_auth_local))
      OR v_scope @> jsonb_build_array(jsonb_build_object('id',v_auth_foreign)) THEN
      RAISE EXCEPTION 'V130 compromised jurisdiction filter for %: %',v_role,v_scope;
   END IF;
 END LOOP;
END $qa$;
ROLLBACK;