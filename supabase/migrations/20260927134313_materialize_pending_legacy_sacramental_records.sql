-- SACRAMENTUM V64
-- Convierte INSBAUTI / INSCONFI en trabajo parroquial moderno.
-- reported=false -> pendiente real.
-- reported=true  -> sólo se concilia con una partida celebrada cuando hay una coincidencia única.

create schema if not exists private;

create or replace function private.materialize_pending_legacy_sacramental_records(
  p_batch_id uuid,
  p_limit integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.legacy_import_batches%rowtype;
  r public.legacy_import_rows%rowtype;
  d jsonb;
  v_profile text;
  v_target uuid;
  v_match uuid;
  v_match_count integer;
  v_imported integer := 0;
  v_reconciled integer := 0;
  v_reviewed integer := 0;
  v_source_key text;
  v_raw jsonb;
  v_date date;
  v_birth date;
  v_remaining integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select * into v_batch
  from public.legacy_import_batches
  where id = p_batch_id;

  if not found then
    raise exception 'Lote histórico no encontrado';
  end if;

  if v_batch.parish_id is null then
    raise exception 'El lote no tiene parroquia propietaria';
  end if;

  if not public.can_access_parish(v_batch.parish_id) then
    raise exception 'Fuera de jurisdicción';
  end if;

  v_profile := upper(coalesce(v_batch.profile_key,''));
  if v_profile not in ('INSBAUTI','INSCONFI') then
    raise exception 'Este materializador sólo admite INSBAUTI o INSCONFI';
  end if;

  for r in
    select *
    from public.legacy_import_rows
    where batch_id = p_batch_id
      and status = 'valid'
      and target_entity in ('pending_baptism','pending_confirmation')
    order by row_number
    limit greatest(1, least(coalesce(p_limit,500), 2000))
    for update skip locked
  loop
    d := coalesce(r.normalized_data,'{}'::jsonb);
    v_source_key := coalesce(r.source_key,r.row_number::text);
    v_target := null;
    v_match := null;
    v_match_count := 0;

    -- Idempotencia entre lotes/importaciones repetidas.
    select l.target_id into v_target
    from public.legacy_record_links l
    where l.source_system = v_batch.source_system
      and l.profile_key = v_batch.profile_key
      and l.source_key = v_source_key
    limit 1;

    if v_target is not null then
      update public.legacy_import_rows
      set status='duplicate', target_id=v_target, imported_at=coalesce(imported_at,now()), updated_at=now()
      where id=r.id;
      continue;
    end if;

    begin
      v_date := nullif(d->>'celebration_date','')::date;
    exception when others then
      v_date := null;
    end;
    begin
      v_birth := nullif(d->>'birth_date','')::date;
    exception when others then
      v_birth := null;
    end;

    if coalesce((d->>'reported')::boolean,false) then
      -- Una boleta reportada ya debería tener partida: nunca crear otro pendiente.
      if v_profile='INSBAUTI' then
        select count(*), min(b.id::text)::uuid
          into v_match_count, v_match
        from public.baptisms b
        where b.parish_id=v_batch.parish_id
          and upper(trim(coalesce(b.nombres,'')))=upper(trim(coalesce(d->>'names','')))
          and upper(trim(coalesce(b.apellidos,'')))=upper(trim(coalesce(d->>'last_names','')))
          and (v_date is null or b.celebration_date=v_date)
          and (v_birth is null or b.fecha_nacimiento=v_birth)
          and lower(coalesce(b.status,'seated')) not in ('anulada','annulled','deleted','reversed','revertida','replaced');
      else
        select count(*), min(c.id::text)::uuid
          into v_match_count, v_match
        from public.confirmations c
        where c.parish_id=v_batch.parish_id
          and upper(trim(coalesce(c.nombres,'')))=upper(trim(coalesce(d->>'names','')))
          and upper(trim(coalesce(c.apellidos,'')))=upper(trim(coalesce(d->>'last_names','')))
          and (v_date is null or c.celebration_date=v_date)
          and (v_birth is null or c.fecha_nacimiento=v_birth)
          and lower(coalesce(c.status,'seated')) not in ('anulada','annulled','deleted','reversed','revertida','replaced');
      end if;

      if v_match_count = 1 and v_match is not null then
        v_target := v_match;
        insert into public.legacy_record_links(
          source_system,profile_key,source_key,checksum,batch_id,row_id,target_table,target_id,metadata
        ) values (
          v_batch.source_system,v_batch.profile_key,v_source_key,r.checksum,p_batch_id,r.id,
          case when v_profile='INSBAUTI' then 'baptisms' else 'confirmations' end,
          v_target,
          jsonb_build_object('filename',v_batch.original_filename,'reconciliation','reported_unique_match')
        )
        on conflict(source_system,profile_key,source_key)
        do update set
          checksum=excluded.checksum,batch_id=excluded.batch_id,row_id=excluded.row_id,
          target_table=excluded.target_table,target_id=excluded.target_id,
          metadata=excluded.metadata,updated_at=now();

        update public.legacy_import_rows
        set status='imported',
            target_table=case when v_profile='INSBAUTI' then 'baptisms' else 'confirmations' end,
            target_id=v_target,
            imported_at=now(),
            issue_codes=array_remove(coalesce(issue_codes,'{}'::text[]),'LEGACY_BOLETA_REPORTED'),
            issue_details=coalesce(issue_details,'{}'::jsonb) || jsonb_build_object('reconciliation','unique_celebrated_match'),
            updated_at=now()
        where id=r.id;
        v_reconciled := v_reconciled + 1;
      else
        update public.legacy_import_rows
        set status='review',
            issue_codes=array_append(
              array_remove(coalesce(issue_codes,'{}'::text[]),'LEGACY_BOLETA_REPORTED'),
              case when v_match_count=0 then 'REPORTED_PARTIDA_NOT_FOUND' else 'REPORTED_PARTIDA_AMBIGUOUS' end
            ),
            issue_details=coalesce(issue_details,'{}'::jsonb) || jsonb_build_object(
              'reconciliation','manual_required',
              'candidate_count',v_match_count
            ),
            updated_at=now()
        where id=r.id;
        v_reviewed := v_reviewed + 1;
      end if;

      continue;
    end if;

    if v_profile='INSBAUTI' then
      v_raw := coalesce(r.original_data,'{}'::jsonb) || jsonb_build_object(
        'legacy_normalized',d,
        'source','legacy_import',
        'sourceFlow','legacy_pending_baptism',
        'numeroRegistro',coalesce(d->>'legacy_entry_number',''),
        'fechaInscripcion',coalesce(d->>'inscription_date',''),
        'fechaSacramento',coalesce(d->>'celebration_date',''),
        'lugarBautismo',coalesce(d->>'celebration_place',''),
        'apellidos',coalesce(d->>'last_names',''),
        'nombres',coalesce(d->>'names',''),
        'fechaNacimiento',coalesce(d->>'birth_date',''),
        'lugarNacimiento',coalesce(d->>'birth_place',''),
        'sexo',coalesce(d->>'gender',''),
        'tipoUnionPadres',coalesce(d->>'parent_union_type',''),
        'nombrePadre',coalesce(d->>'father_name',''),
        'cedulaPadre',coalesce(d->>'father_document',''),
        'nombreMadre',coalesce(d->>'mother_name',''),
        'cedulaMadre',coalesce(d->>'mother_document',''),
        'abuelosPaternos',coalesce(d->>'paternal_grandparents',''),
        'abuelosMaternos',coalesce(d->>'maternal_grandparents',''),
        'padrinos',coalesce(d->>'godparents',''),
        'direccion',coalesce(d->>'address',''),
        'responsable',coalesce(d->>'responsible',''),
        'ministro',coalesce(d->>'minister',''),
        'porDecreto',coalesce((d->>'by_decree')::boolean,false),
        'decretoNumero',coalesce(d->>'decree_number',''),
        'decretoFecha',coalesce(d->>'decree_date',''),
        'decretoExpedido',coalesce(d->>'decree_issuer',''),
        'nuip',coalesce(d->>'nuip',''),
        'serialRegistro',coalesce(d->>'civil_registry_number',''),
        'oficinaRegistro',coalesce(d->>'civil_registry_office',''),
        'fechaExpedicionRegistro',coalesce(d->>'civil_registry_date',''),
        'adulto',coalesce((d->>'adult_baptism')::boolean,false)
      );

      insert into public.pending_baptisms(parish_id,status,reportado,raw_data)
      values(v_batch.parish_id,'pending',false,v_raw)
      returning id into v_target;

      insert into public.legacy_record_links(
        source_system,profile_key,source_key,checksum,batch_id,row_id,target_table,target_id,metadata
      ) values (
        v_batch.source_system,v_batch.profile_key,v_source_key,r.checksum,p_batch_id,r.id,
        'pending_baptisms',v_target,
        jsonb_build_object('filename',v_batch.original_filename,'materialization','pending')
      )
      on conflict(source_system,profile_key,source_key)
      do update set
        checksum=excluded.checksum,batch_id=excluded.batch_id,row_id=excluded.row_id,
        target_table=excluded.target_table,target_id=excluded.target_id,
        metadata=excluded.metadata,updated_at=now();

      update public.legacy_import_rows
      set status='imported',target_table='pending_baptisms',target_id=v_target,imported_at=now(),updated_at=now()
      where id=r.id;
      v_imported := v_imported + 1;

    else
      v_raw := coalesce(r.original_data,'{}'::jsonb) || jsonb_build_object(
        'legacy_normalized',d,
        'source','legacy_import',
        'sourceFlow','legacy_pending_confirmation',
        'numeroRegistro',coalesce(d->>'legacy_entry_number',''),
        'fechaInscripcion',coalesce(d->>'inscription_date',''),
        'fechaSacramento',coalesce(d->>'celebration_date',''),
        'lugarSacramento',coalesce(d->>'celebration_place',''),
        'apellidos',coalesce(d->>'last_names',''),
        'nombres',coalesce(d->>'names',''),
        'fechaNacimiento',coalesce(d->>'birth_date',''),
        'edad',coalesce(d->>'age_text',''),
        'sexo',coalesce(d->>'gender',''),
        'codigoBautizo',coalesce(d->>'baptism_church_code',''),
        'lugarBautismo',coalesce(d->>'baptism_place',''),
        'libroBautismo',coalesce(d->>'baptism_book',''),
        'folioBautismo',coalesce(d->>'baptism_folio',''),
        'numeroBautismo',coalesce(d->>'baptism_number',''),
        'nombrePadre',coalesce(d->>'father_name',''),
        'nombreMadre',coalesce(d->>'mother_name',''),
        'padrinos',coalesce(d->>'sponsor',''),
        'direccion',coalesce(d->>'address',''),
        'responsable',coalesce(d->>'responsible',''),
        'ministro',coalesce(d->>'minister',''),
        'porDecreto',coalesce((d->>'by_decree')::boolean,false),
        'decretoNumero',coalesce(d->>'decree_number',''),
        'decretoFecha',coalesce(d->>'decree_date',''),
        'decretoExpedido',coalesce(d->>'decree_issuer','')
      );

      insert into public.pending_confirmations(parish_id,status,reportado,raw_data)
      values(v_batch.parish_id,'pending',false,v_raw)
      returning id into v_target;

      insert into public.legacy_record_links(
        source_system,profile_key,source_key,checksum,batch_id,row_id,target_table,target_id,metadata
      ) values (
        v_batch.source_system,v_batch.profile_key,v_source_key,r.checksum,p_batch_id,r.id,
        'pending_confirmations',v_target,
        jsonb_build_object('filename',v_batch.original_filename,'materialization','pending')
      )
      on conflict(source_system,profile_key,source_key)
      do update set
        checksum=excluded.checksum,batch_id=excluded.batch_id,row_id=excluded.row_id,
        target_table=excluded.target_table,target_id=excluded.target_id,
        metadata=excluded.metadata,updated_at=now();

      update public.legacy_import_rows
      set status='imported',target_table='pending_confirmations',target_id=v_target,imported_at=now(),updated_at=now()
      where id=r.id;
      v_imported := v_imported + 1;
    end if;
  end loop;

  select count(*) into v_remaining
  from public.legacy_import_rows
  where batch_id=p_batch_id
    and status='valid'
    and target_entity in ('pending_baptism','pending_confirmation');

  update public.legacy_import_batches b
  set imported_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='imported'),
      valid_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='valid'),
      review_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='review'),
      error_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='error'),
      status=case
        when v_remaining>0 then 'ready'
        when exists(select 1 from public.legacy_import_rows where batch_id=p_batch_id and status='review') then 'completed_with_review'
        else 'completed'
      end,
      updated_at=now()
  where b.id=p_batch_id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values (
    auth.uid(),v_batch.parish_id,v_batch.diocese_id,'legacy_import_batch',p_batch_id,
    'legacy_pending_materialized',
    jsonb_build_object('pending_created',v_imported,'reported_reconciled',v_reconciled,'manual_review',v_reviewed),
    jsonb_build_object('profile_key',v_profile,'remaining',v_remaining)
  );

  return jsonb_build_object(
    'imported',v_imported,
    'reconciled',v_reconciled,
    'reviewed',v_reviewed,
    'remaining',v_remaining
  );
end;
$$;

revoke all on function private.materialize_pending_legacy_sacramental_records(uuid,integer) from public;
revoke all on function private.materialize_pending_legacy_sacramental_records(uuid,integer) from anon;
grant usage on schema private to authenticated;
grant execute on function private.materialize_pending_legacy_sacramental_records(uuid,integer) to authenticated;

create or replace function public.materialize_pending_legacy_sacramental_records(
  p_batch_id uuid,
  p_limit integer default 500
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.materialize_pending_legacy_sacramental_records(p_batch_id,p_limit);
$$;

revoke all on function public.materialize_pending_legacy_sacramental_records(uuid,integer) from public;
revoke all on function public.materialize_pending_legacy_sacramental_records(uuid,integer) from anon;
grant execute on function public.materialize_pending_legacy_sacramental_records(uuid,integer) to authenticated;

comment on function public.materialize_pending_legacy_sacramental_records(uuid,integer)
is 'Materializa INSBAUTI/INSCONFI: reported=false crea pendientes modernos; reported=true sólo concilia contra una partida celebrada única.';
