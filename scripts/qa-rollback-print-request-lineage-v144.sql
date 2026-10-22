-- V144 · Tres solicitudes por partida y una variante documental, con linaje único. Todas en ROLLBACK.
BEGIN;
DO $qa$
DECLARE
 v_actor uuid;v_parish uuid;v_kind text;v_record uuid;v_first uuid;v_second uuid;v_third uuid;v_other uuid;
 v_one public.registry_print_events%rowtype;v_two public.registry_print_events%rowtype;
 v_three public.registry_print_events%rowtype;v_alt public.registry_print_events%rowtype;
 v_passed int:=0;
BEGIN
 SELECT auth_user_id,parish_id INTO STRICT v_actor,v_parish FROM public.user_profiles WHERE role='parish' AND is_active LIMIT 1;
 FOREACH v_kind IN ARRAY ARRAY['bautismo','confirmacion','matrimonio','exequias'] LOOP
   IF v_kind='bautismo' THEN
     INSERT INTO public.baptisms(parish_id,status,celebration_date,nombres,apellidos,book_number,folio,number,raw_data)
      VALUES(v_parish,'seated',DATE '2022-01-01','QA','V144','QA144','1','1','{"qaOnly":true}'::jsonb) RETURNING id INTO v_record;
   ELSIF v_kind='confirmacion' THEN
     INSERT INTO public.confirmations(parish_id,status,celebration_date,nombres,apellidos,book_number,folio,number,raw_data)
      VALUES(v_parish,'seated',DATE '2022-01-01','QA','V144','QA144','1','1','{"qaOnly":true}'::jsonb) RETURNING id INTO v_record;
   ELSIF v_kind='matrimonio' THEN
     INSERT INTO public.marriages(parish_id,status,celebration_date,book_number,folio,number,raw_data)
      VALUES(v_parish,'seated',DATE '2022-01-01','QA144','1','1','{"qaOnly":true}'::jsonb) RETURNING id INTO v_record;
   ELSE
     INSERT INTO public.funerals(parish_id,status,nombres,apellidos,fecha_nacimiento,fecha_defuncion,fecha_exequias,book_number,folio,number,raw_data)
      VALUES(v_parish,'seated','QA','V144',DATE '1950-01-01',DATE '2022-01-01',DATE '2022-01-02','QA144','1','1','{"qaOnly":true}'::jsonb) RETURNING id INTO v_record;
   END IF;
   PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
   EXECUTE 'SET LOCAL ROLE authenticated';
   SELECT public.register_registry_print(v_parish,v_kind,v_record,'partida',
     ARRAY[]::text[],'[]'::jsonb,'{"qaOnly":true}'::jsonb) INTO v_first;
   SELECT public.register_registry_print(v_parish,v_kind,v_record,'partida',
     ARRAY[]::text[],'[]'::jsonb,'{"qaOnly":true}'::jsonb) INTO v_second;
   SELECT public.register_registry_print(v_parish,v_kind,v_record,'partida',
     ARRAY[]::text[],'[]'::jsonb,'{"qaOnly":true}'::jsonb) INTO v_third;
   SELECT public.register_registry_print(v_parish,v_kind,v_record,'constancia',
     ARRAY[]::text[],'[]'::jsonb,'{"qaOnly":true}'::jsonb) INTO v_other;
   SELECT * INTO STRICT v_one FROM public.registry_print_events WHERE id=v_first;
   SELECT * INTO STRICT v_two FROM public.registry_print_events WHERE id=v_second;
   SELECT * INTO STRICT v_three FROM public.registry_print_events WHERE id=v_third;
   SELECT * INTO STRICT v_alt FROM public.registry_print_events WHERE id=v_other;
   EXECUTE 'RESET ROLE';

   IF v_one.metadata->>'print_request_sequence'<>'1'
      OR v_one.metadata->>'print_request_classification'<>'primera_solicitud'
      OR v_one.metadata->>'previous_print_request_id' IS NOT NULL
      OR v_two.metadata->>'print_request_sequence'<>'2'
      OR v_two.metadata->>'previous_print_request_id'<>v_first::text
      OR v_three.metadata->>'print_request_sequence'<>'3'
      OR v_three.metadata->>'previous_print_request_id'<>v_second::text
      OR v_three.metadata->>'print_request_classification'<>'reimpresion_solicitada'
      OR v_alt.metadata->>'print_request_sequence'<>'1'
      OR v_alt.metadata->>'print_request_classification'<>'primera_solicitud'
      OR v_alt.metadata->>'previous_print_request_id' IS NOT NULL
      OR v_alt.document_kind<>'constancia'
      OR (SELECT count(*) FROM public.registry_print_events WHERE sacrament_id=v_record)<>4
    THEN RAISE EXCEPTION 'V145-FAIL: request chain for % is inconsistent',v_kind;
   END IF;
   v_passed:=v_passed+1;
 END LOOP;
 IF v_passed<>4 THEN RAISE EXCEPTION 'V144 expected 4 sacraments, got %',v_passed; END IF;
END $qa$;
ROLLBACK;