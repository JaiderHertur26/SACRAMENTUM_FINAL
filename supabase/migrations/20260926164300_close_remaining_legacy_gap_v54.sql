-- SACRAMENTUM V54 · Cierre del último gap activo del catálogo FRX/FRT
update public.legacy_report_definitions
set audit_status='IMPLEMENTADO',
    current_equivalent='Centro Documental Eclesial · LEGACY-71061 + emisión oficial + PDF + archivo',
    gap='Certificado de Supervivencia recuperado desde CERTIFICADOS y emitible como documento oficial numerado y auditable.',
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
      'closed_by_version','V54',
      'verification','legacy_template_plus_issuance',
      'template_code','LEGACY-71061'
    )
where report_key='rpt_doc7106';
