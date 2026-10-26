-- V214: REAL SQL positive and ambiguous reported boleta reconciliation. Synthetic and rolled back.
BEGIN;
SET LOCAL statement_timeout='45000ms';
SELECT set_config('qa214.actor',(
 SELECT u.auth_user_id::text FROM public.user_profiles u JOIN public.parishes p ON p.diocese_id=u.diocese_id
 WHERE u.role='diocese' AND u.is_active IS TRUE AND upper(u.status)='ACTIVE'
 GROUP BY u.auth_user_id,u.diocese_id HAVING count(DISTINCT p.id)>=2
 LIMIT 1),true);
SELECT set_config('qa214.diocese',(
 SELECT u.diocese_id::text FROM public.user_profiles u WHERE u.auth_user_id::text=current_setting('qa214.actor') AND u.role='diocese' LIMIT 1),true);
SELECT set_config('qa214.parish',(
 SELECT id::text FROM public.parishes WHERE diocese_id::text=current_setting('qa214.diocese') ORDER BY id LIMIT 1),true);
SELECT set_config('qa214.other_parish',(
 SELECT id::text FROM public.parishes WHERE diocese_id::text=current_setting('qa214.diocese')
 AND id::text<>current_setting('qa214.parish') ORDER BY id LIMIT 1),true);
DO $fixtures$
DECLARE scope text:=gen_random_uuid()::text;pa uuid:=current_setting('qa214.parish')::uuid;pb uuid:=current_setting('qa214.other_parish')::uuid;
BEGIN
 IF pa IS NULL OR pb IS NULL THEN RAISE EXCEPTION 'V214 distinct QA parishes required'; END IF;
 PERFORM set_config('qa214.scope',scope,true);
 IF EXISTS(SELECT 1 FROM public.baptisms WHERE book_number='9214' AND parish_id=pa)
  OR EXISTS(SELECT 1 FROM public.confirmations WHERE book_number='9214' AND parish_id=pa) THEN
  RAISE EXCEPTION 'V214 book 9214 in use, choose a different fictional fixture';
 END IF;
 INSERT INTO public.baptisms(parish_id,nombres,apellidos,celebration_date,fecha_nacimiento,book_number,folio,number,status,raw_data)
 VALUES
 (pa,'QA214 BAU SINGLE '||scope,'ENSAYO','2026-10-01','2026-01-01','9214','0001','0001','seated',jsonb_build_object('qa','V214')),
 (pa,'QA214 BAU TWINS '||scope,'ENSAYO','2026-10-01','2026-01-01','9214','0001','0002','seated',jsonb_build_object('qa','V214')),
 (pa,'QA214 BAU TWINS '||scope,'ENSAYO','2026-10-01','2026-01-01','9214','0001','0003','seated',jsonb_build_object('qa','V214')),
 (pb,'QA214 BAU FOREIGN '||scope,'ENSAYO','2026-10-01','2026-01-01','9214','0001','0004','seated',jsonb_build_object('qa','V214'));
 INSERT INTO public.confirmations(parish_id,nombres,apellidos,celebration_date,fecha_nacimiento,book_number,folio,number,status,raw_data)
 VALUES
 (pa,'QA214 CON SINGLE '||scope,'ENSAYO','2026-10-01','2026-01-01','9214','0001','0001','seated',jsonb_build_object('qa','V214')),
 (pa,'QA214 CON TWINS '||scope,'ENSAYO','2026-10-01','2026-01-01','9214','0001','0002','seated',jsonb_build_object('qa','V214')),
 (pa,'QA214 CON TWINS '||scope,'ENSAYO','2026-10-01','2026-01-01','9214','0001','0003','seated',jsonb_build_object('qa','V214')),
 (pb,'QA214 CON FOREIGN '||scope,'ENSAYO','2026-10-01','2026-01-01','9214','0001','0004','seated',jsonb_build_object('qa','V214'));
END $fixtures$;
SET LOCAL ROLE authenticated;
DO $run$
DECLARE p text;v_batch uuid;v_target text;v_scope text:=current_setting('qa214.scope');
v_report jsonb;row_rec record;matched_id uuid;v_total int;v_link_count int;v_replay jsonb;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',current_setting('qa214.actor'),true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa214.actor'),'role','authenticated')::text,true);
 FOREACH p IN ARRAY ARRAY['INSBAUTI','INSCONFI'] LOOP
  v_target:=CASE WHEN p='INSBAUTI' THEN 'pending_baptism' ELSE 'pending_confirmation' END;
  v_batch:=public.create_legacy_import_batch('QA214-'||p||'.json',p,repeat('e',64),'QA214 Synthetic',
    current_setting('qa214.parish')::uuid,current_setting('qa214.diocese')::uuid,jsonb_build_object('qa','V214'));
  PERFORM public.stage_legacy_import_rows(v_batch,(
   SELECT jsonb_agg(jsonb_build_object(
    'row_number',n,'source_key','QA214-'||v_scope||'-'||p||'-'||n,
    'target_entity',v_target,'original_data',jsonb_build_object('reported',true),
    'normalized_data',jsonb_build_object('reported',true,'names',
      'QA214 '||(CASE WHEN p='INSBAUTI' THEN 'BAU' ELSE 'CON' END)||' '||name||' '||v_scope,
      'last_names','ENSAYO','celebration_date','2026-10-01','birth_date','2026-01-01'),
    'status','valid','issue_codes',jsonb_build_array('LEGACY_BOLETA_REPORTED')))
    FROM (VALUES(1,'SINGLE'),(2,'TWINS'),(3,'FOREIGN'),(4,'MISSING')) AS test_data(n,name)
  ));
  v_report:=public.materialize_pending_legacy_sacramental_records(v_batch,20);
  IF (v_report->>'reconciled')::int <> 1 OR (v_report->>'reviewed')::int <> 3
   OR (v_report->>'imported')::int <> 0 OR (v_report->>'remaining')::int<>0 THEN
   RAISE EXCEPTION 'V214 % counters unexpected %',p,v_report;
  END IF;
  FOR row_rec IN SELECT row_number,status,target_table,target_id,issue_codes FROM public.legacy_import_rows WHERE batch_id=v_batch ORDER BY row_number LOOP
   IF row_rec.row_number=1 THEN
    IF row_rec.status<>'imported' OR row_rec.target_table<>(CASE WHEN p='INSBAUTI' THEN 'baptisms' ELSE 'confirmations' END) OR row_rec.target_id IS NULL THEN
     RAISE EXCEPTION 'V214 unique reported must link to celebrated record %',p;
    END IF;
   ELSIF row_rec.status<>'review' OR row_rec.target_id IS NOT NULL OR
     NOT (CASE WHEN row_rec.row_number=2 THEN 'REPORTED_PARTIDA_AMBIGUOUS' ELSE 'REPORTED_PARTIDA_NOT_FOUND' END)=ANY(row_rec.issue_codes) THEN
     RAISE EXCEPTION 'V214 ambiguous, foreign and missing require manual review % row %',p,row_rec.row_number;
   END IF;
  END LOOP;
  SELECT count(*) INTO v_link_count FROM public.legacy_record_links WHERE batch_id=v_batch;
  IF v_link_count<>1 THEN RAISE EXCEPTION 'V214 should link exactly one celebrated record, got %',v_link_count;END IF;
  v_replay:=public.materialize_pending_legacy_sacramental_records(v_batch,20);
  IF (v_replay->>'reconciled')::int<>0 OR (v_replay->>'imported')::int<>0 THEN RAISE EXCEPTION 'V214 replay was not idempotent';END IF;
 END LOOP;
 PERFORM set_config('qa214.result',jsonb_build_object('profiles_tested',2,'celebrated_unique_links',2,'manual_reviews_ambiguous',2,'manual_reviews_foreign',2,'manual_reviews_missing',2,'retries_idempotent',2,'transaction_rollback',true)::text,true);
END $run$;
SELECT current_setting('qa214.result')::jsonb AS qa214_result;
ROLLBACK;
