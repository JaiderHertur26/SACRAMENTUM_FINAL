begin;

insert into public.funerals(
  parish_id,status,fecha_defuncion,lugar_defuncion,raw_data,book_type,
  book_number,folio,number,nombres,apellidos,baptism_id
)
select
  b.parish_id,'seated',current_date,'PRUEBA TRANSACCIONAL V7',
  jsonb_build_object('smoke_test','v7','baptism_record_id',b.id),
  'ordinario','9999','9999','9999',b.nombres,b.apellidos,b.id
from public.baptisms b
where coalesce(b.is_deceased,false)=false
  and lower(coalesce(b.status,'seated')) not in ('anulada','annulled','reversed','revertida','replaced','deleted')
limit 1;
do $$
declare
  v_funeral uuid;
  v_baptism uuid;
begin
  select id,baptism_id into v_funeral,v_baptism
  from public.funerals
  where raw_data->>'smoke_test'='v7'
  order by created_at desc limit 1;

  if v_funeral is null or v_baptism is null then
    raise exception 'V7 smoke: no se creó la Exequia vinculada';
  end if;

  if not exists(
    select 1 from public.baptisms
    where id=v_baptism and is_deceased=true and linked_funeral_id=v_funeral
  ) then
    raise exception 'V7 smoke: Bautismo no quedó marcado fallecido';
  end if;
  if not exists(
    select 1 from public.marginal_notes
    where sacrament_type='bautismo'
      and sacrament_id=v_baptism
      and source_type='funeral'
      and source_id=v_funeral
      and note_type='defuncion'
      and coalesce(status,'active')='active'
  ) then
    raise exception 'V7 smoke: no se creó la nota marginal de defunción';
  end if;
end;
$$;

rollback;

select
  (select count(*) from public.funerals where raw_data->>'smoke_test'='v7') as smoke_funerals_after_rollback,
  (select count(*) from public.baptisms where death_place='PRUEBA TRANSACCIONAL V7') as smoke_baptisms_after_rollback;
