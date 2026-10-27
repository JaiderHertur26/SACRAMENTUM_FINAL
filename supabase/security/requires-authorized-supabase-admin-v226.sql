-- OBSOLETE V226 — superseded by security preflight V234.
-- Supabase official guidance: the reserved supabase_admin DEFAULT ACLs cannot
-- be changed by project postgres, and membership cannot be granted by the user.
-- The correct mitigation is postgres-controlled defaults (already locked down)
-- plus forbidding extensions/objects owned by supabase_admin in public.
-- SEE: https://supabase.com/kb/troubleshooting/cant-change-the-default-privileges-of-supabase_admin-in-the-public-schema
-- THIS FILE MUST NEVER CHANGE DEFAULT PRIVILEGES. It deliberately fails closed.
DO $obsolete_v226$
BEGIN
  RAISE EXCEPTION
    'V226 supabase_admin default ACL remediation is unsupported. Use V234 preflight and keep extensions outside exposed public.'
    USING ERRCODE='0A000';
END
$obsolete_v226$;
