-- SACRAMENTUM V190: inventario privilegiado real de PostgreSQL, solo lectura.
BEGIN READ ONLY;
DO $qa$
DECLARE
 definer_total integer; privileged_auth integer; privileged_anon integer;
 no_fixed_path integer; explicit_temp_path integer; mutable_namespace integer;
 affected integer; delegated_guards integer;
BEGIN
 SELECT count(*)::integer,
   count(*) FILTER(WHERE has_function_privilege('authenticated',p.oid,'EXECUTE'))::integer,
   count(*) FILTER(WHERE has_function_privilege('anon',p.oid,'EXECUTE'))::integer,
   count(*) FILTER(WHERE NOT EXISTS(
      SELECT 1 FROM unnest(coalesce(p.proconfig,ARRAY[]::text[])) c WHERE c LIKE 'search_path=%'
   ))::integer,
   count(*) FILTER(WHERE EXISTS(
      SELECT 1 FROM unnest(coalesce(p.proconfig,ARRAY[]::text[])) c WHERE c LIKE 'search_path=%pg_temp%'
   ))::integer
 INTO definer_total, privileged_auth,privileged_anon,no_fixed_path,explicit_temp_path
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN('public','private') AND p.prosecdef;
 SELECT count(*)::integer INTO mutable_namespace
 FROM pg_namespace n
 WHERE n.nspname IN('public','private','auth','storage','extensions')
 AND (has_schema_privilege('authenticated',n.oid,'CREATE')
 OR has_schema_privilege('anon',n.oid,'CREATE')
 OR has_schema_privilege('public',n.oid,'CREATE'));
 SELECT count(*)::integer INTO affected
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN
 ('issue_documentary_decree_v88','get_decree_trace_v89','register_historical_narrative')
 AND p.prosecdef AND p.proconfig @> ARRAY['search_path=""']::text[];
 SELECT count(*)::integer INTO delegated_guards
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prosecdef
 AND has_function_privilege('authenticated',p.oid,'EXECUTE')
 AND p.prosrc !~* 'auth[.]uid|current_app_|can_access_|can_manage_|is_app_admin|current_effective_diocese|request.jwt.claim.sub|jwt.claims';
 IF definer_total<>210 OR privileged_auth<>149 OR privileged_anon<>0
 OR no_fixed_path<>0 OR explicit_temp_path<>0 OR mutable_namespace<>0 OR affected<>3 OR delegated_guards>8 THEN
  RAISE EXCEPTION 'V190 function security regression: %,%,%,%,%,%,%',
   definer_total,privileged_auth,privileged_anon,no_fixed_path,explicit_temp_path,mutable_namespace,affected;
 END IF;
 PERFORM set_config('qa190.report',jsonb_build_object(
 'privileged_functions',definer_total,
 'authenticated_executable',privileged_auth,
 'anonymous_executable',privileged_anon,
 'missing_fixed_search_path',no_fixed_path,
 'explicit_pg_temp_search_path',explicit_temp_path,
 'writable_search_namespaces',mutable_namespace,
 'newly_hardened_functions',affected,
 'functions_using_delegated_authorization_unverified',delegated_guards
 )::text,true);
END $qa$;
SELECT current_setting('qa190.report')::jsonb AS qa_report;
ROLLBACK;
