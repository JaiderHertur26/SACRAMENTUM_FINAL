-- V168 · Reproducir conflicto de dos notas independientes posteriores.
BEGIN;
DO $setup$
DECLARE v_dio uuid;v_c uuid;v_d uuid;v_parish uuid;
 v_decree uuid;v_record uuid;v_n1 uuid;v_n2 uuid;v_case1 uuid;v_case2 uuid;
BEGIN
 SELECT diocese_id,auth_user_id INTO STRICT v_dio,v_c FROM public.user_profiles
 WHERE role='chancery' AND is_active LIMIT 1;
 SELECT auth_user_id INTO STRICT v_d FROM public.user_profiles
 WHERE role='diocese' AND diocese_id=v_dio AND is_active LIMIT 1;
 SELECT id INTO STRICT v_parish FROM public.parishes
 WHERE diocese_id=v_dio AND is_operational LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',v_c::text,true);
 SELECT decree_id,marriage_id INTO STRICT v_decree,v_record
 FROM public.create_marriage_reposition_by_decree(
  v_parish,current_date,'Reposición ficticia con dos notas posteriores independientes',
  jsonb_build_object('novioNombres','QA','novioApellidos','V168',
   'noviaNombres','QA','noviaApellidos','V168','fechaMatrimonio','2020-01-01'),
  jsonb_build_object('type','archivo','reference','QA-V168-DOS-NOTAS',
   'issuer','Archivo QA','description','Caso ficticio en ROLLBACK'),
  'QA-V168-'||left(gen_random_uuid()::text,8));
 SELECT public.create_manual_marginal_note(v_parish,'matrimonio',v_record,
  'QA-V168 NOTA MANUAL INDEPENDIENTE NÚMERO UNO') INTO v_n1;
 SELECT public.create_manual_marginal_note(v_parish,'matrimonio',v_record,
  'QA-V168 NOTA MANUAL INDEPENDIENTE NÚMERO DOS') INTO v_n2;
 SELECT public.request_later_note_reconciliation_v156(v_decree,v_n1,
  'La primera nota requiere conciliación debidamente motivada para efectuar reversión.',
  'QA V168 PRIMER ARCHIVO') INTO v_case1;
 SELECT public.request_later_note_reconciliation_v156(v_decree,v_n2,
  'La segunda nota también requiere conciliación debidamente motivada para reversión.',
  'QA V168 SEGUNDO ARCHIVO') INTO v_case2;
 PERFORM set_config('qa168.decree',v_decree::text,true);
 PERFORM set_config('qa168.note1',v_n1::text,true);
 PERFORM set_config('qa168.note2',v_n2::text,true);
 PERFORM set_config('qa168.case1',v_case1::text,true);
 PERFORM set_config('qa168.case2',v_case2::text,true);
 PERFORM set_config('qa168.chancery',v_c::text,true);
 PERFORM set_config('qa168.diocese',v_d::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $repro$
DECLARE v_case1 uuid:=current_setting('qa168.case1')::uuid;
 v_case2 uuid:=current_setting('qa168.case2')::uuid;
 v_c uuid:=current_setting('qa168.chancery')::uuid;
 v_d uuid:=current_setting('qa168.diocese')::uuid;
 v_decree uuid:=current_setting('qa168.decree')::uuid;
 v_n1 uuid:=current_setting('qa168.note1')::uuid;
 v_n2 uuid:=current_setting('qa168.note2')::uuid;
 v_denied boolean:=false;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',v_d::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_d,'role','authenticated')::text,true);
 PERFORM public.approve_later_note_reconciliation_v156(v_case1,
  'APROBADO QA V168 UNO','Nota uno revisada y aprobada por autoridad diocesana independiente.');
 PERFORM public.approve_later_note_reconciliation_v156(v_case2,
  'APROBADO QA V168 DOS','Nota dos revisada y aprobada por autoridad diocesana independiente.');
 PERFORM set_config('request.jwt.claim.sub',v_c::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_c,'role','authenticated')::text,true);
 BEGIN
  PERFORM public.execute_later_note_reconciliation_v156(v_case1);
  RAISE EXCEPTION 'V168 REPRO FAILED: individual case succeeded despite other active manual note';
 EXCEPTION WHEN check_violation THEN v_denied:=true;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'V168 expected blocked single note';END IF;
END $repro$;
RESET ROLE;
-- Role authenticated cannot SELECT private cases: verify using postgres after
-- the authenticated RPC test, without granting private-table visibility.
DO $verify$
DECLARE v_decree uuid:=current_setting('qa168.decree')::uuid;
 v_n1 uuid:=current_setting('qa168.note1')::uuid;
 v_n2 uuid:=current_setting('qa168.note2')::uuid;
 v_case1 uuid:=current_setting('qa168.case1')::uuid;
 v_case2 uuid:=current_setting('qa168.case2')::uuid;
BEGIN
 IF (SELECT status FROM public.decretos WHERE id=v_decree) IS DISTINCT FROM 'active'
  OR (SELECT status FROM public.marginal_notes WHERE id=v_n1) IS DISTINCT FROM 'active'
  OR (SELECT status FROM public.marginal_notes WHERE id=v_n2) IS DISTINCT FROM 'active'
  OR (SELECT status FROM public.later_note_reconciliations_v156 WHERE id=v_case1) IS DISTINCT FROM 'authorized'
  OR (SELECT status FROM public.later_note_reconciliations_v156 WHERE id=v_case2) IS DISTINCT FROM 'authorized'
 THEN RAISE EXCEPTION 'V168 blocked reversal made partial state changes';END IF;
END $verify$;
ROLLBACK;