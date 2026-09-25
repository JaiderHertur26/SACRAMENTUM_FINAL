begin;

create or replace function public.sacramentum_validate_bishop_tenure()
returns trigger
language plpgsql security definer set search_path=public
as $$
begin
  if exists(
    select 1
    from public.bishop_tenures bt
    where bt.parish_id=new.parish_id
      and bt.id<>coalesce(new.id,gen_random_uuid())
      and daterange(bt.start_date,coalesce(bt.end_date,'infinity'::date),'[]')
          && daterange(new.start_date,coalesce(new.end_date,'infinity'::date),'[]')
  ) then
    raise exception 'Ya existe un Obispo titular para una parte de ese período.';
  end if;
  new.updated_at:=now();
  return new;
end;
$$;

drop trigger if exists trg_validate_bishop_tenure on public.bishop_tenures;
create trigger trg_validate_bishop_tenure
before insert or update on public.bishop_tenures
for each row execute function public.sacramentum_validate_bishop_tenure();

create or replace function public.sacramentum_bishop_at_date(
  p_parish_id uuid,
  p_date date default current_date
) returns jsonb
language plpgsql stable security definer set search_path=public
as $$
declare
  r public.bishop_tenures%rowtype;
  v_date date:=coalesce(p_date,current_date);
begin
  select * into r
  from public.bishop_tenures bt
  where bt.parish_id=p_parish_id
    and bt.start_date<=v_date
    and (bt.end_date is null or bt.end_date>=v_date)
  order by bt.start_date desc,bt.created_at desc
  limit 1;

  if r.id is null then
    select * into r
    from public.bishop_tenures bt
    where bt.parish_id=p_parish_id
      and bt.start_date<=v_date
    order by bt.start_date desc,bt.created_at desc
    limit 1;
  end if;

  if r.id is null then return null; end if;

  return jsonb_build_object(
    'id',r.id,
    'bishopId',r.bishop_id,
    'nombreCompleto',upper(r.bishop_name),
    'fechaInicio',r.start_date,
    'fechaFin',r.end_date,
    'notes',r.notes
  );
end;
$$;

commit;