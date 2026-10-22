-- V146 · Antecedentes sin secuencia válida no deben bloquear la nueva solicitud. ROLLBACK.
BEGIN;
DO $qa$
DECLARE
 v_actor uuid;v_parish uuid;v_rec uuid;v_legacy_bad uuid;v_legacy_big uuid;
 v_first uuid;v_other uuid;v_a public.registry_print_events%rowtype;
 v_b public.registry_print_events%rowtype;
BEGIN
 SELECT auth_user_id,parish_id INTO STRICT v_actor,v_parish FROM public.user_profiles
 WHERE role='parish' AND is_active LIMIT 1;
 INSERT INTO public.baptisms(parish_id,status,celebration_date,nombres,apellidos,book_number,folio,number,raw_data)
 VALUES(v_parish,'seated',DATE '2022-01-01','LEGACY','V146','QA146','1','1','{"qaOnly":true}'::jsonb)
 RETURNING id INTO v_rec;
 INSERT INTO public.registry_print_events(parish_id,sacrament_type,sacrament_id,document_kind,selected_note_keys,included_notes,requested_by,metadata)
 VALUES(v_parish,'bautismo',v_rec,'partida','{}'::text[],'[]'::jsonb,v_actor,
   '{"qaOnly":true,"print_request_sequence":"NO_NUMERIC"}'::jsonb) RETURNING id INTO v_legacy_bad;
 INSERT INTO public.registry_print_events(parish_id,sacrament_type,sacrament_id,document_kind,selected_note_keys,included_notes,requested_by,metadata)
 VALUES(v_parish,'bautismo',v_rec,'constancia','{}'::text[],'[]'::jsonb,v_actor,
   '{"qaOnly":true,"print_request_sequence":"9999999999999999999999999"}'::jsonb) RETURNING id INTO v_legacy_big;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 SELECT public.register_registry_print(v_parish,'bautismo',v_rec,'partida',
    '{}'::text[],'[]'::jsonb,'{"qaOnly":true}'::jsonb) INTO v_first;
 SELECT public.register_registry_print(v_parish,'bautismo',v_rec,'constancia',
    '{}'::text[],'[]'::jsonb,'{"qaOnly":true}'::jsonb) INTO v_other;
 EXECUTE 'RESET ROLE';
 SELECT * INTO STRICT v_a FROM public.registry_print_events WHERE id=v_first;
 SELECT * INTO STRICT v_b FROM public.registry_print_events WHERE id=v_other;
 IF v_a.metadata->>'print_request_sequence'<>'2'
   OR v_a.metadata->>'previous_print_request_id'<>v_legacy_bad::text
   OR v_a.metadata->>'print_request_classification'<>'reimpresion_solicitada'
   OR v_b.metadata->>'print_request_sequence'<>'2'
   OR v_b.metadata->>'previous_print_request_id'<>v_legacy_big::text
   OR v_b.metadata->>'print_request_classification'<>'reimpresion_solicitada'
   OR (SELECT metadata->>'print_request_sequence' FROM public.registry_print_events WHERE id=v_legacy_bad)<>'NO_NUMERIC'
   OR (SELECT metadata->>'print_request_sequence' FROM public.registry_print_events WHERE id=v_legacy_big)<>'9999999999999999999999999'
 THEN RAISE EXCEPTION 'V146-FAIL: malformed historical metadata changed or broke new lineage'; END IF;
END $qa$;
ROLLBACK;