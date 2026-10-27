-- V226 / NOT EXECUTED on existing QA: postgres lacks authority for supabase_admin.
-- Run only with an authorized supabase_admin role or member after independent approval,
-- and verify new-object RLS and explicit GRANTs in a NON-PRODUCTION rehearsal.
-- This changes FUTURE OBJECT DEFAULTS ONLY, not existing rows/tables/functions.
DO $$
BEGIN
  IF NOT pg_has_role(current_user, 'supabase_admin', 'MEMBER') THEN
    RAISE EXCEPTION 'Se requiere autorización efectiva del rol supabase_admin';
  END IF;
END $$;
BEGIN;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE USAGE, SELECT, UPDATE ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
COMMIT;
