-- SACRAMENTUM V68
-- Materialización directa de notas marginales históricas en la estructura moderna.
-- No crea archivo paralelo: vincula únicamente por parroquia + Libro/Folio/Número exactos.
-- Cero o múltiples coincidencias pasan a revisión manual sin alterar partidas.

update public.legacy_import_profiles
set target_entity='marginal_note',
    import_mode='direct_link',
    display_name=case profile_key
      when 'NTBAU001' then 'Nota de Matrimonio en Bautismo'
      when 'NTBAU002' then 'Notas marginales de Bautismo'
      when 'NTCON001' then 'Notas marginales de Confirmación'
      when 'NTMAT001' then 'Notas estructuradas de Matrimonio'
      when 'NTMAT002' then 'Notas marginales de Matrimonio'
      when 'NTDEF001' then 'Notas marginales de Exequias'
      else display_name
    end,
    updated_at=now()
where profile_key in ('NTBAU001','NTBAU002','NTCON001','NTMAT001','NTMAT002','NTDEF001');

create or replace function public.apply_legacy_marginal_note_batch(
  p_batch_id uuid,
  p_limit integer default 250
)
returns table(imported integer, failed integer, remaining integer)
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_batch public.legacy_import_batches%rowtype;
  r public.legacy_import_rows%rowtype;
  d jsonb;
  v_imported integer:=0;
  v_failed integer:=0;
  v_reviewed integer:=0;
  v_book text;
  v_folio text;
  v_number text;
  v_sacrament text;
  v_match_count integer;
  v_target uuid;
  v_note uuid;
  v_existing uuid;
  v_source_key text;
  v_classification text;
  v_content text;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if p_limit<1 or p_limit>1000 then raise exception 'Límite inválido'; end if;

  select * into v_batch
  from public.legacy_import_batches
  where id=p_batch_id
  for update;

  if not found then raise exception 'Lote no encontrado'; end if;
  if v_batch.profile_key not in ('NTBAU001','NTBAU002','NTCON001','NTMAT001','NTMAT002','NTDEF001') then
    raise exception 'El lote % no corresponde a notas marginales sacramentales soportadas',v_batch.profile_key;
  end if;
  if v_batch.parish_id is null then raise exception 'Parroquia destino requerida'; end if;
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
      d:=coalesce(r.normalized_data,'{}'::jsonb);
      v_source_key:=coalesce(nullif(r.source_key,''),r.row_number::text);
      v_book:=public.sacramentum_registry_ref(d->>'book_number');
      v_folio:=public.sacramentum_registry_ref(d->>'folio');
      v_number:=public.sacramentum_registry_ref(d->>'number');
      v_content:=nullif(trim(d->>'content'),'');
      v_classification:=coalesce(nullif(trim(d->>'classification'),''),'historical_note');
      v_target:=null;
      v_note:=null;
      v_existing:=null;
      v_match_count:=0;

      v_sacrament:=lower(coalesce(nullif(trim(d->>'sacrament_type'),''),
        case
          when v_batch.profile_key like 'NTBAU%' then 'bautismo'
          when v_batch.profile_key='NTCON001' then 'confirmacion'
          when v_batch.profile_key like 'NTMAT%' then 'matrimonio'
          when v_batch.profile_key='NTDEF001' then 'exequias'
          else null
        end
      ));

      if v_sacrament in ('baptism','bautizo') then v_sacrament:='bautismo'; end if;
      if v_sacrament in ('confirmation','confirmación') then v_sacrament:='confirmacion'; end if;
      if v_sacrament in ('marriage') then v_sacrament:='matrimonio'; end if;
      if v_sacrament in ('funeral','funerals','exequia') then v_sacrament:='exequias'; end if;

      if v_sacrament not in ('bautismo','confirmacion','matrimonio','exequias') then
        raise exception 'Sacramento no soportado en nota histórica';
      end if;
      if v_book is null or v_folio is null or v_number is null then
        raise exception 'Libro/Folio/Número incompletos en nota histórica';
      end if;
      if v_content is null then
        raise exception 'Texto de nota histórica vacío';
      end if;

      select l.target_id into v_existing
      from public.legacy_record_links l
      where l.source_system=v_batch.source_system
        and l.profile_key=v_batch.profile_key
        and l.source_key=v_source_key
        and l.target_table='marginal_notes'
      limit 1;

      if v_existing is not null and exists(select 1 from public.marginal_notes mn where mn.id=v_existing) then
        update public.legacy_import_rows
        set status='duplicate',
            target_table='marginal_notes',
            target_id=v_existing,
            imported_at=coalesce(imported_at,now()),
            issue_details=coalesce(issue_details,'{}'::jsonb)||jsonb_build_object(
              'note_link_status','already_materialized',
              'marginal_note_id',v_existing
            ),
            updated_at=now()
        where id=r.id;
        continue;
      end if;

      if v_sacrament='bautismo' then
        select count(*) into v_match_count
        from public.baptisms
        where parish_id=v_batch.parish_id
          and public.sacramentum_registry_ref(book_number)=v_book
          and public.sacramentum_registry_ref(folio)=v_folio
          and public.sacramentum_registry_ref(number)=v_number;
        if v_match_count=1 then
          select id into v_target
          from public.baptisms
          where parish_id=v_batch.parish_id
            and public.sacramentum_registry_ref(book_number)=v_book
            and public.sacramentum_registry_ref(folio)=v_folio
            and public.sacramentum_registry_ref(number)=v_number
          limit 1;
        end if;
      elsif v_sacrament='confirmacion' then
        select count(*) into v_match_count
        from public.confirmations
        where parish_id=v_batch.parish_id
          and public.sacramentum_registry_ref(book_number)=v_book
          and public.sacramentum_registry_ref(folio)=v_folio
          and public.sacramentum_registry_ref(number)=v_number;
        if v_match_count=1 then
          select id into v_target
          from public.confirmations
          where parish_id=v_batch.parish_id
            and public.sacramentum_registry_ref(book_number)=v_book
            and public.sacramentum_registry_ref(folio)=v_folio
            and public.sacramentum_registry_ref(number)=v_number
          limit 1;
        end if;
      elsif v_sacrament='matrimonio' then
        select count(*) into v_match_count
        from public.marriages
        where parish_id=v_batch.parish_id
          and public.sacramentum_registry_ref(book_number)=v_book
          and public.sacramentum_registry_ref(folio)=v_folio
          and public.sacramentum_registry_ref(number)=v_number;
        if v_match_count=1 then
          select id into v_target
          from public.marriages
          where parish_id=v_batch.parish_id
            and public.sacramentum_registry_ref(book_number)=v_book
            and public.sacramentum_registry_ref(folio)=v_folio
            and public.sacramentum_registry_ref(number)=v_number
          limit 1;
        end if;
      else
        select count(*) into v_match_count
        from public.funerals
        where parish_id=v_batch.parish_id
          and public.sacramentum_registry_ref(book_number)=v_book
          and public.sacramentum_registry_ref(folio)=v_folio
          and public.sacramentum_registry_ref(number)=v_number;
        if v_match_count=1 then
          select id into v_target
          from public.funerals
          where parish_id=v_batch.parish_id
            and public.sacramentum_registry_ref(book_number)=v_book
            and public.sacramentum_registry_ref(folio)=v_folio
            and public.sacramentum_registry_ref(number)=v_number
          limit 1;
        end if;
      end if;

      if v_match_count<>1 or v_target is null then
        update public.legacy_import_rows
        set status='review',
            issue_codes=array(
              select distinct x
              from unnest(
                coalesce(issue_codes,'{}'::text[])
                || case when v_match_count=0
                        then array['NOTE_TARGET_NOT_FOUND']::text[]
                        else array['NOTE_TARGET_AMBIGUOUS']::text[]
                   end
              ) x
            ),
            issue_details=coalesce(issue_details,'{}'::jsonb)||jsonb_build_object(
              'note_link_status',case when v_match_count=0 then 'not_found' else 'ambiguous' end,
              'sacrament_type',v_sacrament,
              'book_number',v_book,
              'folio',v_folio,
              'number',v_number,
              'match_count',v_match_count
            ),
            reviewed_at=now(),
            updated_at=now()
        where id=r.id;
        v_reviewed:=v_reviewed+1;
        continue;
      end if;

      select mn.id into v_note
      from public.marginal_notes mn
      where mn.source_type='legacy_import'
        and mn.source_id=r.id
        and mn.sacrament_type=v_sacrament
        and mn.sacrament_id=v_target
      limit 1;

      if v_note is null then
        insert into public.marginal_notes(
          sacrament_type,note_type,content,parish_id,sacrament_id,note_date,
          source_type,source_id,created_by,status,print_policy,print_default,
          is_locked,print_label,legacy_source
        ) values (
          v_sacrament,
          left(v_classification,80),
          v_content,
          v_batch.parish_id,
          v_target,
          null,
          'legacy_import',
          r.id,
          auth.uid(),
          'active',
          'optional',
          true,
          true,
          case v_sacrament
            when 'bautismo' then 'Nota histórica de Bautismo'
            when 'confirmacion' then 'Nota histórica de Confirmación'
            when 'matrimonio' then 'Nota histórica de Matrimonio'
            else 'Nota histórica de Exequias'
          end,
          jsonb_build_object(
            'batch_id',p_batch_id,
            'row_id',r.id,
            'profile_key',v_batch.profile_key,
            'source_key',v_source_key,
            'filename',v_batch.original_filename,
            'sha256',v_batch.sha256,
            'book_number',v_book,
            'folio',v_folio,
            'number',v_number,
            'legacy_dafe_code',d->>'legacy_dafe_code',
            'legacy_updated_at',d->>'legacy_updated_at',
            'classification',v_classification,
            'normalized_data',d,
            'original_data',coalesce(r.original_data,'{}'::jsonb)
          )
        )
        returning id into v_note;
      end if;

      insert into public.legacy_record_links(
        source_system,profile_key,source_key,checksum,batch_id,row_id,
        target_table,target_id,metadata
      ) values (
        v_batch.source_system,v_batch.profile_key,v_source_key,r.checksum,
        p_batch_id,r.id,'marginal_notes',v_note,
        jsonb_build_object(
          'filename',v_batch.original_filename,
          'sha256',v_batch.sha256,
          'sacrament_type',v_sacrament,
          'sacrament_id',v_target,
          'link_key','parish_book_folio_number_exact'
        )
      )
      on conflict(source_system,profile_key,source_key) do update set
        checksum=excluded.checksum,
        batch_id=excluded.batch_id,
        row_id=excluded.row_id,
        target_table=excluded.target_table,
        target_id=excluded.target_id,
        metadata=excluded.metadata,
        updated_at=now();

      update public.legacy_import_rows
      set status='imported',
          target_table='marginal_notes',
          target_id=v_note,
          imported_at=now(),
          issue_details=coalesce(issue_details,'{}'::jsonb)||jsonb_build_object(
            'note_link_status','linked',
            'sacrament_type',v_sacrament,
            'matched_record_id',v_target,
            'marginal_note_id',v_note,
            'link_key','parish_book_folio_number_exact'
          ),
          updated_at=now()
      where id=r.id;

      v_imported:=v_imported+1;
    exception when others then
      update public.legacy_import_rows
      set status='error',
          issue_codes=array_append(coalesce(issue_codes,'{}'::text[]),'IMPORT_ERROR'),
          issue_details=coalesce(issue_details,'{}'::jsonb)||jsonb_build_object('import_error',sqlerrm),
          updated_at=now()
      where id=r.id;
      v_failed:=v_failed+1;
    end;
  end loop;

  update public.legacy_import_batches b
  set imported_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='imported'),
      valid_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='valid'),
      review_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='review'),
      skipped_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status in ('skipped','duplicate')),
      error_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='error'),
      status=case
        when exists(select 1 from public.legacy_import_rows where batch_id=p_batch_id and status='valid') then 'ready'
        when exists(select 1 from public.legacy_import_rows where batch_id=p_batch_id and status in ('review','error')) then 'completed_with_review'
        else 'completed'
      end,
      metadata=coalesce(b.metadata,'{}'::jsonb)||jsonb_build_object(
        'direct_marginal_note_materialization',true,
        'note_link_key','parish_book_folio_number_exact',
        'notes_imported_this_run',v_imported,
        'notes_reviewed_this_run',v_reviewed,
        'notes_failed_this_run',v_failed
      ),
      updated_at=now()
  where b.id=p_batch_id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values (
    auth.uid(),v_batch.parish_id,v_batch.diocese_id,
    'legacy_import_batch',p_batch_id,'legacy_sacramental_notes_materialized',
    jsonb_build_object(
      'imported_this_run',v_imported,
      'reviewed_this_run',v_reviewed,
      'failed_this_run',v_failed
    ),
    jsonb_build_object(
      'profile_key',v_batch.profile_key,
      'filename',v_batch.original_filename,
      'sha256',v_batch.sha256,
      'target_table','marginal_notes',
      'link_key','parish_book_folio_number_exact'
    )
  );

  imported:=v_imported;
  failed:=v_failed;
  remaining:=(select count(*)::integer from public.legacy_import_rows where batch_id=p_batch_id and status='valid');
  return next;
end;
$$;

revoke all on function public.apply_legacy_marginal_note_batch(uuid,integer) from public,anon;
grant execute on function public.apply_legacy_marginal_note_batch(uuid,integer) to authenticated;

comment on function public.apply_legacy_marginal_note_batch(uuid,integer)
is 'Materializa notas marginales históricas de Bautismo, Confirmación, Matrimonio y Exequias directamente en marginal_notes usando coincidencia exacta única por parroquia + Libro/Folio/Número.';
