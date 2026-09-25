-- SACRAMENTUM - Fase 2.7
-- Asentamiento ordinario atómico de Bautismos y Confirmaciones.
-- Evita que una partida quede creada sin cerrar el pendiente o sin avanzar
-- el consecutivo, y protege el asentamiento por lote contra concurrencia.

create or replace function public.seat_baptism_records(
  p_parish_id uuid,
  p_records jsonb,
  p_expected_book integer,
  p_expected_folio integer,
  p_expected_number integer
)
returns table(seated_count integer,next_book integer,next_folio integer,next_number integer)
language plpgsql security definer set search_path=public
as $$
declare
  v_role text; v_user_parish uuid;
  v_params jsonb; v_rec jsonb; v_pending public.pending_baptisms%rowtype;
  v_book integer; v_folio integer; v_number integer; v_limit integer; v_restart boolean;
  v_id uuid; v_count integer:=0;
  v_rbook integer; v_rfolio integer; v_rnumber integer;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  select lower(coalesce(role,'')),parish_id into v_role,v_user_parish
  from public.user_profiles where auth_user_id=auth.uid() and coalesce(is_active,true)=true limit 1;
  if v_role<>'parish' or v_user_parish is distinct from p_parish_id then
    raise exception 'Sólo la parroquia propietaria puede asentar estos Bautismos';
  end if;
  if jsonb_typeof(p_records)<>'array' or jsonb_array_length(p_records)=0 then raise exception 'No hay registros para asentar'; end if;

  select bautizos_params into v_params from public.parish_parameters where parish_id=p_parish_id for update;
  if not found then raise exception 'La parroquia no tiene parámetros de Bautismo'; end if;
  v_book:=greatest(coalesce(nullif(v_params->>'ordinarioLibro','')::integer,1),1);
  v_folio:=greatest(coalesce(nullif(v_params->>'ordinarioFolio','')::integer,1),1);
  v_number:=greatest(coalesce(nullif(v_params->>'ordinarioNumero','')::integer,1),1);
  v_limit:=greatest(coalesce(nullif(v_params->>'ordinarioPartidas','')::integer,2),1);
  v_restart:=coalesce((v_params->>'ordinarioRestartNumber')::boolean,false);
  if v_book<>p_expected_book or v_folio<>p_expected_folio or v_number<>p_expected_number then
    raise exception 'El consecutivo de Bautismo cambió. Recargue antes de asentar.';
  end if;

  for v_rec in select value from jsonb_array_elements(p_records)
  loop
    if nullif(v_rec->>'pending_id','') is null then raise exception 'Cada registro debe indicar pending_id'; end if;
    select * into v_pending from public.pending_baptisms where id=(v_rec->>'pending_id')::uuid and parish_id=p_parish_id for update;
    if not found then raise exception 'Pendiente de Bautismo no encontrado en esta parroquia'; end if;
    if coalesce(v_pending.reportado,false) then raise exception 'Uno de los Bautismos ya fue asentado'; end if;

    v_rbook:=coalesce(nullif(v_rec->>'assigned_book','')::integer,v_book);
    v_rfolio:=coalesce(nullif(v_rec->>'assigned_folio','')::integer,v_folio);
    v_rnumber:=coalesce(nullif(v_rec->>'assigned_number','')::integer,v_number);
    if v_rbook<>v_book or v_rfolio<>v_folio or v_rnumber<>v_number then
      raise exception 'La numeración calculada por la interfaz ya no coincide con el consecutivo oficial';
    end if;
    if exists(select 1 from public.baptisms b where b.parish_id=p_parish_id and b.book_number=lpad(v_book::text,4,'0') and b.folio=lpad(v_folio::text,4,'0') and b.number=lpad(v_number::text,4,'0')) then
      raise exception 'Ya existe una partida en Libro %, Folio %, Número %',v_book,v_folio,v_number;
    end if;

    insert into public.baptisms(
      parish_id,book_number,folio,number,numero_registro,status,celebration_date,lugar_bautismo,
      apellidos,nombres,sexo,fecha_nacimiento,lugar_nacimiento,nombre_padre,nombre_madre,
      tipo_union_padres,padrinos,abuelos_paternos,abuelos_maternos,ministro,da_fe,nuip,
      serial_registro,oficina_registro,fecha_expedicion_registro,direccion,raw_data
    ) values (
      p_parish_id,lpad(v_book::text,4,'0'),lpad(v_folio::text,4,'0'),lpad(v_number::text,4,'0'),
      nullif(v_rec->>'numero_registro',''),'seated',nullif(v_rec->>'celebration_date','')::date,nullif(v_rec->>'lugar_bautismo',''),
      nullif(v_rec->>'apellidos',''),nullif(v_rec->>'nombres',''),nullif(v_rec->>'sexo',''),nullif(v_rec->>'fecha_nacimiento','')::date,
      nullif(v_rec->>'lugar_nacimiento',''),nullif(v_rec->>'nombre_padre',''),nullif(v_rec->>'nombre_madre',''),
      nullif(v_rec->>'tipo_union_padres',''),nullif(v_rec->>'padrinos',''),nullif(v_rec->>'abuelos_paternos',''),nullif(v_rec->>'abuelos_maternos',''),
      nullif(v_rec->>'ministro',''),nullif(v_rec->>'da_fe',''),nullif(v_rec->>'nuip',''),nullif(v_rec->>'serial_registro',''),
      nullif(v_rec->>'oficina_registro',''),nullif(v_rec->>'fecha_expedicion_registro','')::date,nullif(v_rec->>'direccion',''),
      coalesce(v_rec->'raw_data','{}'::jsonb)||jsonb_build_object('Libro',lpad(v_book::text,4,'0'),'folio',lpad(v_folio::text,4,'0'),'numero',lpad(v_number::text,4,'0'),'status','seated')
    ) returning id into v_id;

    update public.pending_baptisms set reportado=true,status='seated' where id=v_pending.id;
    insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
    values(auth.uid(),p_parish_id,(select diocese_id from public.parishes where id=p_parish_id),'baptism',v_id,'seat',v_rec,jsonb_build_object('pending_id',v_pending.id,'book',v_book,'folio',v_folio,'number',v_number));
    v_count:=v_count+1;

    if v_restart then
      if v_number>=v_limit then v_folio:=v_folio+1; v_number:=1; else v_number:=v_number+1; end if;
    else
      v_number:=v_number+1; if mod(v_number-1,v_limit)=0 then v_folio:=v_folio+1; end if;
    end if;
  end loop;

  v_params:=jsonb_set(jsonb_set(jsonb_set(v_params,'{ordinarioLibro}',to_jsonb(v_book),true),'{ordinarioFolio}',to_jsonb(v_folio),true),'{ordinarioNumero}',to_jsonb(v_number),true);
  update public.parish_parameters set bautizos_params=v_params,updated_at=now() where parish_id=p_parish_id;
  return query select v_count,v_book,v_folio,v_number;
end; $$;
revoke all on function public.seat_baptism_records(uuid,jsonb,integer,integer,integer) from public;
grant execute on function public.seat_baptism_records(uuid,jsonb,integer,integer,integer) to authenticated;

create or replace function public.seat_confirmation_records(
  p_parish_id uuid,
  p_records jsonb,
  p_expected_book integer,
  p_expected_folio integer,
  p_expected_number integer
)
returns table(seated_count integer,next_book integer,next_folio integer,next_number integer)
language plpgsql security definer set search_path=public
as $$
declare
  v_role text; v_user_parish uuid;
  v_params jsonb; v_rec jsonb; v_pending public.pending_confirmations%rowtype;
  v_book integer; v_folio integer; v_number integer; v_limit integer; v_restart boolean;
  v_id uuid; v_count integer:=0; v_cross_id uuid; v_cross_note text; v_existing text;
  v_rbook integer; v_rfolio integer; v_rnumber integer;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  select lower(coalesce(role,'')),parish_id into v_role,v_user_parish
  from public.user_profiles where auth_user_id=auth.uid() and coalesce(is_active,true)=true limit 1;
  if v_role<>'parish' or v_user_parish is distinct from p_parish_id then
    raise exception 'Sólo la parroquia propietaria puede asentar estas Confirmaciones';
  end if;
  if jsonb_typeof(p_records)<>'array' or jsonb_array_length(p_records)=0 then raise exception 'No hay registros para asentar'; end if;

  select confirmaciones_params into v_params from public.parish_parameters where parish_id=p_parish_id for update;
  if not found then raise exception 'La parroquia no tiene parámetros de Confirmación'; end if;
  v_book:=greatest(coalesce(nullif(v_params->>'ordinarioLibro','')::integer,1),1);
  v_folio:=greatest(coalesce(nullif(v_params->>'ordinarioFolio','')::integer,1),1);
  v_number:=greatest(coalesce(nullif(v_params->>'ordinarioNumero','')::integer,1),1);
  v_limit:=greatest(coalesce(nullif(v_params->>'ordinarioPartidas','')::integer,2),1);
  v_restart:=coalesce((v_params->>'ordinarioRestartNumber')::boolean,false);
  if v_book<>p_expected_book or v_folio<>p_expected_folio or v_number<>p_expected_number then
    raise exception 'El consecutivo de Confirmación cambió. Recargue antes de asentar.';
  end if;

  for v_rec in select value from jsonb_array_elements(p_records)
  loop
    if nullif(v_rec->>'pending_id','') is null then raise exception 'Cada registro debe indicar pending_id'; end if;
    select * into v_pending from public.pending_confirmations where id=(v_rec->>'pending_id')::uuid and parish_id=p_parish_id for update;
    if not found then raise exception 'Pendiente de Confirmación no encontrado en esta parroquia'; end if;
    if coalesce(v_pending.reportado,false) then raise exception 'Una de las Confirmaciones ya fue asentada'; end if;

    v_rbook:=coalesce(nullif(v_rec->>'assigned_book','')::integer,v_book);
    v_rfolio:=coalesce(nullif(v_rec->>'assigned_folio','')::integer,v_folio);
    v_rnumber:=coalesce(nullif(v_rec->>'assigned_number','')::integer,v_number);
    if v_rbook<>v_book or v_rfolio<>v_folio or v_rnumber<>v_number then raise exception 'La numeración calculada ya no coincide con el consecutivo oficial'; end if;
    if exists(select 1 from public.confirmations c where c.parish_id=p_parish_id and c.book_number=lpad(v_book::text,4,'0') and c.folio=lpad(v_folio::text,4,'0') and c.number=lpad(v_number::text,4,'0')) then
      raise exception 'Ya existe una Confirmación en Libro %, Folio %, Número %',v_book,v_folio,v_number;
    end if;

    insert into public.confirmations(
      parish_id,book_number,folio,number,numero_registro,status,celebration_date,lugar_bautismo,
      apellidos,nombres,sexo,fecha_nacimiento,lugar_nacimiento,nombre_padre,nombre_madre,
      tipo_union_padres,padrinos,ministro,da_fe,nota_marginal,raw_data
    ) values (
      p_parish_id,lpad(v_book::text,4,'0'),lpad(v_folio::text,4,'0'),lpad(v_number::text,4,'0'),nullif(v_rec->>'numero_registro',''),'seated',
      nullif(v_rec->>'celebration_date','')::date,nullif(v_rec->>'lugar_bautismo',''),nullif(v_rec->>'apellidos',''),nullif(v_rec->>'nombres',''),
      nullif(v_rec->>'sexo',''),nullif(v_rec->>'fecha_nacimiento','')::date,nullif(v_rec->>'lugar_nacimiento',''),nullif(v_rec->>'nombre_padre',''),
      nullif(v_rec->>'nombre_madre',''),nullif(v_rec->>'tipo_union_padres',''),nullif(v_rec->>'padrinos',''),nullif(v_rec->>'ministro',''),nullif(v_rec->>'da_fe',''),
      nullif(v_rec->>'nota_marginal',''),coalesce(v_rec->'raw_data','{}'::jsonb)||jsonb_build_object('Libro',lpad(v_book::text,4,'0'),'folio',lpad(v_folio::text,4,'0'),'numero',lpad(v_number::text,4,'0'),'status','seated')
    ) returning id into v_id;

    v_cross_id:=nullif(v_rec->>'cross_baptism_id','')::uuid;
    v_cross_note:=nullif(v_rec->>'cross_note','');
    if v_cross_id is not null and v_cross_note is not null then
      select nota_marginal into v_existing from public.baptisms where id=v_cross_id and parish_id=p_parish_id for update;
      if found then
        if not exists(select 1 from public.marginal_notes where sacrament_type='bautismo' and sacrament_id=v_cross_id and source_type='confirmation' and source_id=v_id and coalesce(status,'active')<>'reversed') then
          update public.baptisms set nota_marginal=concat_ws(E'\n\n',nullif(v_existing,''),v_cross_note),raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object('notaMarginal',concat_ws(E'\n\n',nullif(v_existing,''),v_cross_note),'lastConfirmationId',v_id),updated_at=now() where id=v_cross_id;
          insert into public.marginal_notes(sacrament_type,note_type,content,parish_id,sacrament_id,note_date,source_type,source_id,created_by,status)
          values('bautismo','confirmacion',v_cross_note,p_parish_id,v_cross_id,current_date,'confirmation',v_id,auth.uid(),'active');
        end if;
      end if;
    end if;

    update public.pending_confirmations set reportado=true,status='seated' where id=v_pending.id;
    insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
    values(auth.uid(),p_parish_id,(select diocese_id from public.parishes where id=p_parish_id),'confirmation',v_id,'seat',v_rec,jsonb_build_object('pending_id',v_pending.id,'book',v_book,'folio',v_folio,'number',v_number,'cross_baptism_id',v_cross_id));
    v_count:=v_count+1;

    if v_restart then
      if v_number>=v_limit then v_folio:=v_folio+1; v_number:=1; else v_number:=v_number+1; end if;
    else
      v_number:=v_number+1; if mod(v_number-1,v_limit)=0 then v_folio:=v_folio+1; end if;
    end if;
  end loop;

  v_params:=jsonb_set(jsonb_set(jsonb_set(v_params,'{ordinarioLibro}',to_jsonb(v_book),true),'{ordinarioFolio}',to_jsonb(v_folio),true),'{ordinarioNumero}',to_jsonb(v_number),true);
  update public.parish_parameters set confirmaciones_params=v_params,updated_at=now() where parish_id=p_parish_id;
  return query select v_count,v_book,v_folio,v_number;
end; $$;
revoke all on function public.seat_confirmation_records(uuid,jsonb,integer,integer,integer) from public;
grant execute on function public.seat_confirmation_records(uuid,jsonb,integer,integer,integer) to authenticated;
