-- ============================================================================
-- SACRAMENTUM · Fase 2.9 · Digitalización histórica transaccional
-- 2026-09-04
--
-- Las pantallas "Celebrado" representan transcripción de libros físicos ya
-- existentes. Estas funciones registran Libro/Folio/Número exactos, aplican
-- unicidad y auditoría, pero NO modifican los consecutivos ordinarios vivos.
-- ============================================================================

create or replace function public.sacramentum_registry_ref(p_value text)
returns text
language sql
immutable
as $$
  select case
    when nullif(trim(coalesce(p_value,'')), '') is null then null
    when trim(p_value) ~ '^\d+$' then lpad(trim(p_value), 4, '0')
    else upper(trim(p_value))
  end;
$$;

create or replace function public.register_historical_baptism(
  p_parish_id uuid,
  p_record jsonb
)
returns table(record_id uuid, book_number text, folio text, number text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text; v_user_parish uuid; v_diocese uuid;
  v_id uuid; v_book text; v_folio text; v_number text;
  v_celebration date; v_birth date; v_registry_date date;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  select lower(coalesce(role,'')), parish_id, diocese_id
    into v_role,v_user_parish,v_diocese
  from public.user_profiles
  where auth_user_id=auth.uid() and coalesce(is_active,true)=true
    and coalesce(status,'active') not in ('blocked','disabled','inactive')
  limit 1;
  if v_role<>'parish' or v_user_parish is distinct from p_parish_id then
    raise exception 'Sólo la parroquia propietaria puede digitalizar su libro de Bautismos';
  end if;
  if p_record is null or jsonb_typeof(p_record)<>'object' then raise exception 'Registro de Bautismo inválido'; end if;

  v_book:=public.sacramentum_registry_ref(coalesce(p_record->>'Libro',p_record->>'book_number',p_record->>'libro'));
  v_folio:=public.sacramentum_registry_ref(coalesce(p_record->>'folio',p_record->>'page_number'));
  v_number:=public.sacramentum_registry_ref(coalesce(p_record->>'numero',p_record->>'entry_number',p_record->>'number'));
  if v_book is null or v_folio is null or v_number is null then raise exception 'Libro, Folio y Número son obligatorios'; end if;

  begin v_celebration:=nullif(coalesce(p_record->>'fechaSacramento',p_record->>'celebration_date'),'')::date; exception when others then raise exception 'Fecha de Bautismo inválida'; end;
  begin v_birth:=nullif(coalesce(p_record->>'fechaNacimiento',p_record->>'fecha_nacimiento'),'')::date; exception when others then raise exception 'Fecha de nacimiento inválida'; end;
  begin v_registry_date:=nullif(coalesce(p_record->>'fechaExpedicionRegistro',p_record->>'fecha_expedicion_registro'),'')::date; exception when others then raise exception 'Fecha de expedición de registro inválida'; end;

  if exists(select 1 from public.baptisms b where b.parish_id=p_parish_id and public.sacramentum_registry_ref(b.book_number)=v_book and public.sacramentum_registry_ref(b.folio)=v_folio and public.sacramentum_registry_ref(b.number)=v_number) then
    raise exception 'Ya existe un Bautismo en Libro %, Folio %, Número %',v_book,v_folio,v_number;
  end if;

  insert into public.baptisms(
    parish_id,book_number,folio,number,status,celebration_date,lugar_bautismo,
    apellidos,nombres,sexo,fecha_nacimiento,lugar_nacimiento,tipo_union_padres,
    nombre_padre,cedula_padre,nombre_madre,cedula_madre,abuelos_paternos,
    abuelos_maternos,padrinos,ministro,da_fe,nuip,numero_registro,serial_registro,
    oficina_registro,fecha_expedicion_registro,direccion,observations,nota_marginal,raw_data
  ) values (
    p_parish_id,v_book,v_folio,v_number,'seated',v_celebration,
    nullif(coalesce(p_record->>'lugarBautismo',p_record->>'lugar_bautismo'),''),
    nullif(p_record->>'apellidos',''),nullif(p_record->>'nombres',''),nullif(p_record->>'sexo',''),v_birth,
    nullif(coalesce(p_record->>'lugarNacimiento',p_record->>'lugar_nacimiento'),''),
    nullif(coalesce(p_record->>'tipoUnionPadres',p_record->>'tipo_union_padres'),''),
    nullif(coalesce(p_record->>'nombrePadre',p_record->>'nombre_padre'),''),
    nullif(coalesce(p_record->>'cedulaPadre',p_record->>'cedula_padre'),''),
    nullif(coalesce(p_record->>'nombreMadre',p_record->>'nombre_madre'),''),
    nullif(coalesce(p_record->>'cedulaMadre',p_record->>'cedula_madre'),''),
    nullif(coalesce(p_record->>'abuelosPaternos',p_record->>'abuelos_paternos'),''),
    nullif(coalesce(p_record->>'abuelosMaternos',p_record->>'abuelos_maternos'),''),
    nullif(p_record->>'padrinos',''),nullif(p_record->>'ministro',''),
    nullif(coalesce(p_record->>'daFe',p_record->>'da_fe'),''),nullif(p_record->>'nuip',''),
    nullif(coalesce(p_record->>'numeroRegistro',p_record->>'numero_registro'),''),
    nullif(coalesce(p_record->>'serialRegistro',p_record->>'serial_registro'),''),
    nullif(coalesce(p_record->>'oficinaRegistro',p_record->>'oficina_registro'),''),v_registry_date,
    nullif(p_record->>'direccion',''),nullif(coalesce(p_record->>'observations',p_record->>'observaciones'),''),
    nullif(coalesce(p_record->>'notaMarginal',p_record->>'nota_marginal'),''),
    p_record || jsonb_build_object('Libro',v_book,'folio',v_folio,'numero',v_number,'status','seated','source','historical_book_digitization')
  ) returning id into v_id;

  insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
  values(auth.uid(),p_parish_id,v_diocese,'baptism',v_id,'historical_digitization',p_record,
         jsonb_build_object('book',v_book,'folio',v_folio,'number',v_number,'changes_live_sequence',false));

  return query select v_id,v_book,v_folio,v_number;
end;
$$;
revoke all on function public.register_historical_baptism(uuid,jsonb) from public;
grant execute on function public.register_historical_baptism(uuid,jsonb) to authenticated;

create or replace function public.register_historical_confirmation(
  p_parish_id uuid,
  p_record jsonb,
  p_cross_baptism_id uuid default null,
  p_cross_note text default null
)
returns table(record_id uuid, book_number text, folio text, number text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text; v_user_parish uuid; v_diocese uuid;
  v_id uuid; v_book text; v_folio text; v_number text;
  v_celebration date; v_birth date; v_baptism_date date;
  v_existing_note text;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  select lower(coalesce(role,'')),parish_id,diocese_id into v_role,v_user_parish,v_diocese
  from public.user_profiles
  where auth_user_id=auth.uid() and coalesce(is_active,true)=true
    and coalesce(status,'active') not in ('blocked','disabled','inactive') limit 1;
  if v_role<>'parish' or v_user_parish is distinct from p_parish_id then
    raise exception 'Sólo la parroquia propietaria puede digitalizar su libro de Confirmaciones';
  end if;

  v_book:=public.sacramentum_registry_ref(coalesce(p_record->>'Libro',p_record->>'book_number',p_record->>'libro'));
  v_folio:=public.sacramentum_registry_ref(coalesce(p_record->>'folio',p_record->>'page_number'));
  v_number:=public.sacramentum_registry_ref(coalesce(p_record->>'numero',p_record->>'entry_number',p_record->>'number'));
  if v_book is null or v_folio is null or v_number is null then raise exception 'Libro, Folio y Número son obligatorios'; end if;
  begin v_celebration:=nullif(coalesce(p_record->>'fechaSacramento',p_record->>'celebration_date'),'')::date; exception when others then raise exception 'Fecha de Confirmación inválida'; end;
  if v_celebration is null then raise exception 'La fecha de Confirmación es obligatoria'; end if;
  begin v_birth:=nullif(coalesce(p_record->>'fechaNacimiento',p_record->>'fecha_nacimiento'),'')::date; exception when others then raise exception 'Fecha de nacimiento inválida'; end;
  begin v_baptism_date:=nullif(coalesce(p_record->>'fechaBautismo',p_record->>'fecha_bautismo'),'')::date; exception when others then raise exception 'Fecha de Bautismo inválida'; end;

  if exists(select 1 from public.confirmations c where c.parish_id=p_parish_id and public.sacramentum_registry_ref(c.book_number)=v_book and public.sacramentum_registry_ref(c.folio)=v_folio and public.sacramentum_registry_ref(c.number)=v_number) then
    raise exception 'Ya existe una Confirmación en Libro %, Folio %, Número %',v_book,v_folio,v_number;
  end if;

  insert into public.confirmations(
    parish_id,book_number,folio,number,status,celebration_date,fecha_nacimiento,fecha_bautismo,
    lugar_bautismo,lugar_nacimiento,apellidos,nombres,sexo,nombre_padre,cedula_padre,
    nombre_madre,cedula_madre,tipo_union_padres,abuelos_paternos,abuelos_maternos,padrinos,
    ministro,da_fe,nota_marginal,numero_registro,direccion,observations,raw_data
  ) values (
    p_parish_id,v_book,v_folio,v_number,'seated',v_celebration,v_birth,v_baptism_date,
    nullif(coalesce(p_record->>'lugarBautismo',p_record->>'lugar_bautismo'),''),
    nullif(coalesce(p_record->>'lugarNacimiento',p_record->>'lugar_nacimiento'),''),
    nullif(p_record->>'apellidos',''),nullif(p_record->>'nombres',''),nullif(p_record->>'sexo',''),
    nullif(coalesce(p_record->>'nombrePadre',p_record->>'nombre_padre'),''),
    nullif(coalesce(p_record->>'cedulaPadre',p_record->>'cedula_padre'),''),
    nullif(coalesce(p_record->>'nombreMadre',p_record->>'nombre_madre'),''),
    nullif(coalesce(p_record->>'cedulaMadre',p_record->>'cedula_madre'),''),
    nullif(coalesce(p_record->>'tipoUnionPadres',p_record->>'tipo_union_padres'),''),
    nullif(coalesce(p_record->>'abuelosPaternos',p_record->>'abuelos_paternos'),''),
    nullif(coalesce(p_record->>'abuelosMaternos',p_record->>'abuelos_maternos'),''),
    nullif(p_record->>'padrinos',''),nullif(p_record->>'ministro',''),
    nullif(coalesce(p_record->>'daFe',p_record->>'da_fe'),''),
    nullif(coalesce(p_record->>'notaMarginal',p_record->>'nota_marginal'),''),
    nullif(coalesce(p_record->>'numeroRegistro',p_record->>'numero_registro'),''),
    nullif(p_record->>'direccion',''),nullif(coalesce(p_record->>'observations',p_record->>'observaciones'),''),
    p_record || jsonb_build_object('Libro',v_book,'folio',v_folio,'numero',v_number,'status','seated','source','historical_book_digitization')
  ) returning id into v_id;

  if p_cross_baptism_id is not null and nullif(trim(coalesce(p_cross_note,'')),'') is not null then
    select nota_marginal into v_existing_note from public.baptisms
      where id=p_cross_baptism_id and parish_id=p_parish_id for update;
    if not found then raise exception 'La partida bautismal enlazada no pertenece a esta parroquia'; end if;
    update public.baptisms
      set nota_marginal=concat_ws(E'\n\n',nullif(v_existing_note,''),trim(p_cross_note)),
          raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object(
            'notaMarginal',concat_ws(E'\n\n',nullif(v_existing_note,''),trim(p_cross_note)),
            'lastConfirmationId',v_id
          ),updated_at=now()
      where id=p_cross_baptism_id;
    insert into public.marginal_notes(sacrament_type,note_type,content,parish_id,sacrament_id,note_date,source_type,source_id,created_by,status)
    values('bautismo','confirmacion',trim(p_cross_note),p_parish_id,p_cross_baptism_id,current_date,'historical_confirmation',v_id,auth.uid(),'active');
  end if;

  insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
  values(auth.uid(),p_parish_id,v_diocese,'confirmation',v_id,'historical_digitization',p_record,
         jsonb_build_object('book',v_book,'folio',v_folio,'number',v_number,'cross_baptism_id',p_cross_baptism_id,'changes_live_sequence',false));

  return query select v_id,v_book,v_folio,v_number;
end;
$$;
revoke all on function public.register_historical_confirmation(uuid,jsonb,uuid,text) from public;
grant execute on function public.register_historical_confirmation(uuid,jsonb,uuid,text) to authenticated;

create or replace function public.register_historical_marriage(
  p_parish_id uuid,
  p_record jsonb
)
returns table(record_id uuid, book_number text, folio text, number text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text; v_user_parish uuid; v_diocese uuid;
  v_id uuid; v_book text; v_folio text; v_number text; v_date date;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  select lower(coalesce(role,'')),parish_id,diocese_id into v_role,v_user_parish,v_diocese
  from public.user_profiles where auth_user_id=auth.uid() and coalesce(is_active,true)=true
    and coalesce(status,'active') not in ('blocked','disabled','inactive') limit 1;
  if v_role<>'parish' or v_user_parish is distinct from p_parish_id then
    raise exception 'Sólo la parroquia propietaria puede digitalizar su libro de Matrimonios';
  end if;

  v_book:=public.sacramentum_registry_ref(coalesce(p_record->>'book_number',p_record->>'libro'));
  v_folio:=public.sacramentum_registry_ref(coalesce(p_record->>'page_number',p_record->>'folio'));
  v_number:=public.sacramentum_registry_ref(coalesce(p_record->>'entry_number',p_record->>'numero',p_record->>'number'));
  if v_book is null or v_folio is null or v_number is null then raise exception 'Libro, Folio y Número son obligatorios'; end if;
  begin v_date:=nullif(coalesce(p_record->>'sacramentDate',p_record->>'fechaMatrimonio',p_record->>'celebration_date'),'')::date; exception when others then raise exception 'Fecha de Matrimonio inválida'; end;
  if v_date is null then raise exception 'La fecha de Matrimonio es obligatoria'; end if;

  if exists(select 1 from public.marriages m where m.parish_id=p_parish_id and public.sacramentum_registry_ref(m.book_number)=v_book and public.sacramentum_registry_ref(m.folio)=v_folio and public.sacramentum_registry_ref(m.number)=v_number) then
    raise exception 'Ya existe un Matrimonio en Libro %, Folio %, Número %',v_book,v_folio,v_number;
  end if;

  insert into public.marriages(parish_id,celebration_date,book_number,folio,number,observations,status,raw_data)
  values(p_parish_id,v_date,v_book,v_folio,v_number,
         nullif(coalesce(p_record->>'observations',p_record->>'observaciones'),''),'seated',
         p_record||jsonb_build_object('book_number',v_book,'page_number',v_folio,'entry_number',v_number,'status','seated','source','historical_book_digitization'))
  returning id into v_id;

  insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
  values(auth.uid(),p_parish_id,v_diocese,'marriage',v_id,'historical_digitization',p_record,
         jsonb_build_object('book',v_book,'folio',v_folio,'number',v_number,'changes_live_sequence',false));

  return query select v_id,v_book,v_folio,v_number;
end;
$$;
revoke all on function public.register_historical_marriage(uuid,jsonb) from public;
grant execute on function public.register_historical_marriage(uuid,jsonb) to authenticated;

comment on function public.register_historical_baptism(uuid,jsonb) is 'Digitaliza una partida bautismal física sin modificar el consecutivo ordinario vivo.';
comment on function public.register_historical_confirmation(uuid,jsonb,uuid,text) is 'Digitaliza una Confirmación física y opcionalmente enlaza su nota al Bautismo de la misma parroquia.';
comment on function public.register_historical_marriage(uuid,jsonb) is 'Digitaliza una partida matrimonial física sin modificar el consecutivo ordinario vivo.';
