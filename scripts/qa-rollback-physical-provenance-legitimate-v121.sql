-- V121 · Lectura legítima de artefactos locales para 3 roles y lectura global estructural Admin General.
BEGIN;
DO $qa$
DECLARE v_dio uuid;v_install uuid;v_parish uuid;v_origin uuid;v_artifact uuid;v_row uuid;v_hash uuid;
 v_actor uuid;v_role text;v_a int;v_r int;v_h int;v_f int;
BEGIN
 SELECT diocese_id INTO STRICT v_dio FROM public.user_profiles WHERE role='chancery' AND is_active LIMIT 1;
 SELECT id,mapped_parish_id INTO STRICT v_install,v_parish FROM public.legacy_source_installations
 WHERE owner_diocese_id=v_dio AND mapped_parish_id IS NOT NULL ORDER BY id LIMIT 1;
 INSERT INTO public.legacy_source_origins(source_installation_id,origin_key,origin_kind,display_name,mapped_parish_id,identity_status)
 VALUES(v_install,'QA-V121-LOCAL-'||substr(gen_random_uuid()::text,1,8),'qa_test','ARCHIVO FISICO LOCAL FICTICIO',v_parish,'verified')
 RETURNING id INTO v_origin;
 INSERT INTO public.legacy_physical_source_artifacts(source_installation_id,source_origin_id,relative_path,filename,source_sha256)
 VALUES(v_install,v_origin,'QA-V121','QA-V121-LOCAL.DBF',repeat('d',64))
 RETURNING id INTO v_artifact;
 INSERT INTO public.legacy_physical_source_rows(artifact_id,row_number,record_sha256,original_data)
 VALUES(v_artifact,1,repeat('e',64),'{"qaOnly":true}'::jsonb)
 RETURNING id INTO v_row;
 INSERT INTO public.legacy_source_origin_hashes(origin_id,sha256,profile_key)
 VALUES(v_origin,repeat('f',64),'ANULACION') RETURNING id INTO v_hash;
 INSERT INTO public.legacy_source_files(source_installation_id,source_origin_id,filename)
 VALUES(v_install,v_origin,'QA-V121-LOCAL.DBF');

 FOREACH v_role IN ARRAY ARRAY['diocese','chancery','admin_general'] LOOP
  SELECT auth_user_id INTO STRICT v_actor FROM public.user_profiles WHERE role=v_role AND is_active
  AND (v_role='admin_general' OR diocese_id=v_dio) LIMIT 1;
  PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_a FROM public.legacy_physical_source_artifacts WHERE id=v_artifact;
  SELECT count(*) INTO v_r FROM public.legacy_physical_source_rows WHERE id=v_row;
  SELECT count(*) INTO v_h FROM public.legacy_source_origin_hashes WHERE id=v_hash;
  SELECT count(*) INTO v_f FROM public.legacy_source_files WHERE filename='QA-V121-LOCAL.DBF';
  EXECUTE 'RESET ROLE';
  IF v_a<>1 OR v_r<>1 OR v_h<>1 OR v_f<>1 THEN
   RAISE EXCEPTION 'V121 WRONG LOCAL AUTHORITY % physical=% rows=% hashes=% files=%',v_role,v_a,v_r,v_h,v_f;
  END IF;
 END LOOP;

 -- La parroquia del origen debe ver exclusivamente sus archivos locales.
 SELECT auth_user_id INTO v_actor FROM public.user_profiles WHERE role='parish'
 AND parish_id=v_parish AND is_active LIMIT 1;
 IF v_actor IS NOT NULL THEN
  PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_a FROM public.legacy_physical_source_artifacts WHERE id=v_artifact;
  SELECT count(*) INTO v_r FROM public.legacy_physical_source_rows WHERE id=v_row;
  SELECT count(*) INTO v_h FROM public.legacy_source_origin_hashes WHERE id=v_hash;
  SELECT count(*) INTO v_f FROM public.legacy_source_files WHERE filename='QA-V121-LOCAL.DBF';
  EXECUTE 'RESET ROLE';
  IF v_a<>1 OR v_r<>1 OR v_h<>1 OR v_f<>1 THEN
   RAISE EXCEPTION 'V121 PARISH LOCAL FILE RIGHTS FAILED % % % %',v_a,v_r,v_h,v_f;
  END IF;
 END IF;
END $qa$;
ROLLBACK;