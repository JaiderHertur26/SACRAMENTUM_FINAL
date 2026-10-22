-- SACRAMENTUM V118: laboratorio exclusivamente ficticio, siempre ROLLBACK.
BEGIN;
DO $qa$
DECLARE
 v_dio uuid; v_parish uuid; v_foreign_parish uuid; v_chancery uuid; v_diocesan uuid;
 v_parish_user uuid; v_admin uuid; v_install uuid; v_origin uuid; v_other_origin uuid;
 v_original uuid; v_new uuid; v_archive uuid; v_decree uuid; v_materialized jsonb;
 v_row_id uuid; v_concept text; v_ref text; v_count bigint;
 v_record jsonb;
BEGIN
 SELECT diocese_id,auth_user_id INTO STRICT v_dio,v_chancery
 FROM public.user_profiles WHERE role='chancery' AND is_active;
 SELECT auth_user_id INTO STRICT v_diocesan FROM public.user_profiles
 WHERE role='diocese' AND is_active AND diocese_id=v_dio;
 SELECT auth_user_id INTO STRICT v_parish_user FROM public.user_profiles
 WHERE role='parish' AND is_active AND diocese_id=v_dio;
 SELECT auth_user_id INTO STRICT v_admin FROM public.user_profiles
 WHERE role='admin_general' AND is_active;
 SELECT id INTO STRICT v_parish FROM public.parishes
 WHERE diocese_id=v_dio AND is_operational ORDER BY id LIMIT 1;
 SELECT id INTO STRICT v_foreign_parish FROM public.parishes
 WHERE diocese_id=v_dio AND id<>v_parish ORDER BY id LIMIT 1;
 SELECT id INTO STRICT v_install FROM public.legacy_source_installations ORDER BY id LIMIT 1;
 INSERT INTO public.legacy_source_origins(
   source_installation_id,origin_key,origin_kind,display_name,
   mapped_parish_id,identity_status)
 VALUES(v_install,'QA-V118-'||substr(gen_random_uuid()::text,1,10),
   'qa_test','FUENTE FICTICIA DE DECRETOS V118',v_parish,'verified')
 RETURNING id INTO v_origin;
 INSERT INTO public.legacy_source_origins(
   source_installation_id,origin_key,origin_kind,display_name,
   mapped_parish_id,identity_status)
 VALUES(v_install,'QA-CONCEPT-OTHER-'||substr(gen_random_uuid()::text,1,10),
   'qa_test','FUENTE AJENA FICTICIA',v_parish,'verified')
 RETURNING id INTO v_other_origin;
 INSERT INTO public.legacy_archive_records(
  profile_key,source_sha256,source_key,source_installation_id,source_origin_id,
  parish_id,diocese_id,original_data)
 VALUES('CPTOANULA',repeat('a',64),'QA-CONCEPT-GOOD',v_install,v_origin,
  v_parish,v_dio,'{"codigo":"008","concepto":"CONCEPTO FICTICIO V118 CORRECTO"}'::jsonb),
 ('CPTOANULA',repeat('b',64),'QA-CONCEPT-FOREIGN',v_install,v_other_origin,
  v_parish,v_dio,'{"codigo":"008","concepto":"CONCEPTO DE OTRO ORIGEN (PROHIBIDO)"}'::jsonb);

 INSERT INTO public.baptisms(parish_id,book_number,folio,number,
 celebration_date,nombres,apellidos,status,raw_data)
 VALUES(v_parish,'QA118','0007','0011','2001-01-01','PRUEBA','ORIGINAL',
 'seated','{"qaOnly":true,"origin":"V118"}'::jsonb)
 RETURNING id INTO v_original;
 INSERT INTO public.baptisms(parish_id,book_number,folio,number,
 celebration_date,nombres,apellidos,status,raw_data)
 VALUES(v_parish,'QA118','0007','0012','2001-01-01','PRUEBA','SUPLETORIA',
 'seated','{"qaOnly":true,"origin":"V118"}'::jsonb)
 RETURNING id INTO v_new;

 v_ref:='QA-DEC-V118-'||substr(gen_random_uuid()::text,1,8);
 v_record:=jsonb_build_object('decreto',v_ref,'libro','QA118','folio','7','numero','11',
   'newlib','QA118','newfol','7','newnum','12','codiconcep','008',
   'fecha','2002-04-19','observacio','Expediente ficticio sin validez jurídica');
 INSERT INTO public.legacy_archive_records(
  profile_key,source_sha256,source_key,source_installation_id,source_origin_id,
  parish_id,diocese_id,original_data)
 VALUES('ANULACION',repeat('c',64),'QA-HISTORICAL-VALID',v_install,v_origin,
  v_parish,v_dio,v_record) RETURNING id INTO v_archive;

 -- Tres actores no autorizados y la llamada sin origen deben abortar sin cambiar el archivo.
 FOREACH v_row_id IN ARRAY ARRAY[v_diocesan,v_parish_user,v_admin] LOOP
  PERFORM set_config('request.jwt.claim.sub',v_row_id::text,true);
  BEGIN
   PERFORM public.materialize_legacy_decrees_v68(v_origin,50);
   RAISE EXCEPTION 'V118-FAIL un rol externo materializó';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub',v_chancery::text,true);
 BEGIN
   PERFORM public.materialize_legacy_decrees_v68(NULL,50);
   RAISE EXCEPTION 'V118-FAIL origen opcional';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 IF (SELECT reconciliation_status FROM public.legacy_archive_records WHERE id=v_archive)<>'archived'
 THEN RAISE EXCEPTION 'V118-FAIL: actor prohibido cambió estado'; END IF;

 SELECT public.materialize_legacy_decrees_v68(v_origin,50) INTO STRICT v_materialized;
 IF (v_materialized->>'materialized')::integer<>1 THEN
  RAISE EXCEPTION 'V118-FAIL materialización ficticia: %',v_materialized; END IF;
 SELECT id INTO STRICT v_decree FROM public.decretos
 WHERE payload->>'legacyArchiveRecordId'=v_archive::text;
 IF (SELECT status FROM public.decretos WHERE id=v_decree)<>'archived'
 OR (SELECT issued_by FROM public.decretos WHERE id=v_decree) IS NOT NULL
 OR (SELECT parish_id FROM public.decretos WHERE id=v_decree)<>v_parish
 OR (SELECT diocese_id FROM public.decretos WHERE id=v_decree)<>v_dio
 OR (SELECT original_record_id FROM public.decretos WHERE id=v_decree)<>v_original
 OR (SELECT replacement_record_id FROM public.decretos WHERE id=v_decree)<>v_new
 OR (SELECT payload->>'registersEffect' FROM public.decretos WHERE id=v_decree)<>'false'
 OR (SELECT payload->>'recordOrigin' FROM public.decretos WHERE id=v_decree)<>'historical_archive'
 THEN RAISE EXCEPTION 'V118-FAIL trazabilidad, estado o carácter histórico'; END IF;
 IF (SELECT payload->>'concept' FROM public.decretos WHERE id=v_decree)
  <>'CONCEPTO FICTICIO V118 CORRECTO'
 THEN RAISE EXCEPTION 'V118-FAIL se mezclaron conceptos de orígenes'; END IF;
 IF (SELECT status FROM public.baptisms WHERE id=v_original)<>'seated'
 OR (SELECT status FROM public.baptisms WHERE id=v_new)<>'seated'
 THEN RAISE EXCEPTION 'V118-FAIL alteró la vigencia de partidas históricas'; END IF;
 IF (SELECT count(*) FROM public.marginal_notes WHERE decree_id=v_decree)<>2
 OR (SELECT count(*) FROM public.official_notifications WHERE decree_id=v_decree
     AND receiver_parish_id=v_parish AND payload->>'historicalArchive'='true')<>1
 THEN RAISE EXCEPTION 'V118-FAIL faltan dos notas o aviso a parroquia'; END IF;
 SELECT public.materialize_legacy_decrees_v68(v_origin,50) INTO STRICT v_materialized;
 IF (v_materialized->>'materialized')::integer<>0
 OR (SELECT count(*) FROM public.decretos WHERE payload->>'legacyArchiveRecordId'=v_archive::text)<>1
 THEN RAISE EXCEPTION 'V118-FAIL segunda ejecución creó duplicado'; END IF;

 -- Colisión de número documental: debe pasar a revisión, nunca generar segundo decreto.
 INSERT INTO public.legacy_archive_records(
  profile_key,source_sha256,source_key,source_installation_id,source_origin_id,
  parish_id,diocese_id,original_data)
 VALUES('ANULACION',repeat('d',64),'QA-COLLISION',v_install,v_origin,v_parish,v_dio,
  v_record||jsonb_build_object('observacio','Colisión documental ficticia'))
 RETURNING id INTO v_row_id;
 SELECT public.materialize_legacy_decrees_v68(v_origin,50) INTO STRICT v_materialized;
 IF (SELECT reconciliation_status FROM public.legacy_archive_records WHERE id=v_row_id)<>'review_required'
 OR (SELECT metadata->>'decree_reconciliation_v118' FROM public.legacy_archive_records
  WHERE id=v_row_id)<>'decree_number_collision'
 THEN RAISE EXCEPTION 'V118-FAIL colisión no llegó a revisión'; END IF;

 -- Fuente sin número: no debe improvisarse un nuevo decreto.
 INSERT INTO public.legacy_archive_records(
  profile_key,source_sha256,source_key,source_installation_id,source_origin_id,
  parish_id,diocese_id,original_data)
 VALUES('ANULACION',repeat('e',64),'QA-MISSING-NUMBER',v_install,v_origin,
  v_parish,v_dio,v_record - 'decreto')
 RETURNING id INTO v_row_id;
 SELECT public.materialize_legacy_decrees_v68(v_origin,50) INTO STRICT v_materialized;
 IF (SELECT metadata->>'decree_reconciliation_v118' FROM public.legacy_archive_records
  WHERE id=v_row_id)<>'missing_historical_decree_reference'
 THEN RAISE EXCEPTION 'V118-FAIL número faltante no bloqueado'; END IF;

 -- Origen y parroquia no concordantes: sólo revisión, sin alterar otras parroquias.
 INSERT INTO public.legacy_archive_records(
  profile_key,source_sha256,source_key,source_installation_id,source_origin_id,
  parish_id,diocese_id,original_data)
 VALUES('ANULACION',repeat('f',64),'QA-WRONG-PARISH',v_install,v_origin,
  v_foreign_parish,v_dio,v_record||jsonb_build_object('decreto','QA-WRONG-'||v_ref))
 RETURNING id INTO v_row_id;
 SELECT public.materialize_legacy_decrees_v68(v_origin,50) INTO STRICT v_materialized;
 IF (SELECT metadata->>'decree_reconciliation_v118' FROM public.legacy_archive_records
  WHERE id=v_row_id)<>'source_parish_or_diocese_mismatch'
 THEN RAISE EXCEPTION 'V118-FAIL parroquia distinta no detectada'; END IF;
END $qa$;
ROLLBACK;