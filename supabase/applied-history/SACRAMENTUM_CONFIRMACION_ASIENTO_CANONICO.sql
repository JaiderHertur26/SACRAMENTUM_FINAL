-- SACRAMENTUM · CONFIRMACIÓN · ASIENTO CANÓNICO
-- El permanente se construye desde pending_confirmations bloqueado, nunca desde datos del navegador.
begin;

create or replace function public.seat_confirmation_records(
  p_parish_id uuid,
  p_records jsonb,
  p_expected_book integer,
  p_expected_folio integer,
  p_expected_number integer
)
returns table(seated_count integer,next_book integer,next_folio integer,next_number integer)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text; v_user_parish uuid; v_diocese uuid;
  v_params jsonb; v_rec jsonb; v_pending public.pending_confirmations%rowtype; v_raw jsonb;
  v_book integer; v_folio integer; v_number integer; v_limit integer; v_restart boolean;
  v_rbook integer; v_rfolio integer; v_rnumber integer; v_count integer:=0; v_id uuid;
  v_celebration date; v_birth date; v_baptism date; v_time time;
  v_cross_id uuid; v_cross_note text; v_existing text;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  select lower(coalesce(up.role,'')),up.parish_id,up.diocese_id
    into v_role,v_user_parish,v_diocese
  from public.user_profiles up
  where up.auth_user_id=auth.uid() and coalesce(up.is_active,true)=true
    and coalesce(up.status,'active') not in ('blocked','disabled','inactive')
  limit 1;  if v_role<>'parish' or v_user_parish is distinct from p_parish_id then
    raise exception 'Sólo la parroquia propietaria puede asentar estas Confirmaciones';
  end if;
  if p_records is null or jsonb_typeof(p_records)<>'array' or jsonb_array_length(p_records)=0 then
    raise exception 'No hay registros para asentar';
  end if;

  select pp.confirmaciones_params into v_params
  from public.parish_parameters pp
  where pp.parish_id=p_parish_id for update;
  if not found then raise exception 'La parroquia no tiene parámetros de Confirmación'; end if;
  if coalesce((v_params->>'ordinarioBlocked')::boolean,false) then
    raise exception 'El Libro Ordinario de Confirmación está bloqueado';
  end if;

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
    select * into v_pending
    from public.pending_confirmations
    where id=(v_rec->>'pending_id')::uuid and parish_id=p_parish_id
    for update;    if not found then raise exception 'Pendiente de Confirmación no encontrado en esta parroquia'; end if;
    if coalesce(v_pending.reportado,false) or lower(coalesce(v_pending.status,''))='seated' then
      raise exception 'Una de las Confirmaciones ya fue asentada';
    end if;

    v_raw:=coalesce(v_pending.raw_data,'{}'::jsonb);
    if nullif(trim(coalesce(v_raw->>'nombres','')),'') is null
       or nullif(trim(coalesce(v_raw->>'apellidos','')),'') is null then
      raise exception 'El borrador no contiene nombres y apellidos válidos';
    end if;

    begin
      v_celebration:=nullif(coalesce(v_raw->>'fechaSacramento',v_raw->>'fechaConfirmacion',v_raw->>'celebration_date',v_raw->>'feccon'),'')::date;
      v_birth:=nullif(coalesce(v_raw->>'fechaNacimiento',v_raw->>'fecha_nacimiento'),'')::date;
      v_baptism:=nullif(coalesce(v_raw->>'fechaBautismo',v_raw->>'fecha_bautismo'),'')::date;
      v_time:=nullif(coalesce(v_raw->>'horaSacramento',v_raw->>'hora_sacramento',v_raw->>'hora'),'')::time;
    exception when others then
      raise exception 'El borrador contiene una fecha u hora inválida';
    end;
    if v_celebration is null then raise exception 'La fecha de Confirmación es obligatoria'; end if;
    if v_celebration>current_date then raise exception 'No se puede asentar una Confirmación antes de su celebración'; end if;
    if v_birth is not null and v_birth>v_celebration then raise exception 'Nacimiento posterior a la Confirmación'; end if;
    if v_baptism is not null and v_baptism>v_celebration then raise exception 'Bautismo posterior a la Confirmación'; end if;

    v_rbook:=coalesce(nullif(v_rec->>'assigned_book','')::integer,v_book);
    v_rfolio:=coalesce(nullif(v_rec->>'assigned_folio','')::integer,v_folio);
    v_rnumber:=coalesce(nullif(v_rec->>'assigned_number','')::integer,v_number);
    if v_rbook<>v_book or v_rfolio<>v_folio or v_rnumber<>v_number then
      raise exception 'La numeración calculada ya no coincide con el consecutivo oficial';
    end if;    if exists(
      select 1 from public.confirmations c
      where c.parish_id=p_parish_id
        and c.book_number=lpad(v_book::text,4,'0')
        and c.folio=lpad(v_folio::text,4,'0')
        and c.number=lpad(v_number::text,4,'0')
    ) then
      raise exception 'Ya existe una Confirmación en Libro %, Folio %, Número %',v_book,v_folio,v_number;
    end if;

    insert into public.confirmations(
      parish_id,book_number,folio,number,numero_registro,status,
      celebration_date,hora_sacramento,fecha_nacimiento,fecha_bautismo,
      lugar_bautismo,lugar_nacimiento,apellidos,nombres,sexo,nuip,direccion,
      nombre_padre,cedula_padre,nombre_madre,cedula_madre,tipo_union_padres,
      abuelos_paternos,abuelos_maternos,padrinos,ministro,da_fe,nota_marginal,observations,raw_data
    ) values (
      p_parish_id,lpad(v_book::text,4,'0'),lpad(v_folio::text,4,'0'),lpad(v_number::text,4,'0'),
      nullif(coalesce(v_raw->>'numeroRegistro',v_raw->>'numero_registro'),''),'seated',
      v_celebration,v_time,v_birth,v_baptism,
      nullif(coalesce(v_raw->>'lugarBautismo',v_raw->>'lugar_bautismo'),''),
      nullif(coalesce(v_raw->>'lugarNacimiento',v_raw->>'lugar_nacimiento'),''),
      nullif(trim(v_raw->>'apellidos'),''),nullif(trim(v_raw->>'nombres'),''),nullif(trim(v_raw->>'sexo'),''),
      nullif(trim(v_raw->>'nuip'),''),nullif(v_raw->>'direccion',''),
      nullif(coalesce(v_raw->>'nombrePadre',v_raw->>'nombre_padre'),''),nullif(coalesce(v_raw->>'cedulaPadre',v_raw->>'cedula_padre'),''),
      nullif(coalesce(v_raw->>'nombreMadre',v_raw->>'nombre_madre'),''),nullif(coalesce(v_raw->>'cedulaMadre',v_raw->>'cedula_madre'),''),
      nullif(coalesce(v_raw->>'tipoUnionPadres',v_raw->>'tipo_union_padres'),''),      nullif(coalesce(v_raw->>'abuelosPaternos',v_raw->>'abuelos_paternos'),''),nullif(coalesce(v_raw->>'abuelosMaternos',v_raw->>'abuelos_maternos'),''),
      nullif(v_raw->>'padrinos',''),nullif(v_raw->>'ministro',''),nullif(coalesce(v_raw->>'daFe',v_raw->>'da_fe'),''),
      nullif(coalesce(v_raw->>'notaMarginal',v_raw->>'nota_marginal'),''),nullif(coalesce(v_raw->>'observaciones',v_raw->>'observations'),'') ,
      v_raw || jsonb_build_object(
        'Libro',lpad(v_book::text,4,'0'),'folio',lpad(v_folio::text,4,'0'),'numero',lpad(v_number::text,4,'0'),
        'book_number',lpad(v_book::text,4,'0'),'status','seated','estado','seated','source','ordinary','pendingId',v_pending.id
      )
    ) returning id into v_id;

    v_cross_id:=nullif(v_rec->>'cross_baptism_id','')::uuid;
    v_cross_note:=nullif(trim(coalesce(v_rec->>'cross_note','')),'');
    if v_cross_id is not null then
      select b.nota_marginal into v_existing
      from public.baptisms b
      where b.id=v_cross_id and b.parish_id=p_parish_id
        and coalesce(lower(b.status),'active') not in ('anulada','annulled','reversed','revertida','replaced','deleted')
      for update;
      if not found then raise exception 'La partida bautismal enlazada no está vigente o no pertenece a esta parroquia'; end if;

      if v_cross_note is not null and not exists(
        select 1 from public.marginal_notes mn
        where mn.sacrament_type='bautismo' and mn.sacrament_id=v_cross_id
          and mn.source_type='confirmation' and mn.source_id=v_id
          and coalesce(lower(mn.status),'active') not in ('reversed','revertida','deleted')
      ) then
        update public.baptisms
        set nota_marginal=concat_ws(E'\n\n',nullif(v_existing,''),v_cross_note),
            raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object('notaMarginal',concat_ws(E'\n\n',nullif(v_existing,''),v_cross_note),'lastConfirmationId',v_id),
            updated_at=now()
        where id=v_cross_id;        insert into public.marginal_notes(
          sacrament_type,note_type,content,parish_id,sacrament_id,note_date,source_type,source_id,created_by,status
        ) values(
          'bautismo','confirmacion',v_cross_note,p_parish_id,v_cross_id,current_date,'confirmation',v_id,auth.uid(),'active'
        );
      end if;
    end if;

    update public.pending_confirmations
    set reportado=true,status='seated'
    where id=v_pending.id;

    insert into public.registry_audit_log(
      actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
    ) values(
      auth.uid(),p_parish_id,v_diocese,'confirmation',v_id,'seat',
      v_raw,
      jsonb_build_object('pending_id',v_pending.id,'book',v_book,'folio',v_folio,'number',v_number,'cross_baptism_id',v_cross_id)
    );
    v_count:=v_count+1;

    if v_restart then
      if v_number>=v_limit then v_folio:=v_folio+1; v_number:=1; else v_number:=v_number+1; end if;
    else
      v_number:=v_number+1;
      if mod(v_number-1,v_limit)=0 then v_folio:=v_folio+1; end if;
    end if;
  end loop;

  v_params:=jsonb_set(jsonb_set(jsonb_set(v_params,'{ordinarioLibro}',to_jsonb(v_book),true),'{ordinarioFolio}',to_jsonb(v_folio),true),'{ordinarioNumero}',to_jsonb(v_number),true);
  update public.parish_parameters set confirmaciones_params=v_params,updated_at=now() where parish_id=p_parish_id;
  return query select v_count,v_book,v_folio,v_number;
end;
$$;
revoke all on function public.seat_confirmation_records(uuid,jsonb,integer,integer,integer) from public, anon;
grant execute on function public.seat_confirmation_records(uuid,jsonb,integer,integer,integer) to authenticated, service_role;

commit;

select jsonb_build_object(
  'anon_seat',has_function_privilege('anon','public.seat_confirmation_records(uuid,jsonb,integer,integer,integer)','EXECUTE'),
  'auth_seat',has_function_privilege('authenticated','public.seat_confirmation_records(uuid,jsonb,integer,integer,integer)','EXECUTE')
) as confirmation_seating_postcheck;