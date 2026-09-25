-- SACRAMENTUM - Fase 2.6
-- Reposición de Bautismo atómica: partida supletoria + consecutivo + decreto +
-- nota marginal + notificación (cuando emite Cancillería) + auditoría.

create or replace function public.apply_baptism_replacement(
  p_parish_id uuid,
  p_decree_number text,
  p_decree_date date,
  p_concept_id uuid,
  p_new_data jsonb,
  p_decree_payload jsonb,
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
  v_user_parish uuid;
  v_user_diocese uuid;
  v_chancery uuid;
  v_parish_diocese uuid;
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
  v_payload jsonb;
  v_celebration_date date;
  v_birth_date date;
  v_registry_date date;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select lower(coalesce(up.role,'')),up.parish_id,up.diocese_id,up.chancery_id
    into v_role,v_user_parish,v_user_diocese,v_chancery
  from public.user_profiles up
  where up.auth_user_id=auth.uid() and coalesce(up.is_active,true)=true
  limit 1;

  if v_role not in ('chancery','diocese','admin_general') then
    raise exception 'Sólo Cancillería, Diócesis o Administración General pueden emitir una reposición';
  end if;

  select p.diocese_id into v_parish_diocese from public.parishes p where p.id=p_parish_id;
  if v_parish_diocese is null then raise exception 'Parroquia no encontrada o sin diócesis'; end if;

  if v_role in ('chancery','diocese') and v_user_diocese is distinct from v_parish_diocese then
    raise exception 'La parroquia no pertenece a la jurisdicción del usuario';
  end if;

  if nullif(trim(p_decree_number),'') is null or p_decree_date is null then
    raise exception 'Número y fecha de decreto son obligatorios';
  end if;
  if nullif(trim(coalesce(p_replacement_note,'')),'') is null then
    raise exception 'La nota marginal de reposición es obligatoria';
  end if;

  if exists (
    select 1 from public.decretos d
    where d.diocese_id=v_parish_diocese
      and lower(coalesce(d.status,'active')) <> 'reversed'
      and lower(trim(coalesce(d.decree_number,'')))=lower(trim(p_decree_number))
  ) then
    raise exception 'El número de decreto % ya existe en esta diócesis',p_decree_number;
  end if;

  select pp.bautizos_params into v_params
  from public.parish_parameters pp
  where pp.parish_id=p_parish_id
  for update;
  if not found then raise exception 'La parroquia no tiene parámetros de Bautismo configurados'; end if;

  v_book:=greatest(coalesce(nullif(v_params->>'suplementarioLibro','')::integer,1),1);
  v_folio:=greatest(coalesce(nullif(v_params->>'suplementarioFolio','')::integer,1),1);
  v_number:=greatest(coalesce(nullif(v_params->>'suplementarioNumero','')::integer,1),1);
  v_limit:=greatest(coalesce(nullif(v_params->>'suplementarioPartidas','')::integer,2),1);
  v_restart:=coalesce((v_params->>'suplementarioReiniciar')::boolean,false);

  if v_book<>p_expected_book or v_folio<>p_expected_folio or v_number<>p_expected_number then
    raise exception 'El consecutivo supletorio cambió. Recargue los parámetros antes de emitir la reposición.';
  end if;

  if exists (
    select 1 from public.baptisms b where b.parish_id=p_parish_id
      and b.book_number=lpad(v_book::text,4,'0')
      and b.folio=lpad(v_folio::text,4,'0')
      and b.number=lpad(v_number::text,4,'0')
  ) then
    raise exception 'El consecutivo supletorio Libro %, Folio %, Número % ya está ocupado',v_book,v_folio,v_number;
  end if;

  v_celebration_date := case when coalesce(p_new_data->>'sacramentDate','') ~ '^\d{4}-\d{2}-\d{2}$' then (p_new_data->>'sacramentDate')::date else null end;
  v_birth_date := case when coalesce(p_new_data->>'birthDate','') ~ '^\d{4}-\d{2}-\d{2}$' then (p_new_data->>'birthDate')::date else null end;
  v_registry_date := case when coalesce(p_new_data->>'fechaExpedicion','') ~ '^\d{4}-\d{2}-\d{2}$' then (p_new_data->>'fechaExpedicion')::date else null end;
  if v_celebration_date is null then raise exception 'La fecha de Bautismo es obligatoria'; end if;
  if nullif(trim(coalesce(p_new_data->>'firstName','')),'') is null or nullif(trim(coalesce(p_new_data->>'lastName','')),'') is null then
    raise exception 'Nombres y apellidos son obligatorios';
  end if;

  insert into public.baptisms(
    parish_id,book_number,folio,number,celebration_date,nombres,apellidos,sexo,
    fecha_nacimiento,lugar_nacimiento,lugar_bautismo,nuip,oficina_registro,serial_registro,
    fecha_expedicion_registro,nombre_padre,cedula_padre,nombre_madre,cedula_madre,
    tipo_union_padres,abuelos_paternos,abuelos_maternos,padrinos,ministro,da_fe,status,
    nota_marginal,raw_data
  ) values (
    p_parish_id,lpad(v_book::text,4,'0'),lpad(v_folio::text,4,'0'),lpad(v_number::text,4,'0'),v_celebration_date,
    trim(p_new_data->>'firstName'),trim(p_new_data->>'lastName'),nullif(trim(p_new_data->>'sex'),''),
    v_birth_date,coalesce(nullif(trim(p_new_data->>'placeOfBirth'),''),nullif(trim(p_new_data->>'lugarNacimientoDetalle'),'')),
    nullif(trim(p_new_data->>'lugarBautismo'),''),coalesce(nullif(trim(p_new_data->>'nuipNuit'),''),nullif(trim(p_new_data->>'nuip'),'')),
    nullif(trim(p_new_data->>'oficinaRegistro'),''),nullif(trim(p_new_data->>'serialRegCivil'),''),v_registry_date,
    nullif(trim(p_new_data->>'fatherName'),''),coalesce(nullif(trim(p_new_data->>'ceduPadre'),''),nullif(trim(p_new_data->>'cedulaPadre'),'')),
    nullif(trim(p_new_data->>'motherName'),''),coalesce(nullif(trim(p_new_data->>'ceduMadre'),''),nullif(trim(p_new_data->>'cedulaMadre'),'')),
    nullif(trim(p_new_data->>'tipoUnionPadres'),''),nullif(p_new_data->>'paternalGrandparents',''),nullif(p_new_data->>'maternalGrandparents',''),
    nullif(p_new_data->>'godparents',''),coalesce(nullif(trim(p_new_data->>'minister'),''),nullif(trim(p_new_data->>'ministro'),'')),
    coalesce(nullif(trim(p_new_data->>'ministerFaith'),''),nullif(trim(p_new_data->>'daFe'),'')),
    'seated',p_replacement_note,
    coalesce(p_new_data,'{}'::jsonb) || jsonb_build_object(
      'Libro',lpad(v_book::text,4,'0'),'folio',lpad(v_folio::text,4,'0'),'numero',lpad(v_number::text,4,'0'),
      'book_number',lpad(v_book::text,4,'0'),'page_number',lpad(v_folio::text,4,'0'),'entry_number',lpad(v_number::text,4,'0'),
      'notaMarginal',p_replacement_note,'status','seated','estado','permanente','isSupplementary',true,'tipoIdentidad','id_creada_reposicion'
    )
  ) returning id into v_new_id;

  v_next_book:=v_book; v_next_folio:=v_folio; v_next_number:=v_number;
  if v_restart then
    if v_next_number>=v_limit then v_next_folio:=v_next_folio+1; v_next_number:=1;
    else v_next_number:=v_next_number+1; end if;
  else
    v_next_number:=v_next_number+1;
    if mod(v_next_number-1,v_limit)=0 then v_next_folio:=v_next_folio+1; end if;
  end if;

  v_next_params:=jsonb_set(jsonb_set(jsonb_set(v_params,'{suplementarioLibro}',to_jsonb(v_next_book),true),'{suplementarioFolio}',to_jsonb(v_next_folio),true),'{suplementarioNumero}',to_jsonb(v_next_number),true);
  update public.parish_parameters set bautizos_params=v_next_params,updated_at=now() where parish_id=p_parish_id;

  v_payload:=coalesce(p_decree_payload,'{}'::jsonb) || jsonb_build_object(
    'sacramentType','bautismo','sacramento','bautismo','decreeNumber',trim(p_decree_number),
    'decreeDate',p_decree_date,'conceptoAnulacionId',p_concept_id,'newPartidaId',v_new_id,
    'targetParishId',p_parish_id,'issuedFrom',v_role,
    'newPartidaSummary',coalesce(p_decree_payload->'newPartidaSummary','{}'::jsonb) || jsonb_build_object(
      'book',lpad(v_book::text,4,'0'),'page',lpad(v_folio::text,4,'0'),'entry',lpad(v_number::text,4,'0')
    )
  );

  insert into public.decretos(
    parish_id,diocese_id,chancery_id,tipo,sacrament_type,decree_number,decree_date,
    original_record_id,replacement_record_id,status,issued_by,payload
  ) values (
    p_parish_id,v_parish_diocese,v_chancery,'reposicion','bautismo',trim(p_decree_number),p_decree_date,
    null,v_new_id,'active',auth.uid(),v_payload
  ) returning id into v_decree_id;

  insert into public.marginal_notes(
    sacrament_type,note_type,decree_number,content,parish_id,sacrament_id,note_date,
    source_type,source_id,decree_id,created_by,status
  ) values (
    'bautismo','reposicion_supletoria',trim(p_decree_number),p_replacement_note,p_parish_id,v_new_id,p_decree_date,
    'decree',v_decree_id,v_decree_id,auth.uid(),'active'
  );

  if v_role in ('chancery','diocese','admin_general') then
    insert into public.official_notifications(
      diocese_id,sender_chancery_id,receiver_parish_id,decree_id,category,subject,message,status,payload,created_by
    ) values (
      v_parish_diocese,v_chancery,p_parish_id,v_decree_id,'decree',
      'Decreto de reposición de Bautismo '||trim(p_decree_number),
      'Se ha registrado un decreto de reposición que crea una partida supletoria de Bautismo en esta parroquia.',
      'pending',jsonb_build_object('sacramentType','bautismo','decreeType','reposicion','decreeNumber',trim(p_decree_number),'replacementRecordId',v_new_id),auth.uid()
    ) on conflict (decree_id,receiver_parish_id,category) where decree_id is not null do nothing;
  end if;

  insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
  values
    (auth.uid(),p_parish_id,v_parish_diocese,'baptism',v_new_id,'create_replacement_by_decree',p_new_data || jsonb_build_object('book',v_book,'folio',v_folio,'number',v_number),jsonb_build_object('decree_id',v_decree_id,'decree_number',trim(p_decree_number))),
    (auth.uid(),p_parish_id,v_parish_diocese,'decree',v_decree_id,'issue',v_payload,jsonb_build_object('sacrament_type','bautismo','decree_type','reposicion'));

  return query select v_decree_id,v_new_id,lpad(v_book::text,4,'0'),lpad(v_folio::text,4,'0'),lpad(v_number::text,4,'0');
end;
$$;

revoke all on function public.apply_baptism_replacement(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer) from public;
grant execute on function public.apply_baptism_replacement(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer) to authenticated;

comment on function public.apply_baptism_replacement(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer)
is 'Crea atómicamente una reposición de Bautismo con partida supletoria, consecutivo, decreto, nota marginal, aviso institucional y auditoría.';
