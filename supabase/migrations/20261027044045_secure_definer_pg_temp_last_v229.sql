-- V229 · SECURITY DEFINER function temporary-schema shadowing hardening.
-- This migration alters only the search_path of existing public functions owned by postgres.
-- Existing function source, arguments, ACL, owners and data remain unchanged.
-- The explicitly trusted public schema is searched before pg_temp for relation/type names.
-- New migrations must likewise SET search_path TO public, pg_temp (or fully qualify
-- every identifier with an otherwise locked-down path).
DO $security_v229$
DECLARE
  target RECORD;
  changed integer := 0;
  unexpected_owners integer := 0;
BEGIN
  SELECT count(*) INTO unexpected_owners
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND p.proconfig @> ARRAY['search_path=public']::text[]
    AND p.proowner <> 'postgres'::regrole;
  IF unexpected_owners <> 0 THEN
    RAISE EXCEPTION 'V229: % SECURITY DEFINER functions require their legitimate owning role; refusing partial change', unexpected_owners;
  END IF;

  FOR target IN
    SELECT n.nspname AS schema_name, p.proname AS routine_name,
           pg_get_function_identity_arguments(p.oid) AS routine_arguments
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proowner = 'postgres'::regrole
      AND p.proconfig @> ARRAY['search_path=public']::text[]
    ORDER BY p.oid
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path TO public, pg_temp',
                   target.schema_name, target.routine_name, target.routine_arguments);
    changed := changed + 1;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prosecdef
      AND p.proconfig @> ARRAY['search_path=public']::text[]
  ) THEN
    RAISE EXCEPTION 'V229: unsafe SECURITY DEFINER path remains after update';
  END IF;
  RAISE NOTICE 'V229: % privileged functions secured with pg_temp last', changed;
END
$security_v229$;
