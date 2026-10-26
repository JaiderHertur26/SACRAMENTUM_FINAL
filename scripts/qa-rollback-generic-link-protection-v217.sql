-- V217: old generic importer could reassign cross-parish registral source links.
-- All data invented; explicit transaction rollback.
BEGIN;
SET LOCAL statement_timeout='45000ms';
SELECT set_config('qa217.actor',(SELECT u.auth_user_id::text FROM public.user_profiles u WHERE u.role='diocese' AND u.is_active AND upper(u.status)='ACTIVE' AND u.auth_user_id IS NOT NULL AND (SELECT count(*) FROM public.parishes p WHERE p.diocese_id=u.diocese_id AND p.is_operational)>=2 ORDER BY u.auth_user_id LIMIT 1),true);
SELECT set_config('qa217.diocese',(SELECT diocese_id::text FROM public.user_profiles WHERE auth_user_id::text=current_setting('qa217.actor') AND role='diocese' LIMIT 1),true);
SELECT set_config('qa217.pa',(SELECT id::text FROM public.parishes WHERE diocese_id::text=current_setting('qa217.diocese') AND is_operational ORDER BY id LIMIT 1),true);
SELECT set_config('qa217.pb',(SELECT id::text FROM public.parishes WHERE diocese_id::text=current_setting('qa217.diocese') AND is_operational AND id::text<>current_setting('qa217.pa') ORDER BY id LIMIT 1),true);
SELECT set_config('qa217.tag',gen_random_uuid()::text,true);
DO $seed$
DECLARE pa uuid:=current_setting('qa217.pa')::uuid;pb uuid:=current_setting('qa217.pb')::uuid;
BEGIN
 IF pa IS NULL OR pb IS NULL OR pa=pb THEN RAISE EXCEPTION 'QA217 requires two QA parishes'; END IF;
 IF EXISTS(SELECT 1 FROM public.baptisms WHERE parish_id IN (pa,pb) AND book_number='9217' AND folio='1' AND number='1') THEN
  RAISE EXCEPTION 'QA217 fictitious reference already exists';
 END IF;
 INSERT INTO public.baptisms(parish_id,nombres,apellidos,celebration_date,status,book_number,folio,number,raw_data)
 VALUES (pa,'QA217 SAME '||current_setting('qa217.tag'),'FICTICIO','2026-10-01','seated','9217','1','1',jsonb_build_object('qa','V217')),
        (pb,'QA217 SAME '||current_setting('qa217.tag'),'FICTICIO','2026-10-01','seated','9217','1','1',jsonb_build_object('qa','V217'));
END $seed$;
SET LOCAL ROLE authenticated;
DO $stage$
DECLARE pa uuid:=current_setting('qa217.pa')::uuid;pb uuid:=current_setting('qa217.pb')::uuid;dd uuid:=current_setting('qa217.diocese')::uuid;aa uuid;bb uuid;key text:='QA217-'||current_setting('qa217.tag'); norm jsonb;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',current_setting('qa217.actor'),true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa217.actor'),'role','authenticated')::text,true);
 norm:=jsonb_build_object('names','QA217 SAME '||current_setting('qa217.tag'),'last_names','FICTICIO','celebration_date','2026-10-01');
 aa:=public.create_legacy_import_batch('QA217-A.json','BAUTIZOS',repeat('a',64),'QA217',pa,dd,'{}');
 bb:=public.create_legacy_import_batch('QA217-B.json','BAUTIZOS',repeat('a',64),'QA217',pb,dd,'{}');
 PERFORM public.stage_legacy_import_rows(aa,jsonb_build_array(jsonb_build_object('row_number',1,'source_key',key,'target_entity','baptism','original_data','{}'::jsonb,'normalized_data',norm,'status','valid')));
 PERFORM public.stage_legacy_import_rows(bb,jsonb_build_array(jsonb_build_object('row_number',1,'source_key',key,'target_entity','baptism','original_data','{}'::jsonb,'normalized_data',norm,'status','valid')));
 PERFORM set_config('qa217.aa',aa::text,true);
 PERFORM set_config('qa217.bb',bb::text,true);
END $stage$;
RESET ROLE;
DO $repro$
DECLARE aa uuid:=current_setting('qa217.aa')::uuid;bb uuid:=current_setting('qa217.bb')::uuid;
  id_a uuid;id_b uuid;row_a uuid;row_b uuid;key text:='QA217-'||current_setting('qa217.tag');source text;
  observed_target uuid;observed_batch uuid;
BEGIN
 SELECT id INTO id_a FROM public.baptisms WHERE parish_id=current_setting('qa217.pa')::uuid AND book_number='9217' AND folio='1' AND number='1';
 SELECT id INTO id_b FROM public.baptisms WHERE parish_id=current_setting('qa217.pb')::uuid AND book_number='9217' AND folio='1' AND number='1';
 SELECT id INTO row_a FROM public.legacy_import_rows WHERE batch_id=aa;
 SELECT id INTO row_b FROM public.legacy_import_rows WHERE batch_id=bb;
 SELECT source_system INTO source FROM public.legacy_import_batches WHERE id=aa;
 INSERT INTO public.legacy_record_links(source_system,profile_key,source_key,batch_id,row_id,target_table,target_id)
 VALUES(source,'BAUTIZOS',key,aa,row_a,'baptism',id_a);
 BEGIN
  INSERT INTO public.legacy_record_links(source_system,profile_key,source_key,batch_id,row_id,target_table,target_id)
  VALUES(source,'BAUTIZOS',key,bb,row_b,'baptism',id_b)
  ON CONFLICT (source_system,profile_key,source_key) DO UPDATE SET
   batch_id=excluded.batch_id,row_id=excluded.row_id,target_table=excluded.target_table,target_id=excluded.target_id;
  RAISE EXCEPTION 'V217_UNSAFE overwrite accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='V217_UNSAFE overwrite accepted' THEN RAISE;END IF;
  IF SQLERRM NOT LIKE 'V217 prohibido reasignar la procedencia histórica%' THEN
    RAISE EXCEPTION 'V217 unexpected foreign overwrite rejection: %',SQLERRM;
  END IF;
 END;
 SELECT batch_id,target_id INTO observed_batch,observed_target FROM public.legacy_record_links
 WHERE source_system=source AND profile_key='BAUTIZOS' AND source_key=key;
 IF observed_batch IS DISTINCT FROM aa OR observed_target IS DISTINCT FROM id_a THEN
   RAISE EXCEPTION 'V217 original provenance mutated';
 END IF;
 -- Same-owner replay on the identical physical record is still valid.
 UPDATE public.legacy_record_links SET updated_at=now()
 WHERE source_system=source AND profile_key='BAUTIZOS' AND source_key=key;
 -- A new foreign target is also forbidden even when its source key is fresh.
 BEGIN
  INSERT INTO public.legacy_record_links(source_system,profile_key,source_key,batch_id,row_id,target_table,target_id)
  VALUES(source,'BAUTIZOS',key||'-foreign',aa,row_a,'baptism',id_b);
  RAISE EXCEPTION 'V217_UNSAFE direct foreign target accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'V217_UNSAFE%' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE 'V217 enlace registral sin lote%' AND
     SQLERRM NOT LIKE 'V217 el expediente registral destino%' THEN
    RAISE EXCEPTION 'V217 unexpected foreign target outcome: %',SQLERRM;
  END IF;
 END;
 PERFORM set_config('qa217.result',jsonb_build_object('cross_parish_source_overwrite_denied',true,'original_source_preserved',true,'same_target_replay_safe',true,'foreign_target_denied',true,'rolled_back',true)::text,true);
END $repro$;
SELECT current_setting('qa217.result')::jsonb AS result;
ROLLBACK;
