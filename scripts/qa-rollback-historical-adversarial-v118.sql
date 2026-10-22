-- SACRAMENTUM V118 · Laboratorio adversarial de decretos ANULACION (ROLLBACK)
BEGIN;
DO $qa$
DECLARE
 v_dio uuid; v_foreign_dio uuid; v_parish uuid; v_foreign_parish uuid;
 v_chancery uuid; v_install uuid; v_origin uuid; v_foreign_origin uuid; v_pending_origin uuid;
 v_bid uuid; v_number text; v_row uuid; v_decree uuid; v_result jsonb; v_archive uuid;
BEGIN
 SELECT diocese_id,auth_user_id INTO STRICT v_dio,v_chancery
 FROM public.user_profiles WHERE role='chancery' AND is_active;
 SELECT id INTO STRICT v_parish FROM public.parishes
 WHERE diocese_id=v_dio AND is_operational ORDER BY id LIMIT 1;
 SELECT id INTO STRICT v_install FROM public.legacy_source_installations ORDER BY id LIMIT 1;

 INSERT INTO public.dioceses(name) VALUES('QA-V118-DIOCESIS-EXCLUSIVAMENTE-FICTICIA')
 RETURNING id INTO v_foreign_dio;
 INSERT INTO public.parishes(name,diocese_id,is_operational)
 VALUES('QA-V118-PARROQUIA-AJENA',v_foreign_dio,false) RETURNING id INTO v_foreign_parish;

 INSERT INTO public.legacy_source_origins(
  source_installation_id,origin_key,origin_kind,display_name,mapped_parish_id,identity_status)
 VALUES(v_install,'QA-FOREIGN-'||substr(gen_random_uuid()::text,1,8),
 'qa_test','ORIGEN OTRA DIOCESIS',v_foreign_parish,'verified')
 RETURNING id INTO v_foreign_origin;
 INSERT INTO public.legacy_source_origins(
  source_installation_id,origin_key,origin_kind,display_name,mapped_parish_id,identity_status)
 VALUES(v_install,'QA-PENDING-'||substr(gen_random_uuid()::text,1,8),
 'qa_test','ORIGEN PENDIENTE NO VERIFICADO',v_parish,'pending')
 RETURNING id INTO v_pending_origin;
 INSERT INTO public.legacy_source_origins(
  source_installation_id,origin_key,origin_kind,display_name,mapped_parish_id,identity_status)
 VALUES(v_install,'QA-VALID-'||substr(gen_random_uuid()::text,1,8),
 'qa_test','ORIGEN FICTICIO VERIFICADO',v_parish,'verified')
 RETURNING id INTO v_origin;
 PERFORM set_config('request.jwt.claim.sub',v_chancery::text,true);

 BEGIN
  PERFORM public.materialize_legacy_decrees_v68(v_foreign_origin,10);
  RAISE EXCEPTION 'V118 FAIL acceso a otra diócesis';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.materialize_legacy_decrees_v68(v_pending_origin,10);
  RAISE EXCEPTION 'V118 FAIL origen pendiente';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;

 -- Dos sacramentos contienen el mismo libro/folio/número: revisión obligatoria.
 INSERT INTO public.baptisms(parish_id,book_number,folio,number,
 celebration_date,nombres,apellidos,status,raw_data)
 VALUES(v_parish,'QA118A','0001','0001','2001-01-01',
 'ORIGINAL','DOBLE','seated','{"qaOnly":true}'::jsonb);
 INSERT INTO public.confirmations(parish_id,book_number,folio,number,
 celebration_date,nombres,apellidos,status,raw_data)
 VALUES(v_parish,'QA118A','0001','0001','2001-01-01',
 'ORIGINAL','DOBLE','seated','{"qaOnly":true}'::jsonb);
 INSERT INTO public.legacy_archive_records(
 profile_key,source_sha256,source_key,source_installation_id,source_origin_id,
 parish_id,diocese_id,original_data)
 VALUES('ANULACION',repeat('1',64),'QA-AMBIGUOUS',v_install,v_origin,
 v_parish,v_dio,'{"decreto":"QA-V118-AMBIG","libro":"QA118A","folio":"1","numero":"1"}'::jsonb);

 -- Original único con reposición no encontrada: revisión.
 INSERT INTO public.baptisms(parish_id,book_number,folio,number,
 celebration_date,nombres,apellidos,status,raw_data)
 VALUES(v_parish,'QA118B','0002','0001','2001-01-01',
 'ORIGINAL','UNICO','seated','{"qaOnly":true}'::jsonb)
 RETURNING id INTO v_bid;
 INSERT INTO public.legacy_archive_records(
 profile_key,source_sha256,source_key,source_installation_id,source_origin_id,
 parish_id,diocese_id,original_data)
 VALUES('ANULACION',repeat('2',64),'QA-NO-REPLACEMENT',v_install,v_origin,
 v_parish,v_dio,'{"decreto":"QA-V118-NONE","libro":"QA118B","folio":"2","numero":"1","newlib":"QA118B","newfol":"2","newnum":"9"}'::jsonb);

 -- Imposible usar como nueva partida la misma partida original.
 INSERT INTO public.legacy_archive_records(
 profile_key,source_sha256,source_key,source_installation_id,source_origin_id,
 parish_id,diocese_id,original_data)
 VALUES('ANULACION',repeat('3',64),'QA-SELF-REPLACEMENT',v_install,v_origin,
 v_parish,v_dio,'{"decreto":"QA-V118-SELF","libro":"QA118B","folio":"2","numero":"1","newlib":"QA118B","newfol":"2","newnum":"1"}'::jsonb);

 -- Decreto histórico SIN fecha original: nunca fabricar una fecha actual.
 v_number:='QA-V118-DATE-'||substr(gen_random_uuid()::text,1,8);
 INSERT INTO public.legacy_archive_records(
 profile_key,source_sha256,source_key,source_installation_id,source_origin_id,
 parish_id,diocese_id,original_data)
 VALUES('ANULACION',repeat('4',64),'QA-UNDEFINED-DATE',v_install,v_origin,
 v_parish,v_dio,jsonb_build_object('decreto',v_number,'libro','QA118B',
 'folio','2','numero','1','fecha','DESCONOCIDA','fechanul','N/A'))
 RETURNING id INTO v_archive;

 SELECT public.materialize_legacy_decrees_v68(v_origin,50) INTO STRICT v_result;
 IF (v_result->>'materialized')::int<>1 OR (v_result->>'review_required')::int<>3
 THEN RAISE EXCEPTION 'V118 FAIL cómputo de riesgos %',v_result; END IF;

 IF (SELECT count(*) FROM public.legacy_archive_records
      WHERE source_origin_id=v_origin AND reconciliation_status='review_required')<>3
 THEN RAISE EXCEPTION 'V118 FAIL no protegió tres casos ambiguos'; END IF;
 SELECT id INTO STRICT v_decree FROM public.decretos WHERE payload->>'legacyArchiveRecordId'=v_archive::text;
 IF (SELECT decree_date FROM public.decretos WHERE id=v_decree) IS NOT NULL
 OR (SELECT status FROM public.decretos WHERE id=v_decree)<>'archived'
 OR (SELECT status FROM public.baptisms WHERE id=v_bid)<>'seated'
 OR (SELECT count(*) FROM public.marginal_notes WHERE decree_id=v_decree
      AND note_date IS NULL)<>1
 THEN RAISE EXCEPTION 'V118 FAIL historia sin fecha o estado adulterado'; END IF;
END $qa$;
ROLLBACK;