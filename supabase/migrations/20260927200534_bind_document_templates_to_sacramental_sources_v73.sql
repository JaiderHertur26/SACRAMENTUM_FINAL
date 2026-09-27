-- SACRAMENTUM V73
-- Vinculación declarativa de plantillas documentales con su fuente sacramental moderna.
-- La fuente queda persistida en metadata para que la biblioteca pueda hidratar tokens desde Supabase.

update public.document_templates
set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
  'sacrament_source','baptism',
  'record_kind','celebrated',
  'binding_version',1
)
where is_active=true and upper(code) in ('LEGACY-71011','LEGACY-73011','LEGACY-73021','LEGACY-73031');

update public.document_templates
set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
  'sacrament_source','pending_baptism',
  'record_kind','pending',
  'binding_version',1
)
where is_active=true and upper(code) in (
  'LEGACY-71081','LEGACY-71091','LEGACY-71101','LEGACY-71131','LEGACY-71132',
  'LEGACY-73041','LEGACY-73061'
);

update public.document_templates
set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
  'sacrament_source','confirmation',
  'record_kind','celebrated',
  'binding_version',1
)
where is_active=true and upper(code) in ('LEGACY-73013','LEGACY-73023');

update public.document_templates
set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
  'sacrament_source','pending_confirmation',
  'record_kind','pending',
  'binding_version',1
)
where is_active=true and upper(code)='LEGACY-71111';

update public.document_templates
set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
  'sacrament_source','marriage',
  'record_kind','celebrated',
  'binding_version',1
)
where is_active=true and upper(code) in ('LEGACY-73012','LEGACY-73022');

update public.document_templates
set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
  'sacrament_source','marriage_dossier',
  'record_kind','dossier',
  'binding_version',1
)
where is_active=true and upper(code) in (
  'LEGACY-71012','LEGACY-71021','LEGACY-71031','LEGACY-71041','LEGACY-71051',
  'LEGACY-72011','LEGACY-72021','LEGACY-72031','LEGACY-72061','LEGACY-73101',
  'MODERN-7206-CAUCIONES'
);

update public.document_templates
set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
  'sacrament_source','funeral',
  'record_kind','celebrated',
  'binding_version',1
)
where is_active=true and upper(code)='LEGACY-71112';

update public.document_templates
set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
  'sacrament_source','multi',
  'record_kind','celebrated',
  'binding_version',1,
  'allowed_sources',jsonb_build_array('baptism','confirmation','marriage','funeral')
)
where is_active=true and upper(code)='LEGACY-73071';

update public.document_templates
set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
  'sacrament_source','manual',
  'record_kind','manual',
  'binding_version',1
)
where is_active=true and upper(code) in ('LEGACY-71061','LEGACY-71071');

comment on column public.document_templates.metadata
is 'Metadatos de gobierno documental; sacrament_source y record_kind declaran la fuente canónica para hidratar plantillas desde registros sacramentales.';
