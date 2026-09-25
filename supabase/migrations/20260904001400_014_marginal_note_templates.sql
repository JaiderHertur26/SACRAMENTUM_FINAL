-- SACRAMENTUM · Fase 2
-- Plantillas institucionales de notas marginales como configuración parroquial explícita.
-- Migración aditiva: no elimina datos anteriores.

alter table public.parish_parameters
  add column if not exists marginal_notes_templates jsonb not null default '{}'::jsonb;

comment on column public.parish_parameters.marginal_notes_templates is
  'Plantillas oficiales de redacción de notas marginales de la parroquia. Fuente canónica; reemplaza almacenamiento local del navegador.';

-- Recupera, cuando exista, la estructura histórica almacenada dentro de bautizos_params.
update public.parish_parameters
set marginal_notes_templates = coalesce(bautizos_params->'plantillas_notas', '{}'::jsonb)
where marginal_notes_templates = '{}'::jsonb
  and jsonb_typeof(bautizos_params->'plantillas_notas') = 'object'
  and bautizos_params->'plantillas_notas' <> '{}'::jsonb;
