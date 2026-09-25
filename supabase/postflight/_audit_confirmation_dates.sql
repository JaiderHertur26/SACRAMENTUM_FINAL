select
  count(*) as total,
  count(*) filter(where celebration_date is not null) as celebration_date_ok,
  count(*) filter(where nullif(raw_data->>'feccon','') is not null) as raw_feccon_ok,
  count(*) filter(where celebration_date is null and nullif(raw_data->>'feccon','') is not null) as missing_column_but_raw_has_date,
  min(celebration_date) as min_date,
  max(celebration_date) as max_date
from public.confirmations
where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687';

select id,apellidos,nombres,celebration_date,
       raw_data->>'feccon' as feccon,
       raw_data->>'fechaSacramento' as raw_fecha_sacramento,
       raw_data->>'celebration_date' as raw_celebration_date,
       created_at
from public.confirmations
where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
order by created_at desc
limit 25;