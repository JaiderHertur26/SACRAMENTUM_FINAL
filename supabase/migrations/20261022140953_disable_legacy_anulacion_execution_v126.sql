-- V126 · Cuatro entradas históricas nunca pueden ejecutar ANULACION como mutación registral.
-- No cambia lotes ni decretos, sólo funciones. V118 sigue siendo la ruta de archivo verificado.
-- protected apply_legacy_import_batch
CREATE OR REPLACE FUNCTION public.apply_legacy_import_batch(p_batch_id uuid, p_limit integer DEFAULT 250)
 RETURNS TABLE(imported integer, failed integer, remaining integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_batch public.legacy_import_batches%rowtype;
  v_profile public.legacy_import_profiles%rowtype;
  r public.legacy_import_rows%rowtype;
  d jsonb;
  v_target uuid;
  v_existing uuid;
  v_diocese uuid;
  v_imported integer:=0; v_failed integer:=0;
  v_book text; v_folio text; v_number text;
  v_date date; v_birth date; v_date2 date;
  v_source_key text;
  v_doc_code text;
  v_vars text[];
  v_sacrament text;
  v_original uuid; v_new uuid; v_decree uuid;
  v_concept text;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if p_limit<1 or p_limit>1000 then raise exception 'Límite inválido'; end if;
  select * into v_batch from public.legacy_import_batches where id=p_batch_id for update;
  if not found then raise exception 'Lote no encontrado'; end if;
  if upper(coalesce(v_batch.profile_key,''))='ANULACION' then
    raise exception 'ANULACION debe conciliarse en Cancillería desde el origen histórico verificado; no ejecutar efectos registrales mediante importación legacy.' using errcode='42501';
  end if;
  if not public.can_manage_legacy_import(v_batch.parish_id,v_batch.diocese_id) then raise exception 'No autorizado'; end if;
  select * into v_profile from public.legacy_import_profiles where profile_key=v_batch.profile_key;
  v_diocese:=v_batch.diocese_id;
  update public.legacy_import_batches set status='importing',updated_at=now() where id=p_batch_id;

  for r in
    select * from public.legacy_import_rows
    where batch_id=p_batch_id and status='valid'
    order by row_number
    limit p_limit
    for update skip locked
  loop
    begin
      d:=r.normalized_data;
      v_target:=null; v_existing:=null;
      v_source_key:=coalesce(r.source_key,r.row_number::text);

      -- Idempotencia entre lotes.
      select l.target_id into v_existing from public.legacy_record_links l
       where l.source_system=v_batch.source_system and l.profile_key=v_batch.profile_key and l.source_key=v_source_key;
      if v_existing is not null then
        update public.legacy_import_rows set status='duplicate',target_id=v_existing,imported_at=now(),updated_at=now() where id=r.id;
        continue;
      end if;

      if r.target_entity='baptism' then
        if v_batch.parish_id is null then raise exception 'Parroquia destino requerida'; end if;
        v_book:=public.sacramentum_registry_ref(d->>'book_number'); v_folio:=public.sacramentum_registry_ref(d->>'folio'); v_number:=public.sacramentum_registry_ref(d->>'number');
        if v_book is null or v_folio is null or v_number is null then raise exception 'Libro/Folio/Número incompletos'; end if;
        if exists(select 1 from public.baptisms b where b.parish_id=v_batch.parish_id and public.sacramentum_registry_ref(b.book_number)=v_book and public.sacramentum_registry_ref(b.folio)=v_folio and public.sacramentum_registry_ref(b.number)=v_number) then
          select id into v_target from public.baptisms b where b.parish_id=v_batch.parish_id and public.sacramentum_registry_ref(b.book_number)=v_book and public.sacramentum_registry_ref(b.folio)=v_folio and public.sacramentum_registry_ref(b.number)=v_number limit 1;
        else
          begin v_date:=nullif(d->>'celebration_date','')::date; exception when others then raise exception 'Fecha de Bautismo inválida'; end;
          begin v_birth:=nullif(d->>'birth_date','')::date; exception when others then raise exception 'Fecha de nacimiento inválida'; end;
          begin v_date2:=nullif(d->>'civil_registry_date','')::date; exception when others then raise exception 'Fecha de Registro Civil inválida'; end;
          insert into public.baptisms(parish_id,book_number,folio,number,status,celebration_date,lugar_bautismo,apellidos,nombres,sexo,fecha_nacimiento,lugar_nacimiento,tipo_union_padres,nombre_padre,cedula_padre,nombre_madre,cedula_madre,abuelos_paternos,abuelos_maternos,padrinos,ministro,da_fe,nuip,numero_registro,oficina_registro,fecha_expedicion_registro,direccion,observations,nota_marginal,raw_data)
          values(v_batch.parish_id,v_book,v_folio,v_number,case when coalesce((d->>'annulled')::boolean,false) then 'anulada' else 'seated' end,v_date,nullif(d->>'celebration_place',''),nullif(d->>'last_names',''),nullif(d->>'names',''),nullif(d->>'gender',''),v_birth,nullif(d->>'birth_place',''),nullif(d->>'parent_union_type',''),nullif(d->>'father_name',''),nullif(d->>'father_document',''),nullif(d->>'mother_name',''),nullif(d->>'mother_document',''),nullif(d->>'paternal_grandparents',''),nullif(d->>'maternal_grandparents',''),nullif(d->>'godparents',''),nullif(d->>'minister',''),nullif(d->>'legacy_dafe_code',''),nullif(d->>'nuip',''),nullif(d->>'civil_registry_number',''),nullif(d->>'civil_registry_office',''),v_date2,nullif(d->>'address',''),nullif(d->>'observations',''),nullif(d->>'legacy_marginal_note',''),coalesce(r.original_data,'{}'::jsonb)||jsonb_build_object('legacy_normalized',d,'source','legacy_import')) returning id into v_target;
        end if;

      elsif r.target_entity='confirmation' then
        if v_batch.parish_id is null then raise exception 'Parroquia destino requerida'; end if;
        v_book:=public.sacramentum_registry_ref(d->>'book_number'); v_folio:=public.sacramentum_registry_ref(d->>'folio'); v_number:=public.sacramentum_registry_ref(d->>'number');
        if v_book is null or v_folio is null or v_number is null then raise exception 'Libro/Folio/Número incompletos'; end if;
        if exists(select 1 from public.confirmations c where c.parish_id=v_batch.parish_id and public.sacramentum_registry_ref(c.book_number)=v_book and public.sacramentum_registry_ref(c.folio)=v_folio and public.sacramentum_registry_ref(c.number)=v_number) then
          select id into v_target from public.confirmations c where c.parish_id=v_batch.parish_id and public.sacramentum_registry_ref(c.book_number)=v_book and public.sacramentum_registry_ref(c.folio)=v_folio and public.sacramentum_registry_ref(c.number)=v_number limit 1;
        else
          begin v_date:=nullif(d->>'celebration_date','')::date; exception when others then raise exception 'Fecha de Confirmación inválida'; end;
          if v_date is null then raise exception 'Fecha de Confirmación obligatoria'; end if;
          begin v_birth:=nullif(d->>'birth_date','')::date; exception when others then raise exception 'Fecha de nacimiento inválida'; end;
          begin v_date2:=nullif(d->>'baptism_date','')::date; exception when others then raise exception 'Fecha de Bautismo inválida'; end;
          insert into public.confirmations(parish_id,book_number,folio,number,status,celebration_date,fecha_nacimiento,fecha_bautismo,lugar_bautismo,lugar_nacimiento,apellidos,nombres,sexo,nombre_padre,nombre_madre,padrinos,ministro,da_fe,observations,raw_data)
          values(v_batch.parish_id,v_book,v_folio,v_number,case when coalesce((d->>'annulled')::boolean,false) then 'anulada' else 'seated' end,v_date,v_birth,v_date2,nullif(d->>'baptism_place',''),nullif(d->>'birth_place',''),nullif(d->>'last_names',''),nullif(d->>'names',''),nullif(d->>'gender',''),nullif(d->>'father_name',''),nullif(d->>'mother_name',''),nullif(d->>'sponsor',''),nullif(d->>'minister',''),nullif(d->>'legacy_dafe_code',''),nullif(d->>'observations',''),coalesce(r.original_data,'{}'::jsonb)||jsonb_build_object('legacy_normalized',d,'source','legacy_import')) returning id into v_target;
        end if;

      elsif r.target_entity='marriage' then
        if v_batch.parish_id is null then raise exception 'Parroquia destino requerida'; end if;
        v_book:=public.sacramentum_registry_ref(d->>'book_number'); v_folio:=public.sacramentum_registry_ref(d->>'folio'); v_number:=public.sacramentum_registry_ref(d->>'number');
        if v_book is null or v_folio is null or v_number is null then raise exception 'Libro/Folio/Número incompletos'; end if;
        if exists(select 1 from public.marriages m where m.parish_id=v_batch.parish_id and public.sacramentum_registry_ref(m.book_number)=v_book and public.sacramentum_registry_ref(m.folio)=v_folio and public.sacramentum_registry_ref(m.number)=v_number) then
          select id into v_target from public.marriages m where m.parish_id=v_batch.parish_id and public.sacramentum_registry_ref(m.book_number)=v_book and public.sacramentum_registry_ref(m.folio)=v_folio and public.sacramentum_registry_ref(m.number)=v_number limit 1;
        else
          begin v_date:=nullif(d->>'celebration_date','')::date; exception when others then raise exception 'Fecha de Matrimonio inválida'; end;
          if v_date is null then raise exception 'Fecha de Matrimonio obligatoria'; end if;
          insert into public.marriages(parish_id,celebration_date,book_number,folio,number,observations,status,raw_data)
          values(v_batch.parish_id,v_date,v_book,v_folio,v_number,nullif(d->>'observations',''),case when coalesce((d->>'annulled')::boolean,false) then 'annulled' else 'seated' end,coalesce(r.original_data,'{}'::jsonb)||jsonb_build_object('legacy_normalized',d,'source','legacy_import')) returning id into v_target;
        end if;

      elsif r.target_entity='funeral' then
        if v_batch.parish_id is null then raise exception 'Parroquia destino requerida'; end if;
        v_book:=public.sacramentum_registry_ref(d->>'book_number'); v_folio:=public.sacramentum_registry_ref(d->>'folio'); v_number:=public.sacramentum_registry_ref(d->>'number');
        begin v_date:=nullif(d->>'death_date','')::date; exception when others then raise exception 'Fecha de defunción inválida'; end;
        if v_book is null or v_folio is null or v_number is null or v_date is null then raise exception 'Exequias incompletas'; end if;
        if exists(select 1 from public.funerals f where f.parish_id=v_batch.parish_id and public.sacramentum_registry_ref(f.book_number)=v_book and public.sacramentum_registry_ref(f.folio)=v_folio and public.sacramentum_registry_ref(f.number)=v_number) then
          select id into v_target from public.funerals f where f.parish_id=v_batch.parish_id and public.sacramentum_registry_ref(f.book_number)=v_book and public.sacramentum_registry_ref(f.folio)=v_folio and public.sacramentum_registry_ref(f.number)=v_number limit 1;
        else
          insert into public.funerals(parish_id,book_number,folio,number,status,nombres,apellidos,fecha_defuncion,lugar_defuncion,fecha_exequias,lugar_exequias,cementerio,ministro,da_fe,observations,raw_data)
          values(v_batch.parish_id,v_book,v_folio,v_number,'seated',nullif(d->>'names',''),nullif(d->>'last_names',''),v_date,nullif(d->>'death_place',''),nullif(d->>'funeral_date','')::date,nullif(d->>'funeral_place',''),nullif(d->>'cemetery',''),nullif(d->>'minister',''),nullif(d->>'legacy_dafe_code',''),nullif(d->>'observations',''),coalesce(r.original_data,'{}'::jsonb)||jsonb_build_object('legacy_normalized',d,'source','legacy_import')) returning id into v_target;
        end if;

      elsif r.target_entity='directory_diocese' then
        insert into public.directory_dioceses(legacy_code,name,nit,address,phone,fax,email,city,bishop_1,bishop_2,raw_data)
        values(nullif(d->>'legacy_code',''),coalesce(nullif(d->>'name',''),'SIN NOMBRE'),nullif(d->>'nit',''),nullif(d->>'address',''),nullif(d->>'phone',''),nullif(d->>'fax',''),nullif(d->>'email',''),nullif(d->>'city',''),nullif(d->>'bishop_1',''),nullif(d->>'bishop_2',''),r.original_data) returning id into v_target;

      elsif r.target_entity='directory_church' then
        insert into public.directory_churches(legacy_code,name,nit,address,city,phone,fax,email,priest_name,diocese_legacy_code,raw_data)
        values(nullif(d->>'legacy_code',''),coalesce(nullif(d->>'name',''),'SIN NOMBRE'),nullif(d->>'nit',''),nullif(d->>'address',''),nullif(d->>'city',''),nullif(d->>'phone',''),nullif(d->>'fax',''),nullif(d->>'email',''),nullif(d->>'priest_name',''),nullif(d->>'diocese_legacy_code',''),r.original_data) returning id into v_target;

      elsif r.target_entity='location_dictionary' then
        insert into public.location_dictionary(source,value,usage_count,weight,source_created_at,source_updated_at,source_user,metadata)
        values(nullif(d->>'source',''),coalesce(nullif(d->>'value',''),'SIN DATO'),coalesce((d->>'usage_count')::integer,0),coalesce((d->>'weight')::integer,0),nullif(d->>'source_created_at','')::timestamptz,nullif(d->>'source_updated_at','')::timestamptz,nullif(d->>'source_user',''),jsonb_build_object('legacy',r.original_data))
        on conflict ((coalesce(source,'')), (lower(value))) do update set usage_count=greatest(public.location_dictionary.usage_count,excluded.usage_count),weight=greatest(public.location_dictionary.weight,excluded.weight),updated_at=now()
        returning id into v_target;

      elsif r.target_entity='document_template' then
        v_doc_code:=coalesce(nullif(d->>'code',''),r.source_key,'LEGACY-'||r.row_number);
        v_vars:=array(select distinct m[1] from regexp_matches(coalesce(d->>'template_text',''),'<([^>]+)>','g') m);
        insert into public.document_templates(legacy_code,code,name,category,template_text,variables,scope_type,diocese_id,version,is_active,is_legacy,metadata,created_by)
        values(nullif(d->>'legacy_code',''),v_doc_code,coalesce(nullif(d->>'name',''),'Plantilla histórica'),coalesce(nullif(d->>'category',''),'legacy'),coalesce(d->>'template_text',''),coalesce(v_vars,'{}'::text[]),case when v_batch.diocese_id is null then 'system' else 'diocese' end,v_batch.diocese_id,1,true,true,jsonb_build_object('legacy',r.original_data),auth.uid()) returning id into v_target;

      elsif r.target_entity='annulment_concept' then
        if v_batch.diocese_id is null then raise exception 'Los conceptos requieren seleccionar diócesis destino'; end if;
        insert into public.conceptos_anulacion(diocese_id,seinscribe,gennota,gendocum,enlibro,expide,tipo,concepto,codigo,source_kind,source_reference)
        values(v_batch.diocese_id,coalesce((d->>'registers')::boolean,false),coalesce((d->>'generates_note')::boolean,false),coalesce((d->>'generates_document')::boolean,false),coalesce((d->>'book_mode')::integer,0),nullif(d->>'issuer',''),coalesce(nullif(d->>'type',''),'legacy'),coalesce(nullif(d->>'concept',''),'CONCEPTO LEGACY'),coalesce(nullif(d->>'code',''),r.source_key),'legacy_catalog','legacy_batch:'||v_batch.id::text||'/row:'||r.id::text)
        on conflict do nothing returning id into v_target;
        if v_target is null then select id into v_target from public.conceptos_anulacion where diocese_id=v_batch.diocese_id and codigo=coalesce(nullif(d->>'code',''),r.source_key) limit 1; end if;

      elsif r.target_entity='decree_link' then
        if v_batch.parish_id is null then raise exception 'Parroquia destino requerida'; end if;
        v_sacrament:=lower(coalesce(d->>'sacrament_type','bautismo'));
        v_book:=public.sacramentum_registry_ref(d->>'original_book'); v_folio:=public.sacramentum_registry_ref(d->>'original_folio'); v_number:=public.sacramentum_registry_ref(d->>'original_number');
        if v_sacrament in ('bautismo','baptism') then
          select id into v_original from public.baptisms where parish_id=v_batch.parish_id and public.sacramentum_registry_ref(book_number)=v_book and public.sacramentum_registry_ref(folio)=v_folio and public.sacramentum_registry_ref(number)=v_number limit 1;
          select id into v_new from public.baptisms where parish_id=v_batch.parish_id and public.sacramentum_registry_ref(book_number)=public.sacramentum_registry_ref(d->>'new_book') and public.sacramentum_registry_ref(folio)=public.sacramentum_registry_ref(d->>'new_folio') and public.sacramentum_registry_ref(number)=public.sacramentum_registry_ref(d->>'new_number') limit 1;
        elsif v_sacrament in ('confirmacion','confirmation') then
          select id into v_original from public.confirmations where parish_id=v_batch.parish_id and public.sacramentum_registry_ref(book_number)=v_book and public.sacramentum_registry_ref(folio)=v_folio and public.sacramentum_registry_ref(number)=v_number limit 1;
          select id into v_new from public.confirmations where parish_id=v_batch.parish_id and public.sacramentum_registry_ref(book_number)=public.sacramentum_registry_ref(d->>'new_book') and public.sacramentum_registry_ref(folio)=public.sacramentum_registry_ref(d->>'new_folio') and public.sacramentum_registry_ref(number)=public.sacramentum_registry_ref(d->>'new_number') limit 1;
        elsif v_sacrament in ('matrimonio','marriage') then
          select id into v_original from public.marriages where parish_id=v_batch.parish_id and public.sacramentum_registry_ref(book_number)=v_book and public.sacramentum_registry_ref(folio)=v_folio and public.sacramentum_registry_ref(number)=v_number limit 1;
          select id into v_new from public.marriages where parish_id=v_batch.parish_id and public.sacramentum_registry_ref(book_number)=public.sacramentum_registry_ref(d->>'new_book') and public.sacramentum_registry_ref(folio)=public.sacramentum_registry_ref(d->>'new_folio') and public.sacramentum_registry_ref(number)=public.sacramentum_registry_ref(d->>'new_number') limit 1;
        end if;
        if v_original is null then raise exception 'No se encontró la partida original para reconstruir el decreto'; end if;
        begin v_date:=nullif(d->>'decree_date','')::date; exception when others then v_date:=null; end;
        v_concept:=nullif(d->>'concept_code','');
        insert into public.decretos(parish_id,diocese_id,tipo,sacrament_type,decree_number,decree_date,original_record_id,replacement_record_id,status,payload,created_at)
        values(v_batch.parish_id,v_batch.diocese_id,'correction',v_sacrament,nullif(d->>'decree_number',''),v_date,v_original,v_new,'historical',coalesce(r.original_data,'{}'::jsonb)||jsonb_build_object('legacy_normalized',d,'concept_code',v_concept),coalesce(nullif(d->>'legacy_created_at','')::timestamptz,now())) returning id into v_decree;
        v_target:=v_decree;
        insert into public.marginal_notes(sacrament_type,note_type,decree_number,content,parish_id,sacrament_id,note_date,source_type,source_id,decree_id,created_by,status,print_policy,print_default,is_locked,legacy_source)
        values(v_sacrament,'legacy_correction',nullif(d->>'decree_number',''),coalesce(nullif(d->>'original_note',''),'PARTIDA AFECTADA POR DECRETO HISTÓRICO NO. '||coalesce(d->>'decree_number','S/N')||'.'),v_batch.parish_id,v_original,coalesce(v_date,current_date),'decree',v_decree,v_decree,auth.uid(),'active','required',true,true,jsonb_build_object('batch_id',p_batch_id,'row_id',r.id));
        if v_new is not null then
          insert into public.marginal_notes(sacrament_type,note_type,decree_number,content,parish_id,sacrament_id,note_date,source_type,source_id,decree_id,created_by,status,print_policy,print_default,is_locked,legacy_source)
          values(v_sacrament,'legacy_correction_replacement',nullif(d->>'decree_number',''),coalesce(nullif(d->>'replacement_note',''),'PARTIDA CREADA / VINCULADA POR DECRETO HISTÓRICO NO. '||coalesce(d->>'decree_number','S/N')||'.'),v_batch.parish_id,v_new,coalesce(v_date,current_date),'decree',v_decree,v_decree,auth.uid(),'active','required',true,true,jsonb_build_object('batch_id',p_batch_id,'row_id',r.id));
        end if;

      elsif r.target_entity in ('pending_baptism','pending_confirmation','pending_marriage','legacy_marginal_note','legacy_settings') then
        -- Estos perfiles requieren reconciliación humana o sólo preservan referencia.
        raise exception 'Perfil % requiere reconciliación y no se importa automáticamente',r.target_entity;
      else
        raise exception 'Entidad de importación no soportada: %',r.target_entity;
      end if;

      if v_target is not null then
        insert into public.legacy_record_links(source_system,profile_key,source_key,checksum,batch_id,row_id,target_table,target_id,metadata)
        values(v_batch.source_system,v_batch.profile_key,v_source_key,r.checksum,p_batch_id,r.id,r.target_entity,v_target,jsonb_build_object('filename',v_batch.original_filename))
        on conflict(source_system,profile_key,source_key) do update set checksum=excluded.checksum,batch_id=excluded.batch_id,row_id=excluded.row_id,target_table=excluded.target_table,target_id=excluded.target_id,updated_at=now();
      end if;
      update public.legacy_import_rows set status='imported',target_table=r.target_entity,target_id=v_target,imported_at=now(),updated_at=now() where id=r.id;
      v_imported:=v_imported+1;
    exception when others then
      update public.legacy_import_rows set status='error',issue_codes=array_append(coalesce(issue_codes,'{}'::text[]),'IMPORT_ERROR'),issue_details=coalesce(issue_details,'{}'::jsonb)||jsonb_build_object('import_error',sqlerrm),updated_at=now() where id=r.id;
      v_failed:=v_failed+1;
    end;
  end loop;

  update public.legacy_import_batches b set
    imported_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='imported'),
    valid_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='valid'),
    review_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='review'),
    skipped_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status in ('skipped','duplicate')),
    error_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='error'),
    status=case
      when exists(select 1 from public.legacy_import_rows where batch_id=p_batch_id and status='valid') then 'ready'
      when exists(select 1 from public.legacy_import_rows where batch_id=p_batch_id and status in ('review','error')) then 'completed_with_review'
      else 'completed' end,
    updated_at=now()
  where id=p_batch_id;

  insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
  values(auth.uid(),v_batch.parish_id,v_batch.diocese_id,'legacy_import_batch',p_batch_id,'legacy_import_batch_applied',
         jsonb_build_object('imported_this_run',v_imported,'failed_this_run',v_failed),jsonb_build_object('profile_key',v_batch.profile_key,'filename',v_batch.original_filename));

  return query select v_imported,v_failed,(select count(*)::integer from public.legacy_import_rows where batch_id=p_batch_id and status='valid');
end;
$function$
;

-- protected apply_legacy_import_batch_v2
CREATE OR REPLACE FUNCTION public.apply_legacy_import_batch_v2(p_batch_id uuid, p_limit integer DEFAULT 250)
 RETURNS TABLE(imported integer, failed integer, remaining integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_batch public.legacy_import_batches%rowtype; r public.legacy_import_rows%rowtype; d jsonb;
  v_target uuid; v_imported integer:=0; v_failed integer:=0; v_result jsonb;
  v_old record; v_profile text; v_source_name text;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if p_limit<1 or p_limit>1000 then raise exception 'Límite inválido'; end if;
  select * into v_batch from public.legacy_import_batches where id=p_batch_id for update;
  if not found then raise exception 'Lote no encontrado'; end if;
  if upper(coalesce(v_batch.profile_key,''))='ANULACION' then
    raise exception 'ANULACION debe conciliarse en Cancillería desde el origen histórico verificado; no ejecutar efectos registrales mediante importación legacy.' using errcode='42501';
  end if;
  if not public.can_manage_legacy_import(v_batch.parish_id,v_batch.diocese_id) then raise exception 'No autorizado'; end if;
  v_profile:=v_batch.profile_key; v_source_name:=coalesce(nullif(v_batch.source_name,''),v_profile||'.json');

  if v_profile not in ('INSBAUTI','INSCONFI','PARROCOS','OBISPOS','DIOCESIS','IGLESIAS','CIUDADES') then
    select * into v_old from public.apply_legacy_import_batch(p_batch_id,p_limit);
    if v_profile in ('BAUTIZOS','CONFIRMA') then
      perform public.reconcile_legacy_pre_registrations(case when v_profile='BAUTIZOS' then 'INSBAUTI' else 'INSCONFI' end);
    end if;
    imported:=coalesce(v_old.imported,0); failed:=coalesce(v_old.failed,0); remaining:=coalesce(v_old.remaining,0);
    return next; return;
  end if;

  update public.legacy_import_batches set status='importing',updated_at=now() where id=p_batch_id;
  for r in select * from public.legacy_import_rows where batch_id=p_batch_id and status='valid' order by row_number limit p_limit for update skip locked
  loop
    begin
      d:=r.normalized_data; v_target:=null;
      if v_profile in ('INSBAUTI','INSCONFI') then
        insert into public.legacy_pre_sacrament_registrations(
          profile_key,source_sha256,source_key,batch_id,row_id,sacrament_type,legacy_entry_number,source_parish_name,
          inscription_date,celebration_date,names,last_names,birth_date,reported,original_data,normalized_data
        ) values (
          v_profile,coalesce(v_batch.sha256,'NOHASH'),coalesce(r.source_key,r.row_number::text),p_batch_id,r.id,
          case when v_profile='INSBAUTI' then 'baptism' else 'confirmation' end,
          nullif(d->>'legacy_entry_number',''),nullif(d->>'celebration_place',''),nullif(d->>'inscription_date','')::date,
          nullif(d->>'celebration_date','')::date,nullif(d->>'names',''),nullif(d->>'last_names',''),nullif(d->>'birth_date','')::date,
          coalesce((d->>'reported')::boolean,false),coalesce(r.original_data,'{}'::jsonb),d
        ) on conflict(profile_key,source_sha256,source_key) do update set
          batch_id=excluded.batch_id,row_id=excluded.row_id,original_data=excluded.original_data,normalized_data=excluded.normalized_data,
          source_parish_name=excluded.source_parish_name,inscription_date=excluded.inscription_date,celebration_date=excluded.celebration_date,
          names=excluded.names,last_names=excluded.last_names,birth_date=excluded.birth_date,reported=excluded.reported,updated_at=now()
        returning id into v_target;

      elsif v_profile='PARROCOS' then
        insert into public.legacy_priest_directory(source_system,source_name,source_sha256,legacy_code,priest_name,service_start,service_end,legacy_state,legacy_grade,mapping_status,original_data)
        values('legacy_json','PARROCOS.json',v_batch.sha256,nullif(d->>'legacy_code',''),coalesce(nullif(d->>'priest_name',''),'SIN NOMBRE'),
          nullif(d->>'service_start','')::date,nullif(d->>'service_end','')::date,nullif(d->>'legacy_state','')::integer,
          nullif(d->>'legacy_grade',''),'unmapped',coalesce(r.original_data,'{}'::jsonb))
        on conflict(source_system,source_name,legacy_code) do update set source_sha256=excluded.source_sha256,priest_name=excluded.priest_name,
          service_start=excluded.service_start,service_end=excluded.service_end,legacy_state=excluded.legacy_state,
          legacy_grade=excluded.legacy_grade,original_data=excluded.original_data,updated_at=now()
        returning id into v_target;
      elsif v_profile='DIOCESIS' then
        select id into v_target from public.directory_dioceses
        where source_system='SACRAMENTA_PLUS' and legacy_code=nullif(d->>'legacy_code','')
          and lower(name)=lower(coalesce(nullif(d->>'name',''),'SIN NOMBRE')) limit 1;
        if v_target is null then
          insert into public.directory_dioceses(legacy_code,name,nit,address,phone,fax,email,city,bishop_1,bishop_2,source_system,raw_data)
          values(nullif(d->>'legacy_code',''),coalesce(nullif(d->>'name',''),'SIN NOMBRE'),nullif(d->>'nit',''),nullif(d->>'address',''),
            nullif(d->>'phone',''),nullif(d->>'fax',''),nullif(d->>'email',''),nullif(d->>'city',''),nullif(d->>'bishop_1',''),nullif(d->>'bishop_2',''),
            'SACRAMENTA_PLUS',coalesce(r.original_data,'{}'::jsonb)) returning id into v_target;
        else
          update public.directory_dioceses set nit=nullif(d->>'nit',''),address=nullif(d->>'address',''),phone=nullif(d->>'phone',''),
            fax=nullif(d->>'fax',''),email=nullif(d->>'email',''),city=nullif(d->>'city',''),bishop_1=nullif(d->>'bishop_1',''),
            bishop_2=nullif(d->>'bishop_2',''),raw_data=coalesce(r.original_data,'{}'::jsonb),updated_at=now() where id=v_target;
        end if;

      elsif v_profile='IGLESIAS' then
        insert into public.directory_churches(legacy_code,name,nit,address,city,phone,fax,email,priest_name,diocese_legacy_code,source_system,raw_data)
        values(nullif(d->>'legacy_code',''),coalesce(nullif(d->>'name',''),'SIN NOMBRE'),nullif(d->>'nit',''),nullif(d->>'address',''),nullif(d->>'city',''),
          nullif(d->>'phone',''),nullif(d->>'fax',''),nullif(d->>'email',''),nullif(d->>'priest_name',''),nullif(d->>'diocese_legacy_code',''),
          'SACRAMENTA_PLUS',coalesce(r.original_data,'{}'::jsonb))
        on conflict(source_system,legacy_code) where legacy_code is not null do update set
          name=excluded.name,nit=excluded.nit,address=excluded.address,city=excluded.city,phone=excluded.phone,fax=excluded.fax,email=excluded.email,
          priest_name=excluded.priest_name,diocese_legacy_code=excluded.diocese_legacy_code,raw_data=excluded.raw_data,updated_at=now()
        returning id into v_target;
      elsif v_profile='CIUDADES' then
        insert into public.location_dictionary(source,value,usage_count,weight,source_created_at,source_updated_at,source_user,source_system,metadata)
        values(nullif(d->>'source',''),coalesce(nullif(d->>'value',''),'SIN DATO'),coalesce((d->>'usage_count')::integer,0),coalesce((d->>'weight')::integer,0),
          nullif(d->>'source_created_at','')::timestamptz,nullif(d->>'source_updated_at','')::timestamptz,nullif(d->>'source_user',''),
          'SACRAMENTA_PLUS',jsonb_build_object('legacy',coalesce(r.original_data,'{}'::jsonb),'sha256',v_batch.sha256))
        on conflict ((coalesce(source,'')),(lower(value))) do update set usage_count=greatest(public.location_dictionary.usage_count,excluded.usage_count),
          weight=greatest(public.location_dictionary.weight,excluded.weight),metadata=excluded.metadata,updated_at=now()
        returning id into v_target;

      elsif v_profile='OBISPOS' then
        insert into public.legacy_reference_catalog(profile_key,source_sha256,source_key,original_data,normalized_data)
        values(v_profile,coalesce(v_batch.sha256,'NOHASH'),coalesce(r.source_key,r.row_number::text),coalesce(r.original_data,'{}'::jsonb),d)
        on conflict(profile_key,source_sha256,source_key) do update set original_data=excluded.original_data,normalized_data=excluded.normalized_data,updated_at=now()
        returning id into v_target;
      end if;

      if v_target is null then raise exception 'No se pudo materializar la fila legacy'; end if;
      insert into public.legacy_record_links(source_system,profile_key,source_key,checksum,batch_id,row_id,target_table,target_id,metadata)
      values(v_batch.source_system,v_profile,coalesce(r.source_key,r.row_number::text),r.checksum,p_batch_id,r.id,r.target_entity,v_target,
        jsonb_build_object('filename',v_batch.original_filename,'sha256',v_batch.sha256,'scoped_source_key',true))
      on conflict(source_system,profile_key,source_key) do update set checksum=excluded.checksum,batch_id=excluded.batch_id,row_id=excluded.row_id,
        target_table=excluded.target_table,target_id=excluded.target_id,metadata=excluded.metadata,updated_at=now();
      update public.legacy_import_rows set status='imported',target_table=r.target_entity,target_id=v_target,imported_at=now(),updated_at=now() where id=r.id;
      v_imported:=v_imported+1;
    exception when others then
      update public.legacy_import_rows set status='error',issue_codes=array_append(coalesce(issue_codes,'{}'::text[]),'IMPORT_ERROR'),
        issue_details=coalesce(issue_details,'{}'::jsonb)||jsonb_build_object('import_error',sqlerrm),updated_at=now() where id=r.id;
      v_failed:=v_failed+1;
    end;
  end loop;

  if v_profile in ('INSBAUTI','INSCONFI') then
    v_result:=public.reconcile_legacy_pre_registrations(v_profile);
  elsif v_profile in ('DIOCESIS','IGLESIAS') then
    v_result:=public.refresh_legacy_directory_links();
  end if;

  update public.legacy_import_rows lr set issue_details=coalesce(lr.issue_details,'{}'::jsonb)||jsonb_build_object(
    'reconciliation_status',pr.reconciliation_status,'matched_table',pr.matched_table,'matched_record_id',pr.matched_record_id,
    'match_method',pr.match_method,'match_score',pr.match_score)
  from public.legacy_pre_sacrament_registrations pr
  where lr.id=pr.row_id and lr.batch_id=p_batch_id;

  update public.legacy_import_batches b set
    imported_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='imported'),
    valid_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='valid'),
    review_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='review'),
    error_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='error'),
    status=case when exists(select 1 from public.legacy_import_rows where batch_id=p_batch_id and status='valid') then 'ready'
      when exists(select 1 from public.legacy_import_rows where batch_id=p_batch_id and status in ('review','error')) then 'completed_with_review'
      else 'completed' end,
    metadata=coalesce(b.metadata,'{}'::jsonb)||case when v_profile in ('INSBAUTI','INSCONFI') then jsonb_build_object('reconciliation',(
      select jsonb_build_object(
        'matched',count(*) filter(where reconciliation_status='matched'),
        'unmatched',count(*) filter(where reconciliation_status='unmatched'),
        'ambiguous',count(*) filter(where reconciliation_status='ambiguous'),
        'review',count(*) filter(where reconciliation_status='review'))
      from public.legacy_pre_sacrament_registrations where batch_id=p_batch_id)) else '{}'::jsonb end,
    updated_at=now()
  where b.id=p_batch_id;

  insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
  values(auth.uid(),v_batch.parish_id,v_batch.diocese_id,'legacy_import_batch',p_batch_id,'legacy_import_batch_v2_applied',
    jsonb_build_object('imported_this_run',v_imported,'failed_this_run',v_failed,'postprocess',v_result),
    jsonb_build_object('profile_key',v_profile,'filename',v_batch.original_filename,'sha256',v_batch.sha256));

  imported:=v_imported; failed:=v_failed;
  remaining:=(select count(*)::integer from public.legacy_import_rows where batch_id=p_batch_id and status='valid');
  return next;
end;
$function$
;

-- protected apply_legacy_import_batch_v3
CREATE OR REPLACE FUNCTION public.apply_legacy_import_batch_v3(p_batch_id uuid, p_limit integer DEFAULT 250)
 RETURNS TABLE(imported integer, failed integer, remaining integer, reconciled integer, reviewed integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_profile text;
  v_old record;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select upper(coalesce(profile_key,'')) into v_profile
  from public.legacy_import_batches
  where id=p_batch_id;

  if v_profile is null then
    raise exception 'Lote no encontrado';
  end if;

  if v_profile='ANULACION' then
    raise exception 'ANULACION debe conciliarse en Cancillería desde el origen histórico verificado; no ejecutar efectos registrales mediante importación legacy.' using errcode='42501';
  end if;

  select * into v_old
  from public.apply_legacy_import_batch_v2(p_batch_id,p_limit);

  imported:=coalesce(v_old.imported,0);
  failed:=coalesce(v_old.failed,0);
  remaining:=coalesce(v_old.remaining,0);
  reconciled:=0;
  reviewed:=0;
  return next;
end;
$function$
;

-- protected reconcile_legacy_anulacion_batch
CREATE OR REPLACE FUNCTION public.reconcile_legacy_anulacion_batch(p_batch_id uuid, p_limit integer DEFAULT 250)
 RETURNS TABLE(imported integer, failed integer, remaining integer, reconciled integer, reviewed integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_batch public.legacy_import_batches%rowtype;
  r public.legacy_import_rows%rowtype;
  d jsonb;
  v_sacrament text;
  v_original uuid;
  v_new uuid;
  v_decree uuid;
  v_concept_id uuid;
  v_date date;
  v_number text;
  v_original_note text;
  v_new_note text;
  v_imported integer := 0;
  v_failed integer := 0;
  v_reconciled integer := 0;
  v_reviewed integer := 0;
  v_legacy_source jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;
  if p_limit < 1 or p_limit > 1000 then
    raise exception 'Límite inválido';
  end if;

  select * into v_batch
  from public.legacy_import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'Lote no encontrado';
  end if;
  if upper(coalesce(v_batch.profile_key,'')) <> 'ANULACION' then
    raise exception 'Este reconciliador sólo procesa ANULACION';
  end if;
  raise exception 'ANULACION debe conciliarse en Cancillería desde el origen histórico verificado; no ejecutar efectos registrales mediante importación legacy.' using errcode='42501';
  if v_batch.parish_id is null then
    raise exception 'ANULACION requiere una parroquia propietaria';
  end if;
  if not public.can_manage_legacy_import(v_batch.parish_id,v_batch.diocese_id) then
    raise exception 'No autorizado';
  end if;

  update public.legacy_import_batches
  set status='importing',updated_at=now()
  where id=p_batch_id;

  for r in
    select *
    from public.legacy_import_rows
    where batch_id=p_batch_id and status='valid'
    order by row_number
    limit p_limit
    for update skip locked
  loop
    begin
      d := coalesce(r.normalized_data,'{}'::jsonb);
      v_sacrament := lower(coalesce(d->>'sacrament_type','bautismo'));
      v_original := null;
      v_new := null;
      v_decree := null;
      v_concept_id := null;
      v_number := nullif(trim(coalesce(d->>'decree_number','')),'');
      begin
        v_date := nullif(d->>'decree_date','')::date;
      exception when others then
        v_date := null;
      end;

      if v_sacrament in ('bautismo','baptism') then
        v_sacrament := 'bautismo';
        select id into v_original
        from public.baptisms
        where parish_id=v_batch.parish_id
          and public.sacramentum_registry_ref(book_number)=public.sacramentum_registry_ref(d->>'original_book')
          and public.sacramentum_registry_ref(folio)=public.sacramentum_registry_ref(d->>'original_folio')
          and public.sacramentum_registry_ref(number)=public.sacramentum_registry_ref(d->>'original_number')
        limit 1;

        select id into v_new
        from public.baptisms
        where parish_id=v_batch.parish_id
          and public.sacramentum_registry_ref(book_number)=public.sacramentum_registry_ref(d->>'new_book')
          and public.sacramentum_registry_ref(folio)=public.sacramentum_registry_ref(d->>'new_folio')
          and public.sacramentum_registry_ref(number)=public.sacramentum_registry_ref(d->>'new_number')
        limit 1;

      elsif v_sacrament in ('confirmacion','confirmation') then
        v_sacrament := 'confirmacion';
        select id into v_original
        from public.confirmations
        where parish_id=v_batch.parish_id
          and public.sacramentum_registry_ref(book_number)=public.sacramentum_registry_ref(d->>'original_book')
          and public.sacramentum_registry_ref(folio)=public.sacramentum_registry_ref(d->>'original_folio')
          and public.sacramentum_registry_ref(number)=public.sacramentum_registry_ref(d->>'original_number')
        limit 1;

        select id into v_new
        from public.confirmations
        where parish_id=v_batch.parish_id
          and public.sacramentum_registry_ref(book_number)=public.sacramentum_registry_ref(d->>'new_book')
          and public.sacramentum_registry_ref(folio)=public.sacramentum_registry_ref(d->>'new_folio')
          and public.sacramentum_registry_ref(number)=public.sacramentum_registry_ref(d->>'new_number')
        limit 1;

      elsif v_sacrament in ('matrimonio','marriage') then
        v_sacrament := 'matrimonio';
        select id into v_original
        from public.marriages
        where parish_id=v_batch.parish_id
          and public.sacramentum_registry_ref(book_number)=public.sacramentum_registry_ref(d->>'original_book')
          and public.sacramentum_registry_ref(folio)=public.sacramentum_registry_ref(d->>'original_folio')
          and public.sacramentum_registry_ref(number)=public.sacramentum_registry_ref(d->>'original_number')
        limit 1;

        select id into v_new
        from public.marriages
        where parish_id=v_batch.parish_id
          and public.sacramentum_registry_ref(book_number)=public.sacramentum_registry_ref(d->>'new_book')
          and public.sacramentum_registry_ref(folio)=public.sacramentum_registry_ref(d->>'new_folio')
          and public.sacramentum_registry_ref(number)=public.sacramentum_registry_ref(d->>'new_number')
        limit 1;
      else
        raise exception 'Sacramento ANULACION no soportado: %',v_sacrament;
      end if;

      -- Nunca ejecutar una corrección a medias.
      if v_original is null or v_new is null then
        update public.legacy_import_rows
        set status='review',
            issue_codes=array_append(coalesce(issue_codes,'{}'::text[]),'ANULACION_PAIR_NOT_FOUND'),
            issue_details=coalesce(issue_details,'{}'::jsonb) || jsonb_build_object(
              'reason','ANULACION exige localizar la partida original y la nueva antes de ejecutar el decreto',
              'original_found',v_original is not null,
              'replacement_found',v_new is not null,
              'original',jsonb_build_object('book',d->>'original_book','folio',d->>'original_folio','number',d->>'original_number'),
              'replacement',jsonb_build_object('book',d->>'new_book','folio',d->>'new_folio','number',d->>'new_number')
            ),
            updated_at=now()
        where id=r.id;
        v_reviewed := v_reviewed + 1;
        continue;
      end if;

      if v_batch.diocese_id is not null and nullif(d->>'concept_code','') is not null then
        select id into v_concept_id
        from public.conceptos_anulacion
        where diocese_id=v_batch.diocese_id
          and codigo=d->>'concept_code'
          and coalesce(is_active,true)=true
        limit 1;
      end if;

      v_original_note :=
        'PARTIDA ANULADA POR DECRETO DE CORRECCIÓN N.º ' || coalesce(v_number,'S/N') ||
        case when v_date is not null then ' DE FECHA '||to_char(v_date,'DD/MM/YYYY') else '' end ||
        '. NUEVA PARTIDA: LIBRO '||coalesce(d->>'new_book','—')||
        ', FOLIO '||coalesce(d->>'new_folio','—')||
        ', NÚMERO '||coalesce(d->>'new_number','—')||
        case when nullif(d->>'observations','') is not null then '. '||upper(d->>'observations') else '' end;

      v_new_note :=
        'PARTIDA CREADA POR DECRETO DE CORRECCIÓN N.º ' || coalesce(v_number,'S/N') ||
        case when v_date is not null then ' DE FECHA '||to_char(v_date,'DD/MM/YYYY') else '' end ||
        '. SUSTITUYE LA PARTIDA ORIGINAL: LIBRO '||coalesce(d->>'original_book','—')||
        ', FOLIO '||coalesce(d->>'original_folio','—')||
        ', NÚMERO '||coalesce(d->>'original_number','—')||'.';

      -- El decreto se registra sólo DESPUÉS de haber validado las dos partidas.
      if v_number is not null then
        select id into v_decree
        from public.decretos
        where diocese_id=v_batch.diocese_id
          and lower(trim(decree_number))=lower(trim(v_number))
        limit 1;
      end if;

      if v_decree is null then
        insert into public.decretos(
          parish_id,diocese_id,tipo,sacrament_type,decree_number,decree_date,
          original_record_id,replacement_record_id,status,payload,created_at
        )
        values(
          v_batch.parish_id,v_batch.diocese_id,'correccion',v_sacrament,v_number,v_date,
          v_original,v_new,'archived',
          jsonb_build_object(
            'source','ANULACION.DBF',
            'legacyHistorical',true,
            'recordOrigin','legacy_import',
            'issuanceMode','legacy_decree_execution',
            'executionReconciled',true,
            'executionRule','original->anulada; replacement->creada_por_decreto',
            'decreeNumber',v_number,
            'decreeDate',v_date,
            'decreeType','correccion',
            'sacramentType',v_sacrament,
            'conceptCode',d->>'concept_code',
            'originalLocation',jsonb_build_object('book',d->>'original_book','folio',d->>'original_folio','number',d->>'original_number'),
            'replacementLocation',jsonb_build_object('book',d->>'new_book','folio',d->>'new_folio','number',d->>'new_number'),
            'originalRecordId',v_original,
            'replacementRecordId',v_new,
            'originalNote',v_original_note,
            'replacementNote',v_new_note,
            'legacyRaw',coalesce(r.original_data,'{}'::jsonb)
          ) || case when v_concept_id is not null then jsonb_build_object('conceptoAnulacionId',v_concept_id) else '{}'::jsonb end,
          coalesce(nullif(d->>'legacy_created_at','')::timestamptz,now())
        )
        returning id into v_decree;
      else
        update public.decretos
        set parish_id=v_batch.parish_id,
            tipo='correccion',
            sacrament_type=v_sacrament,
            decree_date=coalesce(v_date,decree_date),
            original_record_id=v_original,
            replacement_record_id=v_new,
            status='archived',
            payload=coalesce(payload,'{}'::jsonb) || jsonb_build_object(
              'source','ANULACION.DBF',
              'legacyHistorical',true,
              'recordOrigin','legacy_import',
              'issuanceMode','legacy_decree_execution',
              'executionReconciled',true,
              'executionRule','original->anulada; replacement->creada_por_decreto',
              'originalRecordId',v_original,
              'replacementRecordId',v_new,
              'originalNote',v_original_note,
              'replacementNote',v_new_note
            ) || case when v_concept_id is not null then jsonb_build_object('conceptoAnulacionId',v_concept_id) else '{}'::jsonb end,
            updated_at=now()
        where id=v_decree;
      end if;

      v_legacy_source := jsonb_build_object(
        'batch_id',p_batch_id,
        'row_id',r.id,
        'profile','ANULACION'
      );

      if v_sacrament='bautismo' then
        update public.baptisms
        set status='anulada',
            nota_marginal=case
              when coalesce(nota_marginal,'') ilike '%'||coalesce(v_number,'S/N')||'%' then nota_marginal
              else concat_ws(E'\n\n',nullif(nota_marginal,''),v_original_note)
            end,
            raw_data=coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
              'status','anulada','anulado',true,'annulledByDecree',true,
              'correctionDecree',v_number,'correctionDecreeDate',v_date,
              'correctionReplacementId',v_new,'decreeExecutionSource','ANULACION.DBF'
            ),
            updated_at=now()
        where id=v_original;

        update public.baptisms
        set status=case when lower(coalesce(status,'')) in ('anulada','annulled','deleted') then 'seated' else coalesce(status,'seated') end,
            nota_marginal=case
              when coalesce(nota_marginal,'') ilike '%'||coalesce(v_number,'S/N')||'%' then nota_marginal
              else concat_ws(E'\n\n',nullif(nota_marginal,''),v_new_note)
            end,
            raw_data=coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
              'createdByDecree',true,'created_by_decree',true,'book_type','suplementario',
              'correctionDecree',v_number,'correctionDecreeDate',v_date,
              'originalRecordId',v_original,'decreeExecutionSource','ANULACION.DBF'
            ),
            updated_at=now()
        where id=v_new;

      elsif v_sacrament='confirmacion' then
        update public.confirmations
        set status='anulada',
            nota_marginal=case
              when coalesce(nota_marginal,'') ilike '%'||coalesce(v_number,'S/N')||'%' then nota_marginal
              else concat_ws(E'\n\n',nullif(nota_marginal,''),v_original_note)
            end,
            raw_data=coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
              'status','anulada','anulado',true,'annulledByDecree',true,
              'correctionDecree',v_number,'correctionDecreeDate',v_date,
              'correctionReplacementId',v_new,'decreeExecutionSource','ANULACION.DBF'
            ),
            updated_at=now()
        where id=v_original;

        update public.confirmations
        set status=case when lower(coalesce(status,'')) in ('anulada','annulled','deleted') then 'seated' else coalesce(status,'seated') end,
            nota_marginal=case
              when coalesce(nota_marginal,'') ilike '%'||coalesce(v_number,'S/N')||'%' then nota_marginal
              else concat_ws(E'\n\n',nullif(nota_marginal,''),v_new_note)
            end,
            raw_data=coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
              'createdByDecree',true,'created_by_decree',true,'book_type','suplementario',
              'correctionDecree',v_number,'correctionDecreeDate',v_date,
              'originalRecordId',v_original,'decreeExecutionSource','ANULACION.DBF'
            ),
            updated_at=now()
        where id=v_new;

      elsif v_sacrament='matrimonio' then
        update public.marriages
        set status='anulada',
            raw_data=coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
              'status','anulada','anulado',true,'annulledByDecree',true,
              'correctionDecree',v_number,'correctionDecreeDate',v_date,
              'correctionReplacementId',v_new,'decreeExecutionSource','ANULACION.DBF',
              'notaMarginal',v_original_note
            ),
            updated_at=now()
        where id=v_original;

        update public.marriages
        set status=case when lower(coalesce(status,'')) in ('anulada','annulled','deleted') then 'seated' else coalesce(status,'seated') end,
            raw_data=coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
              'createdByDecree',true,'created_by_decree',true,'book_type','suplementario',
              'correctionDecree',v_number,'correctionDecreeDate',v_date,
              'originalRecordId',v_original,'decreeExecutionSource','ANULACION.DBF',
              'notaMarginal',v_new_note
            ),
            updated_at=now()
        where id=v_new;
      end if;

      -- Notas canónicas, idempotentes por decreto + partida + tipo.
      if not exists (
        select 1 from public.marginal_notes
        where decree_id=v_decree and sacrament_id=v_original
          and note_type in ('correccion_legacy_original','legacy_correction','correccion_anulada')
      ) then
        insert into public.marginal_notes(
          sacrament_type,note_type,decree_number,content,parish_id,sacrament_id,
          note_date,source_type,source_id,decree_id,created_by,status,
          print_policy,print_default,is_locked,legacy_source
        ) values (
          v_sacrament,'correccion_legacy_original',v_number,v_original_note,
          v_batch.parish_id,v_original,coalesce(v_date,current_date),
          'decree',v_decree,v_decree,auth.uid(),'active','required',true,true,v_legacy_source
        );
      end if;

      if not exists (
        select 1 from public.marginal_notes
        where decree_id=v_decree and sacrament_id=v_new
          and note_type in ('correccion_legacy_reemplazo','legacy_correction_replacement','correccion_nueva')
      ) then
        insert into public.marginal_notes(
          sacrament_type,note_type,decree_number,content,parish_id,sacrament_id,
          note_date,source_type,source_id,decree_id,created_by,status,
          print_policy,print_default,is_locked,legacy_source
        ) values (
          v_sacrament,'correccion_legacy_reemplazo',v_number,v_new_note,
          v_batch.parish_id,v_new,coalesce(v_date,current_date),
          'decree',v_decree,v_decree,auth.uid(),'active','required',true,true,v_legacy_source
        );
      end if;

      insert into public.legacy_record_links(
        source_system,profile_key,source_key,checksum,batch_id,row_id,
        target_table,target_id,metadata
      ) values (
        v_batch.source_system,'ANULACION',coalesce(r.source_key,r.row_number::text),
        r.checksum,p_batch_id,r.id,'decree_execution',v_decree,
        jsonb_build_object('original_record_id',v_original,'replacement_record_id',v_new)
      )
      on conflict(source_system,profile_key,source_key) do update
      set checksum=excluded.checksum,batch_id=excluded.batch_id,row_id=excluded.row_id,
          target_table=excluded.target_table,target_id=excluded.target_id,
          metadata=excluded.metadata,updated_at=now();

      update public.legacy_import_rows
      set status='imported',target_table='decree_execution',target_id=v_decree,
          imported_at=now(),
          issue_details=coalesce(issue_details,'{}'::jsonb)||jsonb_build_object(
            'execution','reconciled',
            'original_record_id',v_original,
            'replacement_record_id',v_new,
            'decree_id',v_decree
          ),
          updated_at=now()
      where id=r.id;

      insert into public.registry_audit_log(
        actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
      ) values (
        auth.uid(),v_batch.parish_id,v_batch.diocese_id,'decree',v_decree,
        'reconcile_anulacion_as_decree_execution',
        jsonb_build_object(
          'original_record_id',v_original,'original_status','anulada',
          'replacement_record_id',v_new,'replacement_state','created_by_decree'
        ),
        jsonb_build_object('batch_id',p_batch_id,'row_id',r.id,'profile','ANULACION')
      );

      v_imported := v_imported + 1;
      v_reconciled := v_reconciled + 1;
    exception when others then
      update public.legacy_import_rows
      set status='error',
          issue_codes=array_append(coalesce(issue_codes,'{}'::text[]),'ANULACION_EXECUTION_ERROR'),
          issue_details=coalesce(issue_details,'{}'::jsonb)||jsonb_build_object('import_error',sqlerrm),
          updated_at=now()
      where id=r.id;
      v_failed := v_failed + 1;
    end;
  end loop;

  update public.legacy_import_batches b
  set imported_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='imported'),
      valid_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='valid'),
      review_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='review'),
      error_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='error'),
      status=case
        when exists(select 1 from public.legacy_import_rows where batch_id=p_batch_id and status='valid') then 'ready'
        when exists(select 1 from public.legacy_import_rows where batch_id=p_batch_id and status in ('review','error')) then 'completed_with_review'
        else 'completed'
      end,
      updated_at=now()
  where b.id=p_batch_id;

  imported:=v_imported;
  failed:=v_failed;
  reconciled:=v_reconciled;
  reviewed:=v_reviewed;
  remaining:=(select count(*)::integer from public.legacy_import_rows where batch_id=p_batch_id and status='valid');
  return next;
end;
$function$
;
