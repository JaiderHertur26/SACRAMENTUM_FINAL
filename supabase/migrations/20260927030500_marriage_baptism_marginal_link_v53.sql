-- SACRAMENTUM V53
-- Usa el vínculo bautismal ya seleccionado en el expediente matrimonial moderno
-- para generar automáticamente la nota marginal cuando el Bautismo pertenece
-- a la misma parroquia. No escribe sobre libros de otras parroquias.

create schema if not exists private;

create or replace function private.sync_local_baptism_marriage_notes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_groom_baptism uuid;
  v_bride_baptism uuid;
  v_groom_name text;
  v_bride_name text;
  v_parish_name text;
  v_content text;
begin
  begin
    v_groom_baptism := nullif(new.raw_data->>'novioBautismoId','')::uuid;
  exception when others then
    v_groom_baptism := null;
  end;

  begin
    v_bride_baptism := nullif(new.raw_data->>'noviaBautismoId','')::uuid;
  exception when others then
    v_bride_baptism := null;
  end;

  v_groom_name := trim(concat_ws(' ', new.raw_data->>'novioNombres', new.raw_data->>'novioApellidos'));
  v_bride_name := trim(concat_ws(' ', new.raw_data->>'noviaNombres', new.raw_data->>'noviaApellidos'));

  select p.name into v_parish_name
  from public.parishes p
  where p.id = new.parish_id;

  if v_groom_baptism is not null
     and exists (
       select 1 from public.baptisms b
       where b.id=v_groom_baptism and b.parish_id=new.parish_id
     )
     and not exists (
       select 1 from public.marginal_notes mn
       where mn.sacrament_type='bautismo'
         and mn.sacrament_id=v_groom_baptism
         and mn.source_type='marriage_link'
         and mn.source_id=new.id
         and coalesce(mn.status,'active')='active'
     ) then
    v_content := 'CONTRAJO MATRIMONIO CON ' || upper(coalesce(nullif(v_bride_name,''),'---'))
      || ' EL ' || to_char(new.celebration_date,'DD/MM/YYYY')
      || ' EN ' || upper(coalesce(v_parish_name,'ESTA PARROQUIA'))
      || ', LIBRO ' || coalesce(new.book_number,'---')
      || ', FOLIO ' || coalesce(new.folio,'---')
      || ', NÚMERO ' || coalesce(new.number,'---') || '.';

    insert into public.marginal_notes(
      sacrament_type,note_type,content,parish_id,sacrament_id,note_date,
      source_type,source_id,created_by,status,print_policy,print_default,
      is_locked,print_label
    ) values (
      'bautismo','matrimonio',v_content,new.parish_id,v_groom_baptism,new.celebration_date,
      'marriage_link',new.id,auth.uid(),'active','optional',true,false,'Matrimonio'
    );
  end if;

  if v_bride_baptism is not null
     and exists (
       select 1 from public.baptisms b
       where b.id=v_bride_baptism and b.parish_id=new.parish_id
     )
     and not exists (
       select 1 from public.marginal_notes mn
       where mn.sacrament_type='bautismo'
         and mn.sacrament_id=v_bride_baptism
         and mn.source_type='marriage_link'
         and mn.source_id=new.id
         and coalesce(mn.status,'active')='active'
     ) then
    v_content := 'CONTRAJO MATRIMONIO CON ' || upper(coalesce(nullif(v_groom_name,''),'---'))
      || ' EL ' || to_char(new.celebration_date,'DD/MM/YYYY')
      || ' EN ' || upper(coalesce(v_parish_name,'ESTA PARROQUIA'))
      || ', LIBRO ' || coalesce(new.book_number,'---')
      || ', FOLIO ' || coalesce(new.folio,'---')
      || ', NÚMERO ' || coalesce(new.number,'---') || '.';

    insert into public.marginal_notes(
      sacrament_type,note_type,content,parish_id,sacrament_id,note_date,
      source_type,source_id,created_by,status,print_policy,print_default,
      is_locked,print_label
    ) values (
      'bautismo','matrimonio',v_content,new.parish_id,v_bride_baptism,new.celebration_date,
      'marriage_link',new.id,auth.uid(),'active','optional',true,false,'Matrimonio'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_local_baptism_marriage_notes on public.marriages;
create trigger trg_sync_local_baptism_marriage_notes
after insert on public.marriages
for each row execute function private.sync_local_baptism_marriage_notes();

revoke all on function private.sync_local_baptism_marriage_notes() from public;
revoke all on function private.sync_local_baptism_marriage_notes() from anon;
revoke all on function private.sync_local_baptism_marriage_notes() from authenticated;

comment on function private.sync_local_baptism_marriage_notes()
is 'Genera nota marginal de Matrimonio en Bautismos digitales vinculados de la misma parroquia; los Bautismos externos continúan por Notificación Matrimonial.';
