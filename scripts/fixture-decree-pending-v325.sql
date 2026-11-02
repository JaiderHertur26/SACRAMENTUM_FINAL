CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE SCHEMA sacramentum_ledger;CREATE SCHEMA sacramentum_private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE public.parishes(id uuid,diocese_id uuid,is_operational boolean);
CREATE TABLE public.user_profiles(auth_user_id uuid,role text,parish_id uuid,diocese_id uuid,is_active boolean,status text);
CREATE TABLE public.parish_parameters(id uuid default gen_random_uuid(),parish_id uuid unique,created_at timestamptz default now(),updated_at timestamptz,
 bautizos_params jsonb default '{}',confirmaciones_params jsonb default '{}',matrimonios_params jsonb default '{}',defunciones_params jsonb default '{}');
CREATE FUNCTION public.sacramentum_default_baptism_params() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"ordinarioLibro":1,"ordinarioFolio":1,"ordinarioNumero":1,"ordinarioPartidas":2}'::jsonb $$;
CREATE FUNCTION public.sacramentum_default_confirmation_params() RETURNS jsonb LANGUAGE sql AS $$ SELECT public.sacramentum_default_baptism_params() $$;
CREATE FUNCTION public.sacramentum_ensure_parish_parameters(p uuid) RETURNS void LANGUAGE sql AS $$ INSERT INTO public.parish_parameters(parish_id) VALUES(p) ON CONFLICT DO NOTHING $$;
CREATE FUNCTION public.ensure_parish_parameters(p uuid) RETURNS void LANGUAGE sql AS $$ SELECT public.sacramentum_ensure_parish_parameters(p) $$;
CREATE TABLE public.decretos(id uuid,sacrament_type text,payload jsonb);
CREATE TABLE sacramentum_ledger.celebration_attestations_v263(pending_id uuid,sacrament text,decree_id uuid);
CREATE TABLE public.pending_baptisms(id uuid,parish_id uuid,status text,reportado boolean default false,raw_data jsonb);
CREATE TABLE public.pending_confirmations(LIKE public.pending_baptisms);
CREATE TABLE public.pending_marriages(LIKE public.pending_baptisms,book_type text,celebration_date date);
CREATE TABLE public.pending_funerals(LIKE public.pending_baptisms,book_type text,numero_registro text);
CREATE TABLE public.baptisms(id uuid default gen_random_uuid(),da_fe text,celebrant_id uuid,parishioner_id uuid,book_id uuid,parish_id uuid,nuip text,lugar_nacimiento text,oficina_registro text,serial_registro text,abuelos_paternos text,abuelos_maternos text,direccion text,padrinos text,ministro text,nota_marginal text,sexo text,observations text,nombres text,apellidos text,tipo_union_padres text,lugar_bautismo text,hora_sacramento text,numero_registro text,book_number text,status text,nombre_padre text,cedula_padre text,number text,nombre_madre text,cedula_madre text,fecha_expedicion_registro date,fecha_nacimiento date,raw_data jsonb,updated_at timestamptz,created_at timestamptz,folio text,celebration_date date,godmother_id uuid,godfather_id uuid,is_deceased boolean,death_date date,death_place text,linked_funeral_id uuid);
CREATE TABLE public.registry_audit_log(id uuid default gen_random_uuid(),actor_user_id uuid,parish_id uuid,diocese_id uuid,entity_type text,entity_id uuid,action text,after_data jsonb,metadata jsonb);
CREATE OR REPLACE FUNCTION public.seat_baptism_records(p_parish_id uuid, p_records jsonb, p_expected_book integer, p_expected_folio integer, p_expected_number integer)
 RETURNS TABLE(seated_count integer, next_book integer, next_folio integer, next_number integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_role text;
  v_user_parish uuid;
  v_diocese uuid;
  v_params_row public.parish_parameters%rowtype;
  v_params jsonb;
  v_rec jsonb;
  v_pending public.pending_baptisms%rowtype;
  v_data jsonb;
  v_final_raw jsonb;
  v_book integer;
  v_folio integer;
  v_number integer;
  v_limit integer;
  v_restart boolean;
  v_id uuid;
  v_count integer:=0;
  v_rbook integer;
  v_rfolio integer;
  v_rnumber integer;
  v_celebration date;
  v_celebration_text text;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select lower(coalesce(role,'')),parish_id,diocese_id
    into v_role,v_user_parish,v_diocese
  from public.user_profiles
  where auth_user_id=auth.uid() and public.user_profiles.is_active IS TRUE AND upper(public.user_profiles.status)='ACTIVE' AND public.user_profiles.diocese_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.parishes v178_parish WHERE v178_parish.id=public.user_profiles.parish_id AND v178_parish.diocese_id=public.user_profiles.diocese_id)
  limit 1;

  if v_role<>'parish' or v_user_parish is distinct from p_parish_id then
    raise exception 'Sólo la parroquia propietaria puede asentar estos Bautismos';
  end if;
  if p_records is null or jsonb_typeof(p_records)<>'array' or jsonb_array_length(p_records)=0 then
    raise exception 'No hay registros para asentar';
  end if;

  perform public.sacramentum_ensure_parish_parameters(p_parish_id);
  select * into v_params_row
  from public.parish_parameters
  where parish_id=p_parish_id
  for update;
  if not found then raise exception 'La parroquia no tiene parámetros de Bautismo'; end if;

  v_params:=public.sacramentum_default_baptism_params()||coalesce(v_params_row.bautizos_params,'{}'::jsonb);
  if coalesce((v_params->>'ordinarioBlocked')::boolean,false) then
    raise exception 'El Libro Ordinario de Bautismo está bloqueado en Parámetros';
  end if;

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
    if nullif(v_rec->>'pending_id','') is null then
      raise exception 'Cada registro debe indicar pending_id';
    end if;

    select * into v_pending
    from public.pending_baptisms
    where id=(v_rec->>'pending_id')::uuid and parish_id=p_parish_id
    for update;

    if not found then raise exception 'Pendiente de Bautismo no encontrado en esta parroquia'; end if;
    if coalesce(v_pending.reportado,false) or lower(coalesce(v_pending.status,''))<>'pending' then
      raise exception 'Uno de los Bautismos ya fue asentado o no está pendiente';
    end if;

    v_rbook:=coalesce(nullif(v_rec->>'assigned_book','')::integer,v_book);
    v_rfolio:=coalesce(nullif(v_rec->>'assigned_folio','')::integer,v_folio);
    v_rnumber:=coalesce(nullif(v_rec->>'assigned_number','')::integer,v_number);
    if v_rbook<>v_book or v_rfolio<>v_folio or v_rnumber<>v_number then
      raise exception 'La numeración calculada por la interfaz ya no coincide con el consecutivo oficial';
    end if;

    v_data:=coalesce(v_pending.raw_data,'{}'::jsonb);
    v_celebration_text:=coalesce(nullif(v_data->>'fechaSacramento',''),nullif(v_data->>'celebration_date',''));
    if v_celebration_text is null then raise exception 'El Bautismo pendiente no tiene fecha de celebración'; end if;
    begin
      v_celebration:=v_celebration_text::date;
    exception when others then
      raise exception 'La fecha de celebración del Bautismo no es válida';
    end;
    if v_celebration>current_date then
      raise exception 'No se puede asentar un Bautismo antes de su fecha de celebración (%)',v_celebration;
    end if;

    if exists(
      select 1 from public.baptisms b
      where b.parish_id=p_parish_id
        and b.book_number=lpad(v_book::text,4,'0')
        and b.folio=lpad(v_folio::text,4,'0')
        and b.number=lpad(v_number::text,4,'0')
    ) then
      raise exception 'Ya existe una partida en Libro %, Folio %, Número %',v_book,v_folio,v_number;
    end if;

    v_final_raw:=v_data||jsonb_build_object(
      'Libro',lpad(v_book::text,4,'0'),
      'book_number',lpad(v_book::text,4,'0'),
      'folio',lpad(v_folio::text,4,'0'),
      'numero',lpad(v_number::text,4,'0'),
      'number',lpad(v_number::text,4,'0'),
      'status','seated',
      'estado','seated'
    );

    insert into public.baptisms(
      parish_id,book_number,folio,number,numero_registro,status,celebration_date,lugar_bautismo,
      apellidos,nombres,sexo,fecha_nacimiento,lugar_nacimiento,
      nombre_padre,cedula_padre,nombre_madre,cedula_madre,tipo_union_padres,
      padrinos,abuelos_paternos,abuelos_maternos,ministro,da_fe,
      nuip,serial_registro,oficina_registro,fecha_expedicion_registro,direccion,
      hora_sacramento,nota_marginal,observations,raw_data
    ) values (
      p_parish_id,lpad(v_book::text,4,'0'),lpad(v_folio::text,4,'0'),lpad(v_number::text,4,'0'),
      nullif(coalesce(v_data->>'numeroRegistro',v_data->>'numero_registro'),''),'seated',v_celebration,
      nullif(coalesce(v_data->>'lugarBautismo',v_data->>'lugar_bautismo'),''),
      nullif(v_data->>'apellidos',''),nullif(v_data->>'nombres',''),nullif(v_data->>'sexo',''),
      case when nullif(coalesce(v_data->>'fechaNacimiento',v_data->>'fecha_nacimiento'),'') is null then null else coalesce(v_data->>'fechaNacimiento',v_data->>'fecha_nacimiento')::date end,
      nullif(coalesce(v_data->>'lugarNacimiento',v_data->>'lugar_nacimiento'),''),
      nullif(coalesce(v_data->>'nombrePadre',v_data->>'nombre_padre'),''),
      nullif(coalesce(v_data->>'cedulaPadre',v_data->>'cedula_padre'),''),
      nullif(coalesce(v_data->>'nombreMadre',v_data->>'nombre_madre'),''),
      nullif(coalesce(v_data->>'cedulaMadre',v_data->>'cedula_madre'),''),
      nullif(coalesce(v_data->>'tipoUnionPadres',v_data->>'tipo_union_padres'),''),
      nullif(v_data->>'padrinos',''),
      nullif(coalesce(v_data->>'abuelosPaternos',v_data->>'abuelos_paternos'),''),
      nullif(coalesce(v_data->>'abuelosMaternos',v_data->>'abuelos_maternos'),''),
      nullif(v_data->>'ministro',''),
      nullif(coalesce(v_data->>'daFe',v_data->>'da_fe'),''),
      nullif(v_data->>'nuip',''),
      nullif(coalesce(v_data->>'serialRegistro',v_data->>'serial_registro'),''),
      nullif(coalesce(v_data->>'oficinaRegistro',v_data->>'oficina_registro'),''),
      case when nullif(coalesce(v_data->>'fechaExpedicionRegistro',v_data->>'fecha_expedicion_registro'),'') is null then null else coalesce(v_data->>'fechaExpedicionRegistro',v_data->>'fecha_expedicion_registro')::date end,
      nullif(v_data->>'direccion',''),
      nullif(coalesce(v_data->>'horaSacramento',v_data->>'hora_sacramento'),''),
      nullif(coalesce(v_data->>'notaMarginal',v_data->>'nota_marginal'),''),
      nullif(coalesce(v_data->>'observations',v_data->>'observaciones',v_data->>'obs'),''),
      v_final_raw
    ) returning id into v_id;

    update public.pending_baptisms
    set reportado=true,status='seated',raw_data=v_final_raw||jsonb_build_object('seated_baptism_id',v_id,'seated_book',lpad(v_book::text,4,'0'),'seated_folio',lpad(v_folio::text,4,'0'),'seated_number',lpad(v_number::text,4,'0'),'boleta_archived',true)
    where id=v_pending.id;

    insert into public.registry_audit_log(
      actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
    ) values(
      auth.uid(),p_parish_id,v_diocese,'baptism',v_id,'seat',v_final_raw,
      jsonb_build_object('pending_id',v_pending.id,'book',v_book,'folio',v_folio,'number',v_number)
    );

    v_count:=v_count+1;

    if v_restart then
      if v_number>=v_limit then
        v_folio:=v_folio+1;
        v_number:=1;
      else
        v_number:=v_number+1;
      end if;
    else
      v_number:=v_number+1;
      if mod(v_number-1,v_limit)=0 then v_folio:=v_folio+1; end if;
    end if;
  end loop;

  v_params:=jsonb_set(
    jsonb_set(
      jsonb_set(v_params,'{ordinarioLibro}',to_jsonb(v_book),true),
      '{ordinarioFolio}',to_jsonb(v_folio),true
    ),
    '{ordinarioNumero}',to_jsonb(v_number),true
  );

  update public.parish_parameters
  set bautizos_params=v_params,updated_at=now()
  where id=v_params_row.id;

  return query select v_count,v_book,v_folio,v_number;
end;
$function$;

CREATE OR REPLACE FUNCTION public.seat_confirmation_records(p_parish_id uuid, p_records jsonb, p_expected_book integer, p_expected_folio integer, p_expected_number integer)
 RETURNS TABLE(seated_count integer, next_book integer, next_folio integer, next_number integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  where up.auth_user_id=auth.uid() and up.is_active IS TRUE AND upper(up.status)='ACTIVE' AND up.diocese_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.parishes v178_parish WHERE v178_parish.id=up.parish_id AND v178_parish.diocese_id=up.diocese_id)
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
    set reportado=true,status='seated',
        raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object(
          'seated_confirmation_id',v_id,
          'seated_book',lpad(v_book::text,4,'0'),
          'seated_folio',lpad(v_folio::text,4,'0'),
          'seated_number',lpad(v_number::text,4,'0'),
          'boleta_archived',true
        )
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
$function$;

CREATE OR REPLACE FUNCTION public.seat_funeral_record(p_form_data jsonb, p_pending_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(funeral_id uuid, book_number text, folio text, number text, next_book integer, next_folio integer, next_number integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_role text;
  v_parish uuid;
  v_diocese uuid;

  v_pending public.pending_funerals%rowtype;
  v_data jsonb;

  v_params_row public.parish_parameters%rowtype;
  v_params jsonb;

  v_book_type text;
  v_book integer;
  v_folio integer;
  v_number integer;
  v_limit integer;
  v_restart boolean;
  v_blocked boolean;

  v_next_book integer;
  v_next_folio integer;
  v_next_number integer;

  v_registry_current bigint;
  v_registry text;

  v_funeral_id uuid;
  v_death_date date;
  v_birth_date date;
  v_funeral_date date;
  v_funeral_time time;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select lower(coalesce(up.role,'')), up.parish_id, up.diocese_id
    into v_role, v_parish, v_diocese
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
    and up.is_active IS TRUE AND upper(up.status)='ACTIVE' AND up.diocese_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.parishes v178_parish WHERE v178_parish.id=up.parish_id AND v178_parish.diocese_id=up.diocese_id)
    and coalesce(up.status,'active') not in ('blocked','disabled','inactive')
  limit 1;

  if v_role <> 'parish' or v_parish is null then
    raise exception 'Sólo una cuenta parroquial activa puede asentar Exequias';
  end if;

  perform public.ensure_parish_parameters(v_parish);

  -- V204: acquire the common parish numbering lock before a pending-row lock.
  SELECT * INTO v_params_row
  FROM public.parish_parameters pp
  WHERE pp.parish_id = v_parish
  ORDER BY pp.created_at NULLS LAST
  LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No fue posible cargar los parámetros de Exequias';
  END IF;

  if p_pending_id is not null then
    select *
      into v_pending
    from public.pending_funerals pf
    where pf.id = p_pending_id
      and pf.parish_id = v_parish
    for update;

    if not found then
      raise exception 'El borrador de Exequias no existe o no pertenece a la parroquia';
    end if;

    if lower(coalesce(v_pending.status,'')) <> 'pending'
       or coalesce(v_pending.reportado,false) = true then
      raise exception 'El pendiente de Exequias ya no está disponible';
    end if;

    v_data := coalesce(v_pending.raw_data,'{}'::jsonb)
              || coalesce(p_form_data,'{}'::jsonb);

    v_book_type := lower(coalesce(
      nullif(trim(v_pending.book_type),''),
      nullif(trim(v_data->>'book_type'),''),
      nullif(trim(v_data->>'bookType'),''),
      'ordinario'
    ));

    v_registry := nullif(trim(coalesce(
      v_pending.numero_registro,
      v_data->>'numero_registro',
      v_data->>'numeroRegistro',
      ''
    )), '');
  else
    if p_form_data is null or jsonb_typeof(p_form_data) <> 'object' then
      raise exception 'Datos de Exequias inválidos';
    end if;

    v_data := p_form_data;

    v_book_type := lower(coalesce(
      nullif(trim(v_data->>'book_type'),''),
      nullif(trim(v_data->>'bookType'),''),
      'ordinario'
    ));

    v_registry := nullif(trim(coalesce(
      v_data->>'numero_registro',
      v_data->>'numeroRegistro',
      ''
    )), '');
  end if;

  if v_book_type not in ('ordinario','suplementario') then
    raise exception 'Tipo de libro de Exequias inválido';
  end if;

  if nullif(trim(coalesce(v_data->>'nombres','')), '') is null
     or nullif(trim(coalesce(v_data->>'apellidos','')), '') is null then
    raise exception 'Nombres y apellidos son obligatorios';
  end if;

  if nullif(trim(coalesce(v_data->>'fecha_defuncion','')), '') is null then
    raise exception 'La fecha de defunción es obligatoria';
  end if;

  begin
    v_death_date := (v_data->>'fecha_defuncion')::date;
  exception when others then
    raise exception 'La fecha de defunción no es válida';
  end;

  if nullif(trim(coalesce(v_data->>'fecha_nacimiento','')), '') is not null then
    begin
      v_birth_date := (v_data->>'fecha_nacimiento')::date;
    exception when others then
      raise exception 'La fecha de nacimiento no es válida';
    end;
  end if;

  if v_birth_date is not null and v_birth_date > v_death_date then
    raise exception 'La fecha de nacimiento no puede ser posterior a la fecha de defunción';
  end if;

  if nullif(trim(coalesce(v_data->>'fecha_exequias','')), '') is not null then
    begin
      v_funeral_date := (v_data->>'fecha_exequias')::date;
    exception when others then
      raise exception 'La fecha de Exequias no es válida';
    end;

    if v_funeral_date < v_death_date then
      raise exception 'La fecha de Exequias no puede ser anterior a la fecha de defunción';
    end if;
  end if;

  if nullif(trim(coalesce(v_data->>'hora_exequias','')), '') is not null then
    begin
      v_funeral_time := (v_data->>'hora_exequias')::time;
    exception when others then
      raise exception 'La hora de Exequias no es válida';
    end;
  end if;

  select *
    into v_params_row
  from public.parish_parameters pp
  where pp.parish_id = v_parish
  order by pp.created_at nulls last
  limit 1
  for update;

  if not found then
    raise exception 'No fue posible cargar los parámetros de Exequias';
  end if;

  v_params := public.sacramentum_default_funeral_params()
              || coalesce(v_params_row.exequias_params,'{}'::jsonb);

  if v_book_type = 'suplementario' then
    v_book := greatest(1, coalesce(nullif(v_params->>'suplementarioLibro','')::integer,1));
    v_folio := greatest(1, coalesce(nullif(v_params->>'suplementarioFolio','')::integer,1));
    v_number := greatest(1, coalesce(nullif(v_params->>'suplementarioNumero','')::integer,1));
    v_limit := greatest(1, coalesce(nullif(v_params->>'suplementarioPartidas','')::integer,2));
    v_restart := coalesce((v_params->>'suplementarioReiniciar')::boolean,false);
    v_blocked := coalesce((v_params->>'suplementarioBlocked')::boolean,false);
  else
    v_book := greatest(1, coalesce(
      nullif(v_params->>'ordinarioLibro','')::integer,
      nullif(v_params->>'libro','')::integer,
      1
    ));
    v_folio := greatest(1, coalesce(
      nullif(v_params->>'ordinarioFolio','')::integer,
      nullif(v_params->>'folio','')::integer,
      1
    ));
    v_number := greatest(1, coalesce(
      nullif(v_params->>'ordinarioNumero','')::integer,
      nullif(v_params->>'numero','')::integer,
      1
    ));
    v_limit := greatest(1, coalesce(
      nullif(v_params->>'ordinarioPartidas','')::integer,
      nullif(v_params->>'partidasPorFolio','')::integer,
      2
    ));
    v_restart := coalesce(
      (v_params->>'ordinarioRestartNumber')::boolean,
      (v_params->>'reiniciarNumeroEnFolio')::boolean,
      false
    );
    v_blocked := coalesce((v_params->>'ordinarioBlocked')::boolean,false);
  end if;

  if v_blocked then
    raise exception 'El Libro % de Exequias se encuentra bloqueado',
      case when v_book_type='suplementario' then 'Supletorio' else 'Ordinario' end;
  end if;

  if exists (
    select 1
    from public.funerals f
    where f.parish_id = v_parish
      and f.book_type = v_book_type
      and f.book_number = lpad(v_book::text,4,'0')
      and f.folio = lpad(v_folio::text,4,'0')
      and f.number = lpad(v_number::text,4,'0')
  ) then
    raise exception 'El consecutivo de Exequias % L %, F %, N % ya está ocupado. Recargue los parámetros.',
      upper(v_book_type), v_book, v_folio, v_number;
  end if;

  -- Compatibilidad: si un cliente antiguo llega sin borrador,
  -- se reserva el N.º de Registro en el momento del asiento.
  if v_registry is null then
    v_registry_current := case
      when coalesce(v_params->>'numeroRegistroActual','') ~ '^\d+$'
      then (v_params->>'numeroRegistroActual')::bigint
      else 0
    end;

    v_registry := lpad((v_registry_current + 1)::text, 6, '0');
    v_params := v_params || jsonb_build_object('numeroRegistroActual', v_registry);
  end if;

  if exists (
    select 1
    from public.funerals f
    where f.parish_id = v_parish
      and f.numero_registro = v_registry
  ) then
    raise exception 'El N.º de Registro de Exequias % ya está utilizado', v_registry;
  end if;

  insert into public.funerals(
    parish_id,
    book_number,
    folio,
    number,
    numero_registro,
    book_type,
    status,
    nombres,
    apellidos,
    document_id,
    sexo,
    fecha_nacimiento,
    lugar_nacimiento,
    fecha_defuncion,
    lugar_defuncion,
    fecha_exequias,
    hora_exequias,
    lugar_exequias,
    cementerio,
    causa_muerte,
    nombre_padre,
    nombre_madre,
    conyuge,
    ministro,
    da_fe,
    observations,
    nota_marginal,
    raw_data
  )
  values(
    v_parish,
    lpad(v_book::text,4,'0'),
    lpad(v_folio::text,4,'0'),
    lpad(v_number::text,4,'0'),
    v_registry,
    v_book_type,
    'seated',
    nullif(trim(v_data->>'nombres'),''),
    nullif(trim(v_data->>'apellidos'),''),
    nullif(trim(v_data->>'document_id'),''),
    nullif(trim(v_data->>'sexo'),''),
    v_birth_date,
    nullif(trim(v_data->>'lugar_nacimiento'),''),
    v_death_date,
    nullif(trim(v_data->>'lugar_defuncion'),''),
    v_funeral_date,
    v_funeral_time,
    nullif(trim(v_data->>'lugar_exequias'),''),
    nullif(trim(v_data->>'cementerio'),''),
    nullif(v_data->>'causa_muerte',''),
    nullif(trim(v_data->>'nombre_padre'),''),
    nullif(trim(v_data->>'nombre_madre'),''),
    nullif(trim(v_data->>'conyuge'),''),
    nullif(trim(v_data->>'ministro'),''),
    nullif(trim(v_data->>'da_fe'),''),
    nullif(v_data->>'observations',''),
    nullif(v_data->>'nota_marginal',''),
    coalesce(v_data,'{}'::jsonb)
      || jsonb_build_object(
        'book_number', lpad(v_book::text,4,'0'),
        'folio', lpad(v_folio::text,4,'0'),
        'number', lpad(v_number::text,4,'0'),
        'numero_registro', v_registry,
        'numeroRegistro', v_registry,
        'book_type', v_book_type,
        'bookType', v_book_type,
        'status', 'seated',
        'estado', 'permanente'
      )
  )
  returning id into v_funeral_id;

  v_next_book := v_book;
  v_next_folio := v_folio;
  v_next_number := v_number;

  if v_restart then
    if v_next_number >= v_limit then
      v_next_folio := v_next_folio + 1;
      v_next_number := 1;
    else
      v_next_number := v_next_number + 1;
    end if;
  else
    v_next_number := v_next_number + 1;
    if mod(v_next_number - 1, v_limit) = 0 then
      v_next_folio := v_next_folio + 1;
    end if;
  end if;

  if v_book_type = 'suplementario' then
    v_params := v_params
      || jsonb_build_object(
        'suplementarioLibro', v_next_book,
        'suplementarioFolio', v_next_folio,
        'suplementarioNumero', v_next_number
      );
  else
    v_params := v_params
      || jsonb_build_object(
        'ordinarioLibro', v_next_book,
        'ordinarioFolio', v_next_folio,
        'ordinarioNumero', v_next_number,

        -- compatibilidad con frontend antiguo
        'libro', v_next_book,
        'folio', v_next_folio,
        'numero', v_next_number
      );
  end if;

  update public.parish_parameters
  set exequias_params = v_params,
      updated_at = now()
  where id = v_params_row.id;

  if p_pending_id is not null then
    update public.pending_funerals
    set status = 'seated',
        reportado = true,
        raw_data = coalesce(raw_data,'{}'::jsonb)
          || jsonb_build_object(
            'status','seated',
            'estado','permanente',
            'funeral_id',v_funeral_id,
            'book_number',lpad(v_book::text,4,'0'),
            'folio',lpad(v_folio::text,4,'0'),
            'number',lpad(v_number::text,4,'0'),
            'numero_registro',v_registry,
            'book_type',v_book_type
          ),
        updated_at = now()
    where id = p_pending_id
      and parish_id = v_parish
      and status = 'pending'
      and reportado = false;

    if not found then
      raise exception 'El pendiente de Exequias ya no está disponible';
    end if;
  end if;

  insert into public.registry_audit_log(
    actor_user_id,
    parish_id,
    diocese_id,
    entity_type,
    entity_id,
    action,
    after_data,
    metadata
  )
  values(
    auth.uid(),
    v_parish,
    v_diocese,
    'exequias',
    v_funeral_id,
    'seat',
    v_data
      || jsonb_build_object(
        'book_number',lpad(v_book::text,4,'0'),
        'folio',lpad(v_folio::text,4,'0'),
        'number',lpad(v_number::text,4,'0'),
        'numero_registro',v_registry,
        'book_type',v_book_type
      ),
    jsonb_build_object(
      'pending_id',p_pending_id,
      'numero_registro',v_registry,
      'book_type',v_book_type
    )
  );

  return query
  select
    v_funeral_id,
    lpad(v_book::text,4,'0'),
    lpad(v_folio::text,4,'0'),
    lpad(v_number::text,4,'0'),
    v_next_book,
    v_next_folio,
    v_next_number;
end;
$function$;

CREATE OR REPLACE FUNCTION public.seat_pending_marriage(p_pending_id uuid)
 RETURNS TABLE(marriage_id uuid, book_number text, folio text, number text, next_book integer, next_folio integer, next_number integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_role text;
  v_parish uuid;
  v_diocese uuid;
  v_pending public.pending_marriages%rowtype;
  v_params_row public.parish_parameters%rowtype;
  v_params jsonb;
  v_book_type text;

  v_book integer;
  v_folio integer;
  v_number integer;
  v_limit integer;
  v_restart boolean;

  v_next_book integer;
  v_next_folio integer;
  v_next_number integer;

  v_marriage_id uuid;
  v_date date;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select lower(coalesce(up.role,'')),up.parish_id,up.diocese_id
    into v_role,v_parish,v_diocese
  from public.user_profiles up
  where up.auth_user_id=auth.uid()
    and up.is_active IS TRUE AND upper(up.status)='ACTIVE' AND up.diocese_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.parishes v178_parish WHERE v178_parish.id=up.parish_id AND v178_parish.diocese_id=up.diocese_id)
  limit 1;

  if v_role <> 'parish' or v_parish is null then
    raise exception 'Sólo una parroquia activa puede asentar matrimonios';
  end if;

  -- V204: acquire the common parish numbering lock before a pending-row lock.
  SELECT * INTO v_params_row
  FROM public.parish_parameters pp
  WHERE pp.parish_id = v_parish
  ORDER BY pp.created_at NULLS LAST
  LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La parroquia no tiene parámetros de Matrimonio configurados';
  END IF;

  select * into v_pending
  from public.pending_marriages pm
  where pm.id=p_pending_id
    and pm.parish_id=v_parish
  for update;

  if not found then
    raise exception 'Expediente matrimonial pendiente no encontrado';
  end if;

  if lower(coalesce(v_pending.status,'pending')) <> 'pending'
     or coalesce(v_pending.reportado,false)=true then
    raise exception 'El expediente matrimonial ya fue procesado';
  end if;

  v_date := v_pending.celebration_date;
  if v_date is null then
    begin
      v_date := coalesce(
        nullif(left(v_pending.raw_data->>'fechaSacramento',10),'')::date,
        nullif(left(v_pending.raw_data->>'fechaMatrimonio',10),'')::date,
        nullif(left(v_pending.raw_data->>'fechaHoraPrevista',10),'')::date
      );
    exception when others then
      v_date := null;
    end;
  end if;

  if v_date is null then
    raise exception 'La fecha del matrimonio es obligatoria';
  end if;

  select * into v_params_row
  from public.parish_parameters pp
  where pp.parish_id=v_parish
  order by pp.created_at nulls last
  limit 1
  for update;

  if not found then
    raise exception 'La parroquia no tiene parámetros de Matrimonio configurados';
  end if;

  v_params := public.sacramentum_default_marriage_params()
              || coalesce(v_params_row.matrimonios_params,'{}'::jsonb);

  v_book_type := lower(coalesce(
    nullif(v_pending.book_type,''),
    nullif(v_pending.raw_data->>'bookType',''),
    nullif(v_pending.raw_data->>'book_type',''),
    'ordinario'
  ));

  if v_book_type not in ('ordinario','suplementario') then
    raise exception 'Tipo de libro matrimonial no válido: %',v_book_type;
  end if;

  if v_book_type='suplementario' then
    v_book := greatest(1,coalesce(nullif(v_params->>'suplementarioLibro','')::integer,1));
    v_folio := greatest(1,coalesce(nullif(v_params->>'suplementarioFolio','')::integer,1));
    v_number := greatest(1,coalesce(nullif(v_params->>'suplementarioNumero','')::integer,1));
    v_limit := greatest(1,coalesce(nullif(v_params->>'suplementarioPartidas','')::integer,1));
    v_restart := coalesce((v_params->>'suplementarioReiniciar')::boolean,false);
  else
    v_book := greatest(1,coalesce(nullif(v_params->>'ordinarioLibro','')::integer,1));
    v_folio := greatest(1,coalesce(nullif(v_params->>'ordinarioFolio','')::integer,1));
    v_number := greatest(1,coalesce(nullif(v_params->>'ordinarioNumero','')::integer,1));
    v_limit := greatest(1,coalesce(nullif(v_params->>'ordinarioPartidas','')::integer,1));
    v_restart := coalesce((v_params->>'ordinarioRestartNumber')::boolean,false);
  end if;

  if exists(
    select 1
    from public.marriages m
    where m.parish_id=v_parish
      and m.book_type=v_book_type
      and m.book_number=lpad(v_book::text,4,'0')
      and m.folio=lpad(v_folio::text,4,'0')
      and m.number=lpad(v_number::text,4,'0')
  ) then
    raise exception 'El consecutivo de Matrimonio % L %, F %, N % ya está ocupado. Recargue los parámetros.',
      upper(v_book_type),v_book,v_folio,v_number;
  end if;

  insert into public.marriages(
    parish_id,celebration_date,book_number,folio,number,
    observations,status,raw_data,book_type
  )
  values(
    v_parish,v_date,
    lpad(v_book::text,4,'0'),
    lpad(v_folio::text,4,'0'),
    lpad(v_number::text,4,'0'),
    coalesce(v_pending.raw_data->>'observations',v_pending.raw_data->>'observaciones'),
    'seated',
    coalesce(v_pending.raw_data,'{}'::jsonb) || jsonb_build_object(
      'book_type',v_book_type,
      'bookType',v_book_type,
      'tipoLibro',v_book_type,
      'book_number',lpad(v_book::text,4,'0'),
      'page_number',lpad(v_folio::text,4,'0'),
      'entry_number',lpad(v_number::text,4,'0'),
      'libro',lpad(v_book::text,4,'0'),
      'folio',lpad(v_folio::text,4,'0'),
      'numero',lpad(v_number::text,4,'0'),
      'status','seated'
    ),
    v_book_type
  )
  returning id into v_marriage_id;

  v_next_book:=v_book;
  v_next_folio:=v_folio;
  v_next_number:=v_number;

  if v_restart then
    if v_next_number >= v_limit then
      v_next_folio:=v_next_folio+1;
      v_next_number:=1;
    else
      v_next_number:=v_next_number+1;
    end if;
  else
    v_next_number:=v_next_number+1;
    if mod(v_next_number-1,v_limit)=0 then
      v_next_folio:=v_next_folio+1;
    end if;
  end if;

  if v_book_type='suplementario' then
    v_params := jsonb_set(
      jsonb_set(
        jsonb_set(v_params,'{suplementarioLibro}',to_jsonb(v_next_book),true),
        '{suplementarioFolio}',to_jsonb(v_next_folio),true
      ),
      '{suplementarioNumero}',to_jsonb(v_next_number),true
    );
  else
    v_params := jsonb_set(
      jsonb_set(
        jsonb_set(v_params,'{ordinarioLibro}',to_jsonb(v_next_book),true),
        '{ordinarioFolio}',to_jsonb(v_next_folio),true
      ),
      '{ordinarioNumero}',to_jsonb(v_next_number),true
    );
  end if;

  update public.parish_parameters pp
  set matrimonios_params=v_params,
      updated_at=now()
  where pp.id=v_params_row.id;

  update public.pending_marriages pm
  set status='seated',
      reportado=true,
      book_type=v_book_type,
      raw_data=coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
        'book_type',v_book_type,
        'bookType',v_book_type,
        'tipoLibro',v_book_type,
        'record_id',v_marriage_id
      ),
      updated_at=now()
  where pm.id=v_pending.id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,
    action,after_data,metadata
  )
  values(
    auth.uid(),v_parish,v_diocese,'matrimonio',v_marriage_id,'seat',
    v_pending.raw_data || jsonb_build_object(
      'book_type',v_book_type,
      'book_number',lpad(v_book::text,4,'0'),
      'folio',lpad(v_folio::text,4,'0'),
      'number',lpad(v_number::text,4,'0')
    ),
    jsonb_build_object(
      'pending_id',v_pending.id,
      'book_type',v_book_type
    )
  );

  return query
  select
    v_marriage_id,
    lpad(v_book::text,4,'0'),
    lpad(v_folio::text,4,'0'),
    lpad(v_number::text,4,'0'),
    v_next_book,
    v_next_folio,
    v_next_number;
end;
$function$;

INSERT INTO public.parishes VALUES('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',true);
INSERT INTO public.user_profiles VALUES('00000000-0000-4000-8000-000000000003','parish','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',true,'ACTIVE');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
SELECT public.sacramentum_ensure_parish_parameters('00000000-0000-4000-8000-000000000001');
