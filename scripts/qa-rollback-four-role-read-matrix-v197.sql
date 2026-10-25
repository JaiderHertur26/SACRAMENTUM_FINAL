-- V197: Four current institutional roles, 11 scoped tables, active/suspended.
-- No personal detail emitted. All role-state changes roll back.
BEGIN;
SET LOCAL statement_timeout='45000ms';
DO $setup$
DECLARE actors jsonb:='{}'::jsonb;expectations jsonb:='{}'::jsonb;
 person record;tbl text;global_count integer;parish_count integer;parish uuid;role_count integer;
BEGIN
 FOR person IN SELECT role,auth_user_id,parish_id FROM public.user_profiles
  WHERE role IN('admin_general','diocese','chancery','parish')
  AND is_active IS TRUE AND upper(status)='ACTIVE'
 LOOP
  actors:=actors||jsonb_build_object(person.role,person.auth_user_id);
  IF person.role='parish' THEN parish=person.parish_id;END IF;
 END LOOP;
 SELECT count(*) INTO role_count FROM jsonb_each(actors);
 IF role_count<>4 THEN RAISE EXCEPTION 'V197 incomplete roles';END IF;
 FOREACH tbl IN ARRAY ARRAY['baptisms','confirmations','marriages','funerals',
  'pending_baptisms','pending_confirmations','pending_marriages','pending_funerals',
  'registry_print_events','marginal_notes','decretos']
 LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',tbl) INTO global_count;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE parish_id=$1',tbl)
   INTO parish_count USING parish;
  expectations:=expectations||jsonb_build_object(tbl,
   jsonb_build_object('institution',global_count,'parish',parish_count));
 END LOOP;
 PERFORM set_config('qa197.actors',actors::text,true);
 PERFORM set_config('qa197.expected',expectations::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $active$
DECLARE a_role text;a_uid text;tbl text;n integer;needed integer;
 roles jsonb:=current_setting('qa197.actors')::jsonb;
 expected jsonb:=current_setting('qa197.expected')::jsonb;
 successes integer:=0;
BEGIN
 FOR a_role,a_uid IN SELECT key,value FROM jsonb_each_text(roles)
 LOOP
  PERFORM set_config('request.jwt.claim.sub',a_uid,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a_uid,'role','authenticated')::text,true);
  IF public.current_app_role() IS DISTINCT FROM a_role THEN
   RAISE EXCEPTION 'V197 active actor role mismatch %',a_role;
  END IF;
  FOREACH tbl IN ARRAY ARRAY['baptisms','confirmations','marriages','funerals',
   'pending_baptisms','pending_confirmations','pending_marriages','pending_funerals',
   'registry_print_events','marginal_notes','decretos']
  LOOP
   EXECUTE format('SELECT count(*) FROM public.%I',tbl) INTO n;
   needed:=(expected->tbl->>(CASE WHEN a_role='parish' THEN 'parish' ELSE 'institution' END))::integer;
   IF n<>needed THEN RAISE EXCEPTION 'V197 bad SELECT % % expected % got %',a_role,tbl,needed,n;END IF;
   successes:=successes+1;
  END LOOP;
 END LOOP;
 IF successes<>44 THEN RAISE EXCEPTION 'V197 active matrix incomplete';END IF;
 PERFORM set_config('qa197.active_pass',successes::text,true);
END $active$;
RESET ROLE;
UPDATE public.user_profiles SET status='SUSPENDED'
WHERE role IN ('admin_general','diocese','chancery','parish')
AND is_active IS TRUE AND upper(status)='ACTIVE';
SET LOCAL ROLE authenticated;
DO $inactive$
DECLARE a_role text;a_uid text;tbl text;n integer;blocked integer:=0;
 roles jsonb:=current_setting('qa197.actors')::jsonb;
BEGIN
 FOR a_role,a_uid IN SELECT key,value FROM jsonb_each_text(roles)
 LOOP
  PERFORM set_config('request.jwt.claim.sub',a_uid,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a_uid,'role','authenticated')::text,true);
  IF public.current_app_role() IS NOT NULL THEN
   RAISE EXCEPTION 'V197 suspended profile retained role %',a_role;
  END IF;
  FOREACH tbl IN ARRAY ARRAY['baptisms','confirmations','marriages','funerals',
   'pending_baptisms','pending_confirmations','pending_marriages','pending_funerals',
   'registry_print_events','marginal_notes','decretos']
  LOOP
   EXECUTE format('SELECT count(*) FROM public.%I',tbl) INTO n;
   IF n<>0 THEN RAISE EXCEPTION 'V197 suspended % read % from %',a_role,n,tbl;END IF;
   blocked:=blocked+1;
  END LOOP;
 END LOOP;
 IF blocked<>44 THEN RAISE EXCEPTION 'V197 disabled matrix incomplete';END IF;
 PERFORM set_config('qa197.denied_pass',blocked::text,true);
END $inactive$;
RESET ROLE;
SELECT current_setting('qa197.active_pass')::integer AS correct_active_scope,
 current_setting('qa197.denied_pass')::integer AS denied_suspended_reads,
 'ROLLBACK' AS finalization;
ROLLBACK;
