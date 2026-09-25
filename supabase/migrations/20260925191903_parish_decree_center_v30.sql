-- SACRAMENTUM V30 · CENTRO PARROQUIAL UNIFICADO DE DECRETOS
-- Restablece la lectura jurisdiccional de decretos.
-- Parroquia: sólo su propia parroquia.
-- Cancillería/Diócesis: parroquias de su diócesis.
-- Admin General: acceso global según can_access_parish().
-- La emisión continúa restringida por decretos_insert_authorized.

begin;

alter table public.decretos enable row level security;

drop policy if exists "decretos_select_scope" on public.decretos;
drop policy if exists "decretos_select" on public.decretos;

create policy "decretos_select_scope"
on public.decretos
for select
to authenticated
using (public.can_access_parish(parish_id));

grant select on public.decretos to authenticated;

comment on policy "decretos_select_scope" on public.decretos is
  'V30: lectura jurisdiccional compartida por Parroquia, Cancillería, Diócesis y Admin General mediante can_access_parish().';

commit;
