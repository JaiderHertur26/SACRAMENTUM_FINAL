-- SACRAMENTUM V72 · preparación canónica por origen lógico.
-- Corrige el límite de V60 en instalaciones mixtas: una misma instalación puede contener
-- varias parroquias y copias físicas duplicadas. El Archivo Maestro no se altera.

create or replace function public.legacy_logical_row_key_v72(
  p_source_key text,
  p_original_data jsonb
)
returns text
language sql
immutable
set search_path=''
as $$
  select case
    when coalesce(p_source_key,'') ~ '\|ROW:[0-9]+\|'
      then 'ROW:' || (
        substring(p_source_key from '\|ROW:([0-9]+)\|')::bigint
      )::text
    when trim(coalesce(p_source_key,'')) ~ '^[0-9]+$'
      then 'ROW:' || (trim(p_source_key)::bigint)::text
    when position('|' in coalesce(p_source_key,'')) > 0
      then regexp_replace(coalesce(p_source_key,''),'^.*\|','')
    when nullif(trim(coalesce(p_source_key,'')),'') is not null
      then trim(p_source_key)
    else md5((coalesce(p_original_data,'{}'::jsonb) - '_row_number')::text)
  end;
$$;

create or replace function public.prepare_canonical_legacy_origin_batches_v72(
  p_origin_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_origin public.legacy_source_origins%rowtype;
  v_source public.legacy_source_installations%rowtype;
  v_profile record;
  v_role text;
  v_diocese uuid;
  v_batch_id uuid;
  v_signature text;
  v_created integer:=0;
  v_reused integer:=0;
  v_total_logical integer:=0;
  v_total_physical integer:=0;
  v_batches jsonb:='[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if p_origin_id is null then raise exception 'El origen legacy es obligatorio'; end if;

  v_role:=public.current_app_role();
  v_diocese:=public.current_app_diocese_id();

  select * into v_origin
  from public.legacy_source_origins
  where id=p_origin_id
  for update;

  if v_origin.id is null then raise exception 'Origen legacy no encontrado'; end if;

  select * into v_source
  from public.legacy_source_installations
  where id=v_origin.source_installation_id;

  if v_source.id is null then raise exception 'Instalación legacy no encontrada'; end if;
  if v_role='diocese' and v_source.owner_diocese_id is distinct from v_diocese then
    raise exception 'El origen legacy pertenece a otra jurisdicción';
  elsif v_role not in ('diocese','admin_general') then
    raise exception 'Sólo la Diócesis/Arquidiócesis o el Administrador General puede preparar lotes canónicos';
  end if;

  if v_origin.origin_kind not in ('parish_snapshot','parish_snapshot_family')
     or v_origin.identity_status <> 'verified'
     or v_origin.mapped_parish_id is null then
    raise exception 'El origen debe representar una identidad parroquial verificada y vinculada';
  end if;

  if not exists(
    select 1 from public.parishes p
    where p.id=v_origin.mapped_parish_id
      and p.diocese_id=v_source.owner_diocese_id
  ) then
    raise exception 'La parroquia mapeada no pertenece a la jurisdicción propietaria';
  end if;
  for v_profile in
    with base as (
      select
        upper(a.profile_key) profile_key,
        public.legacy_logical_row_key_v72(a.source_key,a.original_data) logical_key,
        a.row_status,
        a.original_data,
        a.source_sha256,
        a.id archive_record_id,
        p.target_entity,
        p.import_mode,
        row_number() over (
          partition by upper(a.profile_key),
                       public.legacy_logical_row_key_v72(a.source_key,a.original_data)
          order by
            case when lower(coalesce(a.row_status,'archived'))='deleted' then 1 else 0 end,
            a.source_sha256,
            a.id
        ) rn,
        count(*) over (
          partition by upper(a.profile_key),
                       public.legacy_logical_row_key_v72(a.source_key,a.original_data)
        ) evidence_count
      from public.legacy_archive_records a
      join public.legacy_import_profiles p
        on p.profile_key=upper(a.profile_key) and p.active=true
      where a.source_origin_id=p_origin_id
        and upper(a.profile_key) in (
          'BAUTIZOS','CONFIRMA','MATRIMON','DIFUNTOS',
          'INSBAUTI','INSCONFI','INSMATRI',
          'PARROCOS',
          'NTBAU001','NTBAU002','NTCON001','NTMAT001','NTMAT002','NTDEF001',
          'ANULACION',
          'PARAMETROS','MISDATOS','DATOSHIJOS','IMPRESAS','PARTIDAS',
          'COMUNION','INSCOMUN','NTCOM001'
        )
    ),
    logical_rows as (
      select * from base where rn=1
    )
    select
      profile_key,
      min(target_entity) target_entity,
      min(import_mode) import_mode,
      count(*)::integer logical_rows,
      count(*) filter(where lower(coalesce(row_status,'archived'))='deleted')::integer deleted_rows,
      count(*) filter(where lower(coalesce(row_status,'archived'))<>'deleted')::integer active_rows,
      sum(evidence_count)::integer physical_evidence_rows,
      string_agg(logical_key,',' order by logical_key) logical_keys
    from logical_rows
    group by profile_key
    order by profile_key
  loop
    v_signature:=md5(
      p_origin_id::text||'|'||
      v_profile.profile_key||'|'||
      v_profile.logical_rows::text||'|'||
      coalesce(v_profile.logical_keys,'')
    );

    v_batch_id:=null;

    -- Reutiliza primero un lote canónico previo del mismo origen que ya tenga
    -- exactamente el mismo universo lógico. Esto evita duplicar V60/V69.
    select b.id into v_batch_id
    from public.legacy_import_batches b
    where b.source_origin_id=p_origin_id
      and b.profile_key=v_profile.profile_key
      and b.row_count=v_profile.logical_rows
    order by
      case when b.metadata->>'canonical_origin_v72'='true' then 0 else 1 end,
      b.created_at desc
    limit 1;

    if v_batch_id is not null then
      update public.legacy_import_batches
      set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
            'canonical_origin_v72',true,
            'canonical_origin_signature_v72',v_signature,
            'logical_rows_v72',v_profile.logical_rows,
            'physical_evidence_rows_v72',v_profile.physical_evidence_rows,
            'origin_reused_v72',true,
            'origin_reused_at_v72',now()
          ),
          updated_at=now()
      where id=v_batch_id;
      v_reused:=v_reused+1;
    else
      insert into public.legacy_import_batches(
        source_system,source_name,original_filename,profile_key,sha256,
        parish_id,diocese_id,status,
        row_count,valid_count,review_count,imported_count,skipped_count,error_count,
        created_by,metadata,source_installation_id,source_origin_id
      ) values (
        'SACRAMENTA_PLUS',
        coalesce(v_origin.display_name,v_origin.legacy_parish_name,v_source.source_name),
        'CANONICAL_ORIGIN_'||upper(v_origin.origin_key)||'_'||v_profile.profile_key||'.json',
        v_profile.profile_key,
        v_signature,
        v_origin.mapped_parish_id,
        v_source.owner_diocese_id,
        'ready',
        v_profile.logical_rows,
        0,0,0,0,0,
        auth.uid(),
        jsonb_build_object(
          'canonical_origin_v72',true,
          'canonical_origin_signature_v72',v_signature,
          'source_installation_id',v_source.id,
          'source_origin_id',v_origin.id,
          'source_origin_key',v_origin.origin_key,
          'source_identity_status',v_origin.identity_status,
          'modern_parish_id',v_origin.mapped_parish_id,
          'logical_rows_v72',v_profile.logical_rows,
          'physical_evidence_rows_v72',v_profile.physical_evidence_rows,
          'preserved_deleted_rows',v_profile.deleted_rows,
          'target_entity',v_profile.target_entity,
          'import_mode',v_profile.import_mode,
          'prepared_at_v72',now()
        ),
        v_source.id,
        v_origin.id
      )
      returning id into v_batch_id;
      with base as (
        select
          a.*,
          public.legacy_logical_row_key_v72(a.source_key,a.original_data) logical_key,
          public.normalize_legacy_archive_record_v62(a.profile_key,a.original_data) normalized_v72,
          row_number() over (
            partition by public.legacy_logical_row_key_v72(a.source_key,a.original_data)
            order by
              case when lower(coalesce(a.row_status,'archived'))='deleted' then 1 else 0 end,
              a.source_sha256,
              a.id
          ) rn
        from public.legacy_archive_records a
        where a.source_origin_id=p_origin_id
          and upper(a.profile_key)=v_profile.profile_key
      ),
      evidence as (
        select
          public.legacy_logical_row_key_v72(a.source_key,a.original_data) logical_key,
          jsonb_agg(
            jsonb_build_object(
              'archive_record_id',a.id,
              'source_sha256',a.source_sha256,
              'source_key',a.source_key,
              'row_status',a.row_status
            )
            order by a.source_sha256,a.id
          ) physical_evidence
        from public.legacy_archive_records a
        where a.source_origin_id=p_origin_id
          and upper(a.profile_key)=v_profile.profile_key
        group by public.legacy_logical_row_key_v72(a.source_key,a.original_data)
      ),
      chosen as (
        select b.*,e.physical_evidence
        from base b
        join evidence e using(logical_key)
        where b.rn=1
      )
      insert into public.legacy_import_rows(
        batch_id,row_number,source_key,checksum,target_entity,
        original_data,normalized_data,status,issue_codes,issue_details
      )
      select
        v_batch_id,
        row_number() over(order by c.logical_key)::integer,
        v_origin.origin_key||'|'||c.logical_key,
        md5(coalesce(c.original_data,'{}'::jsonb)::text),
        v_profile.target_entity,
        c.original_data,
        c.normalized_v72,
        case
          when lower(coalesce(c.row_status,'archived'))='deleted' then 'skipped'
          when (
            (v_profile.profile_key='MATRIMON'
              and nullif(trim(c.normalized_v72->>'book_number'),'') is null)
            or (
              v_profile.profile_key in ('BAUTIZOS','CONFIRMA','MATRIMON','DIFUNTOS')
              and (
                nullif(trim(c.normalized_v72->>'folio'),'') is null
                or nullif(trim(c.normalized_v72->>'number'),'') is null
              )
            )
            or (
              v_profile.profile_key in ('BAUTIZOS','CONFIRMA','DIFUNTOS')
              and nullif(trim(c.normalized_v72->>'book_number'),'') is null
            )
            or (
              v_profile.profile_key='CONFIRMA'
              and nullif(trim(c.normalized_v72->>'celebration_date'),'') is null
            )
            or (
              v_profile.profile_key='MATRIMON'
              and nullif(trim(c.normalized_v72->>'celebration_date'),'') is null
            )
          ) then 'review'
          else 'valid'
        end,
        case
          when lower(coalesce(c.row_status,'archived'))='deleted'
            then array['CANONICAL_ORIGIN_V72','LEGACY_DELETED_PRESERVED']::text[]
          when (
            (v_profile.profile_key='MATRIMON'
              and nullif(trim(c.normalized_v72->>'book_number'),'') is null)
            or (
              v_profile.profile_key in ('BAUTIZOS','CONFIRMA','MATRIMON','DIFUNTOS')
              and (
                nullif(trim(c.normalized_v72->>'folio'),'') is null
                or nullif(trim(c.normalized_v72->>'number'),'') is null
              )
            )
            or (
              v_profile.profile_key in ('BAUTIZOS','CONFIRMA','DIFUNTOS')
              and nullif(trim(c.normalized_v72->>'book_number'),'') is null
            )
            or (
              v_profile.profile_key in ('CONFIRMA','MATRIMON')
              and nullif(trim(c.normalized_v72->>'celebration_date'),'') is null
            )
          ) then array['CANONICAL_ORIGIN_V72','CANONICAL_REVIEW_V72']::text[]
          else array['CANONICAL_ORIGIN_V72']::text[]
        end,
        jsonb_build_object(
          'canonical_origin_v72',true,
          'logical_key',c.logical_key,
          'source_origin_id',p_origin_id,
          'source_origin_key',v_origin.origin_key,
          'physical_evidence',c.physical_evidence,
          'physical_evidence_count',jsonb_array_length(c.physical_evidence)
        )
      from chosen c
      order by c.logical_key;

      update public.legacy_import_batches b
      set
        valid_count=(select count(*) from public.legacy_import_rows r where r.batch_id=b.id and r.status='valid'),
        review_count=(select count(*) from public.legacy_import_rows r where r.batch_id=b.id and r.status='review'),
        skipped_count=(select count(*) from public.legacy_import_rows r where r.batch_id=b.id and r.status in ('skipped','duplicate')),
        error_count=(select count(*) from public.legacy_import_rows r where r.batch_id=b.id and r.status='error'),
        status=case
          when exists(select 1 from public.legacy_import_rows r where r.batch_id=b.id and r.status='valid') then 'ready'
          when exists(select 1 from public.legacy_import_rows r where r.batch_id=b.id and r.status='review') then 'completed_with_review'
          else 'completed'
        end,
        updated_at=now()
      where b.id=v_batch_id;

      v_created:=v_created+1;
    end if;

    v_total_logical:=v_total_logical+v_profile.logical_rows;
    v_total_physical:=v_total_physical+v_profile.physical_evidence_rows;

    v_batches:=v_batches||jsonb_build_array(jsonb_build_object(
      'profile_key',v_profile.profile_key,
      'batch_id',v_batch_id,
      'logical_rows',v_profile.logical_rows,
      'physical_evidence_rows',v_profile.physical_evidence_rows,
      'active_rows',v_profile.active_rows,
      'deleted_rows',v_profile.deleted_rows
    ));
  end loop;
  update public.legacy_source_origins
  set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
        'canonical_origin_batches_v72',true,
        'canonical_origin_batches_v72_at',now(),
        'canonical_origin_logical_rows_v72',v_total_logical,
        'canonical_origin_physical_evidence_rows_v72',v_total_physical
      ),
      updated_at=now()
  where id=p_origin_id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,
    entity_type,entity_id,action,after_data,metadata
  ) values (
    auth.uid(),v_origin.mapped_parish_id,v_source.owner_diocese_id,
    'legacy_source_origin',p_origin_id,
    'prepare_canonical_legacy_origin_batches_v72',
    jsonb_build_object(
      'created_batches',v_created,
      'reused_batches',v_reused,
      'logical_rows',v_total_logical,
      'physical_evidence_rows',v_total_physical
    ),
    jsonb_build_object(
      'origin_key',v_origin.origin_key,
      'origin_kind',v_origin.origin_kind,
      'legacy_parish_name',v_origin.legacy_parish_name,
      'parish_id',v_origin.mapped_parish_id,
      'physical_evidence_preserved',true
    )
  );

  return jsonb_build_object(
    'origin_id',p_origin_id,
    'origin_key',v_origin.origin_key,
    'parish_id',v_origin.mapped_parish_id,
    'created_batches',v_created,
    'reused_batches',v_reused,
    'logical_rows',v_total_logical,
    'physical_evidence_rows',v_total_physical,
    'batches',v_batches
  );
end;
$$;

revoke all on function public.legacy_logical_row_key_v72(text,jsonb)
from public,anon,authenticated;
revoke all on function public.prepare_canonical_legacy_origin_batches_v72(uuid)
from public,anon;
grant execute on function public.prepare_canonical_legacy_origin_batches_v72(uuid)
to authenticated;

comment on function public.prepare_canonical_legacy_origin_batches_v72(uuid) is
'Prepara lotes canónicos por origen parroquial verificado, deduplicando copias físicas por huella lógica y conservando todas las evidencias físicas sin mezclar parroquias.';
