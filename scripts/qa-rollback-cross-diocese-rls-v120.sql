-- V120 · Ensayo RLS multirrol con diócesis y parroquias ficticias. Transacción reversible.
BEGIN;
DO $qa$
DECLARE
  v_dio uuid; v_foreign_dio uuid; v_parish uuid; v_foreign_parish uuid;
  v_install uuid; v_local_origin uuid; v_foreign_origin uuid;
  v_actor uuid; v_role text; v_visible int; v_local int;
BEGIN
  SELECT diocese_id INTO STRICT v_dio FROM public.user_profiles
    WHERE role='chancery' AND is_active LIMIT 1;
  SELECT parish_id INTO STRICT v_parish FROM public.user_profiles
    WHERE role='parish' AND is_active AND diocese_id=v_dio LIMIT 1;
  SELECT id INTO STRICT v_install FROM public.legacy_source_installations
    WHERE mapped_parish_id IN (SELECT id FROM public.parishes WHERE diocese_id=v_dio)
    LIMIT 1;
  INSERT INTO public.dioceses(name) VALUES('QA-V120-DIOCESIS-AJENA')
    RETURNING id INTO v_foreign_dio;
  INSERT INTO public.parishes(name,diocese_id,is_operational)
    VALUES('QA-V120-PARROQUIA-AJENA',v_foreign_dio,false)
    RETURNING id INTO v_foreign_parish;
  INSERT INTO public.legacy_source_origins(
    source_installation_id,origin_key,origin_kind,display_name,mapped_parish_id,identity_status)
    VALUES(v_install,'QA-V120-OWN-'||substr(gen_random_uuid()::text,1,8),
      'qa_test','ORIGEN AUTORIZADO V120',v_parish,'verified')
    RETURNING id INTO v_local_origin;
  INSERT INTO public.legacy_source_origins(
    source_installation_id,origin_key,origin_kind,display_name,mapped_parish_id,identity_status)
    VALUES(v_install,'QA-V120-FOREIGN-'||substr(gen_random_uuid()::text,1,8),
      'qa_test','ORIGEN DE OTRA DIOCESIS V120',v_foreign_parish,'verified')
    RETURNING id INTO v_foreign_origin;
  INSERT INTO public.legacy_archive_records(
    profile_key,source_sha256,source_key,source_installation_id,
    source_origin_id,parish_id,diocese_id,original_data)
  VALUES
    ('ANULACION',repeat('1',64),'QA-V120-LOCAL',v_install,v_local_origin,v_parish,v_dio,'{"qaOnly":true}'::jsonb),
    ('ANULACION',repeat('2',64),'QA-V120-FOREIGN',v_install,v_foreign_origin,v_foreign_parish,v_foreign_dio,'{"qaOnly":true}'::jsonb),
    ('ANULACION',repeat('3',64),'QA-V120-MISMATCH-DIO',v_install,v_foreign_origin,v_foreign_parish,v_dio,'{"qaOnly":true}'::jsonb),
    ('ANULACION',repeat('4',64),'QA-V120-MISMATCH-PARISH',v_install,v_local_origin,v_parish,v_foreign_dio,'{"qaOnly":true}'::jsonb);

  FOREACH v_role IN ARRAY ARRAY['chancery','diocese','parish'] LOOP
    SELECT auth_user_id INTO STRICT v_actor FROM public.user_profiles
     WHERE role=v_role AND is_active AND diocese_id=v_dio LIMIT 1;
    PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';

    SELECT count(*) INTO v_visible FROM public.legacy_source_origins
       WHERE id=v_foreign_origin;
    IF v_visible<>0 THEN
       RAISE EXCEPTION 'V120 FAIL foreign origin visible to role %',v_role;
    END IF;

    SELECT count(*) INTO v_visible FROM public.legacy_archive_records
       WHERE source_key IN ('QA-V120-FOREIGN','QA-V120-MISMATCH-DIO','QA-V120-MISMATCH-PARISH');
    IF v_visible<>0 THEN
      RAISE EXCEPTION 'V120 FAIL foreign or inconsistent record visible to %',v_role;
    END IF;

    SELECT count(*) INTO v_local FROM public.legacy_archive_records WHERE source_key='QA-V120-LOCAL';
    IF v_local<>1 THEN RAISE EXCEPTION 'V120 FAIL legitimate local row hidden for %',v_role; END IF;

    SELECT count(*) INTO v_local FROM public.legacy_source_origins WHERE id=v_local_origin;
    -- La fuente de instalación sólo es navegable por Diócesis/Cancillería;
    -- Parroquia recibe sus partidas y decretos, sin metadatos internos del origen.
    IF (v_role='parish' AND v_local<>0)
       OR (v_role IN ('diocese','chancery') AND v_local<>1) THEN
      RAISE EXCEPTION 'V120 FAIL visibility mismatch for local source / role %',v_role;
    END IF;
    EXECUTE 'RESET ROLE';
  END LOOP;

  SELECT auth_user_id INTO STRICT v_actor FROM public.user_profiles
    WHERE role='admin_general' AND is_active LIMIT 1;
  PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_visible FROM public.legacy_source_origins WHERE id=v_foreign_origin;
  IF v_visible<>1 THEN RAISE EXCEPTION 'V120 FAIL Administrador General lost global structural visibility'; END IF;
  SELECT count(*) INTO v_visible FROM public.legacy_archive_records
    WHERE source_key LIKE 'QA-V120-%';
  IF v_visible<>4 THEN RAISE EXCEPTION 'V120 FAIL Admin General should inspect four QA rows'; END IF;
  EXECUTE 'RESET ROLE';
END $qa$;
ROLLBACK;