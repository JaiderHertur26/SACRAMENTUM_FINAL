-- SACRAMENTUM V17 · NTMAT001/NTMAT002 · notas históricas matrimoniales
begin;

alter table public.marginal_notes
  alter column note_date drop not null;

insert into public.legacy_import_profiles(
  profile_key,display_name,target_entity,import_mode,requires_parish,mapping,validation_rules,active
) values
  (
    'NTMAT001','Notas históricas de Matrimonio lote 1','legacy_marginal_note','staging',true,
    jsonb_build_object(
      'link_key',jsonb_build_array('libro','folio','numero'),
      'content_field','nota',
      'authority_field','dafe',
      'source_updated_field','actualizad'
    ),
    jsonb_build_object('preserve_text_verbatim',true,'never_infer_note_date',true),
    true
  ),
  (
    'NTMAT002','Notas históricas de Matrimonio lote 2','legacy_marginal_note','staging',true,
    jsonb_build_object(
      'link_key',jsonb_build_array('libro','folio','numero'),
      'content_field','nota',
      'authority_field','dafe',
      'source_updated_field','actualizad'
    ),
    jsonb_build_object('preserve_text_verbatim',true,'never_infer_note_date',true),
    true
  )
on conflict(profile_key) do update set
  display_name=excluded.display_name,
  target_entity=excluded.target_entity,
  import_mode=excluded.import_mode,
  requires_parish=excluded.requires_parish,
  mapping=excluded.mapping,
  validation_rules=excluded.validation_rules,
  active=true,
  updated_at=now();create table if not exists public.legacy_marginal_note_queue(
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete cascade,
  diocese_id uuid references public.dioceses(id) on delete set null,
  profile_key varchar(64) not null,
  source_sha256 varchar(128) not null,
  source_key varchar(700) not null,
  batch_id uuid references public.legacy_import_batches(id) on delete set null,
  row_id uuid references public.legacy_import_rows(id) on delete set null,
  sacrament_type varchar(32) not null default 'matrimonio',
  book_number varchar(64) not null,
  folio varchar(64) not null,
  number varchar(64) not null,
  content text not null,
  legacy_dafe_code varchar(128),
  source_updated_at timestamptz,
  classification varchar(64) not null default 'sin_clasificar',
  status varchar(32) not null default 'pending',
  matched_record_id uuid references public.marriages(id) on delete set null,
  marginal_note_id uuid references public.marginal_notes(id) on delete set null,
  original_data jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_key,source_sha256,source_key),
  check(status in ('pending','matched','ambiguous','error')),
  check(sacrament_type='matrimonio')
);

create index if not exists idx_legacy_marginal_note_queue_ref
on public.legacy_marginal_note_queue(
  parish_id,
  book_number,
  folio,
  number,
  status
);

create unique index if not exists uq_legacy_matrimonial_note_source
on public.marginal_notes(source_type,source_id)
where source_type='legacy_matrimonial_note' and source_id is not null;alter table public.legacy_marginal_note_queue enable row level security;

drop policy if exists legacy_marginal_note_queue_read on public.legacy_marginal_note_queue;
create policy legacy_marginal_note_queue_read
on public.legacy_marginal_note_queue
for select to authenticated
using(
  public.is_app_admin()
  or (
    public.current_app_role() in ('diocese','chancery')
    and diocese_id=public.current_app_diocese_id()
  )
);

revoke insert,update,delete on public.legacy_marginal_note_queue from anon,authenticated;
grant select on public.legacy_marginal_note_queue to authenticated;
grant all on public.legacy_marginal_note_queue to service_role;

create or replace function public.reconcile_legacy_matrimonial_notes(
  p_parish_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  q public.legacy_marginal_note_queue%rowtype;
  v_count integer;
  v_marriage uuid;
  v_note uuid;
  v_matched integer:=0;
  v_pending integer:=0;
  v_ambiguous integer:=0;
begin
  if auth.uid() is not null and p_parish_id is not null
     and not public.can_manage_legacy_import(
       p_parish_id,
       (select diocese_id from public.parishes where id=p_parish_id)
     ) then
    raise exception 'No autorizado para conciliar notas históricas de esta parroquia';
  end if;  for q in
    select *
    from public.legacy_marginal_note_queue
    where status in ('pending','ambiguous')
      and (p_parish_id is null or parish_id=p_parish_id)
    order by created_at,id
    for update
  loop
    select count(*)::integer
      into v_count
    from public.marriages m
    where m.parish_id=q.parish_id
      and public.sacramentum_registry_ref(m.book_number)=q.book_number
      and public.sacramentum_registry_ref(m.folio)=q.folio
      and public.sacramentum_registry_ref(m.number)=q.number;

    v_marriage:=null;
    if v_count=1 then
      select m.id into v_marriage
      from public.marriages m
      where m.parish_id=q.parish_id
        and public.sacramentum_registry_ref(m.book_number)=q.book_number
        and public.sacramentum_registry_ref(m.folio)=q.folio
        and public.sacramentum_registry_ref(m.number)=q.number
      limit 1;
      select id into v_note
      from public.marginal_notes
      where source_type='legacy_matrimonial_note'
        and source_id=q.id
      limit 1;

      if v_note is null then
        insert into public.marginal_notes(
          sacrament_type,note_type,content,parish_id,sacrament_id,note_date,
          source_type,source_id,created_by,status,print_policy,print_default,
          is_locked,print_label,legacy_source,created_at
        ) values (
          'matrimonio',
          'legacy_historical',
          q.content,
          q.parish_id,
          v_marriage,
          null,
          'legacy_matrimonial_note',
          q.id,
          q.created_by,
          'active',
          'internal',
          false,
          true,
          'Nota histórica importada',
          jsonb_build_object(
            'profile_key',q.profile_key,
            'source_sha256',q.source_sha256,
            'source_key',q.source_key,
            'batch_id',q.batch_id,
            'row_id',q.row_id,
            'legacy_dafe_code',q.legacy_dafe_code,
            'source_updated_at',q.source_updated_at,
            'classification',q.classification,
            'historical_note_date_unknown',true,
            'original_data',q.original_data
          ),
          coalesce(q.source_updated_at,now())
        )
        returning id into v_note;
      end if;      update public.legacy_marginal_note_queue
      set status='matched',
          matched_record_id=v_marriage,
          marginal_note_id=v_note,
          metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
            'match_method','book_folio_number_exact',
            'matched_at',now()
          ),
          updated_at=now()
      where id=q.id;
      v_matched:=v_matched+1;

    elsif v_count=0 then
      update public.legacy_marginal_note_queue
      set status='pending',
          matched_record_id=null,
          marginal_note_id=null,
          metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
            'match_method','book_folio_number_exact',
            'last_checked_at',now()
          ),
          updated_at=now()
      where id=q.id;
      v_pending:=v_pending+1;

    else
      update public.legacy_marginal_note_queue
      set status='ambiguous',
          matched_record_id=null,
          marginal_note_id=null,
          metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
            'match_method','book_folio_number_exact',
            'candidate_count',v_count,
            'last_checked_at',now()
          ),
          updated_at=now()
      where id=q.id;
      v_ambiguous:=v_ambiguous+1;
    end if;
  end loop;

  return jsonb_build_object(
    'matched',v_matched,
    'pending',v_pending,
    'ambiguous',v_ambiguous,
    'total_matched',(select count(*) from public.legacy_marginal_note_queue where status='matched' and (p_parish_id is null or parish_id=p_parish_id)),
    'total_pending',(select count(*) from public.legacy_marginal_note_queue where status='pending' and (p_parish_id is null or parish_id=p_parish_id)),
    'total_ambiguous',(select count(*) from public.legacy_marginal_note_queue where status='ambiguous' and (p_parish_id is null or parish_id=p_parish_id))
  );
end;
$$;revoke all on function public.reconcile_legacy_matrimonial_notes(uuid) from public,anon;
grant execute on function public.reconcile_legacy_matrimonial_notes(uuid) to authenticated,service_role;

create or replace function public.apply_legacy_marginal_note_batch(
  p_batch_id uuid,
  p_limit integer default 250
)
returns table(imported integer,failed integer,remaining integer)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_batch public.legacy_import_batches%rowtype;
  r public.legacy_import_rows%rowtype;
  d jsonb;
  v_queue uuid;
  v_imported integer:=0;
  v_failed integer:=0;
  v_updated timestamptz;
  v_reconciliation jsonb;
  v_book text;
  v_folio text;
  v_number text;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if p_limit<1 or p_limit>1000 then raise exception 'Límite inválido'; end if;

  select * into v_batch
  from public.legacy_import_batches
  where id=p_batch_id
  for update;

  if not found then raise exception 'Lote no encontrado'; end if;
  if v_batch.profile_key not in ('NTMAT001','NTMAT002') then
    raise exception 'El lote % no corresponde a notas históricas de Matrimonio',v_batch.profile_key;
  end if;
  if not public.can_manage_legacy_import(v_batch.parish_id,v_batch.diocese_id) then
    raise exception 'No autorizado';
  end if;

  update public.legacy_import_batches
  set status='importing',updated_at=now()
  where id=p_batch_id;  for r in
    select *
    from public.legacy_import_rows
    where batch_id=p_batch_id and status='valid'
    order by row_number
    limit p_limit
    for update skip locked
  loop
    begin
      d:=r.normalized_data;
      v_book:=public.sacramentum_registry_ref(d->>'book_number');
      v_folio:=public.sacramentum_registry_ref(d->>'folio');
      v_number:=public.sacramentum_registry_ref(d->>'number');
      v_updated:=null;

      if v_book is null or v_folio is null or v_number is null then
        raise exception 'Libro/Folio/Número incompletos en nota histórica';
      end if;
      if nullif(trim(d->>'content'),'') is null then
        raise exception 'Texto de nota histórica vacío';
      end if;

      begin
        v_updated:=nullif(d->>'legacy_updated_at','')::timestamptz;
      exception when others then
        v_updated:=null;
      end;

      insert into public.legacy_marginal_note_queue(
        parish_id,diocese_id,profile_key,source_sha256,source_key,batch_id,row_id,
        sacrament_type,book_number,folio,number,content,legacy_dafe_code,
        source_updated_at,classification,status,original_data,metadata,created_by
      ) values (
        v_batch.parish_id,v_batch.diocese_id,v_batch.profile_key,
        coalesce(nullif(v_batch.sha256,''),'NOHASH'),
        coalesce(r.source_key,r.row_number::text),
        p_batch_id,r.id,'matrimonio',
        v_book,v_folio,v_number,d->>'content',nullif(d->>'legacy_dafe_code',''),
        v_updated,coalesce(nullif(d->>'classification',''),'sin_clasificar'),
        'pending',coalesce(r.original_data,'{}'::jsonb),
        jsonb_build_object('filename',v_batch.original_filename,'row_number',r.row_number),
        auth.uid()
      )
      on conflict(profile_key,source_sha256,source_key) do update set
        batch_id=excluded.batch_id,
        row_id=excluded.row_id,
        book_number=excluded.book_number,
        folio=excluded.folio,
        number=excluded.number,
        content=excluded.content,
        legacy_dafe_code=excluded.legacy_dafe_code,
        source_updated_at=excluded.source_updated_at,
        classification=excluded.classification,
        original_data=excluded.original_data,
        metadata=excluded.metadata,
        updated_at=now()
      returning id into v_queue;      insert into public.legacy_record_links(
        source_system,profile_key,source_key,checksum,batch_id,row_id,
        target_table,target_id,metadata
      ) values (
        v_batch.source_system,v_batch.profile_key,coalesce(r.source_key,r.row_number::text),
        r.checksum,p_batch_id,r.id,'legacy_marginal_note_queue',v_queue,
        jsonb_build_object('filename',v_batch.original_filename,'sha256',v_batch.sha256)
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
          target_table='legacy_marginal_note_queue',
          target_id=v_queue,
          imported_at=now(),
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

  v_reconciliation:=public.reconcile_legacy_matrimonial_notes(v_batch.parish_id);  update public.legacy_import_rows lr
  set issue_details=coalesce(lr.issue_details,'{}'::jsonb)||jsonb_build_object(
    'note_link_status',q.status,
    'matched_record_id',q.matched_record_id,
    'marginal_note_id',q.marginal_note_id,
    'classification',q.classification
  )
  from public.legacy_marginal_note_queue q
  where q.row_id=lr.id
    and lr.batch_id=p_batch_id;

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
      metadata=coalesce(b.metadata,'{}'::jsonb)||jsonb_build_object(
        'note_reconciliation',v_reconciliation,
        'note_link_key','book_folio_number_exact',
        'historical_note_date_policy','unknown_unless_explicit'
      ),
      updated_at=now()
  where b.id=p_batch_id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values (
    auth.uid(),v_batch.parish_id,v_batch.diocese_id,
    'legacy_import_batch',p_batch_id,'legacy_matrimonial_notes_applied',
    jsonb_build_object(
      'imported_this_run',v_imported,
      'failed_this_run',v_failed,
      'reconciliation',v_reconciliation
    ),
    jsonb_build_object(
      'profile_key',v_batch.profile_key,
      'filename',v_batch.original_filename,
      'sha256',v_batch.sha256
    )
  );

  imported:=v_imported;
  failed:=v_failed;
  remaining:=(select count(*)::integer from public.legacy_import_rows where batch_id=p_batch_id and status='valid');
  return next;
end;
$$;

revoke all on function public.apply_legacy_marginal_note_batch(uuid,integer) from public,anon;
grant execute on function public.apply_legacy_marginal_note_batch(uuid,integer) to authenticated,service_role;

commit;