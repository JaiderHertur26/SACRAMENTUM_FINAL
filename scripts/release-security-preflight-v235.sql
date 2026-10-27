-- SACRAMENTUM V235 Â· PREVUELO DE SEGURIDAD Â· SOLO LECTURA
-- Run with an authorized privileged SQL editor account against the TARGET project.
-- Supabase_admin global function defaults are implicit PUBLIC when the global f ACL is absent.
-- This checks metadata only. It never reads sacramental names nor mutates records.
WITH RECURSIVE public_tables AS (
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
),
privileged_rpc_sources AS (
  SELECT p.oid,p.proname,pg_get_functiondef(p.oid) AS body,
         has_function_privilege('authenticated',p.oid,'EXECUTE') AS auth_callable,
         p.prosecdef
  FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
),
privileged_rpc_edges AS (
  SELECT src.oid AS from_oid,dst.oid AS to_oid
  FROM privileged_rpc_sources src
  CROSS JOIN LATERAL regexp_matches(src.body,'public[.]([a-z_][a-z_0-9]*)[[:space:]]*[(]','gi') refs
  JOIN privileged_rpc_sources dst ON dst.proname=refs[1]
),
privileged_rpc_walks AS (
  SELECT f.oid origin,f.oid target,0 hops,ARRAY[f.oid] path
  FROM privileged_rpc_sources f WHERE f.prosecdef AND f.auth_callable
  UNION ALL
  SELECT w.origin,e.to_oid,w.hops+1,w.path||e.to_oid
  FROM privileged_rpc_walks w JOIN privileged_rpc_edges e ON e.from_oid=w.target
  WHERE w.hops<6 AND NOT e.to_oid=ANY(w.path)
),
privileged_rpc_identity_gaps AS (
  SELECT f.oid FROM privileged_rpc_sources f
  WHERE f.prosecdef AND f.auth_callable AND NOT EXISTS (
    SELECT 1 FROM privileged_rpc_walks w
    JOIN privileged_rpc_sources callee ON callee.oid=w.target
    WHERE w.origin=f.oid AND callee.body ~* 'auth[.]uid[[:space:]]*[(]'
  )
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
  (SELECT count(*) FROM public.conceptos_anulacion WHERE source_kind='legacy_catalog' AND source_reference ILIKE '%CPTOANULA.DBF%')::int AS qa_legacy_dbf_concept_rows,
  (SELECT count(*) FROM public.legacy_marginal_template_snapshots)::int AS qa_legacy_template_snapshot_rows,
  -- V235: Supabase internal supabase_admin ACLs are reserved and immutable to postgres.
  -- They are informational, not blockers by themselves. Block concrete exposure instead.
  (SELECT count(*) FROM default_grants WHERE owner='postgres' AND defaclobjtype='r'
    AND grantee IN ('PUBLIC','anon','authenticated'))::int AS postgres_future_table_grants,
  (SELECT count(*) FROM default_grants WHERE owner='postgres' AND defaclobjtype='S'
    AND grantee IN ('PUBLIC','anon','authenticated'))::int AS postgres_future_sequence_grants,
  (SELECT count(*) FROM default_grants WHERE owner='postgres' AND defaclobjtype='f'
    AND grantee IN ('PUBLIC','anon','authenticated'))::int AS postgres_future_function_grants,
  (SELECT count(*) FROM (VALUES ('postgres'::regrole)) v(owner_oid)
   WHERE NOT EXISTS(SELECT 1 FROM pg_default_acl g
      WHERE g.defaclrole=v.owner_oid AND g.defaclnamespace=0 AND g.defaclobjtype='f')
      OR EXISTS(SELECT 1 FROM pg_default_acl g
        CROSS JOIN LATERAL aclexplode(g.defaclacl) a
        WHERE g.defaclrole=v.owner_oid AND g.defaclnamespace=0 AND g.defaclobjtype='f'
          AND a.privilege_type='EXECUTE' AND (a.grantee=0 OR a.grantee IN ('anon'::regrole,'authenticated'::regrole)))
  )::int AS postgres_missing_global_function_revoke,
  -- V235: schema-local defaults are insufficient if the owner also set global defaults.
  -- These grants apply to ALL future tables/sequences owned by postgres, including public.
  (SELECT count(*) FROM pg_default_acl a CROSS JOIN LATERAL aclexplode(a.defaclacl) x
    WHERE a.defaclrole='postgres'::regrole AND a.defaclnamespace=0 AND a.defaclobjtype='r'
      AND (x.grantee=0 OR x.grantee IN ('anon'::regrole,'authenticated'::regrole))
  )::int AS postgres_global_table_grants,
  (SELECT count(*) FROM pg_default_acl a CROSS JOIN LATERAL aclexplode(a.defaclacl) x
    WHERE a.defaclrole='postgres'::regrole AND a.defaclnamespace=0 AND a.defaclobjtype='S'
      AND (x.grantee=0 OR x.grantee IN ('anon'::regrole,'authenticated'::regrole))
  )::int AS postgres_global_sequence_grants,
  (SELECT count(*) FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
    WHERE n.nspname='public')::int AS admin_risk_extensions_in_public,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relowner='supabase_admin'::regrole)::int AS admin_owned_public_relations,
  (SELECT count(*) FROM pg_proc p
    WHERE p.pronamespace='public'::regnamespace AND p.proowner='supabase_admin'::regrole)::int AS admin_owned_public_functions,
  (SELECT count(*) FROM public_tables t JOIN pg_class c ON c.oid=t.oid
    WHERE c.relowner='supabase_admin'::regrole
      AND has_table_privilege('authenticated',c.oid,'TRUNCATE'))::int AS admin_owned_exposed_truncate_tables,
  (SELECT count(*) FROM routines)::int AS public_functions,
  (SELECT count(*) FROM routines WHERE prosecdef)::int AS security_definers,
  (SELECT count(*) FROM routines WHERE prosecdef AND anonymous_execute)::int AS anonymous_definer_functions,
  (SELECT count(*) FROM routines WHERE prosecdef AND authenticated_execute)::int AS authenticated_definer_functions,
  (SELECT count(*) FROM privileged_rpc_identity_gaps)::int AS privileged_rpc_without_auth_identity_path,
  (SELECT count(*) FROM privileged_rpc_sources WHERE prosecdef AND auth_callable AND body !~* 'auth[.]uid[[:space:]]*[(]')::int AS privileged_rpc_using_delegated_identity,

  (SELECT count(*) FROM routines WHERE prosecdef AND NOT EXISTS(
      SELECT 1 FROM unnest(coalesce(proconfig,ARRAY[]::text[])) kv WHERE kv LIKE 'search_path=%'
  ))::int AS definer_missing_search_path;

[executed on device: JAIDERHERRERA-TURIZO (91f457af-ee73-43a6-9192-dbb2a920c49a)]
