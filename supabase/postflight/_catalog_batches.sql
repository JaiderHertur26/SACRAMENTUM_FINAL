select profile_key,parish_id,status,imported_count,original_filename,created_at
from public.legacy_import_batches
where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
  and profile_key in ('PARROCOS','IGLESIAS','CIUDADES','OBISPOS','DIOCESIS')
order by created_at desc;