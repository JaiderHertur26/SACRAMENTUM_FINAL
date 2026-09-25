-- 2) Duplicados de numeración sacramental antes de Fase 2.
-- Bautismo y Confirmación ya poseen book_number.
-- Matrimonio todavía no posee book_number en el BOOTSTRAP 000;
-- la migración 001 lo agregará.

select
  'baptisms' as source,
  parish_id,
  book_number::text as book_number,
  folio::text as folio,
  number::text as number,
  count(*) as duplicates
from public.baptisms
where parish_id is not null
  and book_number is not null
  and folio is not null
  and number is not null
group by parish_id, book_number, folio, number
having count(*) > 1

union all

select
  'confirmations' as source,
  parish_id,
  book_number::text as book_number,
  folio::text as folio,
  number::text as number,
  count(*) as duplicates
from public.confirmations
where parish_id is not null
  and book_number is not null
  and folio is not null
  and number is not null
group by parish_id, book_number, folio, number
having count(*) > 1

union all

select
  'marriages' as source,
  parish_id,
  null::text as book_number,
  folio::text as folio,
  number::text as number,
  count(*) as duplicates
from public.marriages
where parish_id is not null
  and folio is not null
  and number is not null
group by parish_id, folio, number
having count(*) > 1

order by source, duplicates desc;