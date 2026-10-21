-- SACRAMENTUM V96: firma e identidad institucional aisladas de Gobierno General.
-- Reproducción previa: UPDATE sin alteración de contenido desde admin_general,
-- 1 fila de mis_datos perteneciente a parroquia. BEGIN/ROLLBACK.
-- No se modifica SELECT; se conservan Diócesis, Cancillería y Parroquia,
-- con los ámbitos exactos establecidos por las políticas anteriores.
ALTER POLICY mis_datos_insert_owner ON public.mis_datos
  WITH CHECK (
  (public.current_app_role() = 'parish'
    AND entity_id = public.current_app_parish_id())
  OR
  (public.current_app_role() = 'diocese'
    AND (entity_id = public.current_app_diocese_id()
         OR public.can_access_parish(entity_id)))
  OR
  (public.current_app_role() = 'chancery'
    AND entity_id = public.current_app_chancery_id())
);
ALTER POLICY mis_datos_update_owner ON public.mis_datos
  USING (
  (public.current_app_role() = 'parish'
    AND entity_id = public.current_app_parish_id())
  OR
  (public.current_app_role() = 'diocese'
    AND (entity_id = public.current_app_diocese_id()
         OR public.can_access_parish(entity_id)))
  OR
  (public.current_app_role() = 'chancery'
    AND entity_id = public.current_app_chancery_id())
)
  WITH CHECK (
  (public.current_app_role() = 'parish'
    AND entity_id = public.current_app_parish_id())
  OR
  (public.current_app_role() = 'diocese'
    AND (entity_id = public.current_app_diocese_id()
         OR public.can_access_parish(entity_id)))
  OR
  (public.current_app_role() = 'chancery'
    AND entity_id = public.current_app_chancery_id())
);
ALTER POLICY mis_datos_delete_owner ON public.mis_datos
  USING (
  (public.current_app_role() = 'parish'
    AND entity_id = public.current_app_parish_id())
  OR
  (public.current_app_role() = 'diocese'
    AND (entity_id = public.current_app_diocese_id()
         OR public.can_access_parish(entity_id)))
  OR
  (public.current_app_role() = 'chancery'
    AND entity_id = public.current_app_chancery_id())
);
