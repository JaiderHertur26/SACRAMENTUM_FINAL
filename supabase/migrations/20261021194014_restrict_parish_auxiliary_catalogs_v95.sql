-- SACRAMENTUM V95 · Control estricto de titularidad en catálogos auxiliares
-- Las cinco tablas son catálogos por parroquia, no directorios centrales.
-- Antes del parche se demostró que admin_general podía INSERT en las cinco.
-- Prueba ficticia revertida íntegramente mediante BEGIN / ROLLBACK.
-- No modifica datos históricos ni las políticas SELECT de consulta autorizada.
-- El rol 'parish' conserva CRUD sólo en su parroquia.

ALTER POLICY ciudades_insert_owner ON public.ciudades WITH CHECK (public.current_app_role() = 'parish' AND context_id = public.current_app_parish_id());
ALTER POLICY ciudades_update_owner ON public.ciudades USING (public.current_app_role() = 'parish' AND context_id = public.current_app_parish_id()) WITH CHECK (public.current_app_role() = 'parish' AND context_id = public.current_app_parish_id());
ALTER POLICY ciudades_delete_owner ON public.ciudades USING (public.current_app_role() = 'parish' AND context_id = public.current_app_parish_id());
ALTER POLICY diocesis_aux_insert_owner ON public.diocesis WITH CHECK (public.current_app_role() = 'parish' AND parish_id = public.current_app_parish_id());
ALTER POLICY diocesis_aux_update_owner ON public.diocesis USING (public.current_app_role() = 'parish' AND parish_id = public.current_app_parish_id()) WITH CHECK (public.current_app_role() = 'parish' AND parish_id = public.current_app_parish_id());
ALTER POLICY diocesis_aux_delete_owner ON public.diocesis USING (public.current_app_role() = 'parish' AND parish_id = public.current_app_parish_id());
ALTER POLICY iglesias_insert_owner ON public.iglesias WITH CHECK (public.current_app_role() = 'parish' AND parish_id = public.current_app_parish_id());
ALTER POLICY iglesias_update_owner ON public.iglesias USING (public.current_app_role() = 'parish' AND parish_id = public.current_app_parish_id()) WITH CHECK (public.current_app_role() = 'parish' AND parish_id = public.current_app_parish_id());
ALTER POLICY iglesias_delete_owner ON public.iglesias USING (public.current_app_role() = 'parish' AND parish_id = public.current_app_parish_id());
ALTER POLICY obispos_insert_owner ON public.obispos WITH CHECK (public.current_app_role() = 'parish' AND parish_id = public.current_app_parish_id());
ALTER POLICY obispos_update_owner ON public.obispos USING (public.current_app_role() = 'parish' AND parish_id = public.current_app_parish_id()) WITH CHECK (public.current_app_role() = 'parish' AND parish_id = public.current_app_parish_id());
ALTER POLICY obispos_delete_owner ON public.obispos USING (public.current_app_role() = 'parish' AND parish_id = public.current_app_parish_id());
ALTER POLICY parrocos_insert_owner ON public.parrocos WITH CHECK (public.current_app_role() = 'parish' AND parish_id = public.current_app_parish_id());
ALTER POLICY parrocos_update_owner ON public.parrocos USING (public.current_app_role() = 'parish' AND parish_id = public.current_app_parish_id()) WITH CHECK (public.current_app_role() = 'parish' AND parish_id = public.current_app_parish_id());
ALTER POLICY parrocos_delete_owner ON public.parrocos USING (public.current_app_role() = 'parish' AND parish_id = public.current_app_parish_id());
