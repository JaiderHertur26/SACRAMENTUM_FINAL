-- V136 · Protección de reversiones de Bautismo y Confirmación: bloqueo sobre estados posteriores y decretos concurrentes.
-- V136 · reverse_correction_decree
CREATE OR REPLACE FUNCTION public.reverse_correction_decree(p_decree_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- La reversión histórica no puede volver a habilitar un original modificado
  -- ni invalidar una supletoria que ya recibió una actuación registral posterior.
  if v_decree.sacrament_type in ('bautismo','confirmacion') then
    if v_decree.replacement_record_id is null
       or v_decree.replacement_record_id=v_decree.original_record_id then
      raise exception 'Corrección sin pareja original/supletoria inequívoca: exige conciliación manual'
      using errcode='23514';
    end if;
    if exists (
       select 1 from public.decretos later
       where later.id<>v_decree.id
         and lower(coalesce(later.status,'')) in ('active','archived')
         and (later.original_record_id in (v_decree.original_record_id,v_decree.replacement_record_id)
           or later.replacement_record_id in (v_decree.original_record_id,v_decree.replacement_record_id))
    ) then
      raise exception 'Hay un decreto posterior o concurrente vigente sobre una de las partidas: conciliación obligatoria'
      using errcode='23514';
    end if;
    if v_decree.sacrament_type='bautismo' then
      perform 1 from public.baptisms b
        where b.id=v_decree.original_record_id and b.parish_id=v_decree.parish_id
          and lower(coalesce(b.status,'')) in ('anulada','annulled') for update;
      if not found then raise exception 'Original de Bautismo ya no se encuentra anulado; reversión tardía bloqueada'
        using errcode='23514'; end if;
      perform 1 from public.baptisms b
        where b.id=v_decree.replacement_record_id and b.parish_id=v_decree.parish_id
          and lower(coalesce(b.status,''))='seated' for update;
      if not found then raise exception 'Supletoria de Bautismo ya no está vigente; reversión tardía bloqueada'
        using errcode='23514'; end if;
    else
      perform 1 from public.confirmations c
        where c.id=v_decree.original_record_id and c.parish_id=v_decree.parish_id
          and lower(coalesce(c.status,'')) in ('anulada','annulled') for update;
      if not found then raise exception 'Original de Confirmación ya no se encuentra anulado; reversión tardía bloqueada'
        using errcode='23514'; end if;
      perform 1 from public.confirmations c
        where c.id=v_decree.replacement_record_id and c.parish_id=v_decree.parish_id
          and lower(coalesce(c.status,''))='seated' for update;
      if not found then raise exception 'Supletoria de Confirmación ya no está vigente; reversión tardía bloqueada'
        using errcode='23514'; end if;
    end if;
  end if;

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
$function$;

-- V136 · reverse_replacement_decree
CREATE OR REPLACE FUNCTION public.reverse_replacement_decree(p_decree_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  if lower(coalesce(v_decree.status,'')) not in ('active','archived') then
    raise exception 'Decreto de reposición no reversible en su estado actual' using errcode='23514';
  end if;
  if v_decree.original_record_id is not null then
    raise exception 'Reposición con partida original ligada: requiere conciliación antes de revertir'
    using errcode='23514';
  end if;
  if exists (
     select 1 from public.decretos later
     where later.id<>v_decree.id
       and lower(coalesce(later.status,'')) in ('active','archived')
       and (later.original_record_id=v_replacement or later.replacement_record_id=v_replacement)
  ) then
    raise exception 'La supletoria tiene un decreto vigente posterior o concurrente: reversión detenida'
    using errcode='23514';
  end if;
  if v_sacrament in ('confirmacion','confirmation','confirmaciones') then
    perform 1 from public.confirmations c where c.id=v_replacement
      and c.parish_id=v_decree.parish_id and lower(coalesce(c.status,''))='seated'
      for update;
    if not found then raise exception 'La supletoria de Confirmación cambió de estado: reversión denegada'
      using errcode='23514'; end if;
  elsif v_sacrament in ('bautismo','baptism','bautismos') then
    perform 1 from public.baptisms b where b.id=v_replacement
      and b.parish_id=v_decree.parish_id and lower(coalesce(b.status,''))='seated'
      for update;
    if not found then raise exception 'La supletoria de Bautismo cambió de estado: reversión denegada'
      using errcode='23514'; end if;
  else
    raise exception 'Tipo sacramental ajeno a reposición de Bautismo/Confirmación' using errcode='23514';
  end if;

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
$function$;
