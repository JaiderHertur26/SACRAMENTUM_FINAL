select
  count(*) filter(where reportado=true) as historial_reportadas,
  count(*) filter(where reportado=false) as pendientes
from public.pending_baptisms
where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687';