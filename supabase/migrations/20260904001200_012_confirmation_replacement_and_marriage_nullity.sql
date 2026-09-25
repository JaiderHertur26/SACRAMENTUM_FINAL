-- SACRAMENTUM - Fase 2.12
-- Reposición de Confirmación + Nulidad Matrimonial institucional.
-- Operaciones jurídicas exclusivas de Cancillería/Diócesis/Admin y auditadas.

-- --------------------------------------------------------------------------
-- 1. REPOSICIÓN DE CONFIRMACIÓN
-- --------------------------------------------------------------------------
create or replace function public.apply_confirmation_replacement(
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
  replacement_confirmation_id uuid,
  book_number text,
  folio text,
  number text
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text; v_user_diocese uuid; v_chancery uuid; v_parish_diocese uuid;
  v_params jsonb; v_book integer; v_folio integer; v_number integer; v_limit integer; v_restart boolean;
  v_next_book integer; v_next_folio integer; v_next_number integer; v_next_params jsonb;
  v_new_id uuid; v_decree_id uuid; v_payload jsonb;
  v_celebration date; v_birth date; v_baptism date;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  select lower(coalesce(role,'')),diocese_id,chancery_id
    into v_role,v_user_diocese,v_chancery
  from public.user_profiles
  where auth_user_id=auth.uid() and coalesce(is_active,true)=true limit 1;

  if v_role not in ('chancery','diocese','admin_general') then
    raise exception 'Sólo Cancillería, Diócesis o Administración General pueden emitir una reposición de Confirmación';
  end if;

  select diocese_id into v_parish_diocese from public.parishes where id=p_parish_id;
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
  if exists(select 1 from public.decretos d where d.diocese_id=v_parish_diocese and lower(trim(coalesce(d.decree_number,'')))=lower(trim(p_decree_number))) then
    raise exception 'El número de decreto % ya existe en esta diócesis',p_decree_number;
  end if;

  select confirmaciones_params into v_params from public.parish_parameters where parish_id=p_parish_id for update;
  if not found then raise exception 'La parroquia no tiene parámetros de Confirmación configurados'; end if;

  v_book:=greatest(coalesce(nullif(v_params->>'suplementarioLibro','')::integer,1),1);
  v_folio:=greatest(coalesce(nullif(v_params->>'suplementarioFolio','')::integer,1),1);
  v_number:=greatest(coalesce(nullif(v_params->>'suplementarioNumero','')::integer,1),1);
  v_limit:=greatest(coalesce(nullif(v_params->>'suplementarioPartidas','')::integer,2),1);
  v_restart:=coalesce((v_params->>'suplementarioReiniciar')::boolean,false);

  if v_book<>p_expected_book or v_folio<>p_expected_folio or v_number<>p_expected_number then
    raise exception 'El consecutivo supletorio cambió. Recargue la parroquia antes de emitir el decreto.';
  end if;
  if exists(select 1 from public.confirmations where parish_id=p_parish_id and book_number=lpad(v_book::text,4,'0') and folio=lpad(v_folio::text,4,'0') and number=lpad(v_number::text,4,'0')) then
    raise exception 'El consecutivo supletorio Libro %, Folio %, Número % ya está ocupado',v_book,v_folio,v_number;
  end if;

  v_celebration:=case when coalesce(p_new_data->>'fechaSacramento','')~'^\d{4}-\d{2}-\d{2}$' then (p_new_data->>'fechaSacramento')::date else null end;
  v_birth:=case when coalesce(p_new_data->>'fechaNacimiento','')~'^\d{4}-\d{2}-\d{2}$' then (p_new_data->>'fechaNacimiento')::date else null end;
  v_baptism:=case when coalesce(p_new_data->>'fechaBautismo','')~'^\d{4}-\d{2}-\d{2}$' then (p_new_data->>'fechaBautismo')::date else null end;
  if v_celebration is null then raise exception 'La fecha de Confirmación es obligatoria'; end if;
  if nullif(trim(coalesce(p_new_data->>'nombres','')),'') is null or nullif(trim(coalesce(p_new_data->>'apellidos','')),'') is null then
    raise exception 'Nombres y apellidos son obligatorios';
  end if;

  insert into public.confirmations(
    parish_id,book_number,folio,number,celebration_date,nombres,apellidos,sexo,
    fecha_nacimiento,lugar_nacimiento,fecha_bautismo,lugar_bautismo,nuip,direccion,numero_registro,hora_sacramento,
    nombre_padre,cedula_padre,nombre_madre,cedula_madre,abuelos_paternos,abuelos_maternos,tipo_union_padres,
    padrinos,ministro,da_fe,observations,status,nota_marginal,raw_data
  ) values (
    p_parish_id,lpad(v_book::text,4,'0'),lpad(v_folio::text,4,'0'),lpad(v_number::text,4,'0'),v_celebration,
    nullif(trim(p_new_data->>'nombres'),''),nullif(trim(p_new_data->>'apellidos'),''),nullif(trim(p_new_data->>'sexo'),''),
    v_birth,nullif(trim(p_new_data->>'lugarNacimiento'),''),v_baptism,nullif(trim(p_new_data->>'lugarBautismo'),''),
    nullif(trim(p_new_data->>'nuip'),''),nullif(trim(p_new_data->>'direccion'),''),nullif(trim(p_new_data->>'numeroRegistro'),''),nullif(trim(p_new_data->>'horaSacramento'),''),
    nullif(trim(p_new_data->>'nombrePadre'),''),nullif(trim(p_new_data->>'cedulaPadre'),''),nullif(trim(p_new_data->>'nombreMadre'),''),nullif(trim(p_new_data->>'cedulaMadre'),''),
    nullif(p_new_data->>'abuelosPaternos',''),nullif(p_new_data->>'abuelosMaternos',''),nullif(trim(p_new_data->>'tipoUnionPadres'),''),
    nullif(trim(p_new_data->>'padrinos'),''),nullif(trim(p_new_data->>'ministro'),''),nullif(trim(p_new_data->>'daFe'),''),nullif(p_new_data->>'observaciones',''),
    'seated',p_replacement_note,
    coalesce(p_new_data,'{}'::jsonb)||jsonb_build_object(
      'Libro',lpad(v_book::text,4,'0'),'folio',lpad(v_folio::text,4,'0'),'numero',lpad(v_number::text,4,'0'),
      'book_number',lpad(v_book::text,4,'0'),'notaMarginal',p_replacement_note,'status','seated','estado','permanente',
      'isSupplementary',true,'tipoIdentidad','id_creada_reposicion_confirmacion'
    )
  ) returning id into v_new_id;

  v_next_book:=v_book; v_next_folio:=v_folio; v_next_number:=v_number;
  if v_restart then
    if v_next_number>=v_limit then v_next_folio:=v_next_folio+1; v_next_number:=1; else v_next_number:=v_next_number+1; end if;
  else
    v_next_number:=v_next_number+1;
    if mod(v_next_number-1,v_limit)=0 then v_next_folio:=v_next_folio+1; end if;
  end if;
  v_next_params:=jsonb_set(jsonb_set(jsonb_set(v_params,'{suplementarioLibro}',to_jsonb(v_next_book),true),'{suplementarioFolio}',to_jsonb(v_next_folio),true),'{suplementarioNumero}',to_jsonb(v_next_number),true);
  update public.parish_parameters set confirmaciones_params=v_next_params,updated_at=now() where parish_id=p_parish_id;

  v_payload:=coalesce(p_decree_payload,'{}'::jsonb)||jsonb_build_object(
    'sacramentType','confirmacion','sacramento','confirmacion','decreeNumber',trim(p_decree_number),'decreeDate',p_decree_date,
    'conceptoAnulacionId',p_concept_id,'newPartidaId',v_new_id,'targetParishId',p_parish_id,'issuedFrom',v_role,
    'newPartidaSummary',coalesce(p_decree_payload->'newPartidaSummary','{}'::jsonb)||jsonb_build_object('book',lpad(v_book::text,4,'0'),'page',lpad(v_folio::text,4,'0'),'entry',lpad(v_number::text,4,'0'))
  );
  insert into public.decretos(parish_id,diocese_id,chancery_id,tipo,sacrament_type,decree_number,decree_date,replacement_record_id,status,issued_by,payload)
  values(p_parish_id,v_parish_diocese,v_chancery,'reposicion','confirmacion',trim(p_decree_number),p_decree_date,v_new_id,'active',auth.uid(),v_payload)
  returning id into v_decree_id;

  insert into public.marginal_notes(sacrament_type,note_type,decree_number,content,parish_id,sacrament_id,note_date,source_type,source_id,decree_id,created_by,status)
  values('confirmacion','reposicion_supletoria',trim(p_decree_number),p_replacement_note,p_parish_id,v_new_id,p_decree_date,'decree',v_decree_id,v_decree_id,auth.uid(),'active');

  insert into public.official_notifications(diocese_id,sender_chancery_id,receiver_parish_id,decree_id,category,subject,message,status,payload,created_by)
  values(v_parish_diocese,v_chancery,p_parish_id,v_decree_id,'decree','Decreto de reposición de Confirmación '||trim(p_decree_number),
         'Cancillería ha emitido un decreto de reposición que crea una partida supletoria de Confirmación en esta parroquia.',
         'pending',jsonb_build_object('sacramentType','confirmacion','decreeType','reposicion','decreeNumber',trim(p_decree_number),'replacementRecordId',v_new_id),auth.uid())
  on conflict (decree_id,receiver_parish_id,category) where decree_id is not null do nothing;

  insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
  values
    (auth.uid(),p_parish_id,v_parish_diocese,'confirmation',v_new_id,'create_replacement_by_decree',p_new_data||jsonb_build_object('book',v_book,'folio',v_folio,'number',v_number),jsonb_build_object('decree_id',v_decree_id,'decree_number',trim(p_decree_number))),
    (auth.uid(),p_parish_id,v_parish_diocese,'decree',v_decree_id,'issue',v_payload,jsonb_build_object('sacrament_type','confirmacion','decree_type','reposicion'));

  return query select v_decree_id,v_new_id,lpad(v_book::text,4,'0'),lpad(v_folio::text,4,'0'),lpad(v_number::text,4,'0');
end;
$$;
revoke all on function public.apply_confirmation_replacement(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer) from public;
grant execute on function public.apply_confirmation_replacement(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer) to authenticated;

-- --------------------------------------------------------------------------
-- 2. REVERSIÓN GENÉRICA DE REPOSICIONES BAUTISMO/CONFIRMACIÓN
-- --------------------------------------------------------------------------
create or replace function public.reverse_replacement_decree(p_decree_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text; v_user_diocese uuid; v_decree public.decretos%rowtype; v_diocese uuid; v_replacement uuid;
  v_sacrament text; v_payload jsonb; v_book text; v_folio text; v_number text; v_match_count integer;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  select lower(coalesce(role,'')),diocese_id into v_role,v_user_diocese
  from public.user_profiles where auth_user_id=auth.uid() and coalesce(is_active,true)=true limit 1;
  if v_role not in ('chancery','diocese','admin_general') then raise exception 'Sólo Cancillería, Diócesis o Administración General pueden revertir una reposición'; end if;

  select * into v_decree from public.decretos where id=p_decree_id for update;
  if not found then raise exception 'Decreto de reposición no encontrado'; end if;
  if lower(coalesce(v_decree.tipo,''))<>'reposicion' then raise exception 'El decreto no corresponde a una reposición'; end if;
  if lower(coalesce(v_decree.status,'active'))='reversed' then return true; end if;
  select diocese_id into v_diocese from public.parishes where id=v_decree.parish_id;
  if v_role in ('chancery','diocese') and v_user_diocese is distinct from v_diocese then raise exception 'La reposición está fuera de su jurisdicción'; end if;

  v_payload:=coalesce(v_decree.payload,'{}'::jsonb);
  v_sacrament:=lower(coalesce(nullif(v_decree.sacrament_type,''),nullif(v_payload->>'sacramentType',''),nullif(v_payload->>'sacramento',''),'bautismo'));
  v_replacement:=v_decree.replacement_record_id;
  if v_replacement is null and coalesce(v_payload->>'newPartidaId','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then v_replacement:=(v_payload->>'newPartidaId')::uuid; end if;

  if v_replacement is null then
    v_book:=coalesce(v_payload#>>'{newPartidaSummary,book}',v_payload#>>'{datosNuevaPartida,book}',v_payload#>>'{datosNuevaPartida,book_number}');
    v_folio:=coalesce(v_payload#>>'{newPartidaSummary,page}',v_payload#>>'{datosNuevaPartida,page}',v_payload#>>'{datosNuevaPartida,page_number}',v_payload#>>'{datosNuevaPartida,folio}');
    v_number:=coalesce(v_payload#>>'{newPartidaSummary,entry}',v_payload#>>'{datosNuevaPartida,entry}',v_payload#>>'{datosNuevaPartida,entry_number}',v_payload#>>'{datosNuevaPartida,numero}');
    if nullif(v_book,'') is not null and nullif(v_folio,'') is not null and nullif(v_number,'') is not null then
      if v_sacrament in ('confirmacion','confirmation','confirmaciones') then
        select count(*),min(id) into v_match_count,v_replacement from public.confirmations
        where parish_id=v_decree.parish_id and ltrim(trim(coalesce(book_number,'')),'0')=ltrim(trim(v_book),'0') and ltrim(trim(coalesce(folio,'')),'0')=ltrim(trim(v_folio),'0') and ltrim(trim(coalesce(number,'')),'0')=ltrim(trim(v_number),'0');
      else
        select count(*),min(id) into v_match_count,v_replacement from public.baptisms
        where parish_id=v_decree.parish_id and ltrim(trim(coalesce(book_number,'')),'0')=ltrim(trim(v_book),'0') and ltrim(trim(coalesce(folio,'')),'0')=ltrim(trim(v_folio),'0') and ltrim(trim(coalesce(number,'')),'0')=ltrim(trim(v_number),'0');
      end if;
      if v_match_count>1 then raise exception 'La reposición histórica coincide con varias partidas; requiere conciliación manual'; end if;
    end if;
  end if;
  if v_replacement is null then raise exception 'No se pudo identificar de forma segura la partida supletoria'; end if;

  if v_sacrament in ('confirmacion','confirmation','confirmaciones') then
    update public.confirmations set status='reversed',raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object('status','reversed','estado','revertida','replacementReversedByDecreeId',v_decree.id,'replacementReversedAt',now()),updated_at=now()
    where id=v_replacement and parish_id=v_decree.parish_id;
  else
    update public.baptisms set status='reversed',raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object('status','reversed','estado','revertida','replacementReversedByDecreeId',v_decree.id,'replacementReversedAt',now()),updated_at=now()
    where id=v_replacement and parish_id=v_decree.parish_id;
  end if;
  if not found then raise exception 'La partida supletoria vinculada no existe en la parroquia'; end if;

  update public.marginal_notes set status='reversed',updated_at=now() where decree_id=v_decree.id or (source_type='decree' and source_id=v_decree.id);
  update public.official_notifications set status='cancelled',updated_at=now() where decree_id=v_decree.id and lower(coalesce(status,'pending'))<>'cancelled';
  update public.decretos set status='reversed',updated_at=now(),replacement_record_id=coalesce(replacement_record_id,v_replacement),payload=v_payload||jsonb_build_object('status','reversed','reversedAt',now(),'reversedBy',auth.uid(),'newPartidaId',v_replacement) where id=v_decree.id;
  insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,before_data,after_data,metadata)
  values(auth.uid(),v_decree.parish_id,v_diocese,'decree',v_decree.id,'reverse_replacement',to_jsonb(v_decree),jsonb_build_object('status','reversed','replacement_record_id',v_replacement),jsonb_build_object('sacrament_type',v_sacrament,'sequence_reused',false));
  return true;
end;
$$;
revoke all on function public.reverse_replacement_decree(uuid) from public;
grant execute on function public.reverse_replacement_decree(uuid) to authenticated;

-- --------------------------------------------------------------------------
-- 3. NULIDAD MATRIMONIAL: registra sentencia/decreto, conserva el matrimonio
--    y agrega notas marginales sin borrar la partida original.
-- --------------------------------------------------------------------------
create or replace function public.apply_marriage_nullity(
  p_marriage_id uuid,
  p_decree_number text,
  p_decree_date date,
  p_reason text,
  p_decree_payload jsonb default '{}'::jsonb,
  p_baptism_ids uuid[] default null
)
returns table(decree_id uuid, marriage_id uuid, decree_number text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text; v_user_diocese uuid; v_chancery uuid; v_marriage public.marriages%rowtype; v_diocese uuid;
  v_decree_id uuid; v_payload jsonb; v_note text; v_baptism_id uuid; v_baptism_parish uuid;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  select lower(coalesce(role,'')),diocese_id,chancery_id into v_role,v_user_diocese,v_chancery
  from public.user_profiles where auth_user_id=auth.uid() and coalesce(is_active,true)=true limit 1;
  if v_role not in ('chancery','diocese','admin_general') then raise exception 'Sólo Cancillería, Diócesis o Administración General pueden registrar una nulidad matrimonial'; end if;
  if nullif(trim(p_decree_number),'') is null or p_decree_date is null then raise exception 'Número y fecha de sentencia/decreto son obligatorios'; end if;

  select * into v_marriage from public.marriages where id=p_marriage_id for update;
  if not found then raise exception 'Partida matrimonial no encontrada'; end if;
  select diocese_id into v_diocese from public.parishes where id=v_marriage.parish_id;
  if v_diocese is null then raise exception 'La parroquia del matrimonio no tiene diócesis'; end if;
  if v_role in ('chancery','diocese') and v_user_diocese is distinct from v_diocese then raise exception 'El matrimonio está fuera de su jurisdicción'; end if;
  if lower(coalesce(v_marriage.status,'')) in ('nullified','nulo','anulada','annulled') then raise exception 'El matrimonio ya consta como declarado nulo'; end if;
  if exists(select 1 from public.decretos where diocese_id=v_diocese and lower(trim(coalesce(decree_number,'')))=lower(trim(p_decree_number))) then raise exception 'El número de decreto/sentencia % ya existe en esta diócesis',p_decree_number; end if;

  v_note:='ESTE MATRIMONIO FUE DECLARADO NULO MEDIANTE SENTENCIA DEL TRIBUNAL ECLESIÁSTICO. DECRETO NO. '||upper(trim(p_decree_number))||' DE FECHA '||to_char(p_decree_date,'DD/MM/YYYY')||'.';
  if nullif(trim(coalesce(p_reason,'')),'') is not null then v_note:=v_note||' '||upper(trim(p_reason)); end if;
  v_payload:=coalesce(p_decree_payload,'{}'::jsonb)||jsonb_build_object('sacramentType','matrimonio','sacramento','matrimonio','decreeType','nulidad_matrimonial','decreeNumber',trim(p_decree_number),'decreeDate',p_decree_date,'marriageId',p_marriage_id,'reason',p_reason,'issuedFrom',v_role);

  update public.marriages set status='nullified',observations=concat_ws(E'\n\n',nullif(observations,''),v_note),raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object('status','nullified','nullityDecree',trim(p_decree_number),'nullityDate',p_decree_date,'nullityReason',p_reason,'notaMarginal',v_note),updated_at=now() where id=p_marriage_id;

  insert into public.decretos(parish_id,diocese_id,chancery_id,tipo,sacrament_type,decree_number,decree_date,original_record_id,status,issued_by,payload)
  values(v_marriage.parish_id,v_diocese,v_chancery,'nulidad_matrimonial','matrimonio',trim(p_decree_number),p_decree_date,p_marriage_id,'active',auth.uid(),v_payload)
  returning id into v_decree_id;

  insert into public.marginal_notes(sacrament_type,note_type,decree_number,content,parish_id,sacrament_id,note_date,source_type,source_id,decree_id,created_by,status)
  values('matrimonio','nulidad_matrimonial',trim(p_decree_number),v_note,v_marriage.parish_id,p_marriage_id,p_decree_date,'decree',v_decree_id,v_decree_id,auth.uid(),'active');

  if p_baptism_ids is not null then
    foreach v_baptism_id in array p_baptism_ids loop
      select parish_id into v_baptism_parish from public.baptisms where id=v_baptism_id;
      if v_baptism_parish is not null and (v_role='admin_general' or exists(select 1 from public.parishes where id=v_baptism_parish and diocese_id=v_diocese)) then
        update public.baptisms set nota_marginal=concat_ws(E'\n\n',nullif(nota_marginal,''),v_note),raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object('notaMarginal',concat_ws(E'\n\n',nullif(nota_marginal,''),v_note)),updated_at=now() where id=v_baptism_id;
        insert into public.marginal_notes(sacrament_type,note_type,decree_number,content,parish_id,sacrament_id,note_date,source_type,source_id,decree_id,created_by,status)
        values('bautismo','nulidad_matrimonial',trim(p_decree_number),v_note,v_baptism_parish,v_baptism_id,p_decree_date,'decree',v_decree_id,v_decree_id,auth.uid(),'active');
      end if;
    end loop;
  end if;

  insert into public.official_notifications(diocese_id,sender_chancery_id,receiver_parish_id,decree_id,category,subject,message,status,payload,created_by)
  values(v_diocese,v_chancery,v_marriage.parish_id,v_decree_id,'decree','Nulidad matrimonial '||trim(p_decree_number),'Se ha registrado una sentencia/decreto de nulidad que afecta una partida matrimonial de esta parroquia.','pending',jsonb_build_object('sacramentType','matrimonio','decreeType','nulidad_matrimonial','marriageId',p_marriage_id),auth.uid())
  on conflict (decree_id,receiver_parish_id,category) where decree_id is not null do nothing;

  insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,before_data,after_data,metadata)
  values
    (auth.uid(),v_marriage.parish_id,v_diocese,'marriage',p_marriage_id,'nullify_by_ecclesiastical_sentence',to_jsonb(v_marriage),jsonb_build_object('status','nullified','note',v_note),jsonb_build_object('decree_id',v_decree_id,'decree_number',trim(p_decree_number))),
    (auth.uid(),v_marriage.parish_id,v_diocese,'decree',v_decree_id,'issue',null,v_payload,jsonb_build_object('sacrament_type','matrimonio','decree_type','nulidad_matrimonial'));

  return query select v_decree_id,p_marriage_id,trim(p_decree_number);
end;
$$;
revoke all on function public.apply_marriage_nullity(uuid,text,date,text,jsonb,uuid[]) from public;
grant execute on function public.apply_marriage_nullity(uuid,text,date,text,jsonb,uuid[]) to authenticated;
