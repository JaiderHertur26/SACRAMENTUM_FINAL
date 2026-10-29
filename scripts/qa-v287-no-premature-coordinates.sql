DO $qa$
DECLARE ca uuid; da uuid; pa uuid; di uuid; orig uuid; concept public.conceptos_anulacion%rowtype;
 issued jsonb; dec uuid; pend uuid; n integer;
BEGIN
 SELECT up.auth_user_id,up.diocese_id INTO ca,di FROM public.user_profiles up
 WHERE up.role='chancery' AND up.status='ACTIVE' AND up.is_active LIMIT 1;
 SELECT up.auth_user_id INTO da FROM public.user_profiles up
 WHERE up.role='diocese' AND up.diocese_id=di AND up.status='ACTIVE' AND up.is_active LIMIT 1;
 SELECT up.parish_id INTO pa FROM public.user_profiles up
 WHERE up.role='parish' AND up.diocese_id=di AND up.status='ACTIVE' AND up.is_active LIMIT 1;
 SELECT b.id INTO orig FROM public.baptisms b WHERE b.parish_id=pa
 AND lower(coalesce(b.status,'seated')) NOT IN('anulada','reversed','cancelled') LIMIT 1;
 SELECT * INTO concept FROM public.conceptos_anulacion x
 WHERE x.diocese_id=di AND x.enlibro=2 AND x.seinscribe AND x.is_active
 AND lower(x.tipo)='porcorreccion' ORDER BY x.codigo LIMIT 1;
 IF ca IS NULL OR da IS NULL OR pa IS NULL OR orig IS NULL OR concept.id IS NULL THEN
  RAISE EXCEPTION 'V287 QA identity not complete'; END IF;
 PERFORM set_config('request.jwt.claim.sub',da::text,true);
 PERFORM public.approve_decree_concept_for_new_seat_v282(concept.id,'QA-V287-PERMIT-01');
 PERFORM set_config('request.jwt.claim.sub',ca::text,true);
 issued:=public.issue_chancery_form_decree_v287(pa,'bautismo','correccion',orig,concept.id,
  'QA-V287-0001',date '2026-10-28','THIAGO JUNIOR SIERRA REYES',
  'Corrección documental de prueba con datos del expediente original',
  'QA-EVIDENCE-V287-001',
  jsonb_build_object('nombres','THIAGO JUNIOR','apellidos','SIERRA REYES',
   'fechaSacramento','2026-10-20','sexo','1','book_number','9999',
   'folio','9999','number','9999'),
  jsonb_build_object('originalPartidaSummary',
   jsonb_build_object('book','0001','page','0001','entry','0001')));
 IF issued->>'status'<>'awaiting_parish' OR issued->>'book' IS NOT NULL
 OR issued->>'folio' IS NOT NULL OR issued->>'number' IS NOT NULL THEN
  RAISE EXCEPTION 'V287 wrongly numbered: %',issued; END IF;
 dec:=(issued->>'decreeId')::uuid;
 pend:=(issued->>'pendingId')::uuid;
 SELECT count(*) INTO n FROM public.decretos d JOIN public.official_notifications x
 ON x.decree_id=d.id WHERE d.id=dec AND d.replacement_record_id IS NULL
 AND d.payload->>'seatBook' IS NULL AND d.payload->>'seatFolio' IS NULL
 AND d.payload->>'seatNumber' IS NULL AND x.status='pending';
 IF n<>1 THEN RAISE EXCEPTION 'V287 did not defer decree'; END IF;
 SELECT count(*) INTO n FROM public.pending_baptisms b WHERE b.id=pend
 AND b.status='pending' AND b.raw_data->>'book_number' IS NULL
 AND b.raw_data->>'folio' IS NULL AND b.raw_data->>'number' IS NULL;
 IF n<>1 THEN RAISE EXCEPTION 'V287 pending coordinates exist'; END IF;
END $qa$;
ROLLBACK;