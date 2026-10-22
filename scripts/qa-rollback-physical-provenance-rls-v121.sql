-- V121 · Reproducción de lectura cruzada en artefactos físicos, filas y hashes (solo ROLLBACK).
BEGIN;
DO $qa$
DECLARE v_dio uuid;v_user uuid;v_parish uuid;v_foreign_dio uuid;v_foreign_parish uuid;
 v_install uuid;v_origin uuid;v_artifact uuid;v_row uuid;v_hash uuid;
 v_n_artifacts int;v_n_rows int;v_n_hashes int;v_n_files int;
BEGIN
 SELECT diocese_id,auth_user_id INTO STRICT v_dio,v_user FROM public.user_profiles WHERE role='diocese' AND is_active LIMIT 1;
 SELECT id INTO STRICT v_parish FROM public.parishes WHERE diocese_id=v_dio ORDER BY id LIMIT 1;
 SELECT id INTO STRICT v_install FROM public.legacy_source_installations WHERE owner_diocese_id=v_dio LIMIT 1;
 INSERT INTO public.dioceses(name) VALUES('QA-V121-FOREIGN-DIO') RETURNING id INTO v_foreign_dio;
 INSERT INTO public.parishes(name,diocese_id,is_operational) VALUES('QA-V121-FOREIGN-PARISH',v_foreign_dio,false) RETURNING id INTO v_foreign_parish;
 INSERT INTO public.legacy_source_origins(source_installation_id,origin_key,origin_kind,display_name,mapped_parish_id,identity_status)
 VALUES(v_install,'QA-V121-FOREIGN-'||substr(gen_random_uuid()::text,1,8),'qa_test','ARCHIVO FÍSICO AJENO',v_foreign_parish,'verified')
 RETURNING id INTO v_origin;
 INSERT INTO public.legacy_physical_source_artifacts(source_installation_id,source_origin_id,relative_path,filename,source_sha256)
 VALUES(v_install,v_origin,'QA-V121','QA-V121-PRIVADO.DBF',repeat('a',64))
 RETURNING id INTO v_artifact;
 INSERT INTO public.legacy_physical_source_rows(artifact_id,row_number,record_sha256,original_data)
 VALUES(v_artifact,1,repeat('b',64),'{"qaOnly":true,"persona":"FICTICIA"}'::jsonb)
 RETURNING id INTO v_row;
 INSERT INTO public.legacy_source_origin_hashes(origin_id,sha256,profile_key)
 VALUES(v_origin,repeat('c',64),'ANULACION')
 RETURNING id INTO v_hash;
 INSERT INTO public.legacy_source_files(source_installation_id,source_origin_id,filename)
 VALUES(v_install,v_origin,'QA-V121-PRIVADO.DBF');

 PERFORM set_config('request.jwt.claim.sub',v_user::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 SELECT count(*) INTO v_n_artifacts FROM public.legacy_physical_source_artifacts WHERE id=v_artifact;
 SELECT count(*) INTO v_n_rows FROM public.legacy_physical_source_rows WHERE id=v_row;
 SELECT count(*) INTO v_n_hashes FROM public.legacy_source_origin_hashes WHERE id=v_hash;
 SELECT count(*) INTO v_n_files FROM public.legacy_source_files WHERE filename='QA-V121-PRIVADO.DBF';
 EXECUTE 'RESET ROLE';
 IF v_n_artifacts + v_n_rows + v_n_hashes + v_n_files > 0 THEN
  RAISE EXCEPTION 'V121-EXPOSURE physical=% rows=% hashes=% files=%',v_n_artifacts,v_n_rows,v_n_hashes,v_n_files;
 END IF;
END $qa$;
ROLLBACK;