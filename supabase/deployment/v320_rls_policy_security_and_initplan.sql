-- V320 · Optimización RLS y exclusividad de decretos/notificaciones.
-- ALTER POLICY conserva todos los roles y operaciones existentes.
-- La política de decretos y la de otras notificaciones dejan de superponerse.
ALTER POLICY pending_tokens_insert_owner ON public.pending_tokens
WITH CHECK (
 ((is_app_admin()) AND created_by=(SELECT auth.uid()) AND upper(type::text)='DIOCESE')
 OR ((current_app_role()='diocese') AND created_by=(SELECT auth.uid())
     AND upper(type::text) IN ('PARISH','CHANCERY')
     AND coalesce(payload->>'dioceseId','')=coalesce(current_effective_diocese_id()::text,'')
     AND (upper(type::text)='CHANCERY' OR coalesce(payload->>'vicaryId','')<>''))
);
ALTER POLICY decretos_select_scope ON public.decretos
USING (
 (SELECT auth.uid()) IS NOT NULL AND
 ((current_app_role()='chancery' AND diocese_id=current_app_diocese_id())
  OR (current_app_role()='parish' AND parish_id=current_app_parish_id()
     AND diocese_id=current_app_diocese_id()))
);
ALTER POLICY decree_notification_private_v312 ON public.official_notifications
USING (
 category='decree' AND (SELECT auth.uid()) IS NOT NULL AND
 ((current_app_role()='chancery' AND diocese_id=current_app_diocese_id())
  OR (current_app_role()='parish' AND receiver_parish_id=current_app_parish_id()
      AND diocese_id=current_app_diocese_id()))
);
ALTER POLICY official_notifications_select_scoped ON public.official_notifications
USING (
 category <> 'decree' AND
 (is_app_admin()
  OR (current_app_role()='parish' AND receiver_parish_id=current_app_parish_id())
  OR (current_app_role() IN ('diocese','chancery') AND diocese_id=current_app_diocese_id()))
);
