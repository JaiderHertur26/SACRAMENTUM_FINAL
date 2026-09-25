-- SACRAMENTUM · V7 · Exequias vinculadas a Bautismo
-- La partida bautismal conserva su estado canónico y recibe una marca de defunción trazable.
begin;

alter table public.baptisms
  add column if not exists is_deceased boolean not null default false;
alter table public.baptisms
  add column if not exists death_date date;
alter table public.baptisms
  add column if not exists death_place text;
alter table public.baptisms
  add column if not exists linked_funeral_id uuid references public.funerals(id) on delete set null;

alter table public.funerals
  add column if not exists baptism_id uuid references public.baptisms(id) on delete set null;
alter table public.pending_funerals
  add column if not exists baptism_id uuid references public.baptisms(id) on delete set null;

create index if not exists idx_baptisms_parish_deceased
  on public.baptisms(parish_id,is_deceased);
create index if not exists idx_funerals_baptism_id
  on public.funerals(baptism_id) where baptism_id is not null;

comment on column public.baptisms.is_deceased is
'Condición vital; no altera la vigencia canónica de la partida de Bautismo.';
comment on column public.funerals.baptism_id is
'Partida bautismal de la misma parroquia vinculada al registro de Exequias.';
create or replace function public.sacramentum_person_norm(p_value text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    translate(upper(trim(coalesce(p_value,''))),'ÁÉÍÓÚÜÑ','AEIOUUN'),
    '[^A-Z0-9]+','','g'
  );
$$;

create or replace function public.sacramentum_validate_funeral_baptism_link()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_row jsonb:=to_jsonb(new);
  v_raw jsonb:=coalesce(new.raw_data,'{}'::jsonb);
  v_baptism_id uuid;
  v_baptism public.baptisms%rowtype;
  v_names text;
  v_last_names text;
  v_death date;
begin
  begin
    v_baptism_id:=nullif(coalesce(v_row->>'baptism_id',v_raw->>'baptism_record_id'),'')::uuid;
  exception when others then
    raise exception 'La referencia bautismal de Exequias no es válida';
  end;
  if v_baptism_id is null then
    new.baptism_id:=null;
    return new;
  end if;

  select * into v_baptism
  from public.baptisms b
  where b.id=v_baptism_id
    and b.parish_id=new.parish_id
    and lower(coalesce(b.status,'seated')) not in ('anulada','annulled','reversed','revertida','replaced','deleted')
  for update;

  if not found then
    raise exception 'La partida bautismal seleccionada no existe, no está vigente o pertenece a otra parroquia';
  end if;

  v_names:=coalesce(v_row->>'nombres',v_raw->>'nombres','');
  v_last_names:=coalesce(v_row->>'apellidos',v_raw->>'apellidos','');

  if public.sacramentum_person_norm(v_names)<>''
     and public.sacramentum_person_norm(v_baptism.nombres)<>public.sacramentum_person_norm(v_names) then
    raise exception 'Los nombres de la Exequia no coinciden con la partida bautismal seleccionada';
  end if;
  if public.sacramentum_person_norm(v_last_names)<>''
     and public.sacramentum_person_norm(v_baptism.apellidos)<>public.sacramentum_person_norm(v_last_names) then
    raise exception 'Los apellidos de la Exequia no coinciden con la partida bautismal seleccionada';
  end if;

  begin
    v_death:=nullif(coalesce(v_row->>'fecha_defuncion',v_raw->>'fecha_defuncion'),'')::date;
  exception when others then
    raise exception 'La fecha de defunción no es válida';
  end;
  if v_death is not null then
    if v_baptism.fecha_nacimiento is not null and v_death<v_baptism.fecha_nacimiento then
      raise exception 'La defunción no puede ser anterior al nacimiento registrado en Bautismo';
    end if;
    if v_baptism.celebration_date is not null and v_death<v_baptism.celebration_date then
      raise exception 'La defunción no puede ser anterior al Bautismo registrado';
    end if;
  end if;

  if coalesce(v_baptism.is_deceased,false) and v_baptism.linked_funeral_id is not null then
    if tg_table_name='pending_funerals' then
      raise exception 'La partida bautismal ya está vinculada a otra Exequia';
    end if;
    if v_baptism.linked_funeral_id is distinct from nullif(v_row->>'id','')::uuid then
      raise exception 'La partida bautismal ya está vinculada a otra Exequia';
    end if;
  end if;

  new.baptism_id:=v_baptism_id;
  new.raw_data:=v_raw||jsonb_build_object(
    'baptism_record_id',v_baptism_id,
    'baptism_book_number',v_baptism.book_number,
    'baptism_folio',v_baptism.folio,
    'baptism_number',v_baptism.number
  );
  return new;
end;
$$;

revoke all on function public.sacramentum_validate_funeral_baptism_link() from public,anon,authenticated;
grant execute on function public.sacramentum_validate_funeral_baptism_link() to service_role;

drop trigger if exists trg_validate_pending_funeral_baptism on public.pending_funerals;
create trigger trg_validate_pending_funeral_baptism
before insert or update of raw_data,baptism_id on public.pending_funerals
for each row execute function public.sacramentum_validate_funeral_baptism_link();

drop trigger if exists trg_validate_funeral_baptism on public.funerals;
create trigger trg_validate_funeral_baptism
before insert or update of raw_data,baptism_id,fecha_defuncion,nombres,apellidos on public.funerals
for each row execute function public.sacramentum_validate_funeral_baptism_link();

create or replace function public.sacramentum_sync_baptism_death_from_funeral()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_note text;
  v_status text:=lower(coalesce(new.status,'seated'));
  v_other public.funerals%rowtype;
begin
  if tg_op='UPDATE' and old.baptism_id is not null and old.baptism_id is distinct from new.baptism_id then
    update public.baptisms
    set is_deceased=false,death_date=null,death_place=null,linked_funeral_id=null,
        raw_data=coalesce(raw_data,'{}'::jsonb)-'isDeceased'-'fechaDefuncion'-'lugarDefuncion'-'linkedFuneralId',updated_at=now()
    where id=old.baptism_id and parish_id=old.parish_id and linked_funeral_id=old.id
      and not exists(
        select 1 from public.funerals f
        where f.baptism_id=old.baptism_id and f.id<>old.id
          and lower(coalesce(f.status,'seated')) not in ('anulada','annulled','reversed','revertida','replaced','deleted')
      );
    update public.marginal_notes
    set status='reversed',updated_at=now()
    where sacrament_type='bautismo' and sacrament_id=old.baptism_id
      and source_type='funeral' and source_id=old.id and note_type='defuncion';
  end if;

  if new.baptism_id is null then return new; end if;

  if v_status in ('anulada','annulled','reversed','revertida','replaced','deleted') then
    select * into v_other
    from public.funerals f
    where f.baptism_id=new.baptism_id and f.id<>new.id
      and lower(coalesce(f.status,'seated')) not in ('anulada','annulled','reversed','revertida','replaced','deleted')
    order by f.created_at desc nulls last limit 1;

    if found then
      update public.baptisms
      set is_deceased=true,death_date=v_other.fecha_defuncion,death_place=v_other.lugar_defuncion,
          linked_funeral_id=v_other.id,updated_at=now()
      where id=new.baptism_id and parish_id=new.parish_id;
    else
      update public.baptisms
      set is_deceased=false,death_date=null,death_place=null,linked_funeral_id=null,
          raw_data=coalesce(raw_data,'{}'::jsonb)-'isDeceased'-'fechaDefuncion'-'lugarDefuncion'-'linkedFuneralId',updated_at=now()
      where id=new.baptism_id and parish_id=new.parish_id and linked_funeral_id=new.id;
    end if;
    update public.marginal_notes
    set status='reversed',updated_at=now()
    where sacrament_type='bautismo' and sacrament_id=new.baptism_id
      and source_type='funeral' and source_id=new.id and note_type='defuncion';
    return new;
  end if;

  v_note:='FALLECIÓ EL '||to_char(new.fecha_defuncion,'DD/MM/YYYY')
    ||case when nullif(trim(coalesce(new.lugar_defuncion,'')),'') is not null then ' EN '||upper(trim(new.lugar_defuncion)) else '' end
    ||'. EXEQUIAS REGISTRADAS EN LIBRO '||new.book_number||', FOLIO '||new.folio||', NÚMERO '||new.number||'.';

  update public.baptisms
  set is_deceased=true,
      death_date=new.fecha_defuncion,
      death_place=new.lugar_defuncion,
      linked_funeral_id=new.id,
      raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_strip_nulls(jsonb_build_object(
        'isDeceased',true,
        'fechaDefuncion',new.fecha_defuncion,
        'lugarDefuncion',new.lugar_defuncion,
        'linkedFuneralId',new.id
      )),
      updated_at=now()
  where id=new.baptism_id and parish_id=new.parish_id;

  if not found then
    raise exception 'No fue posible marcar la partida bautismal vinculada como fallecida';
  end if;

  update public.marginal_notes
  set content=v_note,note_date=new.fecha_defuncion,status='active',updated_at=now()
  where sacrament_type='bautismo' and sacrament_id=new.baptism_id
    and source_type='funeral' and source_id=new.id and note_type='defuncion';
  if not found then
    insert into public.marginal_notes(
      sacrament_type,note_type,content,parish_id,sacrament_id,note_date,
      source_type,source_id,created_by,status
    ) values(
      'bautismo','defuncion',v_note,new.parish_id,new.baptism_id,new.fecha_defuncion,
      'funeral',new.id,auth.uid(),'active'
    );
  end if;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,entity_type,entity_id,action,after_data,metadata
  ) values(
    auth.uid(),new.parish_id,'baptism',new.baptism_id,'mark_deceased_from_funeral',
    jsonb_build_object('is_deceased',true,'death_date',new.fecha_defuncion,'death_place',new.lugar_defuncion),
    jsonb_build_object('funeral_id',new.id,'book',new.book_number,'folio',new.folio,'number',new.number)
  );
  return new;
end;
$$;

revoke all on function public.sacramentum_sync_baptism_death_from_funeral() from public,anon,authenticated;
grant execute on function public.sacramentum_sync_baptism_death_from_funeral() to service_role;

drop trigger if exists trg_sync_baptism_death_from_funeral on public.funerals;
create trigger trg_sync_baptism_death_from_funeral
after insert or update of status,fecha_defuncion,lugar_defuncion,baptism_id on public.funerals
for each row execute function public.sacramentum_sync_baptism_death_from_funeral();

commit;