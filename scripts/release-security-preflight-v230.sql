-- SACRAMENTUM V230 Â· PREVUELO DE SEGURIDAD Â· SOLO LECTURA
-- Run with an authorized privileged SQL editor account against the TARGET project.
-- Supabase_admin global function defaults are implicit PUBLIC when the global f ACL is absent.
-- This checks metadata only. It never reads sacramental names nor mutates records.
WITH public_tables AS (
  SELECT c.oid,c.relrowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p')
),
default_grants AS (
  SELECT a.defaclrole::regrole::text AS owner, a.defaclobjtype,
    CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE x.grantee::regrole::text END AS grantee,
    x.privilege_type
  FROM pg_default_acl a
  CROSS JOIN LATERAL aclexplode(a.defaclacl) AS x
  WHERE a.defaclnamespace='public'::regnamespace
),
routines AS (
  SELECT p.oid,p.prosecdef,p.proconfig,
    has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
    has_function_privilege('anon',p.oid,'EXECUTE') AS anonymous_execute
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
)
SELECT
  (SELECT count(*) FROM public_tables)::int AS public_tables,
  (SELECT count(*) FROM public_tables WHERE NOT relrowsecurity)::int AS rls_disabled,
  (SELECT count(*) FROM public_tables WHERE has_table_privilege('authenticated',oid,'TRUNCATE'))::int AS auth_truncate_tables,
  (SELECT count(*) FROM public_tables WHERE has_table_privilege('anon',oid,'TRUNCATE'))::int AS anon_truncate_tables,
  (SELECT count(*) FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace AND NOT convalidated)::int AS unvalidated_foreign_keys,
  (SELECT count(*) FROM default_grants WHERE defaclobjtype='r' AND grantee IN ('PUBLIC','anon','authenticated')
    AND privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'))::int AS dangerous_default_table_grants,
  (SELECT count(*) FROM default_grants WHERE defaclobjtype='f' AND grantee IN ('PUBLIC','anon','authenticated')
    AND privilege_type='EXECUTE')::int AS open_default_function_grants,
  (SELECT count(*) FROM default_grants WHERE defaclobjtype='r'
    AND grantee IN ('PUBLIC','anon','authenticated'))::int AS future_user_table_grants,
  (SELECT count(*) FROM default_grants WHERE defaclobjtype='S'
    AND grantee IN ('PUBLIC','anon','authenticated'))::int AS future_user_sequence_grants,
  (SELECT count(*) FROM default_grants WHERE defaclobjtype='f'
    AND grantee IN ('PUBLIC','anon','authenticated'))::int AS future_user_function_grants,
  (SELECT count(*) FROM (VALUES ('postgres'::regrole),('supabase_admin'::regrole)) AS creators(role_oid)
     WHERE NOT EXISTS (
       SELECT 1 FROM pg_default_acl g
       WHERE g.defaclrole=creators.role_oid
         AND g.defaclnamespace=0 AND g.defaclobjtype='f'
     )
     OR EXISTS (
       SELECT 1 FROM pg_default_acl g
       CROSS JOIN LATERAL aclexplode(g.defaclacl) AS x
       WHERE g.defaclrole=creators.role_oid
         AND g.defaclnamespace=0 AND g.defaclobjtype='f'
         AND x.privilege_type='EXECUTE' AND
          (x.grantee=0 OR x.grantee IN ('anon'::regrole,'authenticated'::regrole))
     )
  )::int AS creators_missing_global_function_revoke,
  (SELECT count(*) FROM routines WHERE prosecdef AND proconfig @> ARRAY['search_path=public']::text[])::int AS insecure_public_only_definers,
  (SELECT count(*) FROM pg_extension WHERE extname='pg_graphql')::int AS unused_pg_graphql_enabled,
  (SELECT count(*) FROM routines)::int AS public_functions,
  (SELECT count(*) FROM routines WHERE prosecdef)::int AS security_definers,
  (SELECT count(*) FROM routines WHERE prosecdef AND anonymous_execute)::int AS anonymous_definer_functions,
  (SELECT count(*) FROM routines WHERE prosecdef AND authenticated_execute)::int AS authenticated_definer_functions,
  (SELECT count(*) FROM routines WHERE prosecdef AND NOT EXISTS(
      SELECT 1 FROM unnest(coalesce(proconfig,ARRAY[]::text[])) kv WHERE kv LIKE 'search_path=%'
  ))::int AS definer_missing_search_path;

[executed on device: JAIDERHERRERA-TURIZO (91f457af-ee73-43a6-9192-dbb2a920c49a)]
