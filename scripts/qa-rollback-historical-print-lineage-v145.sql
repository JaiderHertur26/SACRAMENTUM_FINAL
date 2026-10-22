-- V145 · Historial de copia antigua sin consecutivo, seguido por dos reimpresiones nuevas: ROLLBACK.
BEGIN;
DO $qa$
DECLARE
 v_actor uuid;v_parish uuid;v_rec uuid;v_legacy uuid;v_copy1 uuid;v_copy2 uuid;v_alt uuid;
 v_a public.registry_print_events%rowtype;v_b public.registry_print_events%rowtype;
 v_c public.registry_print_events%rowtype;v_denied int:=0;
BEGIN
 SELECT auth_user_id,parish_id INTO STRICT v_actor,v_parish FROM public.user_profiles WHERE role='parish' AND is_active LIMIT 1;
 INSERT INTO public.baptisms(parish_id,status,celebration_date,nombres,apellidos,book_number,folio,number,raw_data)
 VALUES(v_parish,'seated',DATE '2020-01-01','HISTORICO','QA145','QA145','1','3','{"qaOnly":true}'::jsonb)
 RETURNING id INTO v_rec;
 INSERT INTO public.registry_print_events(
  parish_id,sacrament_type,sacrament_id,document_kind,selected_note_keys,included_notes,requested_by,metadata)
 VALUES(v_parish,'bautismo',v_rec,'partida','{}'::text[],'[]'::jsonb,v_actor,
   '{"qaOnly":true,"legacyNoSequence":true}'::jsonb)
 RETURNING id INTO v_legacy;

 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 SELECT public.register_registry_print(v_parish,'bautismo',v_rec,'partida',
    '{}'::text[],'[]'::jsonb,'{"qaOnly":true}'::jsonb) INTO v_copy1;
 SELECT public.register_registry_print(v_parish,'bautismo',v_rec,'partida',
    '{}'::text[],'[]'::jsonb,'{"qaOnly":true}'::jsonb) INTO v_copy2;
 SELECT public.register_registry_print(v_parish,'bautismo',v_rec,'constancia',
    '{}'::text[],'[]'::jsonb,'{"qaOnly":true}'::jsonb) INTO v_alt;
 EXECUTE 'RESET ROLE';

 SELECT * INTO STRICT v_a FROM public.registry_print_events WHERE id=v_copy1;
 SELECT * INTO STRICT v_b FROM public.registry_print_events WHERE id=v_copy2;
 SELECT * INTO STRICT v_c FROM public.registry_print_events WHERE id=v_alt;
 IF v_a.metadata->>'print_request_sequence'<>'2'
    OR v_a.metadata->>'previous_print_request_id'<>v_legacy::text
    OR v_a.metadata->>'print_request_classification'<>'reimpresion_solicitada'
    OR v_b.metadata->>'print_request_sequence'<>'3'
    OR v_b.metadata->>'previous_print_request_id'<>v_copy1::text
    OR v_c.metadata->>'print_request_sequence'<>'1'
    OR v_c.metadata->>'previous_print_request_id' IS NOT NULL
    OR (SELECT metadata->>'print_request_sequence'
        FROM public.registry_print_events WHERE id=v_legacy) IS NOT NULL
 THEN
   RAISE EXCEPTION 'V145-FAIL: historical request must retain its metadata and new lineage must not skip/cycle';
 END IF;
END $qa$;
ROLLBACK;