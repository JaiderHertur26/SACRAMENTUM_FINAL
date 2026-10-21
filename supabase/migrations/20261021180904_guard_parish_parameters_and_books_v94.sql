-- V94: protect parish-owned numbering configuration from administrative
-- bypass via direct PostgREST calls.
--
-- Reproduced before patch: a real admin_general session UPDATE on
-- public.parish_parameters affected one parish-owned row (a no-op assignment).
-- The entire demonstration was run inside BEGIN/ROLLBACK.
--
-- Only a parish may manage its own sacramental book/numbering configuration.
-- Official governance roles use other authorized institutional workflows.
ALTER POLICY parish_parameters_insert_owner ON public.parish_parameters
WITH CHECK (
  public.current_app_role() = 'parish'
  AND parish_id = public.current_app_parish_id()
);
ALTER POLICY parish_parameters_update_owner ON public.parish_parameters
USING (
  public.current_app_role() = 'parish'
  AND parish_id = public.current_app_parish_id()
)
WITH CHECK (
  public.current_app_role() = 'parish'
  AND parish_id = public.current_app_parish_id()
);
ALTER POLICY parish_parameters_delete_owner ON public.parish_parameters
USING (
  public.current_app_role() = 'parish'
  AND parish_id = public.current_app_parish_id()
);
ALTER POLICY sacrament_books_insert_owner ON public.sacrament_books
WITH CHECK (
  public.current_app_role() = 'parish'
  AND parish_id = public.current_app_parish_id()
);
ALTER POLICY sacrament_books_update_owner ON public.sacrament_books
USING (
  public.current_app_role() = 'parish'
  AND parish_id = public.current_app_parish_id()
)
WITH CHECK (
  public.current_app_role() = 'parish'
  AND parish_id = public.current_app_parish_id()
);
ALTER POLICY sacrament_books_delete_owner ON public.sacrament_books
USING (
  public.current_app_role() = 'parish'
  AND parish_id = public.current_app_parish_id()
);
