-- V100 · El Centro de Migración obedece a la jerarquía territorial.
-- Prueba antes: admin_general podía administrar lotes parroquiales globalmente;
-- parroquia titular estaba denegada por can_manage_legacy_import.
-- Conservar gobierno operativo de Diócesis y lectura de Cancillería de su diócesis.
CREATE OR REPLACE FUNCTION public.can_manage_legacy_import(
  p_parish_id uuid DEFAULT NULL, p_diocese_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_diocese uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  v_role := public.current_app_role();
  v_diocese := public.current_app_diocese_id();

  IF v_role='parish' THEN
    RETURN p_parish_id IS NOT NULL
      AND p_parish_id=public.current_app_parish_id()
      AND (p_diocese_id IS NULL OR p_diocese_id=v_diocese);
  END IF;

  IF v_role='diocese' THEN
    IF v_diocese IS NULL THEN RETURN false; END IF;
    IF p_diocese_id IS NOT NULL AND p_diocese_id IS DISTINCT FROM v_diocese THEN RETURN false; END IF;
    IF p_parish_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM public.parishes p
      WHERE p.id=p_parish_id AND p.diocese_id=v_diocese
    ) THEN RETURN false; END IF;
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

-- Leer lotes y filas sólo en el propio ámbito, con consulta institucional
-- para Cancillería. Administrador General no accede al archivo sensible.
ALTER POLICY legacy_batches_read ON public.legacy_import_batches
USING (
  public.can_manage_legacy_import(parish_id,diocese_id)
  OR (public.current_app_role()='chancery'
      AND diocese_id=public.current_app_diocese_id())
);

ALTER POLICY legacy_rows_read ON public.legacy_import_rows
USING (
  EXISTS (
    SELECT 1 FROM public.legacy_import_batches b
    WHERE b.id=legacy_import_rows.batch_id
      AND (
        public.can_manage_legacy_import(b.parish_id,b.diocese_id)
        OR (public.current_app_role()='chancery'
            AND b.diocese_id=public.current_app_diocese_id())
      )
  )
);

-- Los 11734 vínculos actuales tienen batch_id: alcance sin perder enlaces.
ALTER POLICY legacy_links_read ON public.legacy_record_links
USING (
  EXISTS (
    SELECT 1 FROM public.legacy_import_batches b
    WHERE b.id=legacy_record_links.batch_id
      AND (
        public.can_manage_legacy_import(b.parish_id,b.diocese_id)
        OR (public.current_app_role()='chancery'
            AND b.diocese_id=public.current_app_diocese_id())
      )
  )
);
