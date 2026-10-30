-- V320b: La política de decretos es RESTRICTIVE. Debe ser neutra para
-- avisos no-decreto y restrictiva solo cuando category='decree'.
ALTER POLICY decree_notification_private_v312 ON public.official_notifications
USING (
 category <> 'decree' OR
 ((SELECT auth.uid()) IS NOT NULL AND
  ((current_app_role()='chancery' AND diocese_id=current_app_diocese_id())
   OR (current_app_role()='parish' AND receiver_parish_id=current_app_parish_id()
       AND diocese_id=current_app_diocese_id())))
);
ALTER POLICY official_notifications_select_scoped ON public.official_notifications
USING (
 is_app_admin()
 OR (current_app_role()='parish' AND receiver_parish_id=current_app_parish_id())
 OR (current_app_role() IN ('diocese','chancery') AND diocese_id=current_app_diocese_id())
);
