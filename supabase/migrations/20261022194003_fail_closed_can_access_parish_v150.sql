-- V150 SECURITY FIX · authenticated actor with no user_profiles row must NEVER
-- pass "IF NOT can_access_parish(...)" within SECURITY DEFINER RPCs.
-- Before: NULL OR NULL OR NULL = NULL; IF NOT NULL THEN skips denial.
-- Preserve the function owner, signature, grants and valid institutional roles.
CREATE OR REPLACE FUNCTION public.can_access_parish(target_parish_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    auth.uid() IS NOT NULL AND target_parish_id IS NOT NULL AND (
      public.is_app_admin()
      OR (
        public.current_app_role() = 'parish'
        AND public.current_app_parish_id() = target_parish_id
      )
      OR (
        public.current_app_role() IN ('diocese', 'chancery')
        AND EXISTS (
          SELECT 1
          FROM public.parishes p
          WHERE p.id = target_parish_id
            AND p.diocese_id = public.current_app_diocese_id()
        )
      )
    ), FALSE
  );
$function$;
