-- SACRAMENTUM V55
-- Completa la relación funcional Exequias -> Bautismo.
-- Si una Exequia definitiva trae baptism_record_id, el vínculo se materializa
-- en ambas tablas y se genera la nota marginal de defunción en el Bautismo.

create schema if not exists private;

create or replace function private.sync_funeral_to_baptism()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_baptism_id uuid;
  v_baptism public.baptisms%rowtype;
  v_note text;
  v_existing text;
begin
  begin
    v_baptism_id := nullif(trim(coalesce(
      new.baptism_id::text,
      new.raw_data->>'baptism_record_id',
      new.raw_data->>'baptismRecordId',
      ''
    )), '')::uuid;
  exception when others then
    raise exception 'El vínculo bautismal de la Exequia no es válido';
  end;

  if v_baptism_id is null then
    return new;
  end if;

  select *
  into v_baptism
  from public.baptisms b
  where b.id = v_baptism_id
    and b.parish_id = new.parish_id
  for update;

  if not found then
    raise exception 'La partida de Bautismo vinculada no existe o pertenece a otra parroquia';
  end if;

  if v_baptism.linked_funeral_id is not null
     and v_baptism.linked_funeral_id is distinct from new.id then
    raise exception 'La partida de Bautismo ya está vinculada a otra Exequia';
  end if;

  v_note :=
    'FALLECIÓ EL ' || to_char(new.fecha_defuncion, 'DD/MM/YYYY')
    || case
         when nullif(trim(coalesce(new.lugar_defuncion,'')),'') is not null
         then ' EN ' || upper(trim(new.lugar_defuncion))
         else ''
       end
    || case
         when new.fecha_exequias is not null
         then '. EXEQUIAS CELEBRADAS EL ' || to_char(new.fecha_exequias, 'DD/MM/YYYY')
         else ''
       end
    || case
         when nullif(trim(coalesce(new.lugar_exequias,'')),'') is not null
         then ' EN ' || upper(trim(new.lugar_exequias))
         else ''
       end
    || '. REGISTRO DE EXEQUIAS: LIBRO ' || coalesce(new.book_number,'---')
    || ', FOLIO ' || coalesce(new.folio,'---')
    || ', NÚMERO ' || coalesce(new.number,'---') || '.';

  v_existing := nullif(trim(coalesce(v_baptism.nota_marginal,'')),'');

  update public.funerals
  set baptism_id = v_baptism_id,
      raw_data = coalesce(raw_data,'{}'::jsonb)
        || jsonb_build_object(
          'baptism_record_id',v_baptism_id,
          'baptismRecordId',v_baptism_id
        ),
      updated_at = now()
  where id = new.id
    and baptism_id is distinct from v_baptism_id;

  update public.baptisms
  set is_deceased = true,
      linked_funeral_id = new.id,
      nota_marginal = case
        when v_existing is null then v_note
        when position(v_note in v_existing) > 0 then v_existing
        else v_existing || E'\n\n' || v_note
      end,
      raw_data = coalesce(raw_data,'{}'::jsonb)
        || jsonb_build_object(
          'isDeceased',true,
          'is_deceased',true,
          'fallecido',true,
          'linkedFuneralId',new.id,
          'linked_funeral_id',new.id,
          'fechaDefuncion',new.fecha_defuncion,
          'fecha_defuncion',new.fecha_defuncion
        )
        || jsonb_build_object(
          'notaMarginal',
          case
            when v_existing is null then v_note
            when position(v_note in v_existing) > 0 then v_existing
            else v_existing || E'\n\n' || v_note
          end
        ),
      updated_at = now()
  where id = v_baptism_id;

  if not exists (
    select 1
    from public.marginal_notes mn
    where mn.sacrament_type = 'bautismo'
      and mn.sacrament_id = v_baptism_id
      and mn.source_type = 'funeral_link'
      and mn.source_id = new.id
      and coalesce(mn.status,'active') = 'active'
  ) then
    insert into public.marginal_notes(
      sacrament_type,note_type,content,parish_id,sacrament_id,note_date,
      source_type,source_id,created_by,status,print_policy,print_default,
      is_locked,print_label
    ) values (
      'bautismo','defuncion',v_note,new.parish_id,v_baptism_id,
      coalesce(new.fecha_defuncion,new.fecha_exequias,current_date),
      'funeral_link',new.id,auth.uid(),'active','optional',true,false,'Defunción'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_funeral_to_baptism on public.funerals;
create trigger trg_sync_funeral_to_baptism
after insert on public.funerals
for each row execute function private.sync_funeral_to_baptism();

revoke all on function private.sync_funeral_to_baptism() from public;
revoke all on function private.sync_funeral_to_baptism() from anon;
revoke all on function private.sync_funeral_to_baptism() from authenticated;

comment on function private.sync_funeral_to_baptism()
is 'Materializa el vínculo Exequias-Bautismo de la misma parroquia, marca fallecido y crea la nota marginal de defunción.';
