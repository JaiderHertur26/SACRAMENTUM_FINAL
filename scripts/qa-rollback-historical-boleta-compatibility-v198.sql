-- V198: historical imported reported records must remain editable without reclassification.
-- Fictional rows and edits exist only inside this rollback transaction.
BEGIN;
SET LOCAL statement_timeout='20000ms';
DO $setup$
DECLARE p uuid;u uuid;idb uuid;idc uuid;
BEGIN
 SELECT parish_id,auth_user_id INTO STRICT p,u FROM public.user_profiles
 WHERE role='parish' AND is_active IS TRUE AND upper(status)='ACTIVE' LIMIT 1;
 INSERT INTO public.pending_baptisms(id,parish_id,status,reportado,raw_data)
 VALUES(gen_random_uuid(),p,'legacy_reported_unmatched',true,
 '{"qa":"V198_IMPORTED","nombres":"FICTICIO","apellidos":"HISTORICO"}'::jsonb)
 RETURNING id INTO idb;
 INSERT INTO public.pending_confirmations(id,parish_id,status,reportado,raw_data)
 VALUES(gen_random_uuid(),p,'legacy_reported_unmatched',true,
 '{"qa":"V198_IMPORTED","nombres":"FICTICIO","apellidos":"HISTORICO"}'::jsonb)
 RETURNING id INTO idc;
 PERFORM set_config('qa198.actor',u::text,true);
 PERFORM set_config('qa198.b',idb::text,true);
 PERFORM set_config('qa198.c',idc::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $verify$
DECLARE tbl text;pid uuid;n integer;allowed integer:=0;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',current_setting('qa198.actor'),true);
 PERFORM set_config('request.jwt.claims',
 jsonb_build_object('sub',current_setting('qa198.actor'),'role','authenticated')::text,true);
 FOR tbl,pid IN SELECT * FROM (VALUES
 ('pending_baptisms',current_setting('qa198.b')::uuid),
 ('pending_confirmations',current_setting('qa198.c')::uuid)) q(tbl,pid)
 LOOP
  EXECUTE format('UPDATE public.%I SET raw_data=raw_data||''{"qa_historic_note":"allowed"}''::jsonb WHERE id=$1',tbl) USING pid;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'V198 legacy edit blocked: %',tbl;END IF;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE id=$1 AND status=''legacy_reported_unmatched'' AND reportado IS TRUE',tbl)
   INTO n USING pid;
  IF n<>1 THEN RAISE EXCEPTION 'V198 historical classification changed: %',tbl;END IF;
  allowed:=allowed+1;
 END LOOP;
 PERFORM set_config('qa198.legacy',jsonb_build_object(
  'old_reported_rows_editable',allowed,'classification_unchanged',true,'rollback',true)::text,true);
END $verify$;
RESET ROLE;
SELECT current_setting('qa198.legacy')::jsonb AS result;
ROLLBACK;
