-- SACRAMENTUM V21 Â· RETIRO TOTAL DE PRIMERA COMUNIÃ“N DEL SISTEMA ACTIVO
-- 2026-09-25
-- PrecondiciÃ³n auditada en producciÃ³n: 0 partidas, 0 pendientes, 0 lotes,
-- 0 vÃ­nculos, 0 impresiones y 0 notas marginales de Primera ComuniÃ³n.
begin;

do $$
begin
  if exists(select 1 from public.first_communions limit 1) then
    raise exception 'V21 abortada: existen registros en first_communions';
  end if;
  if exists(select 1 from public.pending_first_communions limit 1) then
    raise exception 'V21 abortada: existen registros en pending_first_communions';
  end if;
  if exists(select 1 from public.legacy_import_batches where profile_key in ('COMUNION','INSCOMUN') limit 1) then
    raise exception 'V21 abortada: existen lotes legacy COMUNION/INSCOMUN';
  end if;
  if exists(select 1 from public.legacy_record_links where profile_key in ('COMUNION','INSCOMUN') limit 1) then
    raise exception 'V21 abortada: existen vÃ­nculos legacy COMUNION/INSCOMUN';
  end if;
  if exists(select 1 from public.registry_print_events where lower(coalesce(sacrament_type,'')) in ('primera_comunion','first_communion') limit 1) then
    raise exception 'V21 abortada: existen impresiones de Primera ComuniÃ³n';
  end if;
  if exists(select 1 from public.marginal_notes where lower(coalesce(sacrament_type,'')) in ('primera_comunion','first_communion') limit 1) then
    raise exception 'V21 abortada: existen notas marginales de Primera ComuniÃ³n';
  end if;
end
$$;

-- Limpiar metadatos vacÃ­os heredados en expedientes matrimoniales.
update public.marriages
set raw_data = coalesce(raw_data,'{}'::jsonb)
  - 'novioPrimeraComunion'
  - 'novioPrimeraComunionLugar'
  - 'noviaPrimeraComunion'
  - 'noviaPrimeraComunionLugar'
where coalesce(raw_data,'{}'::jsonb) ?| array[
  'novioPrimeraComunion','novioPrimeraComunionLugar',
  'noviaPrimeraComunion','noviaPrimeraComunionLugar'
];

-- Retirar perfiles y plantillas residuales.
delete from public.legacy_import_profiles
where profile_key in ('COMUNION','INSCOMUN')
   or target_entity in ('first_communion','pending_first_communion');

delete from public.marginal_note_template_clauses
where template_id in (
  select id from public.marginal_note_templates
  where lower(coalesce(sacrament_type,'')) in ('primera_comunion','first_communion')
);
delete from public.marginal_note_templates
where lower(coalesce(sacrament_type,'')) in ('primera_comunion','first_communion');

create or replace function public.apply_legacy_import_batch(
  p_batch_id uuid,
  p_limit integer default 250
)
returns table(imported integer, failed integer, remaining integer)
language plpgsql
security definer
set search_path=public
as $$
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
        insert into public.conceptos_anulacion(diocese_id,seinscribe,gennota,gendocum,enlibro,expide,tipo,concepto,codigo)
        values(v_batch.diocese_id,coalesce((d->>'registers')::boolean,false),coalesce((d->>'generates_note')::boolean,false),coalesce((d->>'generates_document')::boolean,false),coalesce((d->>'book_mode')::integer,0),nullif(d->>'issuer',''),coalesce(nullif(d->>'type',''),'legacy'),coalesce(nullif(d->>'concept',''),'CONCEPTO LEGACY'),coalesce(nullif(d->>'code',''),r.source_key))
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
$$;
revoke all on function public.apply_legacy_import_batch(uuid,integer) from public;
grant execute on function public.apply_legacy_import_batch(uuid,integer) to authenticated;

create or replace function public.create_manual_marginal_note(
  p_parish_id uuid,
  p_sacrament_type text,
  p_sacrament_id uuid,
  p_content text,
  p_note_date date default current_date,
  p_print_policy text default 'optional',
  p_print_default boolean default true,
  p_label text default null,
  p_template_id uuid default null,
  p_variables jsonb default '{}'::jsonb,
  p_clause_snapshot jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text;
  v_id uuid;
  v_diocese uuid;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if p_parish_id is null or p_sacrament_id is null then raise exception 'Parroquia y partida son obligatorias'; end if;
  if nullif(trim(coalesce(p_content,'')),'') is null then raise exception 'El texto de la nota es obligatorio'; end if;
  if lower(coalesce(p_print_policy,'')) not in ('required','optional','internal') then raise exception 'Política de impresión inválida'; end if;

  v_role := public.current_app_role();
  v_diocese := public.current_app_diocese_id();
  if not public.can_access_parish(p_parish_id) then raise exception 'Fuera de jurisdicción'; end if;
  if v_role not in ('parish','chancery','diocese','admin_general') then raise exception 'Rol no autorizado'; end if;
  if v_role='parish' and p_parish_id is distinct from public.current_app_parish_id() then raise exception 'La parroquia sólo puede trabajar su propio archivo'; end if;
  if lower(p_print_policy)='required' and v_role='parish' then
    raise exception 'Las notas de impresión obligatoria requieren autoridad de Cancillería/Diócesis';
  end if;

  -- Asegurar que la partida existe y pertenece al ámbito declarado.
  if lower(p_sacrament_type) in ('bautismo','baptism') then
    if not exists(select 1 from public.baptisms where id=p_sacrament_id and parish_id=p_parish_id) then raise exception 'Bautismo no encontrado'; end if;
  elsif lower(p_sacrament_type) in ('confirmacion','confirmation') then
    if not exists(select 1 from public.confirmations where id=p_sacrament_id and parish_id=p_parish_id) then raise exception 'Confirmación no encontrada'; end if;
  elsif lower(p_sacrament_type) in ('matrimonio','marriage') then
    if not exists(select 1 from public.marriages where id=p_sacrament_id and parish_id=p_parish_id) then raise exception 'Matrimonio no encontrado'; end if;
  elsif lower(p_sacrament_type) in ('exequias','funeral') then
    if not exists(select 1 from public.funerals where id=p_sacrament_id and parish_id=p_parish_id) then raise exception 'Exequias no encontradas'; end if;
  else
    raise exception 'Tipo de registro no admitido';
  end if;

  insert into public.marginal_notes(
    sacrament_type,note_type,content,parish_id,sacrament_id,note_date,source_type,source_id,
    created_by,status,template_id,template_version,print_policy,print_default,is_locked,print_label,
    rendered_variables,clause_snapshot
  )
  select
    lower(p_sacrament_type),'manual',trim(p_content),p_parish_id,p_sacrament_id,coalesce(p_note_date,current_date),
    'manual',null,auth.uid(),'active',p_template_id,t.version,lower(p_print_policy),p_print_default,false,p_label,
    coalesce(p_variables,'{}'::jsonb),coalesce(p_clause_snapshot,'[]'::jsonb)
  from (select 1) x
  left join public.marginal_note_templates t on t.id=p_template_id
  returning id into v_id;

  insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
  values(auth.uid(),p_parish_id,v_diocese,'marginal_note',v_id,'manual_note_created',
         jsonb_build_object('sacrament_type',p_sacrament_type,'sacrament_id',p_sacrament_id,'print_policy',p_print_policy,'content',p_content),
         jsonb_build_object('template_id',p_template_id));

  return v_id;
end;
$$;
revoke all on function public.create_manual_marginal_note(uuid,text,uuid,text,date,text,boolean,text,uuid,jsonb,jsonb) from public;
grant execute on function public.create_manual_marginal_note(uuid,text,uuid,text,date,text,boolean,text,uuid,jsonb,jsonb) to authenticated;

create or replace function public.register_registry_print(
  p_parish_id uuid,
  p_sacrament_type text,
  p_sacrament_id uuid,
  p_document_kind text default 'partida',
  p_selected_note_keys text[] default '{}'::text[],
  p_included_notes jsonb default '[]'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_id uuid; v_type text:=lower(trim(coalesce(p_sacrament_type,'')));
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if not public.can_access_parish(p_parish_id) then raise exception 'Fuera de jurisdicción'; end if;
  if p_sacrament_id is null then raise exception 'Registro requerido'; end if;

  if v_type in ('bautismo','baptism') then
    if not exists(select 1 from public.baptisms where id=p_sacrament_id and parish_id=p_parish_id) then raise exception 'Bautismo no encontrado'; end if;
  elsif v_type in ('confirmacion','confirmation') then
    if not exists(select 1 from public.confirmations where id=p_sacrament_id and parish_id=p_parish_id) then raise exception 'Confirmación no encontrada'; end if;
  elsif v_type in ('matrimonio','marriage') then
    if not exists(select 1 from public.marriages where id=p_sacrament_id and parish_id=p_parish_id) then raise exception 'Matrimonio no encontrado'; end if;
  elsif v_type in ('exequias','funeral') then
    if not exists(select 1 from public.funerals where id=p_sacrament_id and parish_id=p_parish_id) then raise exception 'Exequias no encontradas'; end if;
  else
    raise exception 'Tipo de registro no admitido';
  end if;

  insert into public.registry_print_events(parish_id,sacrament_type,sacrament_id,document_kind,selected_note_keys,included_notes,requested_by,metadata)
  values(p_parish_id,v_type,p_sacrament_id,coalesce(nullif(trim(p_document_kind),''),'partida'),coalesce(p_selected_note_keys,'{}'::text[]),coalesce(p_included_notes,'[]'::jsonb),auth.uid(),coalesce(p_metadata,'{}'::jsonb))
  returning id into v_id;

  insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
  values(auth.uid(),p_parish_id,public.current_app_diocese_id(),'registry_print_event',v_id,'print_requested',
    jsonb_build_object('sacrament_type',v_type,'sacrament_id',p_sacrament_id,'document_kind',p_document_kind),
    jsonb_build_object('selected_note_keys',coalesce(p_selected_note_keys,'{}'::text[]))||coalesce(p_metadata,'{}'::jsonb));
  return v_id;
end;
$$;
revoke all on function public.register_registry_print(uuid,text,uuid,text,text[],jsonb,jsonb) from public;
grant execute on function public.register_registry_print(uuid,text,uuid,text,text[],jsonb,jsonb) to authenticated;

-- RPC exclusivos retirados.
drop function if exists public.create_pending_first_communion(uuid,jsonb);
drop function if exists public.seat_pending_first_communion(uuid);

-- ConfiguraciÃ³n y tablas retiradas.
alter table public.parish_parameters drop column if exists first_communion_params;
drop table if exists public.pending_first_communions;
drop table if exists public.first_communions;

notify pgrst, 'reload schema';
commit;
