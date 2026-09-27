-- SACRAMENTUM V68 · reconciliación segura de decretos y procedencia documental legacy.
-- No fabrica emisiones históricas. Sólo enlaza definiciones documentales y materializa
-- decretos cuando original/reemplazo pueden resolverse de forma inequívoca.

create or replace function public.reconcile_legacy_document_template_provenance_v68()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_updated integer := 0;
  v_mismatch integer := 0;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  v_role := public.current_app_role();
  if v_role not in ('admin_general','diocese','chancery') then
    raise exception 'No autorizado para reconciliar la biblioteca documental legacy';
  end if;

  with source_rows as (
    select distinct on ((lar.original_data->>'codigo')::text)
      lar.id,
      lar.source_key,
      lar.source_sha256,
      lar.source_origin_id,
      lar.source_installation_id,
      lar.original_data,
      lar.metadata
    from public.legacy_archive_records lar
    where lar.profile_key='CERTIFICADOS'
      and coalesce((lar.original_data->>'_deleted')::boolean,false)=false
      and nullif(trim(lar.original_data->>'codigo'),'') is not null
    order by (lar.original_data->>'codigo')::text, lar.created_at desc
  ),
  changed as (
    update public.document_templates dt
    set metadata = coalesce(dt.metadata,'{}'::jsonb) || jsonb_build_object(
          'legacy_archive_record_id',sr.id,
          'legacy_archive_source_key',sr.source_key,
          'legacy_source_sha256',sr.source_sha256,
          'legacy_source_origin_id',sr.source_origin_id,
          'legacy_source_installation_id',sr.source_installation_id,
          'provenance_verified_v68',true,
          'legacy_text_matches_archive',
            replace(coalesce(dt.template_text,''),E'\r\n',E'\n')
            = replace(coalesce(sr.original_data->>'plantilla',''),E'\r\n',E'\n')
        ),
        updated_at=now()
    from source_rows sr
    where dt.is_legacy=true
      and dt.legacy_code=sr.original_data->>'codigo'
    returning
      dt.id,
      (dt.metadata->>'legacy_text_matches_archive')::boolean as text_match
  )
  select count(*), count(*) filter (where text_match=false)
    into v_updated,v_mismatch
  from changed;

  insert into public.registry_audit_log(
    actor_user_id,entity_type,action,after_data,metadata
  ) values (
    auth.uid(),'document_template', 'reconcile_legacy_template_provenance_v68',
    jsonb_build_object('templates_reconciled',v_updated,'text_mismatches',v_mismatch),
    jsonb_build_object('source_profile','CERTIFICADOS','version','V68')
  );

  return jsonb_build_object(
    'templates_reconciled',v_updated,
    'text_mismatches',v_mismatch
  );
end;
$$;

revoke all on function public.reconcile_legacy_document_template_provenance_v68()
from public,anon;
grant execute on function public.reconcile_legacy_document_template_provenance_v68()
to authenticated;
create or replace function public.materialize_legacy_decrees_v68(
  p_origin_id uuid default null,
  p_limit integer default 1000
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_user_diocese uuid;
  v_chancery uuid;
  v_row public.legacy_archive_records%rowtype;
  v_origin public.legacy_source_origins%rowtype;
  v_parish uuid;
  v_diocese uuid;
  v_concept text;
  v_original_type text;
  v_original_id uuid;
  v_replacement_id uuid;
  v_original_count integer;
  v_replacement_count integer;
  v_decree_id uuid;
  v_decree_date date;
  v_note_original text;
  v_note_replacement text;
  v_payload jsonb;
  v_materialized integer := 0;
  v_review integer := 0;
  v_skipped integer := 0;
  v_limit integer := greatest(1,least(coalesce(p_limit,1000),5000));
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select public.current_app_role(),public.current_app_diocese_id()
    into v_role,v_user_diocese;

  if v_role not in ('admin_general','diocese','chancery') then
    raise exception 'No autorizado para reconciliar decretos legacy';
  end if;

  if v_role='chancery' then
    select up.chancery_id into v_chancery
    from public.user_profiles up
    where up.auth_user_id=auth.uid()
      and coalesce(up.is_active,true)=true
    limit 1;
  end if;

  for v_row in
    select lar.*
    from public.legacy_archive_records lar
    where lar.profile_key='ANULACION'
      and (p_origin_id is null or lar.source_origin_id=p_origin_id)
      and coalesce(lar.reconciliation_status,'archived')
            not in ('materialized_decree','ignored_deleted')
    order by lar.created_at,lar.source_key
    limit v_limit
    for update skip locked
  loop
    if coalesce((v_row.original_data->>'_deleted')::boolean,false) then
      update public.legacy_archive_records
      set reconciliation_status='ignored_deleted',
          metadata=coalesce(metadata,'{}'::jsonb)
            || jsonb_build_object('decree_reconciliation_v68','deleted_source_row'),
          updated_at=now()
      where id=v_row.id;
      v_skipped:=v_skipped+1;
      continue;
    end if;

    select * into v_origin
    from public.legacy_source_origins
    where id=v_row.source_origin_id;

    v_parish := coalesce(v_origin.mapped_parish_id,v_row.parish_id);
    if v_parish is null then
      update public.legacy_archive_records
      set reconciliation_status='review_required',
          metadata=coalesce(metadata,'{}'::jsonb)
            || jsonb_build_object(
              'decree_reconciliation_v68','origin_without_mapped_parish'
            ),
          updated_at=now()
      where id=v_row.id;
      v_review:=v_review+1;
      continue;
    end if;

    select p.diocese_id into v_diocese
    from public.parishes p where p.id=v_parish;

    if v_diocese is null
       or (v_role in ('diocese','chancery')
           and v_user_diocese is distinct from v_diocese) then
      update public.legacy_archive_records
      set reconciliation_status='review_required',
          metadata=coalesce(metadata,'{}'::jsonb)
            || jsonb_build_object(
              'decree_reconciliation_v68','parish_outside_authorized_jurisdiction'
            ),
          updated_at=now()
      where id=v_row.id;
      v_review:=v_review+1;
      continue;
    end if;

    select coalesce(c.original_data->>'concepto','CONCEPTO LEGACY '
      ||coalesce(v_row.original_data->>'codiconcep',''))
      into v_concept
    from public.legacy_archive_records c
    where c.profile_key='CPTOANULA'
      and lpad(coalesce(c.original_data->>'codigo',''),3,'0')
          =lpad(coalesce(v_row.original_data->>'codiconcep',''),3,'0')
    order by c.created_at desc
    limit 1;

    with candidates as (
      select 'bautismo'::text sacrament_type,b.id,b.parish_id,
             b.book_number::text book,b.folio::text folio,b.number::text number
      from public.baptisms b where b.parish_id=v_parish
      union all
      select 'confirmacion',c.id,c.parish_id,c.book_number::text,c.folio::text,c.number::text
      from public.confirmations c where c.parish_id=v_parish
      union all
      select 'matrimonio',m.id,m.parish_id,m.book_number::text,m.folio::text,m.number::text
      from public.marriages m where m.parish_id=v_parish
      union all
      select 'exequias',f.id,f.parish_id,f.book_number::text,f.folio::text,f.number::text
      from public.funerals f where f.parish_id=v_parish
    ),
    hits as (
      select *
      from candidates
      where ltrim(coalesce(book,''),'0')=ltrim(coalesce(v_row.original_data->>'libro',''),'0')
        and ltrim(coalesce(folio,''),'0')=ltrim(coalesce(v_row.original_data->>'folio',''),'0')
        and ltrim(coalesce(number,''),'0')=ltrim(coalesce(v_row.original_data->>'numero',''),'0')
    )
    select count(*),min(sacrament_type),min(id::text)::uuid
      into v_original_count,v_original_type,v_original_id
    from hits;

    if v_original_count<>1 then
      update public.legacy_archive_records
      set reconciliation_status='review_required',
          metadata=coalesce(metadata,'{}'::jsonb)
            || jsonb_build_object(
              'decree_reconciliation_v68','original_match_not_unique',
              'candidate_count',v_original_count,
              'mapped_parish_id',v_parish
            ),
          updated_at=now()
      where id=v_row.id;
      v_review:=v_review+1;
      continue;
    end if;
    v_replacement_count:=0;
    v_replacement_id:=null;

    if nullif(trim(v_row.original_data->>'newlib'),'') is not null
       and nullif(trim(v_row.original_data->>'newfol'),'') is not null
       and nullif(trim(v_row.original_data->>'newnum'),'') is not null then

      if v_original_type='bautismo' then
        select count(*),min(b.id::text)::uuid
          into v_replacement_count,v_replacement_id
        from public.baptisms b
        where b.parish_id=v_parish
          and ltrim(coalesce(b.book_number::text,''),'0')
              =ltrim(v_row.original_data->>'newlib','0')
          and ltrim(coalesce(b.folio::text,''),'0')
              =ltrim(v_row.original_data->>'newfol','0')
          and ltrim(coalesce(b.number::text,''),'0')
              =ltrim(v_row.original_data->>'newnum','0');
      elsif v_original_type='confirmacion' then
        select count(*),min(c.id::text)::uuid
          into v_replacement_count,v_replacement_id
        from public.confirmations c
        where c.parish_id=v_parish
          and ltrim(coalesce(c.book_number::text,''),'0')
              =ltrim(v_row.original_data->>'newlib','0')
          and ltrim(coalesce(c.folio::text,''),'0')
              =ltrim(v_row.original_data->>'newfol','0')
          and ltrim(coalesce(c.number::text,''),'0')
              =ltrim(v_row.original_data->>'newnum','0');
      elsif v_original_type='matrimonio' then
        select count(*),min(m.id::text)::uuid
          into v_replacement_count,v_replacement_id
        from public.marriages m
        where m.parish_id=v_parish
          and ltrim(coalesce(m.book_number::text,''),'0')
              =ltrim(v_row.original_data->>'newlib','0')
          and ltrim(coalesce(m.folio::text,''),'0')
              =ltrim(v_row.original_data->>'newfol','0')
          and ltrim(coalesce(m.number::text,''),'0')
              =ltrim(v_row.original_data->>'newnum','0');
      else
        select count(*),min(f.id::text)::uuid
          into v_replacement_count,v_replacement_id
        from public.funerals f
        where f.parish_id=v_parish
          and ltrim(coalesce(f.book_number::text,''),'0')
              =ltrim(v_row.original_data->>'newlib','0')
          and ltrim(coalesce(f.folio::text,''),'0')
              =ltrim(v_row.original_data->>'newfol','0')
          and ltrim(coalesce(f.number::text,''),'0')
              =ltrim(v_row.original_data->>'newnum','0');
      end if;

      if v_replacement_count<>1 then
        update public.legacy_archive_records
        set reconciliation_status='review_required',
            metadata=coalesce(metadata,'{}'::jsonb)
              || jsonb_build_object(
                'decree_reconciliation_v68','replacement_match_not_unique',
                'candidate_count',v_replacement_count,
                'mapped_parish_id',v_parish
              ),
            updated_at=now()
        where id=v_row.id;
        v_review:=v_review+1;
        continue;
      end if;
    end if;

    if exists(
      select 1 from public.decretos d
      where d.payload->>'legacyArchiveRecordId'=v_row.id::text
    ) then
      update public.legacy_archive_records
      set reconciliation_status='materialized_decree',
          updated_at=now()
      where id=v_row.id;
      v_skipped:=v_skipped+1;
      continue;
    end if;

    begin
      v_decree_date:=coalesce(
        case when coalesce(v_row.original_data->>'fecha','') ~ '^\d{4}-\d{2}-\d{2}$'
             then (v_row.original_data->>'fecha')::date end,
        case when left(coalesce(v_row.original_data->>'fechanul',''),10)
                       ~ '^\d{4}-\d{2}-\d{2}$'
             then left(v_row.original_data->>'fechanul',10)::date end
      );
    exception when others then
      v_decree_date:=null;
    end;

    v_note_original := concat(
      'PARTIDA ANULADA/CORREGIDA SEGÚN ',
      coalesce(v_concept,'DECRETO LEGACY'),
      case when nullif(v_row.original_data->>'decreto','') is not null
        then concat(' N.º ', v_row.original_data->>'decreto') else '' end,
      case when v_decree_date is not null
        then concat(' DE FECHA ', to_char(v_decree_date,'DD/MM/YYYY')) else '' end,
      case when v_replacement_id is not null
        then concat(
          '. NUEVA PARTIDA: LIBRO ', v_row.original_data->>'newlib',
          ', FOLIO ', v_row.original_data->>'newfol',
          ', NÚMERO ', v_row.original_data->>'newnum'
        ) else '' end,
      case when nullif(trim(coalesce(v_row.original_data->>'observacio','')),'') is not null
        then concat('. ', trim(v_row.original_data->>'observacio')) else '' end
    );

    v_note_replacement := concat(
      'PARTIDA GENERADA POR ',
      coalesce(v_concept,'DECRETO LEGACY'),
      case when nullif(v_row.original_data->>'decreto','') is not null
        then concat(' N.º ', v_row.original_data->>'decreto') else '' end,
      '. SUSTITUYE LA PARTIDA LIBRO ', v_row.original_data->>'libro',
      ', FOLIO ', v_row.original_data->>'folio',
      ', NÚMERO ', v_row.original_data->>'numero', '.'
    );

    v_payload:=jsonb_build_object(
      'source','legacy_reconciliation_v68',
      'decreeType','correccion',
      'sacramentType',v_original_type,
      'decreeNumber',v_row.original_data->>'decreto',
      'decreeDate',v_decree_date,
      'conceptCode',v_row.original_data->>'codiconcep',
      'concept',v_concept,
      'originalRecordId',v_original_id,
      'replacementRecordId',v_replacement_id,
      'originalLocation',jsonb_build_object(
        'book',v_row.original_data->>'libro',
        'folio',v_row.original_data->>'folio',
        'number',v_row.original_data->>'numero'
      ),
      'replacementLocation',jsonb_build_object(
        'book',v_row.original_data->>'newlib',
        'folio',v_row.original_data->>'newfol',
        'number',v_row.original_data->>'newnum'
      ),
      'legacyArchiveRecordId',v_row.id,
      'legacySourceOriginId',v_row.source_origin_id,
      'legacySourceInstallationId',v_row.source_installation_id,
      'legacySourceSha256',v_row.source_sha256,
      'legacySourceKey',v_row.source_key,
      'legacyUser',v_row.original_data->>'usuario',
      'legacyRaw',v_row.original_data,
      'originalNote',v_note_original,
      'replacementNote',v_note_replacement
    );

    insert into public.decretos(
      parish_id,diocese_id,chancery_id,tipo,sacrament_type,
      decree_number,decree_date,original_record_id,replacement_record_id,
      status,issued_by,payload
    ) values (
      v_parish,v_diocese,v_chancery,'correccion_legacy',
      v_original_type,
      nullif(trim(v_row.original_data->>'decreto'),''),
      v_decree_date,v_original_id,v_replacement_id,
      'active',auth.uid(),v_payload
    )
    returning id into v_decree_id;

    if not exists(
      select 1 from public.marginal_notes mn
      where mn.sacrament_type=v_original_type
        and mn.sacrament_id=v_original_id
        and mn.source_type='legacy_decree'
        and mn.source_id=v_row.id
    ) then
      insert into public.marginal_notes(
        sacrament_type,note_type,decree_number,content,parish_id,
        sacrament_id,note_date,source_type,source_id,decree_id,
        created_by,status,legacy_source,rendered_variables
      ) values (
        v_original_type,'correccion_legacy_original',
        nullif(trim(v_row.original_data->>'decreto'),''),
        v_note_original,v_parish,v_original_id,v_decree_date,
        'legacy_decree',v_row.id,v_decree_id,auth.uid(),'active',
        jsonb_build_object(
          'archive_record_id',v_row.id,
          'source_origin_id',v_row.source_origin_id,
          'source_sha256',v_row.source_sha256
        ),
        jsonb_build_object('legacy',true)
      );
    end if;

    if v_replacement_id is not null and not exists(
      select 1 from public.marginal_notes mn
      where mn.sacrament_type=v_original_type
        and mn.sacrament_id=v_replacement_id
        and mn.source_type='legacy_decree'
        and mn.source_id=v_row.id
    ) then
      insert into public.marginal_notes(
        sacrament_type,note_type,decree_number,content,parish_id,
        sacrament_id,note_date,source_type,source_id,decree_id,
        created_by,status,legacy_source,rendered_variables
      ) values (
        v_original_type,'correccion_legacy_reemplazo',
        nullif(trim(v_row.original_data->>'decreto'),''),
        v_note_replacement,v_parish,v_replacement_id,v_decree_date,
        'legacy_decree',v_row.id,v_decree_id,auth.uid(),'active',
        jsonb_build_object(
          'archive_record_id',v_row.id,
          'source_origin_id',v_row.source_origin_id,
          'source_sha256',v_row.source_sha256
        ),
        jsonb_build_object('legacy',true)
      );
    end if;

    update public.legacy_archive_records
    set reconciliation_status='materialized_decree',
        metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
          'decree_reconciliation_v68','materialized',
          'decree_id',v_decree_id,
          'original_record_id',v_original_id,
          'replacement_record_id',v_replacement_id,
          'mapped_parish_id',v_parish
        ),
        updated_at=now()
    where id=v_row.id;

    insert into public.registry_audit_log(
      actor_user_id,parish_id,diocese_id,entity_type,entity_id,
      action,after_data,metadata
    ) values (
      auth.uid(),v_parish,v_diocese,'decree',v_decree_id,
      'materialize_legacy_decree_v68',v_payload,
      jsonb_build_object(
        'legacy_archive_record_id',v_row.id,
        'source_origin_id',v_row.source_origin_id
      )
    );

    v_materialized:=v_materialized+1;
  end loop;

  return jsonb_build_object(
    'materialized',v_materialized,
    'review_required',v_review,
    'skipped',v_skipped
  );
end;
$$;

revoke all on function public.materialize_legacy_decrees_v68(uuid,integer)
from public,anon;
grant execute on function public.materialize_legacy_decrees_v68(uuid,integer)
to authenticated;

comment on function public.materialize_legacy_decrees_v68(uuid,integer) is
'Reconstruye decretos legacy sólo cuando la partida original y su reemplazo pueden resolverse de forma única dentro de la parroquia verificada de origen.';
