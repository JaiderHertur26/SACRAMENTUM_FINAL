-- V158: browser-facing Supabase SELECT permissions for Chancery note picker.
-- Creates only fictional QA entities and ALWAYS ROLLBACK.
BEGIN;
DO $fixture$
DECLARE v_diocese uuid;v_chancery uuid;v_parish uuid;v_decree uuid;v_note uuid;v_record uuid;
BEGIN
 SELECT diocese_id,auth_user_id INTO STRICT v_diocese,v_chancery FROM public.user_profiles WHERE role='chancery' AND is_active LIMIT 1;
 SELECT id INTO STRICT v_parish FROM public.parishes WHERE diocese_id=v_diocese AND is_operational ORDER BY id LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',v_chancery::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_chancery,'role','authenticated')::text,true);
 SELECT decree_id,marriage_id INTO STRICT v_decree,v_record FROM public.create_marriage_reposition_by_decree(
  v_parish,current_date,'Reposición ficticia V158 para verificar SELECT de picker',
  jsonb_build_object('novioNombres','FICTICIO','novioApellidos','UNO','noviaNombres','FICTICIA','noviaApellidos','DOS','fechaMatrimonio','2020-02-15'),
  jsonb_build_object('type','archivo','reference','QA-158-ARCHIVO','issuer','QA','description','Fixture RLS'),
  'QA-V158-'||left(gen_random_uuid()::text,8));
 SELECT public.create_manual_marginal_note(v_parish,'matrimonio',v_record,'NOTA MANUAL FICTICIA QA-V158 SELECT') INTO v_note;
 PERFORM set_config('qa158.decree',v_decree::text,true);
 PERFORM set_config('qa158.note',v_note::text,true);
 PERFORM set_config('qa158.record',v_record::text,true);
 PERFORM set_config('qa158.parish',v_parish::text,true);
 PERFORM set_config('qa158.uid',v_chancery::text,true);
END $fixture$;
SET LOCAL ROLE authenticated;
DO $qa$
DECLARE v_uid uuid:=current_setting('qa158.uid')::uuid;
 v_parish uuid:=current_setting('qa158.parish')::uuid;
 v_record uuid:=current_setting('qa158.record')::uuid;
 v_decree uuid:=current_setting('qa158.decree')::uuid;
 v_note uuid:=current_setting('qa158.note')::uuid;
 v_count integer;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',v_uid::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_uid,'role','authenticated')::text,true);
 SELECT count(*) INTO v_count FROM public.decretos
 WHERE id=v_decree AND status='active' AND replacement_record_id=v_record AND parish_id=v_parish;
 IF v_count<>1 THEN RAISE EXCEPTION 'V158 picker cannot read own decree under RLS: %',v_count;END IF;
 SELECT count(*) INTO v_count FROM public.marginal_notes
 WHERE id=v_note AND parish_id=v_parish AND sacrament_id=v_record
 AND sacrament_type='matrimonio' AND status='active'
 AND decree_id IS NULL AND note_type='manual'
 AND NOT is_locked AND print_policy='optional';
 IF v_count<>1 THEN RAISE EXCEPTION 'V158 picker cannot read eligible note under RLS: %',v_count;END IF;
 SELECT count(*) INTO v_count FROM public.marginal_notes WHERE id=v_note
 AND lower(coalesce(source_type,'')) IN ('','manual');
 IF v_count<>1 THEN RAISE EXCEPTION 'V158 picker rejects source_type: %',v_count;END IF;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000158',true);
 PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000158","role":"authenticated"}',true);
 SELECT count(*) INTO v_count FROM public.marginal_notes WHERE id=v_note;
 IF v_count<>0 THEN RAISE EXCEPTION 'V158 no-profile actor can read note';END IF;
 SELECT count(*) INTO v_count FROM public.decretos WHERE id=v_decree;
 IF v_count<>0 THEN RAISE EXCEPTION 'V158 no-profile actor can read decree';END IF;
END $qa$;
ROLLBACK;
