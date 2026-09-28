-- SACRAMENTUM V86
-- ANULACION.DBF NO es un archivo de decretos autónomos.
-- Es una tabla de instrucciones para reconstruir una corrección histórica ya ejecutada:
--   libro/folio/numero       -> partida original, queda ANULADA POR DECRETO
--   newlib/newfol/newnum     -> partida nueva, queda CREADA POR DECRETO / SUPLETORIA
-- El registro en decretos es la trazabilidad de una ejecución válida, nunca el punto de partida.

create or replace function public.reconcile_legacy_anulacion_batch(
  p_batch_id uuid,
  p_limit integer default 250
)
returns table(
  imported integer,
  failed integer,
  remaining integer,
  reconciled integer,
  reviewed integer
)
language plpgsql
security definer
set search_path to 'public'
as $$
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
$$;

revoke all on function public.reconcile_legacy_anulacion_batch(uuid,integer) from public,anon;
grant execute on function public.reconcile_legacy_anulacion_batch(uuid,integer) to authenticated;

-- Wrapper canónico: evita que ANULACION vuelva a caer en el importador genérico antiguo.
create or replace function public.apply_legacy_import_batch_v3(
  p_batch_id uuid,
  p_limit integer default 250
)
returns table(
  imported integer,
  failed integer,
  remaining integer,
  reconciled integer,
  reviewed integer
)
language plpgsql
security definer
set search_path to 'public'
as $$
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
    return query
    select x.imported,x.failed,x.remaining,x.reconciled,x.reviewed
    from public.reconcile_legacy_anulacion_batch(p_batch_id,p_limit) x;
    return;
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
$$;

revoke all on function public.apply_legacy_import_batch_v3(uuid,integer) from public,anon;
grant execute on function public.apply_legacy_import_batch_v3(uuid,integer) to authenticated;

-- Reparación de los decretos ya materializados por V68:
-- completar el efecto en las dos partidas y declarar que el decreto es resultado de ejecución legacy.
do $$
declare
  d record;
  v_original_note text;
  v_new_note text;
begin
  for d in
    select *
    from public.decretos
    where coalesce(payload->>'legacyHistorical','false')='true'
      and (
        payload->>'source'='legacy_reconciliation_v68'
        or payload->>'source'='ANULACION.DBF'
      )
      and original_record_id is not null
      and replacement_record_id is not null
  loop
    v_original_note := coalesce(
      nullif(d.payload->>'originalNote',''),
      'PARTIDA ANULADA POR DECRETO DE CORRECCIÓN N.º '||coalesce(d.decree_number,'S/N')||'.'
    );
    v_new_note := coalesce(
      nullif(d.payload->>'replacementNote',''),
      'PARTIDA CREADA POR DECRETO DE CORRECCIÓN N.º '||coalesce(d.decree_number,'S/N')||'.'
    );

    if lower(coalesce(d.sacrament_type,'')) in ('bautismo','baptism') then
      update public.baptisms
      set status='anulada',
          nota_marginal=case
            when coalesce(nota_marginal,'') ilike '%'||coalesce(d.decree_number,'S/N')||'%' then nota_marginal
            else concat_ws(E'\n\n',nullif(nota_marginal,''),v_original_note)
          end,
          raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object(
            'status','anulada','anulado',true,'annulledByDecree',true,
            'correctionDecree',d.decree_number,'correctionDecreeDate',d.decree_date,
            'correctionReplacementId',d.replacement_record_id,'decreeExecutionSource','ANULACION.DBF'
          ),
          updated_at=now()
      where id=d.original_record_id;

      update public.baptisms
      set status=case when lower(coalesce(status,'')) in ('anulada','annulled','deleted') then 'seated' else coalesce(status,'seated') end,
          nota_marginal=case
            when coalesce(nota_marginal,'') ilike '%'||coalesce(d.decree_number,'S/N')||'%' then nota_marginal
            else concat_ws(E'\n\n',nullif(nota_marginal,''),v_new_note)
          end,
          raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object(
            'createdByDecree',true,'created_by_decree',true,'book_type','suplementario',
            'correctionDecree',d.decree_number,'correctionDecreeDate',d.decree_date,
            'originalRecordId',d.original_record_id,'decreeExecutionSource','ANULACION.DBF'
          ),
          updated_at=now()
      where id=d.replacement_record_id;

    elsif lower(coalesce(d.sacrament_type,'')) in ('confirmacion','confirmation') then
      update public.confirmations
      set status='anulada',
          nota_marginal=case
            when coalesce(nota_marginal,'') ilike '%'||coalesce(d.decree_number,'S/N')||'%' then nota_marginal
            else concat_ws(E'\n\n',nullif(nota_marginal,''),v_original_note)
          end,
          raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object(
            'status','anulada','anulado',true,'annulledByDecree',true,
            'correctionDecree',d.decree_number,'correctionDecreeDate',d.decree_date,
            'correctionReplacementId',d.replacement_record_id,'decreeExecutionSource','ANULACION.DBF'
          ),
          updated_at=now()
      where id=d.original_record_id;

      update public.confirmations
      set status=case when lower(coalesce(status,'')) in ('anulada','annulled','deleted') then 'seated' else coalesce(status,'seated') end,
          nota_marginal=case
            when coalesce(nota_marginal,'') ilike '%'||coalesce(d.decree_number,'S/N')||'%' then nota_marginal
            else concat_ws(E'\n\n',nullif(nota_marginal,''),v_new_note)
          end,
          raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object(
            'createdByDecree',true,'created_by_decree',true,'book_type','suplementario',
            'correctionDecree',d.decree_number,'correctionDecreeDate',d.decree_date,
            'originalRecordId',d.original_record_id,'decreeExecutionSource','ANULACION.DBF'
          ),
          updated_at=now()
      where id=d.replacement_record_id;

    elsif lower(coalesce(d.sacrament_type,'')) in ('matrimonio','marriage') then
      update public.marriages
      set status='anulada',
          raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object(
            'status','anulada','anulado',true,'annulledByDecree',true,
            'correctionDecree',d.decree_number,'correctionDecreeDate',d.decree_date,
            'correctionReplacementId',d.replacement_record_id,'decreeExecutionSource','ANULACION.DBF',
            'notaMarginal',v_original_note
          ),
          updated_at=now()
      where id=d.original_record_id;

      update public.marriages
      set status=case when lower(coalesce(status,'')) in ('anulada','annulled','deleted') then 'seated' else coalesce(status,'seated') end,
          raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object(
            'createdByDecree',true,'created_by_decree',true,'book_type','suplementario',
            'correctionDecree',d.decree_number,'correctionDecreeDate',d.decree_date,
            'originalRecordId',d.original_record_id,'decreeExecutionSource','ANULACION.DBF',
            'notaMarginal',v_new_note
          ),
          updated_at=now()
      where id=d.replacement_record_id;
    end if;

    update public.decretos
    set tipo='correccion',
        payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object(
          'source','ANULACION.DBF',
          'issuanceMode','legacy_decree_execution',
          'executionReconciled',true,
          'executionRule','original->anulada; replacement->creada_por_decreto'
        ),
        updated_at=now()
    where id=d.id;

    if not exists (
      select 1 from public.registry_audit_log
      where entity_id=d.id and action='reconcile_legacy_anulacion_execution_v86'
    ) then
      insert into public.registry_audit_log(
        actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
      ) values (
        null,d.parish_id,d.diocese_id,'decree',d.id,'reconcile_legacy_anulacion_execution_v86',
        jsonb_build_object(
          'original_record_id',d.original_record_id,'original_status','anulada',
          'replacement_record_id',d.replacement_record_id,'replacement_state','created_by_decree'
        ),
        jsonb_build_object('source','ANULACION.DBF','migration','V86')
      );
    end if;
  end loop;
end
$$;

comment on function public.reconcile_legacy_anulacion_batch(uuid,integer) is
'V86: ejecuta ANULACION.DBF como una corrección histórica: localiza las dos partidas, anula la original, marca la nueva como creada por decreto y sólo entonces registra la trazabilidad del decreto.';
