-- V197 SQL isolation of pending documents: same diocese, two real parish scopes,
-- four invented boletas and four privileged creation RPCs; all ROLLBACK.
-- No real user identity, registration, or historical records are left changed.
BEGIN;
SET LOCAL statement_timeout='45000ms';
DO $init$
DECLARE profile uuid;actor uuid;one_parish uuid;other_parish uuid;
BEGIN
 SELECT id,auth_user_id,parish_id INTO STRICT profile,actor,one_parish
 FROM public.user_profiles WHERE role='parish' AND is_active IS TRUE AND upper(status)='ACTIVE' LIMIT 1;
 SELECT id INTO STRICT other_parish FROM public.parishes WHERE id<>one_parish
 AND EXISTS(SELECT 1 FROM public.baptisms WHERE parish_id=public.parishes.id)
 LIMIT 1;
 PERFORM set_config('qa197.profile',profile::text,true);
 PERFORM set_config('qa197.actor',actor::text,true);
 PERFORM set_config('qa197.owner',one_parish::text,true);
 PERFORM set_config('qa197.foreign',other_parish::text,true);
END $init$;
SET LOCAL ROLE authenticated;
DO $prepare$
DECLARE owner_id uuid:=current_setting('qa197.owner')::uuid;
 actor_id uuid:=current_setting('qa197.actor')::uuid;
 kind text;rpc text;payload jsonb;pending_uuid uuid;all_ids jsonb:='{}'::jsonb;created integer:=0;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',actor_id::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor_id,'role','authenticated')::text,true);
 FOR kind,rpc,payload IN SELECT * FROM (VALUES
 ('baptism','create_pending_baptism','{"nombres":"FICTICIA","apellidos":"QA-V197","fechaSacramento":"2026-10-24","qa_v197":"yes"}'::jsonb),
 ('confirmation','create_pending_confirmation','{"nombres":"FICTICIA","apellidos":"QA-V197","fechaSacramento":"2026-10-24","qa_v197":"yes"}'::jsonb),
 ('marriage','create_pending_marriage','{"novioNombres":"FICTICIO","novioApellidos":"QA-V197","noviaNombres":"FICTICIA","noviaApellidos":"QA-V197","fechaSacramento":"2026-10-24","qa_v197":"yes"}'::jsonb),
 ('funeral','create_pending_funeral','{"nombres":"FICTICIA","apellidos":"QA-V197","fecha_defuncion":"2026-10-20","fecha_exequias":"2026-10-24","qa_v197":"yes"}'::jsonb)
 ) t(kind,rpc,payload)
 LOOP
   EXECUTE format('SELECT pending_id FROM public.%I($1,$2)',rpc) INTO STRICT pending_uuid USING owner_id,payload;
   all_ids:=all_ids||jsonb_build_object(kind,pending_uuid);
   created:=created+1;
 END LOOP;
 IF created<>4 THEN RAISE EXCEPTION 'QA197 failed to create 4 synthetic boletas';END IF;
 PERFORM set_config('qa197.ids',all_ids::text,true);
END $prepare$;
RESET ROLE;
UPDATE public.user_profiles SET parish_id=current_setting('qa197.foreign')::uuid
WHERE id=current_setting('qa197.profile')::uuid;
SET LOCAL ROLE authenticated;
DO $negative$
DECLARE p uuid:=current_setting('qa197.owner')::uuid;
 actor uuid:=current_setting('qa197.actor')::uuid;
 ids jsonb:=current_setting('qa197.ids')::jsonb;
 kind text;table_name text;rpc text;payload jsonb;
 pid uuid;msg text;cnt integer;affected integer;checked_read integer:=0;blocked_rpc integer:=0;
 blocked_update integer:=0;blocked_delete integer:=0;blocked_insert integer:=0;
BEGIN
 IF public.current_app_role()<>'parish' OR public.current_app_parish_id() IS DISTINCT FROM current_setting('qa197.foreign')::uuid
 THEN RAISE EXCEPTION 'QA197 incorrect switched identity';END IF;
 FOR kind,table_name,rpc,payload IN SELECT * FROM (VALUES
 ('baptism','pending_baptisms','create_pending_baptism','{"nombres":"FICTICIA","apellidos":"QA-V197","fechaSacramento":"2026-10-24"}'::jsonb),
 ('confirmation','pending_confirmations','create_pending_confirmation','{"nombres":"FICTICIA","apellidos":"QA-V197","fechaSacramento":"2026-10-24"}'::jsonb),
 ('marriage','pending_marriages','create_pending_marriage','{"novioNombres":"FICTICIO","novioApellidos":"QA-V197","noviaNombres":"FICTICIA","noviaApellidos":"QA-V197","fechaSacramento":"2026-10-24"}'::jsonb),
 ('funeral','pending_funerals','create_pending_funeral','{"nombres":"FICTICIA","apellidos":"QA-V197","fecha_defuncion":"2026-10-20","fecha_exequias":"2026-10-24"}'::jsonb)
 ) t(kind,table_name,rpc,payload)
 LOOP
  pid:=(ids->>kind)::uuid;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE id=$1',table_name) INTO cnt USING pid;
  IF cnt<>0 THEN RAISE EXCEPTION 'QA197 foreign boleta visible: %',kind;END IF;
  checked_read:=checked_read+1;
  BEGIN
   EXECUTE format('SELECT pending_id FROM public.%I($1,$2)',rpc) USING p,payload;
   RAISE EXCEPTION 'QA197 RPC bypass in %',kind;
  EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT;
   IF position('parroquia propietaria' in msg)=0 THEN RAISE EXCEPTION 'QA197 wrong RPC response %: %',kind,msg;END IF;
   blocked_rpc:=blocked_rpc+1;
  END;
  IF kind IN ('baptism','confirmation') THEN
    EXECUTE format('UPDATE public.%I SET status=status WHERE id=$1',table_name) USING pid;
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected<>0 THEN RAISE EXCEPTION 'QA197 foreign update succeeded %',kind;END IF;
    blocked_update:=blocked_update+1;
    EXECUTE format('DELETE FROM public.%I WHERE id=$1',table_name) USING pid;
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected<>0 THEN RAISE EXCEPTION 'QA197 foreign delete succeeded %',kind;END IF;
    blocked_delete:=blocked_delete+1;
    BEGIN
     EXECUTE format('INSERT INTO public.%I(id,parish_id,status,reportado,raw_data) VALUES(gen_random_uuid(),$1,''pending'',false,''{}''::jsonb)',table_name) USING p;
     RAISE EXCEPTION 'QA197 foreign INSERT succeeded %',kind;
    EXCEPTION WHEN insufficient_privilege THEN
     blocked_insert:=blocked_insert+1;
    END;
  ELSE
    IF has_table_privilege('authenticated',format('public.%I',table_name),'UPDATE')
     OR has_table_privilege('authenticated',format('public.%I',table_name),'DELETE')
     OR has_table_privilege('authenticated',format('public.%I',table_name),'INSERT')
    THEN RAISE EXCEPTION 'QA197 unexpected direct DML grants for %',kind;END IF;
    blocked_update:=blocked_update+1;
    blocked_delete:=blocked_delete+1;
    blocked_insert:=blocked_insert+1;
  END IF;
 END LOOP;
 IF checked_read<>4 OR blocked_rpc<>4 OR blocked_update<>4 OR blocked_delete<>4 OR blocked_insert<>4
 THEN RAISE EXCEPTION 'QA197 test matrix incomplete';END IF;
 PERFORM set_config('qa197.negative',jsonb_build_object('foreign_read_hidden',checked_read,'foreign_creation_rpc_denied',blocked_rpc,
 'foreign_update_denied_or_ungranted',blocked_update,'foreign_delete_denied_or_ungranted',blocked_delete,
 'foreign_insert_denied_or_ungranted',blocked_insert,'all_rollback',true)::text,true);
END $negative$;
RESET ROLE;
DO $verify$
DECLARE ids jsonb:=current_setting('qa197.ids')::jsonb;kind text;tbl text;pid uuid;n integer;
BEGIN
 FOR kind,tbl IN SELECT * FROM (VALUES
 ('baptism','pending_baptisms'),('confirmation','pending_confirmations'),
 ('marriage','pending_marriages'),('funeral','pending_funerals')) q(kind,tbl)
 LOOP
  pid:=(ids->>kind)::uuid;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE id=$1 AND parish_id=$2',tbl) INTO n USING pid,current_setting('qa197.owner')::uuid;
  IF n<>1 THEN RAISE EXCEPTION 'QA197 original boleta damaged: %',kind;END IF;
 END LOOP;
END $verify$;
SELECT current_setting('qa197.negative')::jsonb AS results;
ROLLBACK;
