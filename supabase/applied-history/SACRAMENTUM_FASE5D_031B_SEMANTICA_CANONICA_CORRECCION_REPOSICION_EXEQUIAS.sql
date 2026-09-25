-- SACRAMENTUM · FASE 5D · 031B
-- EXEQUIAS · SEMÁNTICA CANÓNICA DE DECRETOS
-- Corrección = anula la partida existente + crea nueva partida supletoria.
-- Reposición = NO parte de una partida existente; reconstruye una partida perdida/no asentada
--              cuando existe evidencia de que las Exequias sí ocurrieron.
-- Fecha: 2026-09-13
--
-- IMPORTANTE:
-- - Esta migración NO crea decretos ni consume consecutivos por sí sola.
-- - Sustituye la semántica de 031 antes de realizar cualquier QA de decretos de Exequias.
-- - Si ya existiera un decreto de Exequias emitido con la semántica anterior, aborta.

begin;

-- ============================================================
-- 0. BLOQUEO DE SEGURIDAD
-- ============================================================

do $$
begin
  if exists (
    select 1
    from public.decretos d
    where lower(coalesce(d.sacrament_type,'')) = 'exequias'
      and lower(coalesce(d.status,'active')) <> 'reversed'
  ) then
    raise exception
      '031B abortada: ya existen decretos activos de Exequias. Revise esos expedientes antes de cambiar la semántica.';
  end if;
end;
$$;

-- ============================================================
-- AUXILIAR INTERNO: reserva atómica de Libro/Folio/Número
-- Supletorio + N.º Registro. Devuelve la ubicación consumida.
-- ============================================================

create or replace function public.sacramentum_allocate_funeral_supplementary(
  p_parish_id uuid
)
returns table(
  book_number text,
  folio text,
  number text,
  numero_registro text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_params_row public.parish_parameters%rowtype;
  v_params jsonb;
  v_book integer;
  v_folio integer;
  v_number integer;
  v_limit integer;
  v_restart boolean;
  v_blocked boolean;
  v_next_book integer;
  v_next_folio integer;
  v_next_number integer;
  v_registry bigint;
  v_registry_text text;
begin
  perform public.ensure_parish_parameters(p_parish_id);

  select *
  into v_params_row
  from public.parish_parameters pp
  where pp.parish_id = p_parish_id
  order by pp.created_at nulls last
  limit 1
  for update;

  if not found then
    raise exception 'No fue posible obtener los parámetros parroquiales de Exequias';
  end if;

  v_params := coalesce(v_params_row.exequias_params,'{}'::jsonb);

  begin
    v_book := greatest(1,coalesce(nullif(v_params->>'suplementarioLibro','')::integer,1));
    v_folio := greatest(1,coalesce(nullif(v_params->>'suplementarioFolio','')::integer,1));
    v_number := greatest(1,coalesce(nullif(v_params->>'suplementarioNumero','')::integer,1));
    v_limit := greatest(1,coalesce(nullif(v_params->>'suplementarioPartidas','')::integer,2));
    v_restart := coalesce(nullif(v_params->>'suplementarioReiniciar','')::boolean,false);
    v_blocked := coalesce(nullif(v_params->>'suplementarioBlocked','')::boolean,false);
  exception when others then
    raise exception 'Los parámetros supletorios de Exequias contienen valores inválidos';
  end;

  if v_blocked then
    raise exception 'El Libro Supletorio de Exequias está bloqueado';
  end if;

  if exists (
    select 1
    from public.funerals f
    where f.parish_id = p_parish_id
      and f.book_type = 'suplementario'
      and f.book_number = lpad(v_book::text,4,'0')
      and f.folio = lpad(v_folio::text,4,'0')
      and f.number = lpad(v_number::text,4,'0')
  ) then
    raise exception
      'El consecutivo supletorio L-%, F-%, N-% ya está ocupado. Revise los parámetros.',
      lpad(v_book::text,4,'0'), lpad(v_folio::text,4,'0'), lpad(v_number::text,4,'0');
  end if;

  begin
    v_registry := coalesce(nullif(v_params->>'numeroRegistroActual','')::bigint,0) + 1;
  exception when others then
    v_registry := 1;
  end;

  v_registry_text := lpad(v_registry::text,6,'0');

  if exists (
    select 1 from public.funerals f
    where f.parish_id = p_parish_id
      and f.numero_registro = v_registry_text
  ) or exists (
    select 1 from public.pending_funerals pf
    where pf.parish_id = p_parish_id
      and pf.numero_registro = v_registry_text
  ) then
    raise exception
      'El N.º de Registro % ya está ocupado. Recargue los parámetros.',
      v_registry_text;
  end if;

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
    if mod(v_next_number - 1,v_limit) = 0 then
      v_next_folio := v_next_folio + 1;
    end if;
  end if;

  update public.parish_parameters
  set
    exequias_params =
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              v_params,
              '{numeroRegistroActual}',
              to_jsonb(v_registry_text),
              true
            ),
            '{suplementarioLibro}',
            to_jsonb(v_next_book),
            true
          ),
          '{suplementarioFolio}',
          to_jsonb(v_next_folio),
          true
        ),
        '{suplementarioNumero}',
        to_jsonb(v_next_number),
        true
      ),
    updated_at = now()
  where id = v_params_row.id;

  return query
  select
    lpad(v_book::text,4,'0'),
    lpad(v_folio::text,4,'0'),
    lpad(v_number::text,4,'0'),
    v_registry_text;
end;
$function$;

revoke all on function public.sacramentum_allocate_funeral_supplementary(uuid) from public;
revoke all on function public.sacramentum_allocate_funeral_supplementary(uuid) from anon;
revoke all on function public.sacramentum_allocate_funeral_supplementary(uuid) from authenticated;
grant execute on function public.sacramentum_allocate_funeral_supplementary(uuid) to service_role;

-- ============================================================
-- 1. CORRECCIÓN DE EXEQUIAS
--    EXISTE PARTIDA -> se ANULA -> se crea NUEVA SUPLETORIA.
-- ============================================================

-- Cambia el tipo de retorno respecto de 031; por eso se recrea.
drop function if exists public.apply_funeral_correction(uuid,date,text,jsonb,text);

create function public.apply_funeral_correction(
  p_funeral_id uuid,
  p_decree_date date,
  p_reason text,
  p_changes jsonb,
  p_decree_number text default null
)
returns table(
  decree_id uuid,
  original_funeral_id uuid,
  replacement_funeral_id uuid,
  decree_number text,
  book_number text,
  folio text,
  number text,
  numero_registro text,
  original_note text,
  replacement_note text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text;
  v_user_diocese uuid;
  v_chancery uuid;
  v_original public.funerals%rowtype;
  v_diocese uuid;
  v_parish_name text;
  v_decree_number text;
  v_sequence bigint;
  v_decree_id uuid;
  v_new_id uuid;
  v_loc record;
  v_original_note text;
  v_new_note text;
  v_payload jsonb;
  v_raw jsonb;
  v_birth date;
  v_death date;
  v_funeral date;
  v_hour time;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select lower(coalesce(up.role,'')), up.diocese_id, up.chancery_id
  into v_role, v_user_diocese, v_chancery
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
    and coalesce(up.is_active,true) = true
    and coalesce(up.status,'active') not in ('blocked','disabled','inactive')
  limit 1;

  if v_role not in ('chancery','diocese','admin_general') then
    raise exception 'Sólo Cancillería, Diócesis o Administración General pueden corregir Exequias por decreto';
  end if;

  select f.*
  into v_original
  from public.funerals f
  where f.id = p_funeral_id
  for update;

  if not found then
    raise exception 'Partida original de Exequias no encontrada';
  end if;

  if lower(coalesce(v_original.status,'seated')) in ('anulada','annulled','replaced','reversed') then
    raise exception 'La partida original ya no está disponible para una nueva corrección';
  end if;

  select p.diocese_id, p.name
  into v_diocese, v_parish_name
  from public.parishes p
  where p.id = v_original.parish_id;

  if v_diocese is null then
    raise exception 'La partida no tiene una parroquia con diócesis válida';
  end if;

  if v_role <> 'admin_general' and v_user_diocese is distinct from v_diocese then
    raise exception 'La partida está fuera de la jurisdicción del usuario';
  end if;

  if v_chancery is null then
    select c.id into v_chancery
    from public.chancelleries c
    where c.diocese_id = v_diocese
    order by c.created_at nulls last
    limit 1;
  end if;

  if p_decree_date is null or nullif(trim(coalesce(p_reason,'')),'') is null then
    raise exception 'Fecha y fundamento del decreto son obligatorios';
  end if;

  if p_changes is null
     or jsonb_typeof(p_changes) <> 'object'
     or not exists (select 1 from jsonb_object_keys(p_changes)) then
    raise exception 'La corrección debe contener al menos un dato modificado';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_changes) k(key)
    where k.key not in (
      'nombres','apellidos','document_id','sexo',
      'fecha_nacimiento','lugar_nacimiento',
      'fecha_defuncion','lugar_defuncion',
      'fecha_exequias','hora_exequias','lugar_exequias',
      'cementerio','causa_muerte',
      'nombre_padre','nombre_madre','conyuge',
      'ministro','da_fe','observations',
      'edadDeclarada','tipoEdad','estadoCivil','sacramentosRecibidos'
    )
  ) then
    raise exception 'La corrección contiene campos no autorizados';
  end if;

  begin
    v_birth := case
      when p_changes ? 'fecha_nacimiento' then nullif(p_changes->>'fecha_nacimiento','')::date
      else v_original.fecha_nacimiento
    end;
    v_death := case
      when p_changes ? 'fecha_defuncion' then nullif(p_changes->>'fecha_defuncion','')::date
      else v_original.fecha_defuncion
    end;
    v_funeral := case
      when p_changes ? 'fecha_exequias' then nullif(p_changes->>'fecha_exequias','')::date
      else v_original.fecha_exequias
    end;
    v_hour := case
      when p_changes ? 'hora_exequias' then nullif(p_changes->>'hora_exequias','')::time
      else v_original.hora_exequias
    end;
  exception when others then
    raise exception 'Una de las fechas u horas corregidas es inválida';
  end;

  if v_death is null then
    raise exception 'La fecha de defunción no puede quedar vacía';
  end if;
  if v_birth is not null and v_birth > v_death then
    raise exception 'La fecha de nacimiento no puede ser posterior a la fecha de defunción';
  end if;
  if v_funeral is not null and v_funeral < v_death then
    raise exception 'La fecha de Exequias no puede ser anterior a la fecha de defunción';
  end if;

  v_decree_number := nullif(upper(trim(coalesce(p_decree_number,''))), '');

  if v_decree_number is null then
    insert into public.document_sequences(scope_id,document_type,current_value)
    values(
      v_diocese,
      'decreto_exequias_' || extract(year from p_decree_date)::integer,
      1
    )
    on conflict(scope_id,document_type)
    do update set
      current_value = public.document_sequences.current_value + 1,
      updated_at = now()
    returning current_value into v_sequence;

    v_decree_number :=
      'DEX-' || extract(year from p_decree_date)::integer || '-' || lpad(v_sequence::text,6,'0');
  end if;

  if exists (
    select 1 from public.decretos d
    where d.diocese_id = v_diocese
      and lower(coalesce(d.status,'active')) <> 'reversed'
      and lower(trim(coalesce(d.decree_number,''))) = lower(v_decree_number)
  ) then
    raise exception 'El número de decreto % ya existe en esta diócesis', v_decree_number;
  end if;

  select * into v_loc
  from public.sacramentum_allocate_funeral_supplementary(v_original.parish_id);

  v_original_note :=
    'PARTIDA ANULADA POR CORRECCIÓN MEDIANTE DECRETO ' || v_decree_number ||
    ' DE FECHA ' || p_decree_date::text ||
    '. NUEVA PARTIDA SUPLETORIA: LIBRO ' || v_loc.book_number ||
    ', FOLIO ' || v_loc.folio || ', NÚMERO ' || v_loc.number || '. ' ||
    upper(trim(p_reason));

  v_new_note :=
    'PARTIDA SUPLETORIA CREADA POR CORRECCIÓN MEDIANTE DECRETO ' || v_decree_number ||
    ' DE FECHA ' || p_decree_date::text ||
    '. SUSTITUYE LA PARTIDA ORIGINAL: LIBRO ' || coalesce(v_original.book_number,'—') ||
    ', FOLIO ' || coalesce(v_original.folio,'—') ||
    ', NÚMERO ' || coalesce(v_original.number,'—') || '.';

  v_raw :=
    coalesce(v_original.raw_data,'{}'::jsonb)
    || p_changes
    || jsonb_build_object(
      'source','decree_correction',
      'book_type','suplementario',
      'book_number',v_loc.book_number,
      'folio',v_loc.folio,
      'number',v_loc.number,
      'numero_registro',v_loc.numero_registro,
      'correctionDecree',v_decree_number,
      'correctionDecreeDate',p_decree_date,
      'correctionReason',trim(p_reason),
      'originalFuneralId',p_funeral_id,
      'originalBook',v_original.book_number,
      'originalFolio',v_original.folio,
      'originalNumber',v_original.number,
      'notaMarginal',v_new_note
    );

  insert into public.funerals(
    parish_id,book_id,parishioner_id,celebrant_id,
    book_number,folio,number,status,
    nombres,apellidos,document_id,sexo,
    fecha_nacimiento,lugar_nacimiento,
    fecha_defuncion,lugar_defuncion,
    fecha_exequias,hora_exequias,lugar_exequias,
    cementerio,causa_muerte,
    nombre_padre,nombre_madre,conyuge,
    ministro,da_fe,observations,nota_marginal,
    raw_data,numero_registro,book_type
  ) values (
    v_original.parish_id,v_original.book_id,v_original.parishioner_id,v_original.celebrant_id,
    v_loc.book_number,v_loc.folio,v_loc.number,'seated',
    case when p_changes ? 'nombres' then nullif(trim(p_changes->>'nombres'),'') else v_original.nombres end,
    case when p_changes ? 'apellidos' then nullif(trim(p_changes->>'apellidos'),'') else v_original.apellidos end,
    case when p_changes ? 'document_id' then nullif(trim(p_changes->>'document_id'),'') else v_original.document_id end,
    case when p_changes ? 'sexo' then nullif(trim(p_changes->>'sexo'),'') else v_original.sexo end,
    v_birth,
    case when p_changes ? 'lugar_nacimiento' then nullif(trim(p_changes->>'lugar_nacimiento'),'') else v_original.lugar_nacimiento end,
    v_death,
    case when p_changes ? 'lugar_defuncion' then nullif(trim(p_changes->>'lugar_defuncion'),'') else v_original.lugar_defuncion end,
    v_funeral,
    v_hour,
    case when p_changes ? 'lugar_exequias' then nullif(trim(p_changes->>'lugar_exequias'),'') else v_original.lugar_exequias end,
    case when p_changes ? 'cementerio' then nullif(trim(p_changes->>'cementerio'),'') else v_original.cementerio end,
    case when p_changes ? 'causa_muerte' then nullif(p_changes->>'causa_muerte','') else v_original.causa_muerte end,
    case when p_changes ? 'nombre_padre' then nullif(trim(p_changes->>'nombre_padre'),'') else v_original.nombre_padre end,
    case when p_changes ? 'nombre_madre' then nullif(trim(p_changes->>'nombre_madre'),'') else v_original.nombre_madre end,
    case when p_changes ? 'conyuge' then nullif(trim(p_changes->>'conyuge'),'') else v_original.conyuge end,
    case when p_changes ? 'ministro' then nullif(trim(p_changes->>'ministro'),'') else v_original.ministro end,
    case when p_changes ? 'da_fe' then nullif(trim(p_changes->>'da_fe'),'') else v_original.da_fe end,
    case when p_changes ? 'observations' then nullif(p_changes->>'observations','') else v_original.observations end,
    v_new_note,
    v_raw,
    v_loc.numero_registro,
    'suplementario'
  ) returning id into v_new_id;

  update public.funerals
  set
    status = 'anulada',
    nota_marginal = concat_ws(E'\n\n',nullif(nota_marginal,''),v_original_note),
    raw_data = coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
      'status','anulada',
      'annulledByCorrection',true,
      'correctionReplacementId',v_new_id,
      'correctionDecree',v_decree_number,
      'correctionDecreeDate',p_decree_date,
      'notaMarginal',concat_ws(E'\n\n',nullif(nota_marginal,''),v_original_note)
    ),
    updated_at = now()
  where id = p_funeral_id;

  v_payload := jsonb_build_object(
    'decreeNumber',v_decree_number,
    'decreeDate',p_decree_date,
    'sacramentType','exequias',
    'sacramento','exequias',
    'decreeType','correccion',
    'targetName',trim(concat_ws(' ',v_original.nombres,v_original.apellidos)),
    'parishName',v_parish_name,
    'reason',trim(p_reason),
    'before',to_jsonb(v_original),
    'changes',p_changes,
    'originalStatus',coalesce(v_original.status,'seated'),
    'originalRecordId',p_funeral_id,
    'replacementRecordId',v_new_id,
    'originalLocation',jsonb_build_object(
      'bookType',v_original.book_type,
      'book',v_original.book_number,
      'folio',v_original.folio,
      'number',v_original.number,
      'numeroRegistro',v_original.numero_registro
    ),
    'replacementLocation',jsonb_build_object(
      'bookType','suplementario',
      'book',v_loc.book_number,
      'folio',v_loc.folio,
      'number',v_loc.number,
      'numeroRegistro',v_loc.numero_registro
    ),
    'originalNote',v_original_note,
    'replacementNote',v_new_note,
    'issuedFrom','chancery'
  );

  insert into public.decretos(
    parish_id,diocese_id,chancery_id,tipo,sacrament_type,
    decree_number,decree_date,original_record_id,replacement_record_id,
    status,issued_by,payload
  ) values (
    v_original.parish_id,v_diocese,v_chancery,'correccion','exequias',
    v_decree_number,p_decree_date,p_funeral_id,v_new_id,
    'active',auth.uid(),v_payload
  ) returning id into v_decree_id;

  insert into public.marginal_notes(
    sacrament_type,note_type,decree_number,content,parish_id,
    sacrament_id,note_date,source_type,source_id,decree_id,created_by
  ) values
  (
    'exequias','correccion_anulada',v_decree_number,v_original_note,
    v_original.parish_id,p_funeral_id,p_decree_date,'decree',v_decree_id,v_decree_id,auth.uid()
  ),
  (
    'exequias','correccion_nueva',v_decree_number,v_new_note,
    v_original.parish_id,v_new_id,p_decree_date,'decree',v_decree_id,v_decree_id,auth.uid()
  );

  insert into public.official_notifications(
    diocese_id,sender_chancery_id,receiver_parish_id,decree_id,
    category,subject,message,status,payload,created_by
  ) values (
    v_diocese,v_chancery,v_original.parish_id,v_decree_id,
    'decree',
    'Decreto de corrección de Exequias ' || v_decree_number,
    'Cancillería anuló la partida original y creó una nueva partida de Exequias en el Libro Supletorio.',
    'pending',
    jsonb_build_object(
      'sacramentType','exequias','decreeType','correccion',
      'decreeNumber',v_decree_number,
      'originalRecordId',p_funeral_id,
      'replacementRecordId',v_new_id
    ),
    auth.uid()
  );

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,
    before_data,after_data,metadata
  ) values
  (
    auth.uid(),v_original.parish_id,v_diocese,'funeral',p_funeral_id,
    'annul_by_correction_decree',to_jsonb(v_original),
    jsonb_build_object('status','anulada','nota_marginal',v_original_note),
    jsonb_build_object('decree_id',v_decree_id,'decree_number',v_decree_number,'replacement_record_id',v_new_id)
  ),
  (
    auth.uid(),v_original.parish_id,v_diocese,'funeral',v_new_id,
    'create_supplementary_by_correction_decree',null,v_raw,
    jsonb_build_object('decree_id',v_decree_id,'decree_number',v_decree_number,'original_record_id',p_funeral_id)
  ),
  (
    auth.uid(),v_original.parish_id,v_diocese,'decree',v_decree_id,
    'issue',null,v_payload,
    jsonb_build_object('sacrament_type','exequias','decree_type','correccion')
  );

  return query select
    v_decree_id,p_funeral_id,v_new_id,v_decree_number,
    v_loc.book_number,v_loc.folio,v_loc.number,v_loc.numero_registro,
    v_original_note,v_new_note;
end;
$function$;

-- ============================================================
-- 2. REPOSICIÓN DE EXEQUIAS
--    NO EXISTE PARTIDA -> evidencia de Exequias -> nueva SUPLETORIA.
-- ============================================================

create or replace function public.create_funeral_reposition_by_decree(
  p_parish_id uuid,
  p_decree_date date,
  p_reason text,
  p_record jsonb,
  p_evidence jsonb,
  p_decree_number text default null
)
returns table(
  decree_id uuid,
  funeral_id uuid,
  decree_number text,
  book_number text,
  folio text,
  number text,
  numero_registro text,
  note_text text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text;
  v_user_diocese uuid;
  v_chancery uuid;
  v_diocese uuid;
  v_parish_name text;
  v_decree_number text;
  v_sequence bigint;
  v_decree_id uuid;
  v_funeral_id uuid;
  v_loc record;
  v_note text;
  v_payload jsonb;
  v_raw jsonb;
  v_birth date;
  v_death date;
  v_funeral date;
  v_hour time;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select lower(coalesce(up.role,'')),up.diocese_id,up.chancery_id
  into v_role,v_user_diocese,v_chancery
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
    and coalesce(up.is_active,true)=true
    and coalesce(up.status,'active') not in ('blocked','disabled','inactive')
  limit 1;

  if v_role not in ('chancery','diocese','admin_general') then
    raise exception 'Sólo Cancillería, Diócesis o Administración General pueden reponer Exequias por decreto';
  end if;

  select p.diocese_id,p.name
  into v_diocese,v_parish_name
  from public.parishes p
  where p.id = p_parish_id;

  if v_diocese is null then
    raise exception 'Parroquia no encontrada o sin diócesis';
  end if;

  if v_role <> 'admin_general' and v_user_diocese is distinct from v_diocese then
    raise exception 'La parroquia está fuera de la jurisdicción del usuario';
  end if;

  if v_chancery is null then
    select c.id into v_chancery
    from public.chancelleries c
    where c.diocese_id=v_diocese
    order by c.created_at nulls last
    limit 1;
  end if;

  if p_decree_date is null or nullif(trim(coalesce(p_reason,'')),'') is null then
    raise exception 'Fecha y fundamento del decreto son obligatorios';
  end if;

  if p_record is null or jsonb_typeof(p_record) <> 'object' then
    raise exception 'Los datos de la partida a reponer son obligatorios';
  end if;

  if p_evidence is null
     or jsonb_typeof(p_evidence) <> 'object'
     or not exists(select 1 from jsonb_object_keys(p_evidence)) then
    raise exception 'La reposición exige registrar la evidencia de que las Exequias sí ocurrieron';
  end if;

  if exists (
    select 1 from jsonb_object_keys(p_record) k(key)
    where k.key not in (
      'nombres','apellidos','document_id','sexo',
      'fecha_nacimiento','lugar_nacimiento',
      'fecha_defuncion','lugar_defuncion',
      'fecha_exequias','hora_exequias','lugar_exequias',
      'cementerio','causa_muerte',
      'nombre_padre','nombre_madre','conyuge',
      'ministro','da_fe','observations',
      'edadDeclarada','tipoEdad','estadoCivil','sacramentosRecibidos'
    )
  ) then
    raise exception 'La reposición contiene campos no autorizados';
  end if;

  v_name := trim(concat_ws(' ',nullif(trim(p_record->>'nombres'),''),nullif(trim(p_record->>'apellidos'),'')));
  if v_name = '' then
    raise exception 'Nombres o apellidos del difunto son obligatorios';
  end if;

  begin
    v_birth := nullif(p_record->>'fecha_nacimiento','')::date;
    v_death := nullif(p_record->>'fecha_defuncion','')::date;
    v_funeral := nullif(p_record->>'fecha_exequias','')::date;
    v_hour := nullif(p_record->>'hora_exequias','')::time;
  exception when others then
    raise exception 'Una de las fechas u horas de la reposición es inválida';
  end;

  if v_death is null then
    raise exception 'La fecha de defunción es obligatoria para una reposición de Exequias';
  end if;
  if v_birth is not null and v_birth > v_death then
    raise exception 'La fecha de nacimiento no puede ser posterior a la fecha de defunción';
  end if;
  if v_funeral is not null and v_funeral < v_death then
    raise exception 'La fecha de Exequias no puede ser anterior a la fecha de defunción';
  end if;

  v_decree_number := nullif(upper(trim(coalesce(p_decree_number,''))), '');

  if v_decree_number is null then
    insert into public.document_sequences(scope_id,document_type,current_value)
    values(
      v_diocese,
      'decreto_exequias_' || extract(year from p_decree_date)::integer,
      1
    )
    on conflict(scope_id,document_type)
    do update set
      current_value = public.document_sequences.current_value + 1,
      updated_at = now()
    returning current_value into v_sequence;

    v_decree_number :=
      'DEX-' || extract(year from p_decree_date)::integer || '-' || lpad(v_sequence::text,6,'0');
  end if;

  if exists (
    select 1 from public.decretos d
    where d.diocese_id = v_diocese
      and lower(coalesce(d.status,'active')) <> 'reversed'
      and lower(trim(coalesce(d.decree_number,''))) = lower(v_decree_number)
  ) then
    raise exception 'El número de decreto % ya existe en esta diócesis',v_decree_number;
  end if;

  select * into v_loc
  from public.sacramentum_allocate_funeral_supplementary(p_parish_id);

  v_note :=
    'PARTIDA DE REPOSICIÓN CREADA MEDIANTE DECRETO ' || v_decree_number ||
    ' DE FECHA ' || p_decree_date::text ||
    '. SE ASIENTA EN LIBRO SUPLETORIO POR EXISTIR EVIDENCIA SUFICIENTE DE LA CELEBRACIÓN DE LAS EXEQUIAS. ' ||
    upper(trim(p_reason));

  v_raw :=
    coalesce(p_record,'{}'::jsonb)
    || jsonb_build_object(
      'source','decree_reposition',
      'book_type','suplementario',
      'book_number',v_loc.book_number,
      'folio',v_loc.folio,
      'number',v_loc.number,
      'numero_registro',v_loc.numero_registro,
      'repositionDecree',v_decree_number,
      'repositionDecreeDate',p_decree_date,
      'repositionReason',trim(p_reason),
      'evidence',p_evidence,
      'notaMarginal',v_note
    );

  insert into public.funerals(
    parish_id,book_number,folio,number,status,
    nombres,apellidos,document_id,sexo,
    fecha_nacimiento,lugar_nacimiento,
    fecha_defuncion,lugar_defuncion,
    fecha_exequias,hora_exequias,lugar_exequias,
    cementerio,causa_muerte,
    nombre_padre,nombre_madre,conyuge,
    ministro,da_fe,observations,nota_marginal,
    raw_data,numero_registro,book_type
  ) values (
    p_parish_id,v_loc.book_number,v_loc.folio,v_loc.number,'seated',
    nullif(trim(p_record->>'nombres'),''),nullif(trim(p_record->>'apellidos'),''),
    nullif(trim(p_record->>'document_id'),''),nullif(trim(p_record->>'sexo'),''),
    v_birth,nullif(trim(p_record->>'lugar_nacimiento'),''),
    v_death,nullif(trim(p_record->>'lugar_defuncion'),''),
    v_funeral,v_hour,nullif(trim(p_record->>'lugar_exequias'),''),
    nullif(trim(p_record->>'cementerio'),''),nullif(p_record->>'causa_muerte',''),
    nullif(trim(p_record->>'nombre_padre'),''),nullif(trim(p_record->>'nombre_madre'),''),
    nullif(trim(p_record->>'conyuge'),''),
    nullif(trim(p_record->>'ministro'),''),nullif(trim(p_record->>'da_fe'),''),
    nullif(p_record->>'observations',''),v_note,
    v_raw,v_loc.numero_registro,'suplementario'
  ) returning id into v_funeral_id;

  v_payload := jsonb_build_object(
    'decreeNumber',v_decree_number,
    'decreeDate',p_decree_date,
    'sacramentType','exequias',
    'sacramento','exequias',
    'decreeType','reposicion',
    'targetName',v_name,
    'parishName',v_parish_name,
    'reason',trim(p_reason),
    'evidence',p_evidence,
    'recordData',p_record,
    'originalRecordId',null,
    'replacementRecordId',v_funeral_id,
    'replacementLocation',jsonb_build_object(
      'bookType','suplementario',
      'book',v_loc.book_number,
      'folio',v_loc.folio,
      'number',v_loc.number,
      'numeroRegistro',v_loc.numero_registro
    ),
    'replacementNote',v_note,
    'issuedFrom','chancery'
  );

  insert into public.decretos(
    parish_id,diocese_id,chancery_id,tipo,sacrament_type,
    decree_number,decree_date,original_record_id,replacement_record_id,
    status,issued_by,payload
  ) values (
    p_parish_id,v_diocese,v_chancery,'reposicion','exequias',
    v_decree_number,p_decree_date,null,v_funeral_id,
    'active',auth.uid(),v_payload
  ) returning id into v_decree_id;

  insert into public.marginal_notes(
    sacrament_type,note_type,decree_number,content,parish_id,
    sacrament_id,note_date,source_type,source_id,decree_id,created_by
  ) values (
    'exequias','reposicion',v_decree_number,v_note,p_parish_id,
    v_funeral_id,p_decree_date,'decree',v_decree_id,v_decree_id,auth.uid()
  );

  insert into public.official_notifications(
    diocese_id,sender_chancery_id,receiver_parish_id,decree_id,
    category,subject,message,status,payload,created_by
  ) values (
    v_diocese,v_chancery,p_parish_id,v_decree_id,
    'decree',
    'Decreto de reposición de Exequias ' || v_decree_number,
    'Cancillería creó una nueva partida de Exequias en el Libro Supletorio con fundamento en evidencia documental.',
    'pending',
    jsonb_build_object(
      'sacramentType','exequias','decreeType','reposicion',
      'decreeNumber',v_decree_number,'recordId',v_funeral_id
    ),
    auth.uid()
  );

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,
    before_data,after_data,metadata
  ) values
  (
    auth.uid(),p_parish_id,v_diocese,'funeral',v_funeral_id,
    'create_reposition_by_decree',null,v_raw,
    jsonb_build_object('decree_id',v_decree_id,'decree_number',v_decree_number,'evidence',p_evidence)
  ),
  (
    auth.uid(),p_parish_id,v_diocese,'decree',v_decree_id,
    'issue',null,v_payload,
    jsonb_build_object('sacrament_type','exequias','decree_type','reposicion')
  );

  return query select
    v_decree_id,v_funeral_id,v_decree_number,
    v_loc.book_number,v_loc.folio,v_loc.number,v_loc.numero_registro,v_note;
end;
$function$;

-- ============================================================
-- 3. REVERSIÓN CANÓNICA
-- ============================================================

drop function if exists public.reverse_funeral_decree(uuid,text);

create function public.reverse_funeral_decree(
  p_decree_id uuid,
  p_reason text default null
)
returns table(
  decree_id uuid,
  decree_status text,
  original_funeral_id uuid,
  replacement_funeral_id uuid
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text;
  v_user_diocese uuid;
  v_decree public.decretos%rowtype;
  v_reason text;
  v_note text;
  v_original_status text;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select lower(coalesce(up.role,'')),up.diocese_id
  into v_role,v_user_diocese
  from public.user_profiles up
  where up.auth_user_id=auth.uid()
    and coalesce(up.is_active,true)=true
    and coalesce(up.status,'active') not in ('blocked','disabled','inactive')
  limit 1;

  if v_role not in ('chancery','diocese','admin_general') then
    raise exception 'Rol no autorizado para revertir decretos de Exequias';
  end if;

  select d.* into v_decree
  from public.decretos d
  where d.id=p_decree_id
    and lower(coalesce(d.sacrament_type,''))='exequias'
  for update;

  if not found then
    raise exception 'Decreto de Exequias no encontrado';
  end if;

  if lower(coalesce(v_decree.status,'active'))='reversed' then
    raise exception 'El decreto ya fue revertido';
  end if;

  if v_role <> 'admin_general' and v_user_diocese is distinct from v_decree.diocese_id then
    raise exception 'El decreto está fuera de la jurisdicción del usuario';
  end if;

  v_reason := nullif(trim(coalesce(p_reason,'')),'');
  if v_reason is null then
    raise exception 'El motivo de reversión es obligatorio';
  end if;

  v_note :=
    'REVERSIÓN DEL DECRETO ' || coalesce(v_decree.decree_number,'SIN NÚMERO') ||
    '. MOTIVO: ' || upper(v_reason);

  if lower(coalesce(v_decree.tipo,''))='correccion' then
    if v_decree.original_record_id is null or v_decree.replacement_record_id is null then
      raise exception 'El decreto de corrección no contiene la relación original/nueva requerida';
    end if;

    v_original_status := coalesce(nullif(v_decree.payload->>'originalStatus',''),'seated');

    update public.funerals
    set
      status = v_original_status,
      nota_marginal = concat_ws(E'\n\n',nullif(nota_marginal,''),v_note),
      raw_data = coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
        'correctionReversed',true,
        'reversedDecree',v_decree.decree_number,
        'reversalReason',v_reason
      ),
      updated_at = now()
    where id=v_decree.original_record_id;

    update public.funerals
    set
      status='reversed',
      nota_marginal=concat_ws(E'\n\n',nullif(nota_marginal,''),v_note),
      raw_data=coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
        'correctionReversed',true,
        'reversedDecree',v_decree.decree_number,
        'reversalReason',v_reason
      ),
      updated_at=now()
    where id=v_decree.replacement_record_id;

    insert into public.marginal_notes(
      sacrament_type,note_type,decree_number,content,parish_id,
      sacrament_id,note_date,source_type,source_id,decree_id,created_by
    ) values
    ('exequias','reversion_correccion_original',v_decree.decree_number,v_note,
      v_decree.parish_id,v_decree.original_record_id,current_date,'decree',v_decree.id,v_decree.id,auth.uid()),
    ('exequias','reversion_correccion_supletoria',v_decree.decree_number,v_note,
      v_decree.parish_id,v_decree.replacement_record_id,current_date,'decree',v_decree.id,v_decree.id,auth.uid());

  elsif lower(coalesce(v_decree.tipo,''))='reposicion' then
    if v_decree.original_record_id is not null then
      raise exception 'Reposición inválida: no debe existir una partida original asociada';
    end if;
    if v_decree.replacement_record_id is null then
      raise exception 'El decreto de reposición no contiene la partida creada';
    end if;

    update public.funerals
    set
      status='reversed',
      nota_marginal=concat_ws(E'\n\n',nullif(nota_marginal,''),v_note),
      raw_data=coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
        'repositionReversed',true,
        'reversedDecree',v_decree.decree_number,
        'reversalReason',v_reason
      ),
      updated_at=now()
    where id=v_decree.replacement_record_id;

    insert into public.marginal_notes(
      sacrament_type,note_type,decree_number,content,parish_id,
      sacrament_id,note_date,source_type,source_id,decree_id,created_by
    ) values (
      'exequias','reversion_reposicion',v_decree.decree_number,v_note,
      v_decree.parish_id,v_decree.replacement_record_id,current_date,
      'decree',v_decree.id,v_decree.id,auth.uid()
    );
  else
    raise exception 'Tipo de decreto de Exequias no soportado para reversión';
  end if;

  update public.decretos
  set
    status='reversed',
    payload=coalesce(payload,'{}'::jsonb) || jsonb_build_object(
      'reversedAt',now(),
      'reversedBy',auth.uid(),
      'reversalReason',v_reason
    )
  where id=p_decree_id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,
    before_data,after_data,metadata
  ) values (
    auth.uid(),v_decree.parish_id,v_decree.diocese_id,
    'decree',v_decree.id,'reverse',to_jsonb(v_decree),
    jsonb_build_object('status','reversed','reason',v_reason),
    jsonb_build_object(
      'sacrament_type','exequias','decree_type',v_decree.tipo,
      'original_record_id',v_decree.original_record_id,
      'replacement_record_id',v_decree.replacement_record_id,
      'sequence_reused',false
    )
  );

  return query select
    p_decree_id,'reversed'::text,
    v_decree.original_record_id,v_decree.replacement_record_id;
end;
$function$;

-- ============================================================
-- 4. DESHABILITAR RPC INCORRECTA DE 031
--    Esa función exigía una partida existente para la reposición.
-- ============================================================

revoke all on function public.create_funeral_replacement_by_decree(uuid,date,text,jsonb,text) from public;
revoke all on function public.create_funeral_replacement_by_decree(uuid,date,text,jsonb,text) from anon;
revoke all on function public.create_funeral_replacement_by_decree(uuid,date,text,jsonb,text) from authenticated;

-- ============================================================
-- 5. SEGURIDAD DE LAS RPC CANÓNICAS
-- ============================================================

revoke all on function public.apply_funeral_correction(uuid,date,text,jsonb,text) from public;
revoke all on function public.apply_funeral_correction(uuid,date,text,jsonb,text) from anon;
grant execute on function public.apply_funeral_correction(uuid,date,text,jsonb,text) to authenticated;
grant execute on function public.apply_funeral_correction(uuid,date,text,jsonb,text) to service_role;

revoke all on function public.create_funeral_reposition_by_decree(uuid,date,text,jsonb,jsonb,text) from public;
revoke all on function public.create_funeral_reposition_by_decree(uuid,date,text,jsonb,jsonb,text) from anon;
grant execute on function public.create_funeral_reposition_by_decree(uuid,date,text,jsonb,jsonb,text) to authenticated;
grant execute on function public.create_funeral_reposition_by_decree(uuid,date,text,jsonb,jsonb,text) to service_role;

revoke all on function public.reverse_funeral_decree(uuid,text) from public;
revoke all on function public.reverse_funeral_decree(uuid,text) from anon;
grant execute on function public.reverse_funeral_decree(uuid,text) to authenticated;
grant execute on function public.reverse_funeral_decree(uuid,text) to service_role;

commit;

-- ============================================================
-- POST-CHECK · SOLO LECTURA
-- ============================================================

select jsonb_pretty(
  jsonb_build_object(
    'funerals_count',(select count(*) from public.funerals),
    'active_exequias_decrees',(
      select count(*) from public.decretos
      where lower(coalesce(sacrament_type,''))='exequias'
        and lower(coalesce(status,'active'))='active'
    ),

    'canonical_correction_ok',
      to_regprocedure('public.apply_funeral_correction(uuid,date,text,jsonb,text)') is not null,

    'canonical_reposition_ok',
      to_regprocedure('public.create_funeral_reposition_by_decree(uuid,date,text,jsonb,jsonb,text)') is not null,

    'canonical_reverse_ok',
      to_regprocedure('public.reverse_funeral_decree(uuid,text)') is not null,

    'allocator_ok',
      to_regprocedure('public.sacramentum_allocate_funeral_supplementary(uuid)') is not null,

    'correction_security_definer',coalesce((
      select p.prosecdef from pg_proc p
      where p.oid=to_regprocedure('public.apply_funeral_correction(uuid,date,text,jsonb,text)')
    ),false),

    'reposition_security_definer',coalesce((
      select p.prosecdef from pg_proc p
      where p.oid=to_regprocedure('public.create_funeral_reposition_by_decree(uuid,date,text,jsonb,jsonb,text)')
    ),false),

    'reverse_security_definer',coalesce((
      select p.prosecdef from pg_proc p
      where p.oid=to_regprocedure('public.reverse_funeral_decree(uuid,text)')
    ),false),

    'anon_correction_execute',has_function_privilege(
      'anon','public.apply_funeral_correction(uuid,date,text,jsonb,text)','EXECUTE'
    ),
    'anon_reposition_execute',has_function_privilege(
      'anon','public.create_funeral_reposition_by_decree(uuid,date,text,jsonb,jsonb,text)','EXECUTE'
    ),
    'anon_reverse_execute',has_function_privilege(
      'anon','public.reverse_funeral_decree(uuid,text)','EXECUTE'
    ),

    'authenticated_correction_execute',has_function_privilege(
      'authenticated','public.apply_funeral_correction(uuid,date,text,jsonb,text)','EXECUTE'
    ),
    'authenticated_reposition_execute',has_function_privilege(
      'authenticated','public.create_funeral_reposition_by_decree(uuid,date,text,jsonb,jsonb,text)','EXECUTE'
    ),
    'authenticated_reverse_execute',has_function_privilege(
      'authenticated','public.reverse_funeral_decree(uuid,text)','EXECUTE'
    ),

    'legacy_wrong_replacement_disabled',not has_function_privilege(
      'authenticated','public.create_funeral_replacement_by_decree(uuid,date,text,jsonb,text)','EXECUTE'
    ),

    'current_exequias_params',(
      select pp.exequias_params
      from public.parish_parameters pp
      where pp.exequias_params is not null
      order by pp.updated_at desc nulls last
      limit 1
    )
  )
) as fase5d_031b_postcheck;
