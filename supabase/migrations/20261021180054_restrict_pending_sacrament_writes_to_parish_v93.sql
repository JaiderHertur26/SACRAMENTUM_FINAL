-- V93: Parroquia is the only owner authorized to create/edit/delete
-- baptism and confirmation pending records.
-- Security proof prepatch: admin_general inserted an arbitrary fake
-- pending_baptisms row in an operational parish through direct table INSERT,
-- bypassing the parish-only RPC and the institutional role hierarchy.
-- The demonstration was performed in BEGIN / ROLLBACK, leaving no fixture.
--
-- Keep direct parish writes because the existing UI uses pending tables.
-- Never allow admin_general to bypass the ecclesial ownership boundary.
ALTER POLICY pending_baptisms_insert_owner
  ON public.pending_baptisms
  WITH CHECK (
    public.current_app_role() = 'parish'
    AND parish_id = public.current_app_parish_id()
  );

ALTER POLICY pending_baptisms_update_owner
  ON public.pending_baptisms
  USING (
    public.current_app_role() = 'parish'
    AND parish_id = public.current_app_parish_id()
  )
  WITH CHECK (
    public.current_app_role() = 'parish'
    AND parish_id = public.current_app_parish_id()
  );

ALTER POLICY pending_baptisms_delete_owner
  ON public.pending_baptisms
  USING (
    public.current_app_role() = 'parish'
    AND parish_id = public.current_app_parish_id()
  );

ALTER POLICY pending_confirmations_insert_owner
  ON public.pending_confirmations
  WITH CHECK (
    public.current_app_role() = 'parish'
    AND parish_id = public.current_app_parish_id()
  );

ALTER POLICY pending_confirmations_update_owner
  ON public.pending_confirmations
  USING (
    public.current_app_role() = 'parish'
    AND parish_id = public.current_app_parish_id()
  )
  WITH CHECK (
    public.current_app_role() = 'parish'
    AND parish_id = public.current_app_parish_id()
  );

ALTER POLICY pending_confirmations_delete_owner
  ON public.pending_confirmations
  USING (
    public.current_app_role() = 'parish'
    AND parish_id = public.current_app_parish_id()
  );
