select p.id as parish_id,p.diocese_id,c.id as chancery_id
from public.parishes p
left join public.chancelleries c on c.diocese_id=p.diocese_id
where p.id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
limit 10;