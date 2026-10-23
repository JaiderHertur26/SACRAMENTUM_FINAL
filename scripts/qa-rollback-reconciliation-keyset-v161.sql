-- V161 regression · 315 closed cases must NOT conceal a pending case.
-- Authenticated scoped listing + keyset pages and accurate counts.
BEGIN;
DO $fixture$
DECLARE d uuid;c uuid;p uuid;decree uuid;part uuid;note uuid;case_id uuid;ct integer;
BEGIN
 SELECT diocese_id,auth_user_id INTO STRICT d,c FROM public.user_profiles WHERE role='chancery' AND is_active LIMIT 1;
 SELECT id INTO STRICT p FROM public.parishes WHERE diocese_id=d AND is_operational ORDER BY id LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',c::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
 SELECT decree_id,marriage_id INTO STRICT decree,part FROM public.create_marriage_reposition_by_decree(
 p,current_date,'Reposición ficticia de prueba de cola de conciliaciones',
 jsonb_build_object('novioNombres','QA','novioApellidos','TEST','noviaNombres','QA','noviaApellidos','TEST','fechaMatrimonio','2020-02-15'),
 jsonb_build_object('type','archivo','reference','QA-V161-FUENTE','issuer','QA','description','Sin persistencia'),
 'QA-V161-'||left(gen_random_uuid()::text,8));
 SELECT public.create_manual_marginal_note(p,'matrimonio',part,'NOTA FICTICIA V161 COLA ANTIGUA') INTO note;
 SELECT public.request_later_note_reconciliation_v156(decree,note,
 'Conciliación ficticia pendiente y antigua, necesaria para probar que no desaparece.',
 'ARCHIVO V161 FICTICIO') INTO case_id;
 UPDATE public.later_note_reconciliations_v156 SET requested_at=now()-interval '8 days' WHERE id=case_id;
 INSERT INTO public.later_note_reconciliations_v156
  (decree_id,note_id,parish_id,diocese_id,note_snapshot,request_reason,source_reference,requested_by,
   requested_at,status,rejected_by,rejection_reason,rejection_reference,rejected_at)
 SELECT decree,note,p,d,'{"qa":"V161"}'::jsonb,
  'Histórico ficticio cerrado número '||i,'QA-V161-BACKLOG-'||i,c,
   now()+make_interval(secs=>i),'rejected',c,'Ficticio para demostrar límite de pantalla','QA-RECHAZO-V161',now()
 FROM generate_series(1,315) AS i;
 PERFORM set_config('qa161.case',case_id::text,true);
 PERFORM set_config('qa161.diocese',d::text,true);
 PERFORM set_config('qa161.actor',c::text,true);
 SELECT count(*) INTO ct FROM public.later_note_reconciliations_v156 WHERE diocese_id=d;
 IF ct<316 THEN RAISE EXCEPTION 'V161 baseline fixture count %',ct;END IF;
END $fixture$;
SET LOCAL ROLE authenticated;
DO $test$
DECLARE
 d uuid:=current_setting('qa161.diocese')::uuid;
 c uuid:=current_setting('qa161.actor')::uuid;
 older uuid:=current_setting('qa161.case')::uuid;
 v_count integer;v_count2 integer;v_counts jsonb;
 v_time timestamptz;v_id uuid;v_dupes integer;v_denied integer:=0;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',c::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
 SELECT count(*) INTO v_count
 FROM public.list_later_note_reconciliations_v161(d,'pending',50)
 WHERE id=older AND status='pending';
 IF v_count<>1 THEN RAISE EXCEPTION 'V161 older pending case hidden by recent rejected cases';END IF;
 SELECT public.count_later_note_reconciliations_v161(d) INTO v_counts;
 IF (v_counts->>'pending')::integer<1 OR (v_counts->>'rejected')::integer<315
    OR (v_counts->>'all')::integer<316
 THEN RAISE EXCEPTION 'V161 counters incomplete: %',v_counts;END IF;
 SELECT count(*) INTO v_count FROM public.list_later_note_reconciliations_v161(d,'rejected',50);
 IF v_count<>50 THEN RAISE EXCEPTION 'V161 rejected page not bounded at 50: %',v_count;END IF;
 SELECT requested_at,id INTO STRICT v_time,v_id
 FROM public.list_later_note_reconciliations_v161(d,'rejected',50)
 ORDER BY requested_at ASC,id ASC LIMIT 1;
 SELECT count(*) INTO v_count2
 FROM public.list_later_note_reconciliations_v161(d,'rejected',50,v_time,v_id);
 IF v_count2<>50 THEN RAISE EXCEPTION 'V161 second page should have 50, found %',v_count2;END IF;
 SELECT count(*) INTO v_dupes
 FROM public.list_later_note_reconciliations_v161(d,'rejected',50,v_time,v_id)
 WHERE (requested_at,id)>=(v_time,v_id);
 IF v_dupes<>0 THEN RAISE EXCEPTION 'V161 cursor included prior page';END IF;
 BEGIN
  PERFORM 1 FROM public.list_later_note_reconciliations_v161(d,'phantom',50);
  RAISE EXCEPTION 'V161 invalid status accepted';
 EXCEPTION WHEN invalid_parameter_value THEN v_denied:=v_denied+1;END;
 BEGIN
  PERFORM 1 FROM public.list_later_note_reconciliations_v161(d,'pending',101);
  RAISE EXCEPTION 'V161 unbounded page accepted';
 EXCEPTION WHEN invalid_parameter_value THEN v_denied:=v_denied+1;END;
 BEGIN
  PERFORM 1 FROM public.list_later_note_reconciliations_v161(d,'rejected',50,now(),null);
  RAISE EXCEPTION 'V161 incomplete cursor accepted';
 EXCEPTION WHEN invalid_parameter_value THEN v_denied:=v_denied+1;END;
 BEGIN
  PERFORM 1 FROM public.list_later_note_reconciliations_v161(gen_random_uuid(),'pending',50);
  RAISE EXCEPTION 'V161 wrong jurisdiction read accepted';
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=v_denied+1;END;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000161',true);
 PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000161","role":"authenticated"}',true);
 BEGIN
  PERFORM public.count_later_note_reconciliations_v161(d);
  RAISE EXCEPTION 'V161 unprofiled actor counted other diocese';
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=v_denied+1;END;
 IF v_denied<>5 THEN RAISE EXCEPTION 'V161 expected 5 negative checks got %',v_denied;END IF;
END $test$;
RESET ROLE;
ROLLBACK;
