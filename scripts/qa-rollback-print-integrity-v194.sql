-- V194: cuatro sacramentos, constancia cotejada con libro, folio, número y versión;
-- 4 omisiones antiguas, 12 discrepancias y notas obligatorias no permitidas.
-- Prueba enteramente ficticia, ejecutada con rol authenticated y ROLLBACK.
BEGIN;
SET LOCAL statement_timeout='30000ms';
DO $qa$
DECLARE
 actor uuid;parish uuid;kind text;tbl text; rec uuid;note uuid;event_id uuid;
 coord jsonb; meta jsonb; server_row public.registry_print_events%rowtype;
 wrong jsonb; err text;ok integer:=0;denied integer:=0; note_content text;
 row_updated timestamptz; fol text; num text;
BEGIN
 SELECT auth_user_id,parish_id INTO STRICT actor,parish
 FROM public.user_profiles WHERE role='parish' AND is_active IS TRUE AND upper(status)='ACTIVE' AND parish_id IS NOT NULL LIMIT 1;
 FOREACH kind IN ARRAY ARRAY['bautismo','confirmacion','matrimonio','exequias'] LOOP
  fol :=CASE kind WHEN 'bautismo' THEN '884' WHEN 'confirmacion' THEN '885' WHEN 'matrimonio' THEN '886' ELSE '887' END;
  num :=CASE kind WHEN 'bautismo' THEN '893' WHEN 'confirmacion' THEN '894' WHEN 'matrimonio' THEN '895' ELSE '896' END;
  IF kind='bautismo' THEN
    tbl:='baptisms';
    INSERT INTO public.baptisms(parish_id,status,celebration_date,nombres,apellidos,book_number,folio,number,raw_data)
    VALUES(parish,'seated','2026-10-20','QA194','BAUTISMO','QA194',fol,num,'{"qaOnly":true}'::jsonb) RETURNING id,updated_at INTO rec,row_updated;
  ELSIF kind='confirmacion' THEN
    tbl:='confirmations';
    INSERT INTO public.confirmations(parish_id,status,celebration_date,nombres,apellidos,book_number,folio,number,raw_data)
    VALUES(parish,'seated','2026-10-20','QA194','CONFIRMACION','QA194',fol,num,'{"qaOnly":true}'::jsonb) RETURNING id,updated_at INTO rec,row_updated;
  ELSIF kind='matrimonio' THEN
    tbl:='marriages';
    INSERT INTO public.marriages(parish_id,status,celebration_date,book_number,folio,number,raw_data)
    VALUES(parish,'seated','2026-10-20','QA194',fol,num,'{"qaOnly":true}'::jsonb) RETURNING id,updated_at INTO rec,row_updated;
  ELSE
    tbl:='funerals';
    INSERT INTO public.funerals(parish_id,status,nombres,apellidos,fecha_defuncion,fecha_exequias,book_number,folio,number,raw_data)
    VALUES(parish,'seated','QA194','EXEQUIAS','2026-10-18','2026-10-20','QA194',fol,num,'{"qaOnly":true}'::jsonb) RETURNING id,updated_at INTO rec,row_updated;
  END IF;

  note_content:='NOTA MARGINAL OBLIGATORIA V194 '||kind;
  INSERT INTO public.marginal_notes(parish_id,sacrament_type,sacrament_id,note_type,content,status,print_policy,print_default)
  VALUES(parish,kind,rec,'qa_required',note_content,'active','required',true) RETURNING id INTO note;

  coord:=jsonb_build_object('book','QA194','folio',fol,'number',num);
  meta:=jsonb_build_object('expected_coordinates',coord,'expected_record_updated_at',row_updated::text,'document_sha256',repeat('a',64));

  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);

  -- Una petición heredada con nota correcta, pero sin cotejo de versión, debe ser denegada.
  BEGIN
   PERFORM public.register_registry_print(parish,kind,rec,'partida',ARRAY[note::text],
    jsonb_build_array(jsonb_build_object('id',note::text,'policy','required','content',note_content)),'{}'::jsonb);
   RAISE EXCEPTION 'V194 old unchecked print accepted %',kind;
  EXCEPTION WHEN check_violation THEN denied:=denied+1;END;

  -- El libro erróneo no puede quedar declarado como verificado.
  BEGIN
   wrong:=jsonb_set(meta,'{expected_coordinates,book}','"FICTICIOUS_OTHER_BOOK"'::jsonb);
   PERFORM public.register_registry_print(parish,kind,rec,'partida',ARRAY[note::text],
    jsonb_build_array(jsonb_build_object('id',note::text,'policy','required','content',note_content)),wrong);
   RAISE EXCEPTION 'V194 wrong book accepted %',kind;
  EXCEPTION WHEN check_violation THEN denied:=denied+1;END;

  -- Tampoco una versión obsoleta.
  BEGIN
   wrong:=jsonb_set(meta,'{expected_record_updated_at}',to_jsonb((row_updated - INTERVAL '1 day')::text));
   PERFORM public.register_registry_print(parish,kind,rec,'partida',ARRAY[note::text],
    jsonb_build_array(jsonb_build_object('id',note::text,'policy','required','content',note_content)),wrong);
   RAISE EXCEPTION 'V194 stale version accepted %',kind;
  EXCEPTION WHEN check_violation THEN denied:=denied+1;END;

  -- Una huella de HTML inválida debe bloquearse.
  BEGIN
   wrong:=jsonb_set(meta,'{document_sha256}','"weak"'::jsonb);
   PERFORM public.register_registry_print(parish,kind,rec,'partida',ARRAY[note::text],
    jsonb_build_array(jsonb_build_object('id',note::text,'policy','required','content',note_content)),wrong);
   RAISE EXCEPTION 'V194 malformed digest accepted %',kind;
  EXCEPTION WHEN check_violation THEN denied:=denied+1;END;

  -- No se omite una nota obligatoria.
  BEGIN
   PERFORM public.register_registry_print(parish,kind,rec,'partida',ARRAY[]::text[],'[]'::jsonb,meta);
   RAISE EXCEPTION 'V194 required note absent accepted %',kind;
  EXCEPTION WHEN check_violation THEN denied:=denied+1;END;

  SELECT public.register_registry_print(parish,kind,rec,'partida',ARRAY[note::text],
    jsonb_build_array(jsonb_build_object('id',note::text,'policy','required','content',note_content)),meta) INTO event_id;
  SELECT * INTO STRICT server_row FROM public.registry_print_events WHERE id=event_id;
  IF server_row.parish_id<>parish OR server_row.sacrament_id<>rec OR server_row.sacrament_type<>kind
   OR server_row.requested_by<>actor
   OR server_row.metadata->>'coordinates_checked'<>'true'
   OR server_row.metadata->>'record_version_checked'<>'true'
   OR server_row.metadata->>'book'<>'QA194'
   OR server_row.metadata->>'folio'<>fol
   OR server_row.metadata->>'number'<>num
   OR server_row.metadata->>'document_sha256'<>repeat('a',64)
   OR server_row.included_notes->0->>'id'<>note::text
   OR server_row.included_notes->0->>'provenance'<>'persisted_verified'
  THEN RAISE EXCEPTION 'V194 invalid printed receipt %',kind;END IF;
  EXECUTE 'RESET ROLE';
  ok:=ok+1;
 END LOOP;
 IF ok<>4 OR denied<>20 THEN RAISE EXCEPTION 'V194 incomplete: % valid, % denials',ok,denied;END IF;
 PERFORM set_config('qa194.result',jsonb_build_object('verified_receipts',ok,'rejected_invalid_requests',denied,
  'required_notes_preserved',4,'sacraments_covered',4,'rollback',true)::text,true);
END $qa$;
SELECT current_setting('qa194.result')::jsonb AS qa_result;
ROLLBACK;