-- SACRAMENTUM V114 · OCHO DECRETOS DOCUMENTALES FICTICIOS
-- Exclusivamente transaccional: no sustituir ROLLBACK por COMMIT.
BEGIN;
DO $qa$
DECLARE
 v_diocese uuid; v_parish uuid; v_oldparish uuid;
 v_chancery uuid; v_diocesan uuid; v_parishuser uuid; v_admin uuid;
 v_s text; v_old boolean; v_id uuid; v_row public.decretos%rowtype;
 v_count integer:=0; v_notes bigint; v_records bigint; v_duplicate text;
BEGIN
 SELECT diocese_id,auth_user_id INTO STRICT v_diocese,v_chancery
 FROM public.user_profiles WHERE role='chancery' AND is_active;
 SELECT auth_user_id INTO STRICT v_diocesan FROM public.user_profiles
 WHERE role='diocese' AND diocese_id=v_diocese AND is_active;
 SELECT auth_user_id INTO STRICT v_parishuser FROM public.user_profiles
 WHERE role='parish' AND diocese_id=v_diocese AND is_active;
 SELECT auth_user_id INTO STRICT v_admin FROM public.user_profiles
 WHERE role='admin_general' AND is_active;
 SELECT id INTO STRICT v_parish FROM public.parishes
 WHERE diocese_id=v_diocese AND is_operational ORDER BY id LIMIT 1;
 SELECT id INTO STRICT v_oldparish FROM public.parishes
 WHERE diocese_id=v_diocese AND NOT is_operational ORDER BY id LIMIT 1;
 SELECT count(*) INTO v_notes FROM public.marginal_notes;
 SELECT (SELECT count(*) FROM public.baptisms)+(SELECT count(*) FROM public.confirmations)
 +(SELECT count(*) FROM public.marriages)+(SELECT count(*) FROM public.funerals) INTO v_records;
 PERFORM set_config('request.jwt.claim.sub',v_chancery::text,true);
 FOREACH v_s IN ARRAY ARRAY['bautismo','confirmacion','matrimonio','exequias'] LOOP
  FOREACH v_old IN ARRAY ARRAY[false,true] LOOP
   v_count:=v_count+1;
   v_id:=public.issue_documentary_decree_v88(
    CASE WHEN v_old THEN v_oldparish ELSE v_parish END,
    v_s,'QA-V114-'||v_count||'-'||substr(gen_random_uuid()::text,1,8),CURRENT_DATE,
    'PERSONA FICTICIA SIN EXISTENCIA REAL',
    'Documento de prueba sin autorización de efectos sacramentales reales.',
    v_old,CASE WHEN v_old THEN 'QA-ARCHIVO-FISICO-V114' ELSE NULL END);
   SELECT * INTO STRICT v_row FROM public.decretos WHERE id=v_id;
   IF v_row.diocese_id IS DISTINCT FROM v_diocese
    OR v_row.parish_id IS DISTINCT FROM (CASE WHEN v_old THEN v_oldparish ELSE v_parish END)
    OR v_row.payload->>'registersEffect'<>'false'
    OR v_row.payload->>'generatesMarginalNote'<>'false'
    OR v_row.payload->>'affectsSacramentalRecord'<>'false'
    OR (v_old AND (v_row.status<>'archived' OR v_row.payload->>'recordOrigin'<>'historical_archive'))
    OR (NOT v_old AND v_row.status<>'active') THEN
    RAISE EXCEPTION 'V114 fallo documental: % / %',v_s,v_old; END IF;
  END LOOP;
 END LOOP;
 SELECT decree_number INTO STRICT v_duplicate FROM public.decretos
 WHERE decree_number LIKE 'QA-V114-%' ORDER BY decree_number LIMIT 1;
 BEGIN
  PERFORM public.issue_documentary_decree_v88(
   v_parish,'bautismo',v_duplicate,CURRENT_DATE,'PERSONA FICTICIA',
   'Reintento duplicado debe conservar un solo documento canónico.',false,NULL);
  RAISE EXCEPTION 'V114 fallo: decreto duplicado permitido';
 EXCEPTION WHEN others THEN
  IF SQLERRM='V114 fallo: decreto duplicado permitido' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.issue_documentary_decree_v88(
   v_oldparish,'bautismo','QA-V114-INVALID-HIST',CURRENT_DATE,'PERSONA FICTICIA',
   'No se puede recuperar histórico sin procedencia verificable.',true,NULL);
  RAISE EXCEPTION 'V114 fallo: histórico sin fuente permitido';
 EXCEPTION WHEN others THEN
  IF SQLERRM='V114 fallo: histórico sin fuente permitido' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.issue_documentary_decree_v88(
   v_oldparish,'bautismo','QA-V114-INVALID-NEW',CURRENT_DATE,'PERSONA FICTICIA',
   'No debe emitirse decreto nuevo sobre contenedor no operativo.',false,NULL);
  RAISE EXCEPTION 'V114 fallo: decreto nuevo sobre histórico';
 EXCEPTION WHEN others THEN
  IF SQLERRM='V114 fallo: decreto nuevo sobre histórico' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.sub',v_diocesan::text,true);
 BEGIN
  PERFORM public.issue_documentary_decree_v88(
   v_parish,'bautismo','QA-DENIED-DIOCESE',CURRENT_DATE,'SIN PERSONA REAL',
   'Intento institucional que debe ser rechazado.',false,NULL);
  RAISE EXCEPTION 'V114 fallo: Diócesis emitió decreto';
 EXCEPTION WHEN others THEN
  IF SQLERRM='V114 fallo: Diócesis emitió decreto' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.sub',v_parishuser::text,true);
 BEGIN
  PERFORM public.issue_documentary_decree_v88(
   v_parish,'bautismo','QA-DENIED-PARISH',CURRENT_DATE,'SIN PERSONA REAL',
   'Intento parroquial que debe ser rechazado.',false,NULL);
  RAISE EXCEPTION 'V114 fallo: Parroquia emitió decreto';
 EXCEPTION WHEN others THEN
  IF SQLERRM='V114 fallo: Parroquia emitió decreto' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
 BEGIN
  PERFORM public.issue_documentary_decree_v88(
   v_parish,'bautismo','QA-DENIED-GENERAL',CURRENT_DATE,'SIN PERSONA REAL',
   'Intento de Administrador General que debe ser rechazado.',false,NULL);
  RAISE EXCEPTION 'V114 fallo: Administrador General emitió decreto';
 EXCEPTION WHEN others THEN
  IF SQLERRM='V114 fallo: Administrador General emitió decreto' THEN RAISE; END IF; END;
 IF v_count<>8 OR (SELECT count(*) FROM public.marginal_notes)<>v_notes
 OR (SELECT count(*) FROM public.baptisms)+(SELECT count(*) FROM public.confirmations)
 +(SELECT count(*) FROM public.marriages)+(SELECT count(*) FROM public.funerals)<>v_records
 THEN RAISE EXCEPTION 'V114 alteración inesperada de partidas o notas'; END IF;
END
$qa$;
ROLLBACK;
