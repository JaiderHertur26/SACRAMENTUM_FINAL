-- SACRAMENTUM V199: protective behavior of reported historical records after new guard.
-- All fixtures, user context, edits and audit tests are rolled back atomically.
BEGIN;
SET LOCAL statement_timeout='35000ms';
DO $init$
DECLARE actor uuid;parish uuid;pid uuid;cid uuid;
BEGIN
 SELECT auth_user_id,parish_id INTO STRICT actor,parish
 FROM public.user_profiles WHERE role='parish' AND is_active IS TRUE AND upper(status)='ACTIVE' LIMIT 1;
 INSERT INTO public.pending_baptisms(parish_id,status,reportado,raw_data)
 VALUES(parish,'legacy_reported_unmatched',true,
 '{"qa_v199":"yes","boleta_archived":true,"seated_book":"0002","seated_folio":"0012","seated_baptism_id":"00000000-0000-4000-a000-000000019900"}'::jsonb)
 RETURNING id INTO pid;
 INSERT INTO public.pending_confirmations(parish_id,status,reportado,raw_data)
 VALUES(parish,'legacy_reported_unmatched',true,
 '{"qa_v199":"yes","boleta_archived":true,"seated_book":"0002","seated_folio":"0012","seated_confirmation_id":"00000000-0000-4000-a000-000000019901"}'::jsonb)
 RETURNING id INTO cid;
 PERFORM set_config('qa199.actor',actor::text,true);
 PERFORM set_config('qa199.baptism',pid::text,true);
 PERFORM set_config('qa199.confirmation',cid::text,true);
END $init$;
SET LOCAL ROLE authenticated;
DO $qa$
DECLARE t text;pid uuid;action text;command text;
 n integer;denials integer:=0;ordinary integer:=0;message text;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',current_setting('qa199.actor'),true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa199.actor'),'role','authenticated')::text,true);
 FOR t,pid IN SELECT * FROM (VALUES
 ('pending_baptisms',current_setting('qa199.baptism')::uuid),
 ('pending_confirmations',current_setting('qa199.confirmation')::uuid)) x(t,pid)
 LOOP
  EXECUTE format('UPDATE public.%I SET raw_data=raw_data||''{"qa_normal_note":"allowed"}''::jsonb WHERE id=$1',t) USING pid;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'V199 legitimate historical edit blocked %',t;END IF;
  ordinary:=ordinary+1;
  FOR action,command IN SELECT * FROM (VALUES
    ('clear_all',format('UPDATE public.%I SET status=''pending'',reportado=false,raw_data=''{}''::jsonb WHERE id=$1',t)),
    ('clear_reported',format('UPDATE public.%I SET reportado=false WHERE id=$1',t)),
    ('clear_status',format('UPDATE public.%I SET status=''pending'' WHERE id=$1',t)),
    ('remove_seated_book',format('UPDATE public.%I SET raw_data=raw_data-''seated_book'' WHERE id=$1',t)),
    ('remove_archive_flag',format('UPDATE public.%I SET raw_data=raw_data-''boleta_archived'' WHERE id=$1',t)),
    ('change_seated_reference',format('UPDATE public.%I SET raw_data=jsonb_set(raw_data,ARRAY[CASE WHEN $2=''pending_baptisms'' THEN ''seated_baptism_id'' ELSE ''seated_confirmation_id'' END],''"00000000-0000-4000-a000-000000019902"''::jsonb) WHERE id=$1',t)),
    ('delete_historical',format('DELETE FROM public.%I WHERE id=$1',t))
   ) q(action,command)
  LOOP
   BEGIN
     IF action='change_seated_reference' THEN EXECUTE command USING pid,t;ELSE EXECUTE command USING pid;END IF;
     RAISE EXCEPTION 'V199_UNAUTHORIZED_ACCEPTED';
   EXCEPTION WHEN insufficient_privilege THEN
     GET STACKED DIAGNOSTICS message=MESSAGE_TEXT;
     IF message NOT LIKE 'Boleta protegida:%' THEN RAISE EXCEPTION 'V199 wrong rejection in %/%: %',t,action,message;END IF;
     denials:=denials+1;
   END;
  END LOOP;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE id=$1 AND status=''legacy_reported_unmatched'' AND reportado IS TRUE AND raw_data ? ''seated_book''',t) INTO n USING pid;
  IF n<>1 THEN RAISE EXCEPTION 'V199 historical reference changed after rejected action in %',t;END IF;
 END LOOP;
 IF denials<>14 OR ordinary<>2 THEN RAISE EXCEPTION 'V199 unexpected matrix: % denied and % ordinary',denials,ordinary;END IF;
 PERFORM set_config('qa199.result',jsonb_build_object('historical_downgrade_and_deletion_rejected',denials,
 'ordinary_historical_edits_allowed',ordinary,'historical_rows_preserved',2,'rollback',true)::text,true);
END $qa$;
RESET ROLE;
SELECT current_setting('qa199.result')::jsonb AS results;
ROLLBACK;
