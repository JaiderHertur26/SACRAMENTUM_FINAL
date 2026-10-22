-- V120 · Cierre de exposición cruzada de orígenes y filas históricas en RLS.
-- No modifica los datos históricos ni amplía escritura alguna.
-- Administrador General conserva consulta estructural global conforme a jerarquía.
ALTER POLICY legacy_source_origins_select_v65
ON public.legacy_source_origins
TO authenticated
USING (
  public.current_app_role() = 'admin_general'
  OR
  (
    (
      (
        legacy_source_origins.mapped_parish_id IS NOT NULL
        AND public.can_access_parish(legacy_source_origins.mapped_parish_id)
      )
      OR
      (
        legacy_source_origins.mapped_parish_id IS NULL
        AND public.current_app_role() IN ('diocese', 'chancery')
        AND EXISTS (
          SELECT 1 FROM public.legacy_source_installations owner_source
          WHERE owner_source.id = legacy_source_origins.source_installation_id
          AND owner_source.owner_diocese_id = public.current_app_diocese_id()
        )
      )
    )
    AND EXISTS (
      SELECT 1 FROM public.legacy_source_installations s
      WHERE s.id = legacy_source_origins.source_installation_id
        AND (
          s.owner_diocese_id IS NULL
          OR s.owner_diocese_id = public.current_app_diocese_id()
        )
        AND (
          (
            public.current_app_role() = 'diocese'
            AND s.owner_diocese_id = public.current_app_diocese_id()
          )
          OR (
            s.mapped_parish_id IS NOT NULL
            AND public.can_access_parish(s.mapped_parish_id)
          )
        )
    )
  )
);

-- Ambas referencias, si están informadas, deben pertenecer a la jurisdicción
-- del lector; ninguna referencia legítima autoriza ignorar la otra.
ALTER POLICY legacy_archive_records_select_scoped
ON public.legacy_archive_records
TO authenticated
USING (
  public.current_app_role() = 'admin_general'
  OR
  (
    (
      legacy_archive_records.parish_id IS NULL
      OR public.can_access_parish(legacy_archive_records.parish_id)
    )
    AND (
      legacy_archive_records.diocese_id IS NULL
      OR legacy_archive_records.diocese_id = public.current_app_diocese_id()
    )
    AND (
      (
        legacy_archive_records.parish_id IS NOT NULL
        AND public.can_access_parish(legacy_archive_records.parish_id)
      )
      OR (
        legacy_archive_records.diocese_id IS NOT NULL
        AND legacy_archive_records.diocese_id = public.current_app_diocese_id()
        AND public.current_app_role() IN ('diocese', 'chancery')
      )
    )
  )
);
