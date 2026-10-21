-- SACRAMENTUM V97: los conceptos asociados a decretos son gobernados por Cancillería.
-- Prueba anterior: con sesiones reales de admin_general y diocese se consiguió
-- UPDATE sobre un concepto activo, eludiendo el catálogo de Cancillería.
-- Sólo se modifica la autoridad de INSERT/UPDATE; SELECT permanece vigente.
-- No se alteran conceptos históricos ni se hacen operaciones DML sobre ellos.
-- Las RPC de importación institucional de fuente histórica, SECURITY DEFINER,
-- siguen ejecutándose con el dueño y no dependen de la excepción de admin.
ALTER POLICY conceptos_insert_authority ON public.conceptos_anulacion
  WITH CHECK (
    public.current_app_role() = 'chancery'
    AND diocese_id = public.current_effective_diocese_id()
  );
ALTER POLICY conceptos_update_authority ON public.conceptos_anulacion
  USING (
    public.current_app_role() = 'chancery'
    AND diocese_id = public.current_effective_diocese_id()
  )
  WITH CHECK (
    public.current_app_role() = 'chancery'
    AND diocese_id = public.current_effective_diocese_id()
  );
