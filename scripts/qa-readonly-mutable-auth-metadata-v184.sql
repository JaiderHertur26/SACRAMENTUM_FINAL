-- SACRAMENTUM V184: autorización sin user_metadata, catálogo live SQL, solo lectura.
-- No crea usuarios, no consulta expedientes ni modifica datos.
BEGIN READ ONLY;
DO $qa$
DECLARE
 funcs integer;bad_funcs integer;parsed integer;
 policies integer;bad_policies integer;
 views integer;bad_views integer;
 body text;
BEGIN
 SELECT count(*)::int,
        count(*) FILTER (WHERE p.prosrc ~* '(raw_user_meta_data|user_metadata)')::int,
        count(*) FILTER (WHERE p.prosqlbody IS NOT NULL)::int
 INTO funcs,bad_funcs,parsed
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('public','private') AND p.prokind IN ('f','p');
 SELECT count(*)::int,
        count(*) FILTER (WHERE coalesce(qual,'') ~* '(raw_user_meta_data|user_metadata)' OR coalesce(with_check,'') ~* '(raw_user_meta_data|user_metadata)')::int
 INTO policies,bad_policies FROM pg_policies
 WHERE schemaname IN ('public','private','storage');
 SELECT count(*)::int,
        count(*) FILTER (WHERE definition ~* '(raw_user_meta_data|user_metadata)')::int
 INTO views,bad_views FROM (
   SELECT definition FROM pg_views WHERE schemaname IN ('public','private','storage')
   UNION ALL
   SELECT definition FROM pg_matviews WHERE schemaname IN ('public','private','storage')
 ) t;
 IF funcs<200 OR policies<100 THEN
   RAISE EXCEPTION 'V184 catalog inventory unexpectedly incomplete';
 END IF;
 IF bad_funcs<>0 OR bad_policies<>0 OR bad_views<>0 OR parsed<>0 THEN
   RAISE EXCEPTION 'V184 unverified or editable user metadata in authorization SQL';
 END IF;
 SELECT p.prosrc INTO STRICT body
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='current_app_role' AND p.prokind='f';
 IF body !~* 'user_profiles' OR body !~* 'is_active' OR body !~* 'status' OR body !~* 'auth.uid\(\)' THEN
   RAISE EXCEPTION 'V184 canonical role resolver contract no longer recognized';
 END IF;
 PERFORM set_config('qa184.aggregate',jsonb_build_object(
  'functions',funcs,'policies',policies,'views',views,
  'mutable_metadata_references',bad_funcs+bad_policies+bad_views,
  'parsed_sql_bodies',parsed
 )::text,true);
END $qa$;
SELECT current_setting('qa184.aggregate')::jsonb AS qa_catalog_counts;
ROLLBACK;
