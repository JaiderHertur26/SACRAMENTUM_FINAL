-- SACRAMENTUM V172 · P0: restrict episcopal tenure records to own jurisdiction.
-- Proof of vulnerable original: synthetic diocese A read and deleted fictional tenure
-- belonging to the other diocese under BEGIN/ROLLBACK.
-- Entire migration contains only RLS policy changes; never modifies data.
ALTER TABLE public.bishop_tenures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bishop_tenures_parish_select ON public.bishop_tenures;
DROP POLICY IF EXISTS bishop_tenures_parish_insert ON public.bishop_tenures;
DROP POLICY IF EXISTS bishop_tenures_parish_update ON public.bishop_tenures;
DROP POLICY IF EXISTS bishop_tenures_parish_delete ON public.bishop_tenures;
CREATE POLICY bishop_tenures_parish_select ON public.bishop_tenures
 FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.user_profiles up
  JOIN public.parishes p ON p.id=bishop_tenures.parish_id
  WHERE up.auth_user_id=(SELECT auth.uid())
    AND up.is_active IS TRUE
    AND lower(coalesce(up.status,'active'))='active'
    AND (
       lower(up.role)='admin_general'
       OR (lower(up.role) IN ('diocese','archdiocese') AND up.diocese_id=p.diocese_id
           AND up.diocese_id IS NOT NULL)
       OR (lower(up.role)='parish' AND up.parish_id=bishop_tenures.parish_id
           AND up.diocese_id=p.diocese_id AND up.diocese_id IS NOT NULL)
    )
 ));
CREATE POLICY bishop_tenures_parish_insert ON public.bishop_tenures
 FOR INSERT TO authenticated WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_profiles up
  JOIN public.parishes p ON p.id=bishop_tenures.parish_id
  WHERE up.auth_user_id=(SELECT auth.uid())
    AND up.is_active IS TRUE
    AND lower(coalesce(up.status,'active'))='active'
    AND (
       lower(up.role)='admin_general'
       OR (lower(up.role) IN ('diocese','archdiocese') AND up.diocese_id=p.diocese_id
           AND up.diocese_id IS NOT NULL)
       OR (lower(up.role)='parish' AND up.parish_id=bishop_tenures.parish_id
           AND up.diocese_id=p.diocese_id AND up.diocese_id IS NOT NULL)
    )
 ));
CREATE POLICY bishop_tenures_parish_update ON public.bishop_tenures
 FOR UPDATE TO authenticated USING (EXISTS (
  SELECT 1 FROM public.user_profiles up
  JOIN public.parishes p ON p.id=bishop_tenures.parish_id
  WHERE up.auth_user_id=(SELECT auth.uid())
    AND up.is_active IS TRUE
    AND lower(coalesce(up.status,'active'))='active'
    AND (
       lower(up.role)='admin_general'
       OR (lower(up.role) IN ('diocese','archdiocese') AND up.diocese_id=p.diocese_id
           AND up.diocese_id IS NOT NULL)
       OR (lower(up.role)='parish' AND up.parish_id=bishop_tenures.parish_id
           AND up.diocese_id=p.diocese_id AND up.diocese_id IS NOT NULL)
    )
 )) WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_profiles up
  JOIN public.parishes p ON p.id=bishop_tenures.parish_id
  WHERE up.auth_user_id=(SELECT auth.uid())
    AND up.is_active IS TRUE
    AND lower(coalesce(up.status,'active'))='active'
    AND (
       lower(up.role)='admin_general'
       OR (lower(up.role) IN ('diocese','archdiocese') AND up.diocese_id=p.diocese_id
           AND up.diocese_id IS NOT NULL)
       OR (lower(up.role)='parish' AND up.parish_id=bishop_tenures.parish_id
           AND up.diocese_id=p.diocese_id AND up.diocese_id IS NOT NULL)
    )
 ));
CREATE POLICY bishop_tenures_parish_delete ON public.bishop_tenures
 FOR DELETE TO authenticated USING (EXISTS (
  SELECT 1 FROM public.user_profiles up
  JOIN public.parishes p ON p.id=bishop_tenures.parish_id
  WHERE up.auth_user_id=(SELECT auth.uid())
    AND up.is_active IS TRUE
    AND lower(coalesce(up.status,'active'))='active'
    AND (
       lower(up.role)='admin_general'
       OR (lower(up.role) IN ('diocese','archdiocese') AND up.diocese_id=p.diocese_id
           AND up.diocese_id IS NOT NULL)
       OR (lower(up.role)='parish' AND up.parish_id=bishop_tenures.parish_id
           AND up.diocese_id=p.diocese_id AND up.diocese_id IS NOT NULL)
    )
 ));
