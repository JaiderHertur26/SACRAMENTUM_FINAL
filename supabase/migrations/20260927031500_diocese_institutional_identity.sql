-- SACRAMENTUM V52 · completar identidad institucional de Diócesis/Arquidiócesis
-- Recupera únicamente campos estructurales útiles de DIOCESIS.DBF sobre la entidad moderna existente.

alter table public.dioceses
  add column if not exists code text,
  add column if not exists nit text,
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists fax text,
  add column if not exists email text;

comment on column public.dioceses.code is 'Código institucional opcional de la jurisdicción.';
comment on column public.dioceses.nit is 'Identificación tributaria/institucional de la jurisdicción.';
comment on column public.dioceses.address is 'Dirección de la sede diocesana o arquidiocesana.';
comment on column public.dioceses.phone is 'Teléfono institucional de la jurisdicción.';
comment on column public.dioceses.fax is 'Fax institucional, conservado por compatibilidad documental cuando exista.';
comment on column public.dioceses.email is 'Correo institucional de la jurisdicción.';