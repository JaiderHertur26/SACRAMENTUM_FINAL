select
 count(*) as total,
 count(*) filter(where celebration_date is not null) as with_date,
 count(*) filter(where celebration_date is null) as without_date,
 count(*) filter(where nullif(raw_data->>'feccon','') is not null) as raw_feccon
from public.confirmations
where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687';