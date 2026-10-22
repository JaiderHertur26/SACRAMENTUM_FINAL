-- V121 · No revelar archivos físicos, filas, archivos DBF ni hashes de otra jurisdicción.
-- Se exige coincidencia de instalación, origen y parroquia; sin alterar datos ni escrituras.
ALTER POLICY legacy_physical_artifacts_select_v70
ON public.legacy_physical_source_artifacts
TO authenticated
USING (
  public.current_app_role() = 'admin_general'
  OR EXISTS (
    SELECT 1 FROM public.legacy_source_installations s
    WHERE s.id = legacy_physical_source_artifacts.source_installation_id
      AND s.owner_diocese_id = public.current_app_diocese_id()
      AND public.current_app_role() IN ('diocese','chancery','parish')
      AND (
        (
          legacy_physical_source_artifacts.source_origin_id IS NULL
          AND public.current_app_role() IN ('diocese','chancery')
        )
        OR EXISTS (
          SELECT 1 FROM public.legacy_source_origins o
          WHERE o.id=legacy_physical_source_artifacts.source_origin_id
            AND o.source_installation_id=s.id
            AND (
              (o.mapped_parish_id IS NOT NULL AND public.can_access_parish(o.mapped_parish_id))
              OR (o.mapped_parish_id IS NULL AND public.current_app_role() IN ('diocese','chancery'))
            )
        )
      )
  )
);

-- Heredar estrictamente autorización del artefacto propietario,
-- sin rutas alternativas de permiso basadas sólo en instalación.
ALTER POLICY legacy_physical_rows_select_v70
ON public.legacy_physical_source_rows
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.legacy_physical_source_artifacts a
    WHERE a.id=legacy_physical_source_rows.artifact_id
  )
);

ALTER POLICY legacy_source_files_select_scoped
ON public.legacy_source_files
TO authenticated
USING (
  public.current_app_role()='admin_general'
  OR EXISTS (
    SELECT 1 FROM public.legacy_source_installations s
    WHERE s.id=legacy_source_files.source_installation_id
      AND s.owner_diocese_id=public.current_app_diocese_id()
      AND public.current_app_role() IN ('diocese','chancery','parish')
      AND (
        (
          legacy_source_files.source_origin_id IS NULL
          AND public.current_app_role() IN ('diocese','chancery')
        )
        OR EXISTS (
          SELECT 1 FROM public.legacy_source_origins o
          WHERE o.id=legacy_source_files.source_origin_id
            AND o.source_installation_id=s.id
            AND (
              (o.mapped_parish_id IS NOT NULL AND public.can_access_parish(o.mapped_parish_id))
              OR (o.mapped_parish_id IS NULL AND public.current_app_role() IN ('diocese','chancery'))
            )
        )
      )
  )
);

-- Refuerza el hash: no basta que la instalación pertenezca a la Diócesis
-- si el origen específico se asignó a una parroquia de otra jurisdicción.
ALTER POLICY legacy_origin_hashes_select_v65
ON public.legacy_source_origin_hashes
TO authenticated
USING (
  public.current_app_role()='admin_general'
  OR EXISTS (
    SELECT 1 FROM public.legacy_source_origins o
    JOIN public.legacy_source_installations s ON s.id=o.source_installation_id
    WHERE o.id=legacy_source_origin_hashes.origin_id
      AND s.owner_diocese_id=public.current_app_diocese_id()
      AND public.current_app_role() IN ('diocese','chancery','parish')
      AND (
        (o.mapped_parish_id IS NOT NULL AND public.can_access_parish(o.mapped_parish_id))
        OR (o.mapped_parish_id IS NULL AND public.current_app_role() IN ('diocese','chancery'))
      )
  )
);
