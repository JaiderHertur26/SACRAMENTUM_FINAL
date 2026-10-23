-- V161 baseline · a 300-row "last created" list can starve old pending cases.
-- ALL inserted decrees, marginal notes and fictitious history are rolled back.
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
DO $baseline$
DECLARE
 d uuid:=current_setting('qa161.diocese')::uuid;
 c uuid:=current_setting('qa161.actor')::uuid;
 older uuid:=current_setting('qa161.case')::uuid;
 observed integer;pending_in_legacy integer;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',c::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
 SELECT count(*) INTO observed FROM public.list_later_note_reconciliations_v157(d);
 SELECT count(*) INTO pending_in_legacy FROM public.list_later_note_reconciliations_v157(d) WHERE id=older;
 IF observed<>300 OR pending_in_legacy<>0
 THEN RAISE EXCEPTION 'V161 BUG reproduction failed: rows % pendingShown %',observed,pending_in_legacy;END IF;
END $baseline$;
RESET ROLE;
DO $verify$
BEGIN
 IF (SELECT status FROM public.later_note_reconciliations_v156 WHERE id=current_setting('qa161.case')::uuid) IS DISTINCT FROM 'pending'
 THEN RAISE EXCEPTION 'V161 baseline pending fixture missing';END IF;
END $verify$;
ROLLBACK;
