-- V226 / already applied to QA by privileged postgres; repeatable on a NEW project.
-- NEW objects only; existing sacramental records and grants stay untouched.
-- Every new schema migration must explicitly GRANT its intended operations,
-- and enable RLS with correct jurisdiction checks.
BEGIN;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE USAGE, SELECT, UPDATE ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, service_role;
-- CRITICAL: global PUBLIC function grants cannot be undone using only IN SCHEMA public.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
COMMIT;
