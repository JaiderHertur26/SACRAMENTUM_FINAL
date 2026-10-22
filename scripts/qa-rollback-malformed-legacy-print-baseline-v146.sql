-- V146 baseline · Una petición histórica con secuencia de cliente malformada rompe la próxima reimpresión. ROLLBACK.
BEGIN;
DO $qa$
DECLARE v_actor uuid;v_parish uuid;v_rec uuid;v_event uuid;
BEGIN
 SELECT auth_user_id,parish_id INTO STRICT v_actor,v_parish FROM public.user_profiles WHERE role='parish' and is_active LIMIT 1;
 INSERT INTO public.baptisms(parish_id,status,celebration_date,nombres,apellidos,book_number,folio,number,raw_data)
 VALUES(v_parish,'seated',DATE '2022-01-01','LEGACY','FICTICIA','QA146','1','1','{"qaOnly":true}'::jsonb)
 RETURNING id INTO v_rec;
 INSERT INTO public.registry_print_events(parish_id,sacrament_type,sacrament_id,document_kind,
   selected_note_keys,included_notes,requested_by,metadata)
 VALUES(v_parish,'bautismo',v_rec,'partida','{}'::text[],'[]'::jsonb,v_actor,
   '{"qaOnly":true,"print_request_sequence":"NO_NUMERIC"}'::jsonb);
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 SELECT public.register_registry_print(v_parish,'bautismo',v_rec,'partida',
  '{}'::text[],'[]'::jsonb,'{"qaOnly":true}'::jsonb) INTO v_event;
 EXECUTE 'RESET ROLE';
 IF v_event IS NOT NULL THEN RAISE EXCEPTION 'V146-BASELINE-UNEXPECTED: invalid metadata was tolerated'; END IF;
END $qa$;
ROLLBACK;