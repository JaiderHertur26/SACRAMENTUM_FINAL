-- SACRAMENTUM · FASE 5A · BAUTISMO CLOUD-NATIVE
-- 2026-09-07
-- Objetivos:
--   1) Toda parroquia nace con parámetros sacramentales seguros.
--   2) El número de registro del borrador se reserva atómicamente en PostgreSQL.
--   3) El asentamiento usa el borrador de Supabase como fuente de verdad,
--      conserva todos los campos sacramentales y protege el consecutivo.
--   4) La edición de parámetros no puede pisar un consecutivo que cambió en otra sesión.

begin;

-- ---------------------------------------------------------------------------
-- 1. Defaults canónicos
-- ---------------------------------------------------------------------------
create or replace function public.sacramentum_default_baptism_params()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'ordinarioBlocked', false,
    'ordinarioRestartNumber', false,
    'ordinarioPartidas', 2,
    'ordinarioLibro', 1,
    'ordinarioFolio', 1,
    'ordinarioNumero', 1,
    'numeroRegistroActual', '000000',
    'suplementarioBlocked', false,
    'suplementarioReiniciar', false,
    'suplementarioPartidas', 2,
    'suplementarioLibro', 1,
    'suplementarioFolio', 1,
    'suplementarioNumero', 1,
    'registroAdultoEn', 'ordinario',
    'registroDecretoEn', 'suplementario',
    'generarNotaMarginal', true,
    'inscripcionNumero', '',
    'inscripcionFecha', '',
    'inscripcionFormato', ''
  );
$$;

create or replace function public.sacramentum_default_confirmation_params()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'ordinarioLibro',1,'ordinarioFolio',1,'ordinarioNumero',1,'ordinarioPartidas',2,
    'ordinarioRestartNumber',false,'ordinarioBlocked',false,'numeroRegistroActual','000000',
    'suplementarioLibro',1,'suplementarioFolio',1,'suplementarioNumero',1,'suplementarioPartidas',2,
    'suplementarioReiniciar',false,'suplementarioBlocked',false,
    'registroRegularEn','ordinario','registroDecretoEn','suplementario','generarNotaMarginal',true
  );
$$;

create or replace function public.sacramentum_default_marriage_params()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'ordinarioLibro',1,'ordinarioFolio',1,'ordinarioNumero',1,
    'ordinarioPartidas',1,'ordinarioRestartNumber',false
  );
$$;

create or replace function public.sacramentum_default_funeral_params()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'libro',1,'folio',1,'numero',1,'partidasPorFolio',2,'reiniciarNumeroEnFolio',false
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Bootstrap interno de parámetros por parroquia
-- ---------------------------------------------------------------------------
create or replace function public.sacramentum_ensure_parish_parameters(p_parish_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if p_parish_id is null then
    raise exception 'Parroquia no válida';
  end if;

  if not exists(select 1 from public.parishes where id=p_parish_id) then
    raise exception 'Parroquia no encontrada';
  end if;

  if not exists(select 1 from public.parish_parameters where parish_id=p_parish_id) then
    begin
      insert into public.parish_parameters(
        id,parish_id,bautizos_params,confirmaciones_params,matrimonios_params,exequias_params
      ) values (
        gen_random_uuid(),p_parish_id,
        public.sacramentum_default_baptism_params(),
        public.sacramentum_default_confirmation_params(),
        public.sacramentum_default_marriage_params(),
        public.sacramentum_default_funeral_params()
      );
    exception when unique_violation then
      null;
    end;
  end if;
end;
$$;

revoke all on function public.sacramentum_ensure_parish_parameters(uuid) from public;
revoke all on function public.sacramentum_ensure_parish_parameters(uuid) from authenticated;

-- Parroquias existentes sin parámetros: sólo es seguro autoinicializar si no
-- tienen Bautismos permanentes. Si existieran, el preflight debe detener Fase 5A.
do $$
begin
  if exists(
    select 1
    from public.parishes p
    where not exists(select 1 from public.parish_parameters pp where pp.parish_id=p.id)
      and exists(select 1 from public.baptisms b where b.parish_id=p.id)
  ) then
    raise exception 'Fase 5A detenida: existe una parroquia con Bautismos permanentes pero sin parish_parameters. Revisar consecutivos antes de continuar.';
  end if;
end;
$$;

insert into public.parish_parameters(
  id,parish_id,bautizos_params,confirmaciones_params,matrimonios_params,exequias_params
)
select
  gen_random_uuid(),p.id,
  public.sacramentum_default_baptism_params(),
  public.sacramentum_default_confirmation_params(),
  public.sacramentum_default_marriage_params(),
  public.sacramentum_default_funeral_params()
from public.parishes p
where not exists(select 1 from public.parish_parameters pp where pp.parish_id=p.id);

-- Si había números de registro numéricos ya usados, nunca dejamos el contador
-- por debajo del máximo observado.
with max_regs as (
  select parish_id,max(reg_num) as max_reg
  from (
    select parish_id,numero_registro::bigint as reg_num
    from public.baptisms
    where numero_registro ~ '^[0-9]+$'
    union all
    select parish_id,(raw_data->>'numeroRegistro')::bigint as reg_num
    from public.pending_baptisms
    where coalesce(raw_data->>'numeroRegistro','') ~ '^[0-9]+$'
  ) x
  group by parish_id
)
update public.parish_parameters pp
set bautizos_params=jsonb_set(
      coalesce(pp.bautizos_params,public.sacramentum_default_baptism_params()),
      '{numeroRegistroActual}',
      to_jsonb(lpad(m.max_reg::text,6,'0')),
      true
    ),
    updated_at=now()
from max_regs m
where pp.parish_id=m.parish_id
  and coalesce(nullif(regexp_replace(coalesce(pp.bautizos_params->>'numeroRegistroActual',''),'[^0-9]','','g'),''),'0')::bigint < m.max_reg;

-- Trigger para toda nueva parroquia, sin depender del frontend ni de Edge Function.
create or replace function public.sacramentum_bootstrap_new_parish_parameters()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.sacramentum_ensure_parish_parameters(new.id);
  return new;
end;
$$;

drop trigger if exists trg_sacramentum_bootstrap_parish_parameters on public.parishes;
create trigger trg_sacramentum_bootstrap_parish_parameters
after insert on public.parishes
for each row execute function public.sacramentum_bootstrap_new_parish_parameters();

-- ---------------------------------------------------------------------------
-- 3. Crear borrador de Bautismo + reservar Nº Registro en una sola transacción
-- ---------------------------------------------------------------------------
create or replace function public.create_pending_baptism(
  p_parish_id uuid,
  p_record jsonb
)
returns table(pending_id uuid,numero_registro text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text;
  v_user_parish uuid;
  v_diocese uuid;
  v_params_row public.parish_parameters%rowtype;
  v_params jsonb;
  v_last_reg bigint;
  v_next_reg bigint;
  v_reg_text text;
  v_id uuid:=gen_random_uuid();
  v_raw jsonb;
  v_date_text text;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if p_parish_id is null then raise exception 'No se pudo determinar la parroquia'; end if;
  if p_record is null or jsonb_typeof(p_record)<>'object' then raise exception 'El registro de Bautismo no es válido'; end if;

  select lower(coalesce(up.role,'')),up.parish_id,up.diocese_id
    into v_role,v_user_parish,v_diocese
  from public.user_profiles up
  where up.auth_user_id=auth.uid() and coalesce(up.is_active,true)=true
  limit 1;

  if v_role<>'parish' or v_user_parish is distinct from p_parish_id then
    raise exception 'Sólo la parroquia propietaria puede crear borradores de Bautismo';
  end if;

  if nullif(trim(coalesce(p_record->>'nombres','')),'') is null
     or nullif(trim(coalesce(p_record->>'apellidos','')),'') is null then
    raise exception 'Nombres y apellidos son obligatorios';
  end if;

  v_date_text:=coalesce(nullif(p_record->>'fechaSacramento',''),nullif(p_record->>'celebration_date',''));
  if v_date_text is null then raise exception 'La fecha del Bautismo es obligatoria'; end if;
  begin
    perform v_date_text::date;
  exception when others then
    raise exception 'La fecha del Bautismo no es válida';
  end;

  perform public.sacramentum_ensure_parish_parameters(p_parish_id);
  select * into v_params_row
  from public.parish_parameters
  where parish_id=p_parish_id
  for update;

  if not found then raise exception 'No fue posible inicializar los parámetros de Bautismo'; end if;
  v_params:=coalesce(v_params_row.bautizos_params,public.sacramentum_default_baptism_params());

  v_last_reg:=coalesce(
    nullif(regexp_replace(coalesce(v_params->>'numeroRegistroActual',''),'[^0-9]','','g'),'')::bigint,
    0
  );
  v_next_reg:=v_last_reg+1;
  v_reg_text:=lpad(v_next_reg::text,6,'0');

  v_raw:=coalesce(p_record,'{}'::jsonb)||jsonb_build_object(
    'id',v_id,
    'parishId',p_parish_id,
    'parish_id',p_parish_id,
    'numeroRegistro',v_reg_text,
    'numero_registro',v_reg_text,
    'status','pending',
    'estado','pending'
  );

  insert into public.pending_baptisms(id,parish_id,status,reportado,raw_data,created_at)
  values(v_id,p_parish_id,'pending',false,v_raw,now());

  v_params:=jsonb_set(v_params,'{numeroRegistroActual}',to_jsonb(v_reg_text),true);
  update public.parish_parameters
  set bautizos_params=v_params,updated_at=now()
  where id=v_params_row.id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values(
    auth.uid(),p_parish_id,v_diocese,'pending_baptism',v_id,'create_pending',v_raw,
    jsonb_build_object('numero_registro',v_reg_text)
  );

  return query select v_id,v_reg_text;
end;
$$;

revoke all on function public.create_pending_baptism(uuid,jsonb) from public;
grant execute on function public.create_pending_baptism(uuid,jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Guardado seguro de parámetros de Bautismo
-- ---------------------------------------------------------------------------
create or replace function public.save_baptism_parameters(
  p_parish_id uuid,
  p_params jsonb,
  p_expected_book integer default null,
  p_expected_folio integer default null,
  p_expected_number integer default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text;
  v_user_parish uuid;
  v_row public.parish_parameters%rowtype;
  v_current jsonb;
  v_new jsonb;
  v_book integer;
  v_folio integer;
  v_number integer;
  v_limit integer;
  v_reg bigint;
  v_max_reg bigint:=0;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if p_parish_id is null then raise exception 'Parroquia no válida'; end if;
  if p_params is null or jsonb_typeof(p_params)<>'object' then raise exception 'Parámetros de Bautismo no válidos'; end if;

  select lower(coalesce(role,'')),parish_id into v_role,v_user_parish
  from public.user_profiles
  where auth_user_id=auth.uid() and coalesce(is_active,true)=true
  limit 1;

  if v_role<>'parish' or v_user_parish is distinct from p_parish_id then
    raise exception 'Sólo la parroquia propietaria puede modificar sus parámetros de Bautismo';
  end if;

  perform public.sacramentum_ensure_parish_parameters(p_parish_id);
  select * into v_row from public.parish_parameters where parish_id=p_parish_id for update;
  if not found then raise exception 'Parámetros de la parroquia no encontrados'; end if;

  v_current:=coalesce(v_row.bautizos_params,public.sacramentum_default_baptism_params());

  if p_expected_book is not null and greatest(coalesce(nullif(v_current->>'ordinarioLibro','')::integer,1),1)<>p_expected_book then
    raise exception 'El Libro cambió en otra sesión. Recargue los parámetros.';
  end if;
  if p_expected_folio is not null and greatest(coalesce(nullif(v_current->>'ordinarioFolio','')::integer,1),1)<>p_expected_folio then
    raise exception 'El Folio cambió en otra sesión. Recargue los parámetros.';
  end if;
  if p_expected_number is not null and greatest(coalesce(nullif(v_current->>'ordinarioNumero','')::integer,1),1)<>p_expected_number then
    raise exception 'El Número cambió en otra sesión. Recargue los parámetros.';
  end if;

  v_new:=public.sacramentum_default_baptism_params()||v_current||p_params;
  v_book:=greatest(coalesce(nullif(v_new->>'ordinarioLibro','')::integer,1),1);
  v_folio:=greatest(coalesce(nullif(v_new->>'ordinarioFolio','')::integer,1),1);
  v_number:=greatest(coalesce(nullif(v_new->>'ordinarioNumero','')::integer,1),1);
  v_limit:=greatest(coalesce(nullif(v_new->>'ordinarioPartidas','')::integer,2),1);

  if v_limit<1 then raise exception 'Partidas por folio debe ser mayor que cero'; end if;

  if exists(
    select 1 from public.baptisms b
    where b.parish_id=p_parish_id
      and b.book_number=lpad(v_book::text,4,'0')
      and b.folio=lpad(v_folio::text,4,'0')
      and b.number=lpad(v_number::text,4,'0')
  ) then
    raise exception 'El consecutivo propuesto L %, F %, N % ya está ocupado',v_book,v_folio,v_number;
  end if;

  select greatest(
    coalesce((select max(numero_registro::bigint) from public.baptisms where parish_id=p_parish_id and numero_registro ~ '^[0-9]+$'),0),
    coalesce((select max((raw_data->>'numeroRegistro')::bigint) from public.pending_baptisms where parish_id=p_parish_id and coalesce(raw_data->>'numeroRegistro','') ~ '^[0-9]+$'),0)
  ) into v_max_reg;

  v_reg:=coalesce(nullif(regexp_replace(coalesce(v_new->>'numeroRegistroActual',''),'[^0-9]','','g'),'')::bigint,0);
  if v_reg<v_max_reg then
    raise exception 'El Número de Registro no puede retroceder por debajo de %',lpad(v_max_reg::text,6,'0');
  end if;
  v_new:=jsonb_set(v_new,'{numeroRegistroActual}',to_jsonb(lpad(v_reg::text,6,'0')),true);

  update public.parish_parameters
  set bautizos_params=v_new,updated_at=now()
  where id=v_row.id;

  return v_new;
end;
$$;

revoke all on function public.save_baptism_parameters(uuid,jsonb,integer,integer,integer) from public;
grant execute on function public.save_baptism_parameters(uuid,jsonb,integer,integer,integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Asentamiento ordinario atómico y completo
-- ---------------------------------------------------------------------------
create or replace function public.seat_baptism_records(
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
  where auth_user_id=auth.uid() and coalesce(is_active,true)=true
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
    set reportado=true,status='seated',raw_data=v_final_raw
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
$$;

revoke all on function public.seat_baptism_records(uuid,jsonb,integer,integer,integer) from public;
grant execute on function public.seat_baptism_records(uuid,jsonb,integer,integer,integer) to authenticated;

commit;
