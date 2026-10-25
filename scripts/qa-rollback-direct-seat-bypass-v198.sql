-- V198 Postmigration SQL E2E: direct Data API calls cannot seat Baptism or Confirmation.
-- Ordinary editing and official SECURITY DEFINER seating remain permitted.
-- All records fictitious; no permanent mutation (ROLLBACK).
BEGIN;
SET LOCAL statement_timeout='45000ms';
DO $setup$
DECLARE actor uuid;parish uuid;
BEGIN
 SELECT auth_user_id,parish_id INTO STRICT actor,parish FROM public.user_profiles
 WHERE role='parish' AND is_active IS TRUE AND upper(status)='ACTIVE' LIMIT 1;
 IF EXISTS(SELECT 1 FROM public.baptisms WHERE parish_id=parish AND book_number='9875')
 OR EXISTS(SELECT 1 FROM public.confirmations WHERE parish_id=parish AND book_number='9875')
 THEN RAISE EXCEPTION 'V198 test book unexpectedly used'; END IF;
 UPDATE public.parish_parameters SET
  bautizos_params=bautizos_params||'{"ordinarioLibro":9875,"ordinarioFolio":1,"ordinarioNumero":1,"ordinarioPartidas":2,"ordinarioBlocked":false}'::jsonb,
  confirmaciones_params=confirmaciones_params||'{"ordinarioLibro":9875,"ordinarioFolio":1,"ordinarioNumero":1,"ordinarioPartidas":2,"ordinarioBlocked":false}'::jsonb
 WHERE parish_id=parish;
 IF NOT FOUND THEN RAISE EXCEPTION 'V198 missing parish parameters';END IF;
 PERFORM set_config('qa198.actor',actor::text,true);
 PERFORM set_config('qa198.parish',parish::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $attack$
DECLARE parish uuid:=current_setting('qa198.parish')::uuid;
 kind text;tbl text;rpc text;seat_rpc text;payload jsonb;one_id uuid;
 action text;cmd text;receipt record;
 denial_count integer:=0;allow_count integer:=0;rows_affected integer;message text;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',current_setting('qa198.actor'),true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa198.actor'),'role','authenticated')::text,true);
 FOR kind,tbl,rpc,seat_rpc,payload IN SELECT * FROM (VALUES
 ('baptism','pending_baptisms','create_pending_baptism','seat_baptism_records',
 '{"nombres":"FICTICIO","apellidos":"QA V198","fechaSacramento":"2026-10-24","qa_v198":"yes"}'::jsonb),
 ('confirmation','pending_confirmations','create_pending_confirmation','seat_confirmation_records',
 '{"nombres":"FICTICIA","apellidos":"QA V198","fechaSacramento":"2026-10-24","qa_v198":"yes"}'::jsonb)
 ) t(kind,tbl,rpc,seat_rpc,payload)
 LOOP
  EXECUTE format('SELECT pending_id FROM public.%I($1,$2)',rpc) INTO STRICT one_id USING parish,payload;
  -- An ordinary pre-seat content edit must keep working for the owning parish.
  EXECUTE format('UPDATE public.%I SET raw_data=raw_data||''{"qa_edit_allowed":true}''::jsonb WHERE id=$1',tbl) USING one_id;
  GET DIAGNOSTICS rows_affected=ROW_COUNT;
  IF rows_affected<>1 THEN RAISE EXCEPTION 'V198 ordinary edit blocked %',kind;END IF;
  allow_count:=allow_count+1;
  FOR action IN SELECT unnest(ARRAY['status','reported','json_status','json_estado','archived','foreign_link',
                                  'insert_seated','insert_reported','insert_json_status'])
  LOOP
   IF action='status' THEN
    cmd:=format('UPDATE public.%I SET status=''seated'' WHERE id=$1',tbl);
   ELSIF action='reported' THEN
    cmd:=format('UPDATE public.%I SET reportado=true WHERE id=$1',tbl);
   ELSIF action='json_status' THEN
    cmd:=format('UPDATE public.%I SET raw_data=raw_data||''{"status":"seated"}''::jsonb WHERE id=$1',tbl);
   ELSIF action='json_estado' THEN
    cmd:=format('UPDATE public.%I SET raw_data=raw_data||''{"estado":"asentado"}''::jsonb WHERE id=$1',tbl);
   ELSIF action='archived' THEN
    cmd:=format('UPDATE public.%I SET raw_data=raw_data||''{"boleta_archived":true}''::jsonb WHERE id=$1',tbl);
   ELSIF action='foreign_link' THEN
    cmd:=format('UPDATE public.%I SET raw_data=raw_data||''{"%s":"00000000-0000-4000-a000-000000001988"}''::jsonb WHERE id=$1',
     tbl,CASE WHEN kind='baptism' THEN 'seated_baptism_id' ELSE 'seated_confirmation_id' END);
   ELSIF action='insert_seated' THEN
    cmd:=format('INSERT INTO public.%I(id,parish_id,status,reportado,raw_data) VALUES(gen_random_uuid(),$1,''seated'',false,''{"qa_v198":"yes"}''::jsonb)',tbl);
   ELSIF action='insert_reported' THEN
    cmd:=format('INSERT INTO public.%I(id,parish_id,status,reportado,raw_data) VALUES(gen_random_uuid(),$1,''pending'',true,''{"qa_v198":"yes"}''::jsonb)',tbl);
   ELSE
    cmd:=format('INSERT INTO public.%I(id,parish_id,status,reportado,raw_data) VALUES(gen_random_uuid(),$1,''pending'',false,''{"qa_v198":"yes","status":"seated"}''::jsonb)',tbl);
   END IF;
   BEGIN
    IF action LIKE 'insert_%' THEN EXECUTE cmd USING parish; ELSE EXECUTE cmd USING one_id;END IF;
    RAISE EXCEPTION 'V198 illegal direct juridical seat accepted: % %',kind,action;
   EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS message=MESSAGE_TEXT;
    IF message NOT LIKE 'Asiento sacramental protegido:%' THEN
      RAISE EXCEPTION 'V198 wrong authorization refusal % %: %',kind,action,message;
    END IF;
    denial_count:=denial_count+1;
   END;
  END LOOP;
  EXECUTE format('SELECT * FROM public.%I($1,$2::jsonb,$3,$4,$5)',seat_rpc)
   INTO STRICT receipt USING parish,jsonb_build_array(jsonb_build_object('pending_id',one_id)),9875,1,1;
  IF receipt.seated_count<>1 THEN RAISE EXCEPTION 'V198 real seat RPC failed %',kind;END IF;
  allow_count:=allow_count+1;
  IF kind='baptism' AND NOT EXISTS(SELECT 1 FROM public.baptisms WHERE parish_id=parish AND book_number='9875' AND status='seated')
  THEN RAISE EXCEPTION 'V198 official baptism absent';END IF;
  IF kind='confirmation' AND NOT EXISTS(SELECT 1 FROM public.confirmations WHERE parish_id=parish AND book_number='9875' AND status='seated')
  THEN RAISE EXCEPTION 'V198 official confirmation absent';END IF;
  BEGIN
   EXECUTE format('UPDATE public.%I SET raw_data=raw_data||''{"unofficial_change":true}''::jsonb WHERE id=$1',tbl) USING one_id;
   RAISE EXCEPTION 'V198 direct modification of seated record accepted %',kind;
  EXCEPTION WHEN insufficient_privilege THEN
   GET STACKED DIAGNOSTICS message=MESSAGE_TEXT;
   IF message NOT LIKE 'Asiento sacramental protegido:%' THEN
    RAISE EXCEPTION 'V198 wrong sealed record failure: %',message;
   END IF;
   denial_count:=denial_count+1;
  END;
 END LOOP;
 IF denial_count<>20 OR allow_count<>4 THEN
  RAISE EXCEPTION 'V198 expected 20 denials / 4 permitted, got % / %',denial_count,allow_count;
 END IF;
 PERFORM set_config('qa198.result',jsonb_build_object('direct_illegal_operations_blocked',denial_count,
 'ordinary_edits_allowed',2,'official_seatings_allowed',2,
 'juridical_records_created_within_transaction',2,'rollback',true)::text,true);
END $attack$;
RESET ROLE;
SELECT current_setting('qa198.result')::jsonb AS result;
ROLLBACK;
