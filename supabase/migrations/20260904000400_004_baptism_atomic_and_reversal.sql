-- ============================================================================
-- SACRAMENTUM · Bautismo transaccional y reversión no destructiva de decretos
-- 2026-09-04
-- Requiere: 20260904_001_registry_core.sql + helpers de seguridad.
-- ADITIVA / NO DESTRUCTIVA.
-- ============================================================================

alter table if exists public.marginal_notes
  add column if not exists status varchar(32) not null default 'active';

create index if not exists idx_marginal_notes_status_source
  on public.marginal_notes(status, source_type, source_id);

-- --------------------------------------------------------------------------
-- 1. Corrección de Bautismo: original + supletoria + consecutivo + decreto
--    + notas + notificación + auditoría en UNA sola transacción.
-- --------------------------------------------------------------------------
create or replace function public.apply_baptism_correction(
  p_parish_id uuid,
  p_original_baptism_id uuid,
  p_decree_number text,
  p_decree_date date,
  p_concept_id uuid,
  p_corrected_data jsonb,
  p_decree_payload jsonb,
  p_annulled_note text,
  p_replacement_note text,
  p_expected_book integer,
  p_expected_folio integer,
  p_expected_number integer
)
returns table(
  decree_id uuid,
  replacement_baptism_id uuid,
  book_number text,
  folio text,
  number text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_user_diocese uuid;
  v_chancery uuid;
  v_parish_diocese uuid;
  v_original public.baptisms%rowtype;
  v_params jsonb;
  v_book integer;
  v_folio integer;
  v_number integer;
  v_limit integer;
  v_restart boolean;
  v_next_book integer;
  v_next_folio integer;
  v_next_number integer;
  v_next_params jsonb;
  v_new_id uuid;
  v_decree_id uuid;
  v_created_payload jsonb;
  v_birth_date date;
  v_celebration_date date;
  v_registry_date date;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select lower(coalesce(up.role,'')), up.diocese_id, up.chancery_id
    into v_role, v_user_diocese, v_chancery
  from public.user_profiles up
  where up.auth_user_id=auth.uid() and coalesce(up.is_active,true)=true
  limit 1;

  if v_role not in ('chancery','diocese','admin_general') then
    raise exception 'Sólo Cancillería, Diócesis o Administración General pueden emitir este decreto';
  end if;

  select p.diocese_id into v_parish_diocese from public.parishes p where p.id=p_parish_id;
  if v_parish_diocese is null then raise exception 'Parroquia no encontrada o sin diócesis'; end if;
  if v_role <> 'admin_general' and v_user_diocese is distinct from v_parish_diocese then
    raise exception 'La parroquia no pertenece a la jurisdicción del usuario';
  end if;

  if nullif(trim(p_decree_number),'') is null or p_decree_date is null then
    raise exception 'Número y fecha de decreto son obligatorios';
  end if;
  if nullif(trim(coalesce(p_annulled_note,'')),'') is null or nullif(trim(coalesce(p_replacement_note,'')),'') is null then
    raise exception 'Las notas marginales del decreto son obligatorias';
  end if;

  if exists (
    select 1 from public.decretos d
    where d.diocese_id=v_parish_diocese
      and lower(coalesce(d.status,'active')) <> 'reversed'
      and lower(trim(coalesce(d.decree_number,'')))=lower(trim(p_decree_number))
  ) then
    raise exception 'El número de decreto % ya existe en esta diócesis',p_decree_number;
  end if;

  select * into v_original
  from public.baptisms b
  where b.id=p_original_baptism_id and b.parish_id=p_parish_id
  for update;
  if not found then raise exception 'La partida original de Bautismo no existe en la parroquia seleccionada'; end if;
  if lower(coalesce(v_original.status,'')) in ('anulada','annulled','reversed','deleted') then
    raise exception 'La partida original no está disponible para corrección';
  end if;

  select pp.bautizos_params into v_params
  from public.parish_parameters pp
  where pp.parish_id=p_parish_id
  for update;
  if not found then raise exception 'La parroquia no tiene parámetros de Bautismo configurados'; end if;

  v_book := greatest(coalesce(nullif(v_params->>'suplementarioLibro','')::integer,1),1);
  v_folio := greatest(coalesce(nullif(v_params->>'suplementarioFolio','')::integer,1),1);
  v_number := greatest(coalesce(nullif(v_params->>'suplementarioNumero','')::integer,1),1);
  v_limit := greatest(coalesce(nullif(v_params->>'suplementarioPartidas','')::integer,2),1);
  v_restart := coalesce((v_params->>'suplementarioReiniciar')::boolean,false);

  if v_book<>p_expected_book or v_folio<>p_expected_folio or v_number<>p_expected_number then
    raise exception 'El consecutivo supletorio cambió. Recargue la parroquia antes de emitir el decreto.';
  end if;

  if exists (
    select 1 from public.baptisms b where b.parish_id=p_parish_id
      and b.book_number=lpad(v_book::text,4,'0')
      and b.folio=lpad(v_folio::text,4,'0')
      and b.number=lpad(v_number::text,4,'0')
  ) then
    raise exception 'El consecutivo supletorio Libro %, Folio %, Número % ya está ocupado',v_book,v_folio,v_number;
  end if;

  v_celebration_date := case
    when coalesce(p_corrected_data->>'fechaSacramento','') ~ '^\d{4}-\d{2}-\d{2}$' then (p_corrected_data->>'fechaSacramento')::date
    else v_original.celebration_date end;
  v_birth_date := case
    when coalesce(p_corrected_data->>'fechaNacimiento','') ~ '^\d{4}-\d{2}-\d{2}$' then (p_corrected_data->>'fechaNacimiento')::date
    else v_original.fecha_nacimiento end;
  v_registry_date := case
    when coalesce(p_corrected_data->>'fechaExpedicionRegistro','') ~ '^\d{4}-\d{2}-\d{2}$' then (p_corrected_data->>'fechaExpedicionRegistro')::date
    else v_original.fecha_expedicion_registro end;
  if v_celebration_date is null then raise exception 'La fecha de Bautismo corregida es obligatoria'; end if;

  insert into public.baptisms(
    parish_id,book_number,folio,number,celebration_date,
    nombres,apellidos,sexo,fecha_nacimiento,lugar_nacimiento,lugar_bautismo,
    nuip,oficina_registro,serial_registro,fecha_expedicion_registro,direccion,
    nombre_padre,cedula_padre,nombre_madre,cedula_madre,tipo_union_padres,
    abuelos_paternos,abuelos_maternos,padrinos,ministro,da_fe,observations,
    hora_sacramento,numero_registro,status,nota_marginal,raw_data
  ) values (
    p_parish_id,lpad(v_book::text,4,'0'),lpad(v_folio::text,4,'0'),lpad(v_number::text,4,'0'),v_celebration_date,
    coalesce(nullif(trim(p_corrected_data->>'nombres'),''),v_original.nombres),
    coalesce(nullif(trim(p_corrected_data->>'apellidos'),''),v_original.apellidos),
    coalesce(nullif(trim(p_corrected_data->>'sexo'),''),v_original.sexo),
    v_birth_date,
    coalesce(nullif(trim(p_corrected_data->>'lugarNacimiento'),''),v_original.lugar_nacimiento),
    coalesce(nullif(trim(p_corrected_data->>'lugarBautismo'),''),v_original.lugar_bautismo),
    coalesce(nullif(trim(p_corrected_data->>'nuip'),''),v_original.nuip),
    coalesce(nullif(trim(p_corrected_data->>'oficinaRegistro'),''),v_original.oficina_registro),
    coalesce(nullif(trim(p_corrected_data->>'serialRegistro'),''),v_original.serial_registro),
    v_registry_date,
    coalesce(nullif(trim(p_corrected_data->>'direccion'),''),v_original.direccion),
    coalesce(nullif(trim(p_corrected_data->>'nombrePadre'),''),v_original.nombre_padre),
    coalesce(nullif(trim(p_corrected_data->>'cedulaPadre'),''),v_original.cedula_padre),
    coalesce(nullif(trim(p_corrected_data->>'nombreMadre'),''),v_original.nombre_madre),
    coalesce(nullif(trim(p_corrected_data->>'cedulaMadre'),''),v_original.cedula_madre),
    coalesce(nullif(trim(p_corrected_data->>'tipoUnionPadres'),''),v_original.tipo_union_padres),
    coalesce(nullif(p_corrected_data->>'abuelosPaternos',''),v_original.abuelos_paternos),
    coalesce(nullif(p_corrected_data->>'abuelosMaternos',''),v_original.abuelos_maternos),
    coalesce(nullif(p_corrected_data->>'padrinos',''),v_original.padrinos),
    coalesce(nullif(trim(p_corrected_data->>'ministro'),''),v_original.ministro),
    coalesce(nullif(trim(p_corrected_data->>'daFe'),''),v_original.da_fe),
    coalesce(nullif(p_corrected_data->>'observaciones',''),v_original.observations),
    coalesce(nullif(trim(p_corrected_data->>'horaSacramento'),''),v_original.hora_sacramento),
    coalesce(nullif(trim(p_corrected_data->>'numeroRegistro'),''),v_original.numero_registro),
    'seated',p_replacement_note,
    coalesce(v_original.raw_data,'{}'::jsonb) || coalesce(p_corrected_data,'{}'::jsonb)
      || jsonb_build_object(
        'Libro',lpad(v_book::text,4,'0'),'folio',lpad(v_folio::text,4,'0'),'numero',lpad(v_number::text,4,'0'),
        'book_number',lpad(v_book::text,4,'0'),'page_number',lpad(v_folio::text,4,'0'),'entry_number',lpad(v_number::text,4,'0'),
        'notaMarginal',p_replacement_note,'estado','permanente','status','seated','creadoPorDecreto',true
      )
  ) returning id into v_new_id;

  update public.baptisms
  set status='anulada',
      nota_marginal=concat_ws(E'\n\n',nullif(v_original.nota_marginal,''),p_annulled_note),
      raw_data=coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
        'anulado',true,'isAnnulled',true,'status','anulada','estado','anulada',
        'notaMarginal',concat_ws(E'\n\n',nullif(v_original.nota_marginal,''),p_annulled_note),
        'annulmentDecree',trim(p_decree_number),'annulmentDate',p_decree_date
      ),updated_at=now()
  where id=p_original_baptism_id;

  v_next_book:=v_book; v_next_folio:=v_folio; v_next_number:=v_number;
  if v_restart then
    if v_next_number>=v_limit then v_next_folio:=v_next_folio+1; v_next_number:=1;
    else v_next_number:=v_next_number+1; end if;
  else
    v_next_number:=v_next_number+1;
    if mod(v_next_number-1,v_limit)=0 then v_next_folio:=v_next_folio+1; end if;
  end if;

  v_next_params := jsonb_set(jsonb_set(jsonb_set(v_params,'{suplementarioLibro}',to_jsonb(v_next_book),true),'{suplementarioFolio}',to_jsonb(v_next_folio),true),'{suplementarioNumero}',to_jsonb(v_next_number),true);
  update public.parish_parameters set bautizos_params=v_next_params,updated_at=now() where parish_id=p_parish_id;

  v_created_payload := coalesce(p_decree_payload,'{}'::jsonb) || jsonb_build_object(
    'sacramentType','bautismo','sacramento','bautismo','decreeNumber',trim(p_decree_number),'decreeDate',p_decree_date,
    'conceptoAnulacionId',p_concept_id,'originalPartidaId',p_original_baptism_id,'newPartidaId',v_new_id,
    'targetParishId',p_parish_id,'issuedFrom','chancery',
    'newPartidaSummary',coalesce(p_decree_payload->'newPartidaSummary','{}'::jsonb) || jsonb_build_object('book',v_book,'page',v_folio,'entry',v_number)
  );

  insert into public.decretos(
    parish_id,diocese_id,chancery_id,tipo,sacrament_type,decree_number,decree_date,
    original_record_id,replacement_record_id,status,issued_by,payload
  ) values (
    p_parish_id,v_parish_diocese,v_chancery,'correccion','bautismo',trim(p_decree_number),p_decree_date,
    p_original_baptism_id,v_new_id,'active',auth.uid(),v_created_payload
  ) returning id into v_decree_id;

  insert into public.marginal_notes(
    sacrament_type,note_type,decree_number,content,parish_id,sacrament_id,note_date,
    source_type,source_id,decree_id,created_by,status
  ) values
    ('bautismo','correccion_anulacion',trim(p_decree_number),p_annulled_note,p_parish_id,p_original_baptism_id,p_decree_date,'decree',v_decree_id,v_decree_id,auth.uid(),'active'),
    ('bautismo','correccion_supletoria',trim(p_decree_number),p_replacement_note,p_parish_id,v_new_id,p_decree_date,'decree',v_decree_id,v_decree_id,auth.uid(),'active');

  insert into public.official_notifications(
    diocese_id,sender_chancery_id,receiver_parish_id,decree_id,category,subject,message,status,payload,created_by
  ) values (
    v_parish_diocese,v_chancery,p_parish_id,v_decree_id,'decree',
    'Decreto de corrección de Bautismo '||trim(p_decree_number),
    'Cancillería ha emitido un decreto de corrección que afecta una partida de Bautismo de esta parroquia.',
    'pending',jsonb_build_object('sacramentType','bautismo','decreeType','correccion','decreeNumber',trim(p_decree_number),'originalRecordId',p_original_baptism_id,'replacementRecordId',v_new_id),auth.uid()
  );

  insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,before_data,after_data,metadata)
  values
    (auth.uid(),p_parish_id,v_parish_diocese,'baptism',p_original_baptism_id,'annul_by_decree',to_jsonb(v_original),jsonb_build_object('status','anulada','correction_note',p_annulled_note),jsonb_build_object('decree_id',v_decree_id,'decree_number',trim(p_decree_number))),
    (auth.uid(),p_parish_id,v_parish_diocese,'baptism',v_new_id,'create_supplementary_by_decree',null,p_corrected_data || jsonb_build_object('book',v_book,'folio',v_folio,'number',v_number),jsonb_build_object('decree_id',v_decree_id,'decree_number',trim(p_decree_number))),
    (auth.uid(),p_parish_id,v_parish_diocese,'decree',v_decree_id,'issue',null,v_created_payload,jsonb_build_object('sacrament_type','bautismo','decree_type','correccion'));

  return query select v_decree_id,v_new_id,lpad(v_book::text,4,'0'),lpad(v_folio::text,4,'0'),lpad(v_number::text,4,'0');
end;
$$;

revoke all on function public.apply_baptism_correction(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer) from public;
grant execute on function public.apply_baptism_correction(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer) to authenticated;

-- --------------------------------------------------------------------------
-- 2. Reversión institucional NO DESTRUCTIVA.
--    No reutiliza el consecutivo: la supletoria queda REVERSED para preservar
--    la secuencia histórica del libro. Restaura el original desde auditoría.
-- --------------------------------------------------------------------------
create or replace function public.reverse_correction_decree(p_decree_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_user_diocese uuid;
  v_decree public.decretos%rowtype;
  v_before jsonb;
  v_entity_type text;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  select lower(coalesce(up.role,'')),up.diocese_id into v_role,v_user_diocese
  from public.user_profiles up where up.auth_user_id=auth.uid() and coalesce(up.is_active,true)=true limit 1;
  if v_role not in ('chancery','diocese','admin_general') then raise exception 'Rol no autorizado para revertir decretos'; end if;

  select * into v_decree from public.decretos d where d.id=p_decree_id for update;
  if not found then raise exception 'Decreto no encontrado'; end if;
  if lower(coalesce(v_decree.tipo,''))<>'correccion' then raise exception 'Este procedimiento sólo revierte decretos de corrección'; end if;
  if lower(coalesce(v_decree.status,'active'))='reversed' then return true; end if;
  if lower(coalesce(v_decree.status,'active')) not in ('active','archived') then raise exception 'El decreto no está en estado reversible'; end if;
  if v_role<>'admin_general' and v_user_diocese is distinct from v_decree.diocese_id then raise exception 'El decreto no pertenece a la jurisdicción del usuario'; end if;
  if v_decree.original_record_id is null then raise exception 'Decreto legado sin vínculo estructurado: requiere revisión manual antes de revertir'; end if;

  if v_decree.sacrament_type='bautismo' then
    v_entity_type:='baptism';
    select a.before_data into v_before from public.registry_audit_log a
      where a.entity_type='baptism' and a.entity_id=v_decree.original_record_id and a.action='annul_by_decree'
        and (a.metadata->>'decree_id')::text=v_decree.id::text
      order by a.created_at desc limit 1;
    if v_before is null then raise exception 'No existe instantánea de auditoría para restaurar el Bautismo'; end if;

    update public.baptisms set
      status=coalesce(v_before->>'status','seated'),
      nota_marginal=nullif(v_before->>'nota_marginal',''),
      raw_data=coalesce(v_before->'raw_data','{}'::jsonb),
      updated_at=now()
    where id=v_decree.original_record_id and parish_id=v_decree.parish_id;
    if not found then raise exception 'Partida original de Bautismo no encontrada'; end if;

    if v_decree.replacement_record_id is not null then
      update public.baptisms set status='reversed',
        raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object('status','reversed','estado','revertida','reversedByDecree',v_decree.id),updated_at=now()
      where id=v_decree.replacement_record_id and parish_id=v_decree.parish_id;
    end if;

  elsif v_decree.sacrament_type='confirmacion' then
    v_entity_type:='confirmation';
    select a.before_data into v_before from public.registry_audit_log a
      where a.entity_type='confirmation' and a.entity_id=v_decree.original_record_id and a.action='annul_by_decree'
        and (a.metadata->>'decree_number')=v_decree.decree_number
      order by a.created_at desc limit 1;
    if v_before is null then raise exception 'No existe instantánea de auditoría para restaurar la Confirmación'; end if;

    update public.confirmations set
      status=coalesce(v_before->>'status','seated'),
      nota_marginal=nullif(v_before->>'nota_marginal',''),
      raw_data=coalesce(v_before->'raw_data','{}'::jsonb),
      updated_at=now()
    where id=v_decree.original_record_id and parish_id=v_decree.parish_id;
    if not found then raise exception 'Partida original de Confirmación no encontrada'; end if;

    if v_decree.replacement_record_id is not null then
      update public.confirmations set status='reversed',
        raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object('status','reversed','estado','revertida','reversedByDecree',v_decree.id),updated_at=now()
      where id=v_decree.replacement_record_id and parish_id=v_decree.parish_id;
    end if;

  elsif v_decree.sacrament_type='exequias' then
    v_entity_type:='funeral';
    select a.before_data into v_before from public.registry_audit_log a
      where a.entity_type='funeral' and a.entity_id=v_decree.original_record_id and a.action='correct_by_decree'
        and (a.metadata->>'decree_id')::text=v_decree.id::text
      order by a.created_at desc limit 1;
    if v_before is null then raise exception 'No existe instantánea de auditoría para restaurar Exequias'; end if;

    update public.funerals set
      nombres=v_before->>'nombres',apellidos=v_before->>'apellidos',
      fecha_defuncion=case when nullif(v_before->>'fecha_defuncion','') is null then fecha_defuncion else (v_before->>'fecha_defuncion')::date end,
      lugar_defuncion=nullif(v_before->>'lugar_defuncion',''),
      fecha_exequias=case when nullif(v_before->>'fecha_exequias','') is null then null else (v_before->>'fecha_exequias')::date end,
      lugar_exequias=nullif(v_before->>'lugar_exequias',''),cementerio=nullif(v_before->>'cementerio',''),
      ministro=nullif(v_before->>'ministro',''),da_fe=nullif(v_before->>'da_fe',''),
      nota_marginal=nullif(v_before->>'nota_marginal',''),raw_data=coalesce(v_before->'raw_data','{}'::jsonb),updated_at=now()
    where id=v_decree.original_record_id and parish_id=v_decree.parish_id;
    if not found then raise exception 'Registro original de Exequias no encontrado'; end if;
  else
    raise exception 'El sacramento % aún no tiene reversión automática',v_decree.sacrament_type;
  end if;

  update public.marginal_notes set status='reversed',updated_at=now()
    where decree_id=v_decree.id or (source_type='decree' and source_id=v_decree.id);
  update public.official_notifications set status='cancelled',processed_at=coalesce(processed_at,now()),updated_at=now()
    where decree_id=v_decree.id and status<>'cancelled';
  update public.decretos set status='reversed',updated_at=now() where id=v_decree.id;

  insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,before_data,after_data,metadata)
  values(auth.uid(),v_decree.parish_id,v_decree.diocese_id,'decree',v_decree.id,'reverse',to_jsonb(v_decree),jsonb_build_object('status','reversed'),jsonb_build_object('sacrament_type',v_decree.sacrament_type,'entity_type',v_entity_type,'replacement_record_id',v_decree.replacement_record_id));

  return true;
end;
$$;

revoke all on function public.reverse_correction_decree(uuid) from public;
grant execute on function public.reverse_correction_decree(uuid) to authenticated;
