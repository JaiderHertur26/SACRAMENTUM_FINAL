-- V124 · Sólo Diócesis puede limpiar sombras sacramentales importadas;
-- Administrador General gestiona jerarquía, no elimina partidas.
CREATE OR REPLACE FUNCTION public.reconcile_legacy_baptism_shadows_v73(p_shadow_parish_id uuid, p_correct_parish_id uuid, p_batch_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text;
  v_diocese uuid;
  v_shadow_diocese uuid;
  v_correct_diocese uuid;
  v_shadow record;
  v_shadow_count integer:=0;
  v_retry_rows integer:=0;
  v_review_rows integer:=0;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if p_shadow_parish_id is null or p_correct_parish_id is null then
    raise exception 'Las dos parroquias son obligatorias';
  end if;
  if p_shadow_parish_id=p_correct_parish_id then
    raise exception 'Las parroquias de origen erróneo y destino correcto deben ser diferentes';
  end if;

  v_role:=public.current_app_role();
  v_diocese:=public.current_app_diocese_id();

  select diocese_id into v_shadow_diocese from public.parishes where id=p_shadow_parish_id;
  select diocese_id into v_correct_diocese from public.parishes where id=p_correct_parish_id;

  if v_shadow_diocese is null or v_correct_diocese is null then
    raise exception 'No se encontró una de las parroquias';
  end if;
  if v_shadow_diocese is distinct from v_correct_diocese then
    raise exception 'Las dos parroquias deben pertenecer a la misma jurisdicción';
  end if;
  if v_role IS DISTINCT FROM 'diocese'
      OR v_diocese IS DISTINCT FROM v_shadow_diocese then
    raise exception 'Sólo Diócesis propietaria puede reconciliar sombras históricas'
      using errcode='42501';
  end if;
  -- Cada fila eliminada debe tener una contraparte exacta en la parroquia correcta.
  for v_shadow in
    select
      s.*,
      m.id correct_baptism_id
    from public.baptisms s
    join public.baptisms m
      on m.parish_id=p_correct_parish_id
     and m.book_number=s.book_number
     and m.folio=s.folio
     and m.number=s.number
     and upper(trim(coalesce(m.nombres,'')))=upper(trim(coalesce(s.nombres,'')))
     and upper(trim(coalesce(m.apellidos,'')))=upper(trim(coalesce(s.apellidos,'')))
     and m.celebration_date is not distinct from s.celebration_date
    where s.parish_id=p_shadow_parish_id
      and lower(coalesce(s.status,'')) in ('reverted','anulada','anulado','annulled')
      and s.raw_data->>'source'='legacy_import'
  loop
    -- Falla si apareciera una referencia activa inesperada.
    if exists(select 1 from public.funerals f where f.baptism_id=v_shadow.id)
       or exists(select 1 from public.pending_funerals f where f.baptism_id=v_shadow.id)
       or exists(select 1 from public.matrimonial_notifications n
                 where n.source_baptism_id=v_shadow.id or n.spouse_baptism_id=v_shadow.id)
       or exists(select 1 from public.matrimonial_notification_recipients r
                 where r.target_baptism_id=v_shadow.id) then
      raise exception 'La sombra % todavía tiene referencias canónicas activas',v_shadow.id;
    end if;

    insert into public.registry_audit_log(
      actor_user_id,parish_id,diocese_id,
      entity_type,entity_id,action,before_data,after_data,metadata
    ) values (
      auth.uid(),p_shadow_parish_id,v_shadow_diocese,
      'baptism',v_shadow.id,'remove_reconciled_legacy_shadow_v73',
      to_jsonb(v_shadow)-'correct_baptism_id',
      jsonb_build_object('correct_baptism_id',v_shadow.correct_baptism_id),
      jsonb_build_object(
        'shadow_parish_id',p_shadow_parish_id,
        'correct_parish_id',p_correct_parish_id,
        'book_number',v_shadow.book_number,
        'folio',v_shadow.folio,
        'number',v_shadow.number,
        'legacy_archive_preserved',true,
        'physical_archive_preserved',true
      )
    );

    delete from public.baptisms where id=v_shadow.id;
    v_shadow_count:=v_shadow_count+1;
  end loop;
  if p_batch_id is not null then
    if not exists(
      select 1
      from public.legacy_import_batches b
      where b.id=p_batch_id
        and b.parish_id=p_shadow_parish_id
        and b.profile_key='BAUTIZOS'
    ) then
      raise exception 'El lote BAUTIZOS no pertenece a la parroquia de sombras';
    end if;

    -- Las colisiones causadas exclusivamente por las sombras retiradas pueden reintentarse.
    update public.legacy_import_rows r
    set
      status='valid',
      issue_codes=array_append(
        array_remove(array_remove(coalesce(r.issue_codes,'{}'::text[]),'IMPORT_ERROR'),'RECOVERED_SHADOW_COLLISION_V73'),
        'RECOVERED_SHADOW_COLLISION_V73'
      ),
      issue_details=(coalesce(r.issue_details,'{}'::jsonb)-'import_error')
        || jsonb_build_object(
          'recovered_shadow_collision_v73',true,
          'recovered_shadow_collision_at_v73',now()
        ),
      updated_at=now()
    where r.batch_id=p_batch_id
      and r.status='error'
      and coalesce(r.issue_details->>'import_error','')
          like 'COLISIÓN REGISTRAL LEGACY:%';

    get diagnostics v_retry_rows=row_count;

    -- Los renglones que sólo dicen ANULADO/ANULADO sin fecha ni identidad
    -- son evidencia física de una posición de libro, no una partida canónica reconstruible.
    update public.legacy_import_rows r
    set
      status='review',
      issue_codes=array_append(
        array_remove(array_remove(coalesce(r.issue_codes,'{}'::text[]),'IMPORT_ERROR'),'LEGACY_ANNULLED_PLACEHOLDER_V73'),
        'LEGACY_ANNULLED_PLACEHOLDER_V73'
      ),
      issue_details=(coalesce(r.issue_details,'{}'::jsonb)-'import_error')
        || jsonb_build_object(
          'legacy_annulled_placeholder_v73',true,
          'reason','Renglón físico ANULADO sin fecha ni identidad suficiente; preservar sin crear sacramento vivo'
        ),
      updated_at=now()
    where r.batch_id=p_batch_id
      and r.status='error'
      and upper(trim(coalesce(r.normalized_data->>'names','')))='ANULADO'
      and upper(trim(coalesce(r.normalized_data->>'last_names','')))='ANULADO'
      and nullif(trim(coalesce(r.normalized_data->>'celebration_date','')),'') is null;

    get diagnostics v_review_rows=row_count;

    update public.legacy_import_batches b
    set
      valid_count=(select count(*) from public.legacy_import_rows r where r.batch_id=b.id and r.status='valid'),
      review_count=(select count(*) from public.legacy_import_rows r where r.batch_id=b.id and r.status='review'),
      error_count=(select count(*) from public.legacy_import_rows r where r.batch_id=b.id and r.status='error'),
      skipped_count=(select count(*) from public.legacy_import_rows r where r.batch_id=b.id and r.status in ('skipped','duplicate')),
      imported_count=(select count(*) from public.legacy_import_rows r where r.batch_id=b.id and r.status='imported'),
      status=case
        when exists(select 1 from public.legacy_import_rows r where r.batch_id=b.id and r.status='valid') then 'ready'
        when exists(select 1 from public.legacy_import_rows r where r.batch_id=b.id and r.status in ('review','error')) then 'completed_with_review'
        else 'completed'
      end,
      metadata=coalesce(b.metadata,'{}'::jsonb)||jsonb_build_object(
        'legacy_shadow_reconciliation_v73',true,
        'legacy_shadow_reconciliation_at_v73',now(),
        'reconciled_shadow_rows_v73',v_shadow_count,
        'retry_rows_v73',v_retry_rows,
        'review_placeholder_rows_v73',v_review_rows
      ),
      updated_at=now()
    where b.id=p_batch_id;
  end if;
  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,
    entity_type,entity_id,action,after_data,metadata
  ) values (
    auth.uid(),p_shadow_parish_id,v_shadow_diocese,
    'legacy_reconciliation',p_batch_id,
    'reconcile_legacy_baptism_shadows_v73',
    jsonb_build_object(
      'removed_shadows',v_shadow_count,
      'retry_rows',v_retry_rows,
      'review_placeholder_rows',v_review_rows
    ),
    jsonb_build_object(
      'shadow_parish_id',p_shadow_parish_id,
      'correct_parish_id',p_correct_parish_id,
      'batch_id',p_batch_id,
      'legacy_archive_preserved',true
    )
  );

  return jsonb_build_object(
    'shadow_parish_id',p_shadow_parish_id,
    'correct_parish_id',p_correct_parish_id,
    'batch_id',p_batch_id,
    'removed_shadows',v_shadow_count,
    'retry_rows',v_retry_rows,
    'review_placeholder_rows',v_review_rows
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reconcile_legacy_confirmation_shadows_v74(p_shadow_parish_id uuid, p_correct_parish_id uuid, p_source_parish_pattern text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text;
  v_diocese uuid;
  v_shadow_diocese uuid;
  v_correct_diocese uuid;
  v_row record;
  v_removed integer:=0;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if p_shadow_parish_id is null or p_correct_parish_id is null then
    raise exception 'Las parroquias son obligatorias';
  end if;
  if nullif(trim(coalesce(p_source_parish_pattern,'')),'') is null then
    raise exception 'El patrón de parroquia fuente es obligatorio';
  end if;
  if length(trim(p_source_parish_pattern))<6
     or position('%' in p_source_parish_pattern)>0
     or position('_' in p_source_parish_pattern)>0 then
    raise exception 'Especifique un nombre fuente literal de al menos seis caracteres, sin comodines';
  end if;

  v_role:=public.current_app_role();
  v_diocese:=public.current_app_diocese_id();

  select diocese_id into v_shadow_diocese from public.parishes where id=p_shadow_parish_id;
  select diocese_id into v_correct_diocese from public.parishes where id=p_correct_parish_id;
  if v_shadow_diocese is null or v_correct_diocese is null then raise exception 'Parroquia no encontrada'; end if;
  if v_shadow_diocese is distinct from v_correct_diocese then raise exception 'Las parroquias deben pertenecer a la misma jurisdicción'; end if;
  if v_role IS DISTINCT FROM 'diocese'
      OR v_diocese IS DISTINCT FROM v_shadow_diocese then
    raise exception 'Sólo Diócesis propietaria puede reconciliar sombras históricas'
      using errcode='42501';
  end if;

  for v_row in
    select s.*,c.id correct_confirmation_id
    from public.confirmations s
    join public.confirmations c
      on c.parish_id=p_correct_parish_id
     and c.book_number=s.book_number
     and c.folio=s.folio
     and c.number=s.number
     and upper(trim(coalesce(c.nombres,'')))=upper(trim(coalesce(s.nombres,'')))
     and upper(trim(coalesce(c.apellidos,'')))=upper(trim(coalesce(s.apellidos,'')))
     and c.celebration_date is not distinct from s.celebration_date
     and lower(coalesce(c.status,'')) in ('seated','active')
    where s.parish_id=p_shadow_parish_id
      and lower(coalesce(s.status,'')) in ('reverted','anulada','anulado','annulled')
      and s.raw_data->>'source'='legacy_import'
      and position(
        upper(trim(p_source_parish_pattern)) in
        upper(coalesce(s.raw_data->>'source_parish_name',s.raw_data->>'lugcon',''))
      )>0
  loop
    insert into public.registry_audit_log(
      actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,before_data,after_data,metadata
    ) values (
      auth.uid(),p_shadow_parish_id,v_shadow_diocese,'confirmation',v_row.id,
      'remove_reconciled_legacy_confirmation_shadow_v74',
      to_jsonb(v_row)-'correct_confirmation_id',
      jsonb_build_object('correct_confirmation_id',v_row.correct_confirmation_id),
      jsonb_build_object(
        'shadow_parish_id',p_shadow_parish_id,
        'correct_parish_id',p_correct_parish_id,
        'source_parish_pattern',p_source_parish_pattern,
        'legacy_archive_preserved',true,
        'physical_archive_preserved',true
      )
    );

    delete from public.confirmations where id=v_row.id;
    v_removed:=v_removed+1;
  end loop;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,action,after_data,metadata
  ) values (
    auth.uid(),p_shadow_parish_id,v_shadow_diocese,'legacy_reconciliation',
    'reconcile_legacy_confirmation_shadows_v74',
    jsonb_build_object('removed_shadows',v_removed),
    jsonb_build_object(
      'shadow_parish_id',p_shadow_parish_id,
      'correct_parish_id',p_correct_parish_id,
      'source_parish_pattern',p_source_parish_pattern,
      'legacy_archive_preserved',true
    )
  );

  return jsonb_build_object(
    'shadow_parish_id',p_shadow_parish_id,
    'correct_parish_id',p_correct_parish_id,
    'removed_shadows',v_removed
  );
end;
$function$
;
